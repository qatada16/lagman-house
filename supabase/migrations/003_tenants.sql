-- Migration 003: full per-admin segregation (tenants), tokenised public menu,
-- expenses ledger and stock purchases. Run after 002. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tenant helper
-- ---------------------------------------------------------------------------
create or replace function public.tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case when role = 'admin' then id else admin_id end
  from public.profiles where id = auth.uid();
$$;
grant execute on function public.tenant_id() to authenticated, anon;

create or replace function public.new_menu_token() returns text
language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;

alter table public.profiles add column if not exists menu_token text unique;
alter table public.profiles add column if not exists menu_is_default boolean not null default false;
create unique index if not exists profiles_default_menu_idx on public.profiles(menu_is_default) where menu_is_default;
update public.profiles set menu_token = public.new_menu_token() where role = 'admin' and menu_token is null;

-- ---------------------------------------------------------------------------
-- admin_id on every tenant table + backfill to the earliest admin
-- ---------------------------------------------------------------------------
alter table public.categories add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.menu_items add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.menu_item_variants add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.stock_items add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.stock_links add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.receipt_templates add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.order_items add column if not exists admin_id uuid;
alter table public.customer_orders add column if not exists admin_id uuid references public.profiles(id) on delete cascade;
alter table public.stock_movements add column if not exists admin_id uuid;

do $$
declare v_admin uuid;
begin
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then return; end if;
  update public.categories set admin_id = v_admin where admin_id is null;
  update public.menu_items set admin_id = v_admin where admin_id is null;
  update public.menu_item_variants v set admin_id = coalesce((select admin_id from public.menu_items m where m.id = v.menu_item_id), v_admin) where v.admin_id is null;
  update public.stock_items set admin_id = v_admin where admin_id is null;
  update public.stock_links l set admin_id = coalesce((select admin_id from public.menu_items m where m.id = l.menu_item_id), v_admin) where l.admin_id is null;
  update public.receipt_templates set admin_id = v_admin where admin_id is null;
  update public.orders set admin_id = v_admin where admin_id is null;
  update public.order_items oi set admin_id = (select admin_id from public.orders o where o.id = oi.order_id) where oi.admin_id is null;
  update public.customer_orders set admin_id = v_admin where admin_id is null;
  update public.stock_movements sm set admin_id = (select admin_id from public.stock_items s where s.id = sm.stock_item_id) where sm.admin_id is null;
  update public.profiles set menu_is_default = true where id = v_admin and not exists (select 1 from public.profiles where menu_is_default);
end $$;

create index if not exists categories_admin_idx on public.categories(admin_id);
create index if not exists menu_items_admin_idx on public.menu_items(admin_id);
create index if not exists variants_admin_idx on public.menu_item_variants(admin_id);
create index if not exists stock_items_admin_idx on public.stock_items(admin_id);
create index if not exists stock_links_admin_idx on public.stock_links(admin_id);
create index if not exists receipt_templates_admin_idx on public.receipt_templates(admin_id);
create index if not exists order_items_admin_idx on public.order_items(admin_id);
create index if not exists customer_orders_admin_idx on public.customer_orders(admin_id, status);

-- ---------------------------------------------------------------------------
-- Per-tenant settings (replaces the global settings table)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (admin_id, key)
);
create index if not exists tenant_settings_updated_idx on public.tenant_settings(updated_at);
drop trigger if exists tenant_settings_set_updated_at on public.tenant_settings;
create trigger tenant_settings_set_updated_at before update on public.tenant_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expenses ledger and stock purchases
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null,
  category text not null default 'general',
  occurred_at timestamptz not null default now(),
  note text,
  source text not null default 'manual' check (source in ('manual','stock')),
  stock_purchase_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_admin_idx on public.expenses(admin_id, occurred_at);
create index if not exists expenses_updated_idx on public.expenses(updated_at);
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

create table if not exists public.stock_purchases (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  quantity numeric(14,3) not null,
  unit_cost numeric(12,4) not null default 0,
  total_cost numeric(12,2) not null default 0,
  supplier text,
  note text,
  purchased_at timestamptz not null default now(),
  expense_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_purchases_admin_idx on public.stock_purchases(admin_id, purchased_at);
create index if not exists stock_purchases_updated_idx on public.stock_purchases(updated_at);
drop trigger if exists stock_purchases_set_updated_at on public.stock_purchases;
create trigger stock_purchases_set_updated_at before update on public.stock_purchases
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant defaults for a new admin (settings + two receipt templates)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_tenant_defaults(p_admin uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_settings (admin_id, key, value) values
    (p_admin, 'restaurant_name', '"Lagman House"'),
    (p_admin, 'restaurant_name_ur', '"لغمن ہاؤس"'),
    (p_admin, 'restaurant_address', '""'),
    (p_admin, 'currency_symbol', '"Rs"'),
    (p_admin, 'logo_url', '""')
  on conflict (admin_id, key) do nothing;

  if not exists (select 1 from public.receipt_templates where admin_id = p_admin) then
    insert into public.receipt_templates (admin_id, name, sort_order, config) values
    (p_admin, 'Customer', 0, '{
      "paperWidthMm": 58,
      "style": {"font": "A", "boldHeader": true, "boldItems": false, "boldTotals": true, "boldFooter": false},
      "header": {"showName": true, "showLogo": false, "position": "top", "align": "center", "extraLines": []},
      "dateTime": {"show": true, "position": "top", "format": "datetime"},
      "orderNumber": {"show": true, "label": "Order", "prefix": "#", "format": "sequence"},
      "cashier": {"show": false}, "table": {"show": true},
      "note": {"show": true, "label": "Note"},
      "items": {"columns": {"item": true, "size": true, "qty": true, "price": true, "subtotal": true}, "sizeInline": true},
      "total": {"show": true, "showSubtotal": false, "style": "double", "label": "TOTAL"},
      "amountReceived": {"show": true, "showChange": true},
      "paymentMethod": {"show": true},
      "footer": {"lines": ["Thank you for dining with us"]},
      "testWatermark": true, "feedLines": 3, "cut": true
    }'::jsonb),
    (p_admin, 'Kitchen', 1, '{
      "paperWidthMm": 58,
      "style": {"font": "A", "boldHeader": true, "boldItems": true, "boldTotals": false, "boldFooter": false},
      "header": {"showName": false, "showLogo": false, "position": "top", "align": "center", "extraLines": ["KITCHEN"]},
      "dateTime": {"show": true, "position": "top", "format": "time"},
      "orderNumber": {"show": true, "label": "Order", "prefix": "#", "format": "sequence"},
      "cashier": {"show": true}, "table": {"show": true},
      "note": {"show": true, "label": "Note"},
      "items": {"columns": {"item": true, "size": true, "qty": true, "price": false, "subtotal": false}, "sizeInline": true},
      "total": {"show": false, "showSubtotal": false, "style": "plain", "label": "TOTAL"},
      "amountReceived": {"show": false, "showChange": false},
      "paymentMethod": {"show": false},
      "footer": {"lines": []},
      "testWatermark": true, "feedLines": 3, "cut": true
    }'::jsonb);
  end if;
end $$;

do $$
declare r record;
begin
  for r in select id from public.profiles where role = 'admin' loop
    perform public.ensure_tenant_defaults(r.id);
  end loop;
end $$;

-- Existing global settings become the first admin's settings.
insert into public.tenant_settings (admin_id, key, value)
select p.id, s.key, s.value from public.settings s
cross join (select id from public.profiles where role = 'admin' order by created_at limit 1) p
on conflict (admin_id, key) do update set value = excluded.value;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(new.raw_user_meta_data->>'role', 'cashier');
        v_admin uuid := nullif(new.raw_user_meta_data->>'admin_id', '')::uuid;
begin
  if v_role not in ('admin', 'cashier') then v_role := 'cashier'; end if;
  if v_role = 'admin' then v_admin := null; end if;
  if v_admin is not null and not exists (select 1 from public.profiles where id = v_admin and role = 'admin') then
    v_admin := null;
  end if;
  insert into public.profiles (id, name, email, phone, phone_confirmed, role, status, photo_url, language, admin_id, menu_token)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    new.email,
    new.phone,
    new.phone_confirmed_at is not null,
    v_role,
    case when v_role = 'admin' then 'active' else 'pending' end,
    new.raw_user_meta_data->>'photo_url',
    coalesce(new.raw_user_meta_data->>'language', 'en'),
    v_admin,
    case when v_role = 'admin' then public.new_menu_token() else null end
  ) on conflict (id) do nothing;

  if v_role = 'admin' then
    perform public.ensure_tenant_defaults(new.id);
    if not exists (select 1 from public.profiles where menu_is_default) then
      update public.profiles set menu_is_default = true where id = new.id;
    end if;
  end if;

  if v_role = 'cashier' and new.email_confirmed_at is not null then
    perform public.notify_admin(v_admin, 'New cashier request',
      coalesce(new.raw_user_meta_data->>'name', new.email) || ' is waiting for approval',
      jsonb_build_object('type', 'cashier_request', 'user_id', new.id));
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Public menu token RPCs
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_menu_token() returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := public.new_menu_token();
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.profiles set menu_token = v_token where id = auth.uid();
  return v_token;
end $$;
grant execute on function public.regenerate_menu_token() to authenticated;

create or replace function public.set_default_menu(p_default boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_default then
    update public.profiles set menu_is_default = false where menu_is_default and id <> auth.uid();
    update public.profiles set menu_is_default = true where id = auth.uid();
  else
    update public.profiles set menu_is_default = false where id = auth.uid();
  end if;
end $$;
grant execute on function public.set_default_menu(boolean) to authenticated;

create or replace function public.public_menu(p_token text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin uuid;
        v_can_order boolean := false;
begin
  if p_token is not null and length(p_token) > 0 then
    select id into v_admin from public.profiles where role = 'admin' and status = 'active' and menu_token = p_token;
    v_can_order := v_admin is not null;
  end if;
  if v_admin is null then
    select id into v_admin from public.profiles where role = 'admin' and status = 'active' and menu_is_default;
    v_can_order := false;
  end if;
  if v_admin is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'can_order', v_can_order,
    'settings', coalesce((select jsonb_object_agg(key, value) from public.tenant_settings where admin_id = v_admin), '{}'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name) from public.categories c
                             where c.admin_id = v_admin and c.is_active and c.deleted_at is null), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'category_id', m.category_id, 'name', m.name, 'name_ur', m.name_ur,
                        'description', m.description, 'image_url', m.image_url, 'base_price', m.base_price, 'has_variants', m.has_variants,
                        'sort_order', m.sort_order) order by m.sort_order, m.name)
                        from public.menu_items m where m.admin_id = v_admin and m.is_active and m.deleted_at is null), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'menu_item_id', v.menu_item_id, 'name', v.name, 'price', v.price, 'sort_order', v.sort_order)
                           order by v.sort_order, v.price)
                           from public.menu_item_variants v join public.menu_items m on m.id = v.menu_item_id
                           where v.admin_id = v_admin and v.deleted_at is null and m.deleted_at is null and m.is_active), '[]'::jsonb)
  );
end $$;
grant execute on function public.public_menu(text) to anon, authenticated;

-- Server-priced order placement; only a valid token can order.
create or replace function public.place_customer_order(p_token text, p_items jsonb, p_table text default null, p_name text default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_admin uuid;
        v_items jsonb := '[]'::jsonb;
        it jsonb;
        v_item public.menu_items%rowtype;
        v_variant public.menu_item_variants%rowtype;
        v_qty int;
        v_id uuid;
begin
  select id into v_admin from public.profiles where role = 'admin' and status = 'active' and menu_token = p_token;
  if v_admin is null then raise exception 'Invalid menu code'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) between 0 and 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid items';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := least(99, greatest(1, coalesce((it->>'quantity')::int, 1)));
    select * into v_item from public.menu_items
      where id = (it->>'menu_item_id')::uuid and admin_id = v_admin and is_active and deleted_at is null;
    if not found then raise exception 'Item not available'; end if;
    v_variant := null;
    if v_item.has_variants then
      select * into v_variant from public.menu_item_variants
        where id = nullif(it->>'variant_id', '')::uuid and menu_item_id = v_item.id and deleted_at is null;
      if not found then raise exception 'Size not available'; end if;
    end if;
    v_items := v_items || jsonb_build_object(
      'menu_item_id', v_item.id,
      'variant_id', case when v_item.has_variants then v_variant.id else null end,
      'name', v_item.name,
      'variant_name', case when v_item.has_variants then v_variant.name else null end,
      'unit_price', case when v_item.has_variants then v_variant.price else v_item.base_price end,
      'quantity', v_qty);
  end loop;

  insert into public.customer_orders (admin_id, table_code, customer_name, items, note, status)
  values (v_admin, nullif(left(trim(coalesce(p_table, '')), 12), ''), nullif(left(trim(coalesce(p_name, '')), 40), ''), v_items, nullif(left(trim(coalesce(p_note, '')), 200), ''), 'pending')
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.place_customer_order(text, jsonb, text, text, text) to anon, authenticated;

create or replace function public.customer_order_status(p_order_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select status from public.customer_orders where id = p_order_id and created_at > now() - interval '12 hours';
$$;
grant execute on function public.customer_order_status(uuid) to anon, authenticated;

-- Notify only the tenant's active cashiers.
create or replace function public.notify_new_customer_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_count int;
        tokens text[];
begin
  select coalesce(sum((i->>'quantity')::int), 0) into v_count from jsonb_array_elements(new.items) i;
  select array_agg(push_token) into tokens from public.profiles
  where role = 'cashier' and status = 'active' and admin_id = new.admin_id and push_token is not null;
  perform public.send_expo_push(tokens, 'New customer order',
    coalesce('Table ' || new.table_code || ': ', '') || v_count || ' item(s) waiting',
    jsonb_build_object('type', 'customer_order', 'id', new.id));
  return new;
end $$;

-- Tenant-checked claim / release / complete / cancel.
create or replace function public.claim_customer_order(p_order_id uuid, p_cashier_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  if p_cashier_id <> auth.uid() then raise exception 'Cashier id must match the signed-in user'; end if;
  if not public.is_active_staff() then raise exception 'Account is not active'; end if;
  return query
    update public.customer_orders
       set status = 'claimed', claimed_by = p_cashier_id, claimed_at = now()
     where id = p_order_id and status = 'pending' and admin_id = public.tenant_id()
    returning *;
end $$;

create or replace function public.release_customer_order(p_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'pending', claimed_by = null, claimed_at = null
     where id = p_order_id and status = 'claimed' and admin_id = public.tenant_id()
       and (claimed_by = auth.uid() or public.is_admin())
    returning *;
end $$;

create or replace function public.complete_customer_order(p_order_id uuid, p_completed_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'completed', completed_order_id = p_completed_order_id
     where id = p_order_id and status = 'claimed' and admin_id = public.tenant_id()
       and (claimed_by = auth.uid() or public.is_admin())
    returning *;
end $$;

create or replace function public.cancel_customer_order(p_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'cancelled'
     where id = p_order_id and status in ('pending','claimed') and admin_id = public.tenant_id()
       and (claimed_by = auth.uid() or claimed_by is null or public.is_admin())
       and public.is_active_staff()
    returning *;
end $$;

-- Stock deduction: tenant-scoped movements.
create or replace function public.deduct_stock_for_order(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
        r record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.admin_id is distinct from public.tenant_id() then raise exception 'Not allowed'; end if;
  if v_order.cashier_id <> auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;
  if v_order.is_test or v_order.stock_deducted or v_order.status <> 'completed' then return false; end if;
  for r in
    select sl.stock_item_id, sum(sl.quantity_per_unit * oi.quantity) as qty
    from public.order_items oi
    join public.stock_links sl
      on sl.menu_item_id = oi.menu_item_id
     and sl.deleted_at is null
     and (sl.variant_id is null or sl.variant_id = oi.variant_id)
    where oi.order_id = p_order_id
    group by sl.stock_item_id
  loop
    update public.stock_items set quantity = quantity - r.qty where id = r.stock_item_id;
    insert into public.stock_movements (stock_item_id, order_id, delta, reason, admin_id)
    values (r.stock_item_id, p_order_id, -r.qty, 'order', v_order.admin_id);
  end loop;
  update public.orders set stock_deducted = true where id = p_order_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: everything is tenant-scoped; anon has no direct table access
-- ---------------------------------------------------------------------------
alter table public.tenant_settings enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_purchases enable row level security;

drop policy if exists settings_select on public.settings;
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_only on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tenant_settings_select on public.tenant_settings;
create policy tenant_settings_select on public.tenant_settings for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists tenant_settings_write on public.tenant_settings;
create policy tenant_settings_write on public.tenant_settings for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists menu_items_admin_write on public.menu_items;
create policy menu_items_admin_write on public.menu_items for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists variants_select on public.menu_item_variants;
create policy variants_select on public.menu_item_variants for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists variants_admin_write on public.menu_item_variants;
create policy variants_admin_write on public.menu_item_variants for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists qr_tables_select on public.qr_tables;
drop policy if exists qr_tables_admin_write on public.qr_tables;
create policy qr_tables_admin_only on public.qr_tables for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists stock_items_admin_write on public.stock_items;
create policy stock_items_admin_write on public.stock_items for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists stock_links_select on public.stock_links;
create policy stock_links_select on public.stock_links for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists stock_links_admin_write on public.stock_links;
create policy stock_links_admin_write on public.stock_links for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated using (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists receipt_templates_select on public.receipt_templates;
create policy receipt_templates_select on public.receipt_templates for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists receipt_templates_admin_write on public.receipt_templates;
create policy receipt_templates_admin_write on public.receipt_templates for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (admin_id = public.tenant_id() and (public.is_admin() or cashier_id = auth.uid()));
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (cashier_id = auth.uid() and admin_id = public.tenant_id() and public.is_active_staff());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (admin_id = public.tenant_id() and (public.is_admin() or cashier_id = auth.uid()))
  with check (admin_id = public.tenant_id() and (public.is_admin() or cashier_id = auth.uid()));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.admin_id = public.tenant_id() and (public.is_admin() or o.cashier_id = auth.uid())));
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.admin_id = public.tenant_id() and o.cashier_id = auth.uid()));
drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.admin_id = public.tenant_id() and (public.is_admin() or o.cashier_id = auth.uid())));

drop policy if exists customer_orders_anon_insert on public.customer_orders;
drop policy if exists customer_orders_anon_select_recent on public.customer_orders;
drop policy if exists customer_orders_anon_select_own on public.customer_orders;
drop policy if exists customer_orders_select on public.customer_orders;
create policy customer_orders_select on public.customer_orders for select to authenticated
  using (public.is_active_staff() and admin_id = public.tenant_id());

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists stock_purchases_all on public.stock_purchases;
create policy stock_purchases_all on public.stock_purchases for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

-- Storage: menu images live under images/menu/<admin_id>/...
drop policy if exists "images admin write" on storage.objects;
create policy "images admin write" on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin() and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'images' and public.is_admin() and (storage.foldername(name))[2] = auth.uid()::text);

-- Realtime for customer orders is filtered client-side by admin_id; RLS enforces tenant on the server.
alter table public.customer_orders replica identity full;

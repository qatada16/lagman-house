-- Migration 004: deals (combos), discounts, coupons, order discount columns, app releases.
-- Run after 003. Safe to re-run.

create table if not exists public.deals (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  name_ur text,
  description text,
  image_url text,
  price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_admin_idx on public.deals(admin_id);
create index if not exists deals_updated_idx on public.deals(updated_at);
drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();

create table if not exists public.deal_slots (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  options jsonb not null default '[]'::jsonb,
  default_index int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deal_slots_deal_idx on public.deal_slots(deal_id);
create index if not exists deal_slots_updated_idx on public.deal_slots(updated_at);
drop trigger if exists deal_slots_set_updated_at on public.deal_slots;
create trigger deal_slots_set_updated_at before update on public.deal_slots for each row execute function public.set_updated_at();

create table if not exists public.discounts (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('fixed','percent')),
  value numeric(12,2) not null,
  item_ids jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discounts_admin_idx on public.discounts(admin_id);
create index if not exists discounts_updated_idx on public.discounts(updated_at);
drop trigger if exists discounts_set_updated_at on public.discounts;
create trigger discounts_set_updated_at before update on public.discounts for each row execute function public.set_updated_at();

create table if not exists public.coupons (
  id uuid primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  name text,
  kind text not null check (kind in ('fixed','percent')),
  value numeric(12,2) not null,
  min_order numeric(12,2) not null default 0,
  max_discount numeric(12,2),
  max_uses int,
  uses_count int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_id, code)
);
create index if not exists coupons_updated_idx on public.coupons(updated_at);
drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at before update on public.coupons for each row execute function public.set_updated_at();

alter table public.orders add column if not exists item_discount_total numeric(12,2) not null default 0;
alter table public.orders add column if not exists coupon_id uuid;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists savings_total numeric(12,2) not null default 0;

alter table public.order_items add column if not exists parent_item_id uuid;
alter table public.order_items add column if not exists deal_id uuid;
alter table public.order_items add column if not exists original_unit_price numeric(12,2);
alter table public.order_items add column if not exists discount_id uuid;
create index if not exists order_items_parent_idx on public.order_items(parent_item_id);

-- Coupon usage is counted on the server so a usage cap cannot be exceeded by two devices at once.
create or replace function public.count_coupon_use() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.coupon_id is not null and new.status = 'completed' and not new.is_test then
    update public.coupons set uses_count = uses_count + 1 where id = new.coupon_id;
  end if;
  return new;
end $$;
drop trigger if exists orders_count_coupon on public.orders;
create trigger orders_count_coupon after insert on public.orders for each row execute function public.count_coupon_use();

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  build_number int not null default 0,
  apk_url text,
  notes text,
  mandatory boolean not null default false,
  released_at timestamptz not null default now()
);

create or replace function public.latest_release() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select to_jsonb(r) from public.app_releases r order by released_at desc limit 1), 'null'::jsonb);
$$;
grant execute on function public.latest_release() to anon, authenticated;

alter table public.deals enable row level security;
alter table public.deal_slots enable row level security;
alter table public.discounts enable row level security;
alter table public.coupons enable row level security;
alter table public.app_releases enable row level security;

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists deals_write on public.deals;
create policy deals_write on public.deals for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists deal_slots_select on public.deal_slots;
create policy deal_slots_select on public.deal_slots for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists deal_slots_write on public.deal_slots;
create policy deal_slots_write on public.deal_slots for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists discounts_select on public.discounts;
create policy discounts_select on public.discounts for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists discounts_write on public.discounts;
create policy discounts_write on public.discounts for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons for select to authenticated using (admin_id = public.tenant_id());
drop policy if exists coupons_write on public.coupons;
create policy coupons_write on public.coupons for all to authenticated
  using (public.is_admin() and admin_id = public.tenant_id()) with check (public.is_admin() and admin_id = public.tenant_id());

drop policy if exists app_releases_admin on public.app_releases;
create policy app_releases_admin on public.app_releases for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Effective price for an item or size after active discounts.
create or replace function public.discounted_price(p_admin uuid, p_item uuid, p_price numeric)
returns numeric language sql stable as $$
  select coalesce((
    select min(case when d.kind = 'percent' then greatest(0, round(p_price * (1 - d.value / 100), 2)) else greatest(0, p_price - d.value) end)
    from public.discounts d
    where d.admin_id = p_admin and d.is_active and d.deleted_at is null
      and (d.starts_at is null or d.starts_at <= now()) and (d.ends_at is null or d.ends_at >= now())
      and d.item_ids ? p_item::text
  ), p_price);
$$;

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
  if v_admin is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object(
    'found', true,
    'can_order', v_can_order,
    'settings', coalesce((select jsonb_object_agg(key, value) from public.tenant_settings where admin_id = v_admin), '{}'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name) from public.categories c
                             where c.admin_id = v_admin and c.is_active and c.deleted_at is null), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'category_id', m.category_id, 'name', m.name, 'name_ur', m.name_ur,
                        'description', m.description, 'image_url', m.image_url, 'base_price', m.base_price,
                        'discounted_price', public.discounted_price(v_admin, m.id, m.base_price),
                        'has_variants', m.has_variants, 'sort_order', m.sort_order) order by m.sort_order, m.name)
                        from public.menu_items m where m.admin_id = v_admin and m.is_active and m.deleted_at is null), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'menu_item_id', v.menu_item_id, 'name', v.name, 'price', v.price,
                           'discounted_price', public.discounted_price(v_admin, v.menu_item_id, v.price), 'sort_order', v.sort_order)
                           order by v.sort_order, v.price)
                           from public.menu_item_variants v join public.menu_items m on m.id = v.menu_item_id
                           where v.admin_id = v_admin and v.deleted_at is null and m.deleted_at is null and m.is_active), '[]'::jsonb),
    'deals', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'name_ur', d.name_ur, 'description', d.description,
                        'image_url', d.image_url, 'price', d.price, 'sort_order', d.sort_order,
                        'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'options', s.options, 'default_index', s.default_index) order by s.sort_order)
                                           from public.deal_slots s where s.deal_id = d.id and s.deleted_at is null), '[]'::jsonb))
                        order by d.sort_order, d.name)
                        from public.deals d where d.admin_id = v_admin and d.is_active and d.deleted_at is null
                          and (d.starts_at is null or d.starts_at <= now()) and (d.ends_at is null or d.ends_at >= now())), '[]'::jsonb)
  );
end $$;

-- Customer orders: items may be plain {menu_item_id, variant_id, quantity} or deals {deal_id, selections:[{slot_id, menu_item_id, variant_id}], quantity}.
create or replace function public.place_customer_order(p_token text, p_items jsonb, p_table text default null, p_name text default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_admin uuid;
        v_items jsonb := '[]'::jsonb;
        it jsonb;
        sel jsonb;
        v_item public.menu_items%rowtype;
        v_variant public.menu_item_variants%rowtype;
        v_deal public.deals%rowtype;
        v_slot public.deal_slots%rowtype;
        v_qty int;
        v_id uuid;
        v_comps jsonb;
        v_price numeric;
begin
  select id into v_admin from public.profiles where role = 'admin' and status = 'active' and menu_token = p_token;
  if v_admin is null then raise exception 'Invalid menu code'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid items';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := least(99, greatest(1, coalesce((it->>'quantity')::int, 1)));
    if it ? 'deal_id' then
      select * into v_deal from public.deals where id = (it->>'deal_id')::uuid and admin_id = v_admin and is_active and deleted_at is null
        and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now());
      if not found then raise exception 'Deal not available'; end if;
      v_comps := '[]'::jsonb;
      for v_slot in select * from public.deal_slots where deal_id = v_deal.id and deleted_at is null order by sort_order loop
        select s into sel from jsonb_array_elements(coalesce(it->'selections', '[]'::jsonb)) s where s->>'slot_id' = v_slot.id::text limit 1;
        if sel is null then sel := v_slot.options -> least(v_slot.default_index, jsonb_array_length(v_slot.options) - 1); end if;
        if sel is null then raise exception 'Deal slot missing'; end if;
        select * into v_item from public.menu_items where id = (sel->>'menu_item_id')::uuid and admin_id = v_admin and deleted_at is null;
        if not found then raise exception 'Deal item not available'; end if;
        if not exists (select 1 from jsonb_array_elements(v_slot.options) o
                       where o->>'menu_item_id' = v_item.id::text and (o->>'variant_id' is null or o->>'variant_id' = sel->>'variant_id')) then
          raise exception 'Deal option not allowed';
        end if;
        v_variant := null;
        if v_item.has_variants then
          select * into v_variant from public.menu_item_variants where id = nullif(sel->>'variant_id', '')::uuid and menu_item_id = v_item.id and deleted_at is null;
          if not found then raise exception 'Deal size not available'; end if;
        end if;
        v_comps := v_comps || jsonb_build_object('slot_id', v_slot.id, 'menu_item_id', v_item.id, 'variant_id', case when v_item.has_variants then v_variant.id else null end,
          'name', v_item.name, 'variant_name', case when v_item.has_variants then v_variant.name else null end);
      end loop;
      v_items := v_items || jsonb_build_object('deal_id', v_deal.id, 'name', v_deal.name, 'unit_price', v_deal.price, 'quantity', v_qty, 'components', v_comps);
    else
      select * into v_item from public.menu_items where id = (it->>'menu_item_id')::uuid and admin_id = v_admin and is_active and deleted_at is null;
      if not found then raise exception 'Item not available'; end if;
      v_variant := null;
      if v_item.has_variants then
        select * into v_variant from public.menu_item_variants where id = nullif(it->>'variant_id', '')::uuid and menu_item_id = v_item.id and deleted_at is null;
        if not found then raise exception 'Size not available'; end if;
      end if;
      v_price := case when v_item.has_variants then v_variant.price else v_item.base_price end;
      v_items := v_items || jsonb_build_object(
        'menu_item_id', v_item.id,
        'variant_id', case when v_item.has_variants then v_variant.id else null end,
        'name', v_item.name,
        'variant_name', case when v_item.has_variants then v_variant.name else null end,
        'unit_price', public.discounted_price(v_admin, v_item.id, v_price),
        'original_unit_price', v_price,
        'quantity', v_qty);
    end if;
  end loop;

  insert into public.customer_orders (admin_id, table_code, customer_name, items, note, status)
  values (v_admin, nullif(left(trim(coalesce(p_table, '')), 12), ''), nullif(left(trim(coalesce(p_name, '')), 40), ''), v_items, nullif(left(trim(coalesce(p_note, '')), 200), ''), 'pending')
  returning id into v_id;
  return v_id;
end $$;

-- Lagman House: full schema. Run once in Supabase SQL Editor.
-- Safe to re-run (idempotent where possible).

create extension if not exists pgcrypto;
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net not available: push notifications will be disabled until enabled from Dashboard > Database > Extensions';
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text unique,
  phone_confirmed boolean not null default false,
  photo_url text,
  role text not null check (role in ('admin','cashier')),
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  push_token text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_updated_at_idx on public.profiles(updated_at);
create index if not exists profiles_role_status_idx on public.profiles(role, status);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Only admins may change role/status.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if (new.role <> old.role or new.status <> old.status) and not public.is_admin() then
    raise exception 'Only admins can change role or status';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns before update on public.profiles
for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Push notifications (Expo push API via pg_net). Failures never block writes.
-- ---------------------------------------------------------------------------
create or replace function public.send_expo_push(p_tokens text[], p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare payload jsonb;
begin
  if p_tokens is null or array_length(p_tokens, 1) is null then return; end if;
  select jsonb_agg(jsonb_build_object(
    'to', t, 'title', p_title, 'body', p_body, 'data', p_data,
    'sound', 'default', 'channelId', 'orders', 'priority', 'high'))
  into payload
  from unnest(p_tokens) as t
  where t is not null and t like 'ExponentPushToken%';
  if payload is null then return; end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := payload,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
    );
  exception when others then
    raise notice 'push failed: %', sqlerrm;
  end;
end $$;

create or replace function public.notify_admins(p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare tokens text[];
begin
  select array_agg(push_token) into tokens from public.profiles
  where role = 'admin' and status = 'active' and push_token is not null;
  perform public.send_expo_push(tokens, p_title, p_body, p_data);
end $$;

create or replace function public.notify_active_cashiers(p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare tokens text[];
begin
  select array_agg(push_token) into tokens from public.profiles
  where role = 'cashier' and status = 'active' and push_token is not null;
  perform public.send_expo_push(tokens, p_title, p_body, p_data);
end $$;

-- ---------------------------------------------------------------------------
-- auth.users -> profiles sync
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(new.raw_user_meta_data->>'role', 'cashier');
begin
  if v_role not in ('admin', 'cashier') then v_role := 'cashier'; end if;
  insert into public.profiles (id, name, email, phone, phone_confirmed, role, status, photo_url, language)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    new.email,
    new.phone,
    new.phone_confirmed_at is not null,
    v_role,
    case when v_role = 'admin' then 'active' else 'pending' end,
    new.raw_user_meta_data->>'photo_url',
    coalesce(new.raw_user_meta_data->>'language', 'en')
  ) on conflict (id) do nothing;

  if v_role = 'cashier' and new.email_confirmed_at is not null then
    perform public.notify_admins('New cashier request',
      coalesce(new.raw_user_meta_data->>'name', new.email) || ' is waiting for approval',
      jsonb_build_object('type', 'cashier_request', 'user_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles%rowtype;
begin
  update public.profiles set
    email = new.email,
    phone = case when new.phone_confirmed_at is not null then new.phone else phone end,
    phone_confirmed = case when new.phone_confirmed_at is not null then true else phone_confirmed end
  where id = new.id
  returning * into v_profile;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null and v_profile.role = 'cashier' then
    perform public.notify_admins('New cashier request',
      v_profile.name || ' is waiting for approval',
      jsonb_build_object('type', 'cashier_request', 'user_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update on auth.users
for each row execute function public.handle_user_updated();

-- Notify cashier when status changes.
create or replace function public.notify_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.push_token is not null then
    perform public.send_expo_push(array[new.push_token],
      case new.status
        when 'active' then 'Account approved'
        when 'rejected' then 'Account rejected'
        when 'suspended' then 'Account suspended'
        else 'Account status changed' end,
      case new.status
        when 'active' then 'You can now take orders at Lagman House.'
        when 'rejected' then 'Your cashier request was not approved.'
        when 'suspended' then 'Your account has been suspended. Contact an admin.'
        else 'Your account status is now ' || new.status end,
      jsonb_build_object('type', 'status_change', 'status', new.status));
  end if;
  return new;
end $$;
drop trigger if exists profiles_notify_status on public.profiles;
create trigger profiles_notify_status after update on public.profiles
for each row execute function public.notify_status_change();

-- Phone uniqueness check before spending an OTP.
create or replace function public.phone_in_use(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where phone = p_phone and id <> auth.uid())
      or exists (select 1 from public.profiles where phone = p_phone and id <> auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
for each row execute function public.set_updated_at();

insert into public.settings (key, value) values
  ('restaurant_name', '"Lagman House"'),
  ('restaurant_address', '""'),
  ('currency_symbol', '"Rs"'),
  ('logo_url', '""')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ur text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists categories_updated_at_idx on public.categories(updated_at);
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  name_ur text,
  description text,
  image_url text,
  base_price numeric(12,2) not null default 0,
  has_variants boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_updated_at_idx on public.menu_items(updated_at);
drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at before update on public.menu_items
for each row execute function public.set_updated_at();

create table if not exists public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_item_variants_updated_at_idx on public.menu_item_variants(updated_at);
create index if not exists menu_item_variants_item_idx on public.menu_item_variants(menu_item_id);
drop trigger if exists menu_item_variants_set_updated_at on public.menu_item_variants;
create trigger menu_item_variants_set_updated_at before update on public.menu_item_variants
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'g',
  quantity numeric(14,3) not null default 0,
  low_threshold numeric(14,3),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_items_updated_at_idx on public.stock_items(updated_at);
drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at before update on public.stock_items
for each row execute function public.set_updated_at();

create table if not exists public.stock_links (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  variant_id uuid references public.menu_item_variants(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  quantity_per_unit numeric(14,3) not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_links_updated_at_idx on public.stock_links(updated_at);
create index if not exists stock_links_item_idx on public.stock_links(menu_item_id);
drop trigger if exists stock_links_set_updated_at on public.stock_links;
create trigger stock_links_set_updated_at before update on public.stock_links
for each row execute function public.set_updated_at();

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  order_id uuid,
  delta numeric(14,3) not null,
  reason text not null default 'order',
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_order_idx on public.stock_movements(order_id);

-- ---------------------------------------------------------------------------
-- Receipt templates
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  config jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipt_templates_updated_at_idx on public.receipt_templates(updated_at);
drop trigger if exists receipt_templates_set_updated_at on public.receipt_templates;
create trigger receipt_templates_set_updated_at before update on public.receipt_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- QR tables
-- ---------------------------------------------------------------------------
create table if not exists public.qr_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qr_tables_updated_at_idx on public.qr_tables(updated_at);
drop trigger if exists qr_tables_set_updated_at on public.qr_tables;
create trigger qr_tables_set_updated_at before update on public.qr_tables
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key,
  seq bigint generated always as identity,
  order_number text not null,
  cashier_id uuid references public.profiles(id) on delete set null,
  status text not null default 'completed' check (status in ('completed','void')),
  source text not null default 'pos' check (source in ('pos','qr')),
  customer_order_id uuid,
  table_code text,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_received numeric(12,2),
  payment_method text check (payment_method in ('cash','online')),
  note text,
  is_test boolean not null default false,
  stock_deducted boolean not null default false,
  device_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists orders_updated_at_idx on public.orders(updated_at);
create index if not exists orders_cashier_idx on public.orders(cashier_id, created_at);
create index if not exists orders_created_idx on public.orders(created_at);
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  variant_id uuid references public.menu_item_variants(id) on delete set null,
  item_name text not null,
  variant_name text,
  unit_price numeric(12,2) not null default 0,
  quantity int not null default 1,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_updated_at_idx on public.order_items(updated_at);
create index if not exists order_items_menu_item_idx on public.order_items(menu_item_id);
drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at before update on public.order_items
for each row execute function public.set_updated_at();

-- Idempotent, authoritative stock deduction keyed by order id.
create or replace function public.deduct_stock_for_order(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
        r record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.cashier_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if v_order.is_test or v_order.stock_deducted or v_order.status <> 'completed' then
    return false;
  end if;

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
    insert into public.stock_movements (stock_item_id, order_id, delta, reason)
    values (r.stock_item_id, p_order_id, -r.qty, 'order');
  end loop;

  update public.orders set stock_deducted = true where id = p_order_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Customer (QR) orders
-- ---------------------------------------------------------------------------
create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  table_code text,
  customer_name text,
  items jsonb not null,
  note text,
  status text not null default 'pending' check (status in ('pending','claimed','completed','cancelled')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  completed_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_orders_status_idx on public.customer_orders(status, created_at);
drop trigger if exists customer_orders_set_updated_at on public.customer_orders;
create trigger customer_orders_set_updated_at before update on public.customer_orders
for each row execute function public.set_updated_at();

-- Atomic claim: exactly one cashier wins.
create or replace function public.claim_customer_order(p_order_id uuid, p_cashier_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  if p_cashier_id <> auth.uid() then
    raise exception 'Cashier id must match the signed-in user';
  end if;
  if not public.is_active_staff() then
    raise exception 'Account is not active';
  end if;
  return query
    update public.customer_orders
       set status = 'claimed', claimed_by = p_cashier_id, claimed_at = now()
     where id = p_order_id and status = 'pending'
    returning *;
end $$;

create or replace function public.release_customer_order(p_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'pending', claimed_by = null, claimed_at = null
     where id = p_order_id and status = 'claimed' and (claimed_by = auth.uid() or public.is_admin())
    returning *;
end $$;

create or replace function public.complete_customer_order(p_order_id uuid, p_completed_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'completed', completed_order_id = p_completed_order_id
     where id = p_order_id and status = 'claimed' and (claimed_by = auth.uid() or public.is_admin())
    returning *;
end $$;

create or replace function public.cancel_customer_order(p_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'cancelled'
     where id = p_order_id and status in ('pending','claimed')
       and (claimed_by = auth.uid() or claimed_by is null or public.is_admin())
       and public.is_active_staff()
    returning *;
end $$;

create or replace function public.notify_new_customer_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select coalesce(sum((i->>'quantity')::int), 0) into v_count from jsonb_array_elements(new.items) i;
  perform public.notify_active_cashiers('New customer order',
    coalesce('Table ' || new.table_code || ': ', '') || v_count || ' item(s) waiting',
    jsonb_build_object('type', 'customer_order', 'id', new.id));
  return new;
end $$;
drop trigger if exists customer_orders_notify on public.customer_orders;
create trigger customer_orders_notify after insert on public.customer_orders
for each row execute function public.notify_new_customer_order();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_links enable row level security;
alter table public.stock_movements enable row level security;
alter table public.receipt_templates enable row level security;
alter table public.qr_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_orders enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- settings: public read, admin write
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- catalog: public read (menu for QR page), admin write
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to anon, authenticated using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items for select to anon, authenticated using (true);
drop policy if exists menu_items_admin_write on public.menu_items;
create policy menu_items_admin_write on public.menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists variants_select on public.menu_item_variants;
create policy variants_select on public.menu_item_variants for select to anon, authenticated using (true);
drop policy if exists variants_admin_write on public.menu_item_variants;
create policy variants_admin_write on public.menu_item_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists qr_tables_select on public.qr_tables;
create policy qr_tables_select on public.qr_tables for select to anon, authenticated using (true);
drop policy if exists qr_tables_admin_write on public.qr_tables;
create policy qr_tables_admin_write on public.qr_tables for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- stock: staff read, admin write
drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items for select to authenticated using (true);
drop policy if exists stock_items_admin_write on public.stock_items;
create policy stock_items_admin_write on public.stock_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists stock_links_select on public.stock_links;
create policy stock_links_select on public.stock_links for select to authenticated using (true);
drop policy if exists stock_links_admin_write on public.stock_links;
create policy stock_links_admin_write on public.stock_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated using (public.is_admin());

-- receipt templates: staff read, admin write
drop policy if exists receipt_templates_select on public.receipt_templates;
create policy receipt_templates_select on public.receipt_templates for select to authenticated using (true);
drop policy if exists receipt_templates_admin_write on public.receipt_templates;
create policy receipt_templates_admin_write on public.receipt_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- orders: cashier owns their rows, admin sees everything
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (cashier_id = auth.uid() or public.is_admin());
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (cashier_id = auth.uid() and public.is_active_staff());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (cashier_id = auth.uid() or public.is_admin())
  with check (cashier_id = auth.uid() or public.is_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_admin())));
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_admin())));
drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_admin())));

-- customer orders: anon may insert pending rows; staff read; writes go through RPCs
drop policy if exists customer_orders_anon_insert on public.customer_orders;
create policy customer_orders_anon_insert on public.customer_orders for insert to anon, authenticated
  with check (status = 'pending' and claimed_by is null and jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50);
drop policy if exists customer_orders_select on public.customer_orders;
create policy customer_orders_select on public.customer_orders for select to authenticated
  using (public.is_active_staff());
drop policy if exists customer_orders_anon_select_recent on public.customer_orders;
create policy customer_orders_anon_select_recent on public.customer_orders for select to anon
  using (created_at > now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- Grants for RPCs
-- ---------------------------------------------------------------------------
grant execute on function public.phone_in_use(text) to authenticated;
grant execute on function public.claim_customer_order(uuid, uuid) to authenticated;
grant execute on function public.release_customer_order(uuid) to authenticated;
grant execute on function public.complete_customer_order(uuid, uuid) to authenticated;
grant execute on function public.cancel_customer_order(uuid) to authenticated;
grant execute on function public.deduct_stock_for_order(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_active_staff() to authenticated, anon;
revoke execute on function public.send_expo_push(text[], text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_active_cashiers(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.customer_orders;
exception when duplicate_object then null; end $$;
alter table public.customer_orders replica identity full;
alter table public.profiles replica identity full;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('images', 'images', true)
on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'images');
drop policy if exists "images admin write" on storage.objects;
create policy "images admin write" on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin()) with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');
drop policy if exists "avatars own write" on storage.objects;
create policy "avatars own write" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Seed data: default receipt templates, a starter category, two QR tables
-- ---------------------------------------------------------------------------
insert into public.receipt_templates (id, name, sort_order, config) values
('11111111-1111-1111-1111-111111111111', 'Customer', 0, '{
  "paperWidthMm": 58,
  "header": {"showName": true, "showLogo": false, "position": "top", "align": "center", "extraLines": []},
  "dateTime": {"show": true, "position": "top", "format": "datetime"},
  "orderNumber": {"show": true, "label": "Order", "prefix": "#", "format": "sequence"},
  "cashier": {"show": false},
  "table": {"show": true},
  "note": {"show": true, "label": "Note"},
  "items": {"columns": {"item": true, "size": true, "qty": true, "price": true, "subtotal": true}, "sizeInline": true},
  "total": {"show": true, "showSubtotal": false, "style": "double", "label": "TOTAL"},
  "amountReceived": {"show": true, "showChange": true},
  "paymentMethod": {"show": true},
  "footer": {"lines": ["Thank you for dining with us"]},
  "testWatermark": true,
  "feedLines": 3,
  "cut": true
}'::jsonb),
('22222222-2222-2222-2222-222222222222', 'Kitchen', 1, '{
  "paperWidthMm": 58,
  "header": {"showName": false, "showLogo": false, "position": "top", "align": "center", "extraLines": ["KITCHEN"]},
  "dateTime": {"show": true, "position": "top", "format": "time"},
  "orderNumber": {"show": true, "label": "Order", "prefix": "#", "format": "sequence"},
  "cashier": {"show": true},
  "table": {"show": true},
  "note": {"show": true, "label": "Note"},
  "items": {"columns": {"item": true, "size": true, "qty": true, "price": false, "subtotal": false}, "sizeInline": true},
  "total": {"show": false, "showSubtotal": false, "style": "plain", "label": "TOTAL"},
  "amountReceived": {"show": false, "showChange": false},
  "paymentMethod": {"show": false},
  "footer": {"lines": []},
  "testWatermark": true,
  "feedLines": 3,
  "cut": true
}'::jsonb)
on conflict (id) do nothing;

insert into public.categories (id, name, name_ur, sort_order) values
('33333333-3333-3333-3333-333333333333', 'Mains', 'مین ڈشز', 0)
on conflict (id) do nothing;

insert into public.qr_tables (code, label) values ('T1', 'Table 1'), ('T2', 'Table 2')
on conflict (code) do nothing;

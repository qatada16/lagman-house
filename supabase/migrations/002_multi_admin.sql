-- Migration 002: multiple admins, cashier-to-admin linking, account deletion,
-- Urdu restaurant name. Run after schema.sql. Safe to re-run.

alter table public.profiles add column if not exists admin_id uuid references public.profiles(id) on delete set null;
create index if not exists profiles_admin_idx on public.profiles(admin_id);

alter table public.orders add column if not exists admin_id uuid;
create index if not exists orders_admin_idx on public.orders(admin_id);
update public.orders o set admin_id = p.admin_id
from public.profiles p where p.id = o.cashier_id and o.admin_id is null and p.admin_id is not null;

insert into public.settings (key, value) values ('restaurant_name_ur', '"لغمن ہاؤس"')
on conflict (key) do nothing;

-- Public list of active admins for the signup dropdown.
create or replace function public.list_admins()
returns table (id uuid, name text, photo_url text)
language sql stable security definer set search_path = public as $$
  select id, name, photo_url from public.profiles
  where role = 'admin' and status = 'active' order by name;
$$;
grant execute on function public.list_admins() to anon, authenticated;

create or replace function public.notify_admin(p_admin_id uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare tokens text[];
begin
  if p_admin_id is null then
    perform public.notify_admins(p_title, p_body, p_data);
    return;
  end if;
  select array_agg(push_token) into tokens from public.profiles
  where id = p_admin_id and push_token is not null;
  perform public.send_expo_push(tokens, p_title, p_body, p_data);
end $$;
revoke execute on function public.notify_admin(uuid, text, text, jsonb) from public, anon, authenticated;

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
  insert into public.profiles (id, name, email, phone, phone_confirmed, role, status, photo_url, language, admin_id)
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
    v_admin
  ) on conflict (id) do nothing;

  if v_role = 'cashier' and new.email_confirmed_at is not null then
    perform public.notify_admin(v_admin, 'New cashier request',
      coalesce(new.raw_user_meta_data->>'name', new.email) || ' is waiting for approval',
      jsonb_build_object('type', 'cashier_request', 'user_id', new.id));
  end if;
  return new;
end $$;

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
    perform public.notify_admin(v_profile.admin_id, 'New cashier request',
      v_profile.name || ' is waiting for approval',
      jsonb_build_object('type', 'cashier_request', 'user_id', new.id));
  end if;
  return new;
end $$;

-- Admins may only change role/status/admin_id of their own or orphaned cashiers.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if new.role <> old.role or new.status <> old.status or new.admin_id is distinct from old.admin_id then
    if not public.is_admin() then
      raise exception 'Only admins can change role, status or admin link';
    end if;
    if old.role = 'cashier' and old.admin_id is not null and old.admin_id <> auth.uid() then
      raise exception 'This cashier belongs to another admin';
    end if;
  end if;
  return new;
end $$;

create or replace function public.delete_own_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_own_account() to authenticated;

-- RLS: admins see their own cashiers, orphaned cashiers and other admins.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.is_admin() and (admin_id = auth.uid() or admin_id is null or role = 'admin'))
  );
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or (public.is_admin() and (admin_id = auth.uid() or admin_id is null)))
  with check (id = auth.uid() or (public.is_admin() and (admin_id = auth.uid() or admin_id is null)));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (cashier_id = auth.uid() or (public.is_admin() and (admin_id = auth.uid() or admin_id is null)));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (cashier_id = auth.uid() or (public.is_admin() and (admin_id = auth.uid() or admin_id is null)))
  with check (cashier_id = auth.uid() or (public.is_admin() and (admin_id = auth.uid() or admin_id is null)));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.cashier_id = auth.uid() or (public.is_admin() and (o.admin_id = auth.uid() or o.admin_id is null)))));
drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.cashier_id = auth.uid() or (public.is_admin() and (o.admin_id = auth.uid() or o.admin_id is null)))));

-- Stock deduction: allow the linked admin as well.
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

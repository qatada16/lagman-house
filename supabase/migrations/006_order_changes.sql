-- Migration 006: editing and cancelling completed orders with an audit trail, exact stock reconciliation per
-- order, coupon use release, and admin alerts. Run after 005. Safe to re-run.
-- Every edit writes a new revision_id on the order and on its new items; an order's items are the ones whose
-- revision matches the order row, so concurrent edits from two devices always resolve to one consistent set.

alter table public.orders add column if not exists original_total numeric(12,2);
alter table public.orders add column if not exists edit_count int not null default 0;
alter table public.orders add column if not exists edited_at timestamptz;
alter table public.orders add column if not exists edited_by uuid;
alter table public.orders add column if not exists voided_at timestamptz;
alter table public.orders add column if not exists voided_by uuid;
alter table public.orders add column if not exists void_reason text;
alter table public.orders add column if not exists revision_id uuid;
update public.orders set original_total = total where original_total is null;

alter table public.order_items add column if not exists revision_id uuid;
create index if not exists order_items_order_revision_idx on public.order_items(order_id, revision_id);

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (admin_id = public.tenant_id() and public.is_active_staff() and (cashier_id = auth.uid() or public.is_admin()));

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.admin_id = public.tenant_id() and (public.is_admin() or o.cashier_id = auth.uid())));

create or replace function public.guard_order_changes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.stock_deducted := false;
    new.original_total := coalesce(new.original_total, new.total);
    if new.status = 'void' then
      new.voided_by := coalesce(auth.uid(), new.voided_by);
      new.voided_at := coalesce(new.voided_at, now());
    end if;
    if new.revision_id is not null then
      new.edit_count := greatest(new.edit_count, 1);
      new.edited_by := coalesce(auth.uid(), new.edited_by);
      new.edited_at := coalesce(new.edited_at, now());
    else
      new.edit_count := 0;
      new.edited_by := null;
      new.edited_at := null;
    end if;
    return new;
  end if;

  new.cashier_id := old.cashier_id;
  new.admin_id := old.admin_id;
  new.order_number := old.order_number;
  new.created_at := old.created_at;
  new.is_test := old.is_test;
  new.source := old.source;
  new.original_total := coalesce(old.original_total, old.total);

  if new.status is distinct from old.status or new.revision_id is distinct from old.revision_id then
    new.stock_deducted := false;
  end if;

  if old.status = 'void' then
    new.status := 'void';
    new.voided_at := old.voided_at;
    new.voided_by := old.voided_by;
    new.void_reason := old.void_reason;
  elsif new.status = 'void' then
    new.voided_by := coalesce(auth.uid(), new.voided_by);
    new.voided_at := coalesce(new.voided_at, now());
  end if;

  if new.revision_id is distinct from old.revision_id then
    new.edit_count := greatest(new.edit_count, old.edit_count + 1);
    new.edited_by := coalesce(auth.uid(), new.edited_by);
    new.edited_at := coalesce(new.edited_at, now());
  else
    new.edit_count := old.edit_count;
    new.edited_by := old.edited_by;
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;
drop trigger if exists orders_guard_changes on public.orders;
create trigger orders_guard_changes before insert or update on public.orders
for each row execute function public.guard_order_changes();

create or replace function public.count_coupon_use() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old_coupon uuid;
  v_old_counted boolean := false;
  v_new_counted boolean := new.coupon_id is not null and new.status = 'completed' and not new.is_test;
begin
  if tg_op = 'UPDATE' then
    v_old_coupon := old.coupon_id;
    v_old_counted := old.coupon_id is not null and old.status = 'completed' and not old.is_test;
  end if;
  if v_old_counted and (not v_new_counted or new.coupon_id is distinct from v_old_coupon) then
    update public.coupons set uses_count = greatest(0, uses_count - 1) where id = v_old_coupon;
  end if;
  if v_new_counted and (not v_old_counted or new.coupon_id is distinct from v_old_coupon) then
    update public.coupons set uses_count = uses_count + 1 where id = new.coupon_id;
  end if;
  return new;
end $$;
drop trigger if exists orders_count_coupon on public.orders;
create trigger orders_count_coupon after insert or update of coupon_id, status on public.orders
for each row execute function public.count_coupon_use();

create table if not exists public.order_stock_applied (
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null,
  variant_key uuid not null default '00000000-0000-0000-0000-000000000000',
  variant_id uuid,
  admin_id uuid,
  quantity int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (order_id, menu_item_id, variant_key)
);
alter table public.order_stock_applied enable row level security;
revoke all on public.order_stock_applied from anon, authenticated;

insert into public.order_stock_applied (order_id, menu_item_id, variant_key, variant_id, admin_id, quantity)
select oi.order_id, oi.menu_item_id, coalesce(oi.variant_id, '00000000-0000-0000-0000-000000000000'::uuid), oi.variant_id, o.admin_id, sum(oi.quantity)::int
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.stock_deducted and not o.is_test and o.status = 'completed' and oi.menu_item_id is not null
  and oi.revision_id is not distinct from o.revision_id
  and not exists (select 1 from public.order_stock_applied a where a.order_id = o.id)
group by oi.order_id, oi.menu_item_id, oi.variant_id, o.admin_id
on conflict do nothing;

-- Moves stock by the difference between the order's current items and what was already taken for it,
-- so creating, editing and cancelling an order all converge on the right stock. Idempotent.
create or replace function public.deduct_stock_for_order(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  r record;
  v_changed boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.admin_id is distinct from public.tenant_id() then raise exception 'Not allowed'; end if;
  if v_order.cashier_id is distinct from auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;
  if v_order.status = 'completed' and not v_order.is_test and not exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id and oi.revision_id is not distinct from v_order.revision_id
  ) then
    return false;
  end if;

  for r in
    with target as (
      select oi.menu_item_id, coalesce(oi.variant_id, '00000000-0000-0000-0000-000000000000'::uuid) as variant_key,
             min(oi.variant_id::text)::uuid as variant_id, sum(oi.quantity)::int as qty
      from public.order_items oi
      where oi.order_id = p_order_id and oi.revision_id is not distinct from v_order.revision_id and oi.menu_item_id is not null
        and v_order.status = 'completed' and not v_order.is_test
      group by oi.menu_item_id, coalesce(oi.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ), applied as (
      select a.menu_item_id, a.variant_key, a.variant_id, a.quantity as qty
      from public.order_stock_applied a where a.order_id = p_order_id
    )
    select coalesce(t.menu_item_id, a.menu_item_id) as menu_item_id,
           coalesce(t.variant_key, a.variant_key) as variant_key,
           coalesce(t.variant_id, a.variant_id) as variant_id,
           coalesce(t.qty, 0) as target,
           coalesce(t.qty, 0) - coalesce(a.qty, 0) as diff
    from target t
    full join applied a on a.menu_item_id = t.menu_item_id and a.variant_key = t.variant_key
  loop
    continue when r.diff = 0;
    with usage as (
      select sl.stock_item_id, sum(sl.quantity_per_unit * r.diff) as qty
      from public.stock_links sl
      where sl.menu_item_id = r.menu_item_id and sl.deleted_at is null
        and (sl.variant_id is null or sl.variant_id = r.variant_id)
      group by sl.stock_item_id
    ), moved as (
      update public.stock_items s set quantity = s.quantity - u.qty
      from usage u where s.id = u.stock_item_id
      returning s.id, u.qty
    )
    insert into public.stock_movements (stock_item_id, order_id, delta, reason, admin_id)
    select m.id, p_order_id, -m.qty, case when r.diff > 0 then 'order' else 'order_return' end, v_order.admin_id
    from moved m where m.qty <> 0;

    if r.target = 0 then
      delete from public.order_stock_applied where order_id = p_order_id and menu_item_id = r.menu_item_id and variant_key = r.variant_key;
    else
      insert into public.order_stock_applied (order_id, menu_item_id, variant_key, variant_id, admin_id, quantity, updated_at)
      values (p_order_id, r.menu_item_id, r.variant_key, r.variant_id, v_order.admin_id, r.target, now())
      on conflict (order_id, menu_item_id, variant_key) do update set quantity = excluded.quantity, updated_at = now();
    end if;
    v_changed := true;
  end loop;

  update public.orders set stock_deducted = true where id = p_order_id and not stock_deducted;
  return v_changed;
end $$;
grant execute on function public.deduct_stock_for_order(uuid) to authenticated;

create or replace function public.notify_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_old_status text := 'completed';
  v_old_revision uuid;
  v_old_total numeric := new.original_total;
  v_money text;
begin
  if new.is_test or auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' then
    v_old_status := old.status;
    v_old_revision := old.revision_id;
    v_old_total := old.total;
  end if;
  select name into v_name from public.profiles where id = auth.uid();
  v_name := coalesce(v_name, 'A cashier');
  if new.status = 'void' and v_old_status <> 'void' then
    v_money := replace(to_char(coalesce(v_old_total, new.total), 'FM999,999,999,990.00'), '.00', '');
    perform public.notify_admin(new.admin_id, 'Order cancelled',
      v_name || ' cancelled order ' || new.order_number || ' (' || v_money || ')' || coalesce(': ' || nullif(new.void_reason, ''), ''),
      jsonb_build_object('type', 'order_change', 'id', new.id));
  elsif new.status = 'completed' and new.revision_id is not null and new.revision_id is distinct from v_old_revision then
    perform public.notify_admin(new.admin_id, 'Order edited',
      v_name || ' edited order ' || new.order_number || ': '
        || replace(to_char(coalesce(v_old_total, new.total), 'FM999,999,999,990.00'), '.00', '') || ' -> '
        || replace(to_char(new.total, 'FM999,999,999,990.00'), '.00', ''),
      jsonb_build_object('type', 'order_change', 'id', new.id));
  end if;
  return new;
end $$;
revoke execute on function public.notify_order_change() from public, anon, authenticated;
drop trigger if exists orders_notify_change on public.orders;
create trigger orders_notify_change after insert or update of status, revision_id on public.orders
for each row execute function public.notify_order_change();

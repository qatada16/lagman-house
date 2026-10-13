-- Migration 007: live web orders (ticket numbers, response timer, alerts for cashiers and the admin, customer
-- receipt), cashier names kept on orders for reports, and a push to every device when a release is published.
-- Run after 006. Safe to re-run.

alter table public.orders add column if not exists cashier_label text;
alter table public.orders disable trigger orders_set_updated_at;
update public.orders o set cashier_label = p.name from public.profiles p where p.id = o.cashier_id and o.cashier_label is null;
alter table public.orders enable trigger orders_set_updated_at;

do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.conrelid = 'public.orders'::regclass and con.contype = 'f' and a.attname = 'cashier_id'
  loop
    execute format('alter table public.orders drop constraint %I', c);
  end loop;
end $$;

create or replace function public.fill_cashier_label() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.cashier_label := coalesce(old.cashier_label, new.cashier_label);
  end if;
  if new.cashier_label is null and new.cashier_id is not null then
    select p.name into new.cashier_label from public.profiles p where p.id = new.cashier_id;
  end if;
  return new;
end $$;
drop trigger if exists orders_fill_cashier_label on public.orders;
create trigger orders_fill_cashier_label before insert or update on public.orders
for each row execute function public.fill_cashier_label();

alter table public.customer_orders add column if not exists ticket_no int;
alter table public.customer_orders add column if not exists expires_at timestamptz;
alter table public.customer_orders add column if not exists cancel_reason text;
alter table public.customer_orders add column if not exists handled_by uuid;
alter table public.customer_orders add column if not exists claimed_by_name text;
alter table public.customer_orders drop constraint if exists customer_orders_status_check;
alter table public.customer_orders add constraint customer_orders_status_check
  check (status in ('pending', 'claimed', 'completed', 'cancelled', 'expired'));

create or replace function public.web_order_minutes(p_admin uuid) returns int
language sql stable security definer set search_path = public as $$
  select least(120, greatest(1, coalesce((
    select nullif(regexp_replace(s.value #>> '{}', '\D', '', 'g'), '')::int
    from public.tenant_settings s where s.admin_id = p_admin and s.key = 'web_order_minutes'
  ), 10)));
$$;

create or replace function public.prepare_customer_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('customer_ticket:' || coalesce(new.admin_id::text, '')));
  select coalesce(max(c.ticket_no), 0) + 1 into new.ticket_no
  from public.customer_orders c
  where c.admin_id is not distinct from new.admin_id and c.created_at >= date_trunc('day', now());
  new.expires_at := coalesce(new.expires_at, now() + make_interval(mins => public.web_order_minutes(new.admin_id)));
  return new;
end $$;
drop trigger if exists customer_orders_prepare on public.customer_orders;
create trigger customer_orders_prepare before insert on public.customer_orders
for each row execute function public.prepare_customer_order();

create or replace function public.notify_new_customer_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  tokens text[];
begin
  select coalesce(sum((i->>'quantity')::int), 0) into v_count from jsonb_array_elements(new.items) i;
  select array_agg(push_token) into tokens from public.profiles
  where push_token is not null and status = 'active'
    and ((role = 'cashier' and admin_id = new.admin_id) or id = new.admin_id);
  perform public.send_expo_push(tokens,
    'New web order #' || coalesce(new.ticket_no::text, ''),
    coalesce('Table ' || new.table_code || ': ', '') || v_count || ' item(s). Respond within '
      || greatest(1, ceil(extract(epoch from (new.expires_at - now())) / 60))::int || ' min.',
    jsonb_build_object('type', 'customer_order', 'id', new.id));
  return new;
end $$;
drop trigger if exists customer_orders_notify on public.customer_orders;
create trigger customer_orders_notify after insert on public.customer_orders
for each row execute function public.notify_new_customer_order();

create or replace function public.expire_customer_orders() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.customer_orders
     set status = 'expired', cancel_reason = coalesce(cancel_reason, 'timeout')
   where admin_id = public.tenant_id() and status = 'pending' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.expire_customer_orders() to authenticated;

create or replace function public.claim_customer_order(p_order_id uuid, p_cashier_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  if p_cashier_id <> auth.uid() then raise exception 'Cashier id must match the signed-in user'; end if;
  if not public.is_active_staff() then raise exception 'Account is not active'; end if;
  return query
    update public.customer_orders
       set status = 'claimed', claimed_by = p_cashier_id, claimed_at = now(),
           claimed_by_name = (select name from public.profiles where id = p_cashier_id)
     where id = p_order_id and status = 'pending' and admin_id = public.tenant_id()
       and (expires_at is null or expires_at >= now())
    returning *;
end $$;

create or replace function public.release_customer_order(p_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'pending', claimed_by = null, claimed_at = null, claimed_by_name = null,
           expires_at = greatest(coalesce(expires_at, now()), now() + interval '2 minutes')
     where id = p_order_id and status = 'claimed' and admin_id = public.tenant_id()
       and (claimed_by = auth.uid() or public.is_admin())
    returning *;
end $$;

create or replace function public.complete_customer_order(p_order_id uuid, p_completed_order_id uuid)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
declare v_row public.customer_orders%rowtype;
begin
  update public.customer_orders
     set status = 'completed', completed_order_id = p_completed_order_id, handled_by = auth.uid()
   where id = p_order_id and admin_id = public.tenant_id()
     and ((status = 'claimed' and (claimed_by = auth.uid() or public.is_admin()))
       or (status = 'completed' and completed_order_id = p_completed_order_id))
  returning * into v_row;
  if not found then raise exception 'web_order_not_open'; end if;
  return next v_row;
end $$;

create or replace function public.server_time() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.server_time() to authenticated;

create or replace function public.cancel_customer_order(p_order_id uuid, p_reason text)
returns setof public.customer_orders
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.customer_orders
       set status = 'cancelled', handled_by = auth.uid(), cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 160), '')
     where id = p_order_id and status in ('pending', 'claimed') and admin_id = public.tenant_id()
       and (claimed_by = auth.uid() or claimed_by is null or public.is_admin())
       and public.is_active_staff()
    returning *;
end $$;
grant execute on function public.cancel_customer_order(uuid, text) to authenticated;

create or replace function public.customer_order_status(p_order_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when status = 'pending' and expires_at < now() then 'expired' else status end
  from public.customer_orders where id = p_order_id and created_at > now() - interval '24 hours';
$$;
grant execute on function public.customer_order_status(uuid) to anon, authenticated;

create or replace function public.customer_order_info(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'ticket_no', c.ticket_no,
    'status', case when c.status = 'pending' and c.expires_at < now() then 'expired' else c.status end,
    'created_at', c.created_at,
    'expires_at', c.expires_at,
    'server_now', now(),
    'table_code', c.table_code,
    'cancel_reason', c.cancel_reason,
    'items', c.items,
    'currency', coalesce((select s.value #>> '{}' from public.tenant_settings s where s.admin_id = c.admin_id and s.key = 'currency_symbol'), 'Rs'),
    'order', (
      select jsonb_build_object(
        'order_number', o.order_number,
        'status', o.status,
        'subtotal', o.subtotal,
        'item_discount_total', o.item_discount_total,
        'coupon_code', o.coupon_code,
        'coupon_discount', o.coupon_discount,
        'savings_total', o.savings_total,
        'total', o.total,
        'payment_method', o.payment_method,
        'completed_at', coalesce(o.completed_at, o.created_at),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', oi.id, 'parent_id', oi.parent_item_id, 'name', oi.item_name, 'variant_name', oi.variant_name,
            'quantity', oi.quantity, 'unit_price', oi.unit_price, 'original_unit_price', oi.original_unit_price, 'line_total', oi.line_total
          ) order by oi.created_at, oi.id)
          from public.order_items oi
          where oi.order_id = o.id and oi.revision_id is not distinct from o.revision_id
        ), '[]'::jsonb)
      )
      from public.orders o where o.id = c.completed_order_id and o.admin_id = c.admin_id
    )
  )
  from public.customer_orders c
  where c.id = p_order_id and c.created_at > now() - interval '24 hours';
$$;
grant execute on function public.customer_order_info(uuid) to anon, authenticated;

create or replace function public.notify_new_release() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tokens text[];
  i int := 1;
begin
  if new.expires_at is not null and new.expires_at < now() then return new; end if;
  select array_agg(distinct push_token) into tokens from public.profiles where push_token is not null;
  if tokens is null then return new; end if;
  while i <= array_length(tokens, 1) loop
    perform public.send_expo_push(tokens[i:i + 99], 'Update available',
      'Lagman House ' || new.version || ' is ready. Open the app to install it.',
      jsonb_build_object('type', 'app_update', 'version', new.version));
    i := i + 100;
  end loop;
  return new;
end $$;
revoke execute on function public.notify_new_release() from public, anon, authenticated;
drop trigger if exists app_releases_notify on public.app_releases;
create trigger app_releases_notify after insert on public.app_releases
for each row execute function public.notify_new_release();

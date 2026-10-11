import { all, get, transaction, upsert } from '@/lib/db';
import { getDeviceCode, getDeviceId, newId, nextOrderSequence } from '@/lib/device';
import type { CartLine, Coupon, Order, OrderItem, PaymentMethod, Profile } from '@/lib/types';
import { buildOrder } from './buildOrder';
import { bumpCouponUseLocally } from '@/features/promos/promoRepo';
import { deductStockLocally } from '@/features/stock/stockRepo';
import { requestSync } from '@/features/sync/syncEngine';

type OrderRow = Omit<Order, 'is_test' | 'stock_deducted'> & { is_test: number; stock_deducted: number; is_dirty: number };

export interface OrderWithMeta extends Order {
  is_dirty: boolean;
  cashier_name?: string | null;
  edited_by_name?: string | null;
  voided_by_name?: string | null;
}

const toOrder = (r: OrderRow & { cashier_name?: string | null }): OrderWithMeta => ({
  ...r,
  admin_id: r.admin_id ?? null,
  edit_count: r.edit_count ?? 0,
  is_test: !!r.is_test,
  stock_deducted: !!r.stock_deducted,
  is_dirty: !!r.is_dirty,
});

const ORDER_SELECT = `SELECT o.*, p.name AS cashier_name, ep.name AS edited_by_name, vp.name AS voided_by_name
  FROM orders o
  LEFT JOIN profiles p ON p.id = o.cashier_id
  LEFT JOIN profiles ep ON ep.id = o.edited_by
  LEFT JOIN profiles vp ON vp.id = o.voided_by`;

export interface CreateOrderInput {
  id?: string;
  orderNumber?: string;
  cashierId: string;
  adminId: string | null;
  lines: CartLine[];
  note: string | null;
  isTest: boolean;
  amountReceived: number | null;
  paymentMethod: PaymentMethod | null;
  source: 'pos' | 'qr';
  customerOrderId?: string | null;
  tableCode?: string | null;
  coupon: Coupon | null;
}

export function createOrder(input: CreateOrderInput): { order: Order; items: OrderItem[] } {
  const id = input.id ?? newId();
  const orderNumber = input.orderNumber ?? `${getDeviceCode()}-${nextOrderSequence()}`;
  const { order, items } = buildOrder(input.lines, {
    id,
    orderNumber,
    cashierId: input.cashierId,
    adminId: input.adminId,
    note: input.note ?? '',
    isTest: input.isTest,
    amountReceived: input.amountReceived,
    paymentMethod: input.paymentMethod,
    source: input.source,
    tableCode: input.tableCode,
    customerOrderId: input.customerOrderId,
    coupon: input.coupon,
    deviceId: getDeviceId(),
    itemId: () => newId(),
  });

  transaction(() => {
    upsert('orders', { ...order, is_test: order.is_test ? 1 : 0, stock_deducted: 0, is_dirty: 1 });
    for (const it of items) upsert('order_items', { ...it, is_dirty: 1 });
    if (!order.is_test) {
      deductStockLocally(id);
      if (order.coupon_id) bumpCouponUseLocally(order.coupon_id);
    }
  });
  requestSync(500);
  return { order, items };
}

export function getOrder(id: string): OrderWithMeta | null {
  const r = get<OrderRow & { cashier_name: string | null }>(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  return r ? toOrder(r) : null;
}

export function listRecentOrders(profile: Profile | null, since: Date): (OrderWithMeta & { item_count: number })[] {
  if (!profile) return [];
  const tenant = profile.role === 'admin' ? profile.id : profile.admin_id;
  const clauses = ['o.created_at >= ?', 'o.admin_id = ?'];
  const params: string[] = [since.toISOString(), tenant ?? ''];
  if (profile.role !== 'admin') {
    clauses.push('o.cashier_id = ?');
    params.push(profile.id);
  }
  return all<OrderRow & { cashier_name: string | null; item_count: number }>(
    `SELECT q.*, (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = q.id AND oi.parent_item_id IS NULL AND oi.revision_id IS q.revision_id) AS item_count
     FROM (${ORDER_SELECT} WHERE ${clauses.join(' AND ')}) q
     ORDER BY q.created_at DESC LIMIT 500`,
    params
  ).map((r) => ({ ...toOrder(r), item_count: r.item_count }));
}

export function getOrderItems(orderId: string): OrderItem[] {
  return all<OrderItem>(
    `SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.order_id = ? AND oi.revision_id IS o.revision_id
     ORDER BY COALESCE((SELECT p.rowid FROM order_items p WHERE p.id = oi.parent_item_id), oi.rowid), oi.parent_item_id IS NOT NULL, oi.rowid`,
    [orderId]
  );
}

export interface OrderFilter {
  cashierId?: string | null;
  adminId: string | null;
  from: Date;
  to: Date;
  includeTest?: boolean;
  status?: 'completed' | 'void';
}

function whereFor(f: OrderFilter) {
  const clauses = ['o.created_at >= ?', 'o.created_at < ?', 'o.status = ?'];
  const params: (string | number)[] = [f.from.toISOString(), f.to.toISOString(), f.status ?? 'completed'];
  if (f.cashierId) {
    clauses.push('o.cashier_id = ?');
    params.push(f.cashierId);
  }
  clauses.push('o.admin_id = ?');
  params.push(f.adminId ?? '');
  if (!f.includeTest) clauses.push('o.is_test = 0');
  return { where: clauses.join(' AND '), params };
}

export function listOrders(f: OrderFilter, limit = 200): OrderWithMeta[] {
  const { where, params } = whereFor(f);
  return all<OrderRow & { cashier_name: string | null }>(
    `SELECT o.*, p.name AS cashier_name FROM orders o LEFT JOIN profiles p ON p.id = o.cashier_id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT ?`,
    [...params, limit]
  ).map(toOrder);
}

export function listOrdersWithCounts(f: OrderFilter, limit = 1000): (OrderWithMeta & { item_count: number })[] {
  const { where, params } = whereFor(f);
  return all<OrderRow & { cashier_name: string | null; item_count: number }>(
    `SELECT q.*, (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = q.id AND oi.parent_item_id IS NULL AND oi.revision_id IS q.revision_id) AS item_count
     FROM (${ORDER_SELECT} WHERE ${where}) q ORDER BY q.created_at DESC LIMIT ?`,
    [...params, limit]
  ).map((r) => ({ ...toOrder(r), item_count: r.item_count }));
}

export function cancelledSummary(f: OrderFilter): { count: number; value: number } {
  const { where, params } = whereFor({ ...f, status: 'void' });
  const r = get<{ count: number; value: number | null }>(`SELECT COUNT(*) AS count, SUM(o.total) AS value FROM orders o WHERE ${where}`, params);
  return { count: r?.count ?? 0, value: r?.value ?? 0 };
}

export interface Analytics {
  revenue: number;
  count: number;
  average: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}

export function analytics(f: OrderFilter): Analytics {
  const { where, params } = whereFor(f);
  const totals = get<{ revenue: number | null; count: number }>(`SELECT SUM(o.total) AS revenue, COUNT(*) AS count FROM orders o WHERE ${where}`, params);
  const topItems = all<{ name: string; quantity: number; revenue: number }>(
    `SELECT CASE WHEN oi.variant_name IS NULL THEN oi.item_name ELSE oi.item_name || ' (' || oi.variant_name || ')' END AS name,
            SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE ${where} AND oi.revision_id IS o.revision_id AND (oi.parent_item_id IS NULL OR oi.deal_id IS NOT NULL) AND NOT (oi.parent_item_id IS NULL AND oi.deal_id IS NOT NULL)
     GROUP BY name ORDER BY quantity DESC LIMIT 10`,
    params
  );
  const revenue = totals?.revenue ?? 0;
  const count = totals?.count ?? 0;
  return { revenue, count, average: count ? revenue / count : 0, topItems };
}

export interface DayBucket {
  day: string;
  revenue: number;
  count: number;
}

export function ordersByDay(f: OrderFilter): DayBucket[] {
  const { where, params } = whereFor(f);
  return all<DayBucket>(
    `SELECT substr(o.created_at, 1, 10) AS day, SUM(o.total) AS revenue, COUNT(*) AS count
     FROM orders o WHERE ${where} GROUP BY day ORDER BY day`,
    params
  );
}

export interface CashierStat {
  cashier_id: string | null;
  name: string;
  count: number;
  revenue: number;
  average: number;
}

export function cashierStats(f: OrderFilter): CashierStat[] {
  const { where, params } = whereFor(f);
  return all<CashierStat>(
    `SELECT o.cashier_id, COALESCE(p.name, '-') AS name, COUNT(*) AS count, SUM(o.total) AS revenue, AVG(o.total) AS average
     FROM orders o LEFT JOIN profiles p ON p.id = o.cashier_id
     WHERE ${where} GROUP BY o.cashier_id ORDER BY count DESC`,
    params
  );
}

export interface HourStat {
  hour: number;
  count: number;
  revenue: number;
}

export function hourlyStats(f: OrderFilter): HourStat[] {
  const { where, params } = whereFor(f);
  const rows = all<{ hour: string; count: number; revenue: number }>(
    `SELECT strftime('%H', o.created_at, 'localtime') AS hour, COUNT(*) AS count, SUM(o.total) AS revenue
     FROM orders o WHERE ${where} GROUP BY hour ORDER BY hour`,
    params
  );
  const byHour = new Map(rows.map((r) => [Number(r.hour), r]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: byHour.get(h)?.count ?? 0, revenue: byHour.get(h)?.revenue ?? 0 }));
}

export interface ItemStat {
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export function itemStats(f: OrderFilter): ItemStat[] {
  const { where, params } = whereFor(f);
  return all<ItemStat>(
    `SELECT CASE WHEN oi.variant_name IS NULL THEN oi.item_name ELSE oi.item_name || ' (' || oi.variant_name || ')' END AS name,
            SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue, COUNT(DISTINCT oi.order_id) AS orders
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE ${where} AND oi.revision_id IS o.revision_id AND NOT (oi.parent_item_id IS NULL AND oi.deal_id IS NOT NULL)
     GROUP BY name ORDER BY quantity DESC`,
    params
  );
}

export function countUnsyncedOrders() {
  return get<{ c: number }>('SELECT COUNT(*) AS c FROM orders WHERE is_dirty = 1')?.c ?? 0;
}

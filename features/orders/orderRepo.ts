import { all, get, nowIso, transaction, upsert } from '@/lib/db';
import { getDeviceCode, getDeviceId, newId, nextOrderSequence } from '@/lib/device';
import type { CartLine, Order, OrderItem, PaymentMethod } from '@/lib/types';
import { deductStockLocally } from '@/features/stock/stockRepo';
import { requestSync } from '@/features/sync/syncEngine';

type OrderRow = Omit<Order, 'is_test' | 'stock_deducted'> & { is_test: number; stock_deducted: number; is_dirty: number };

export interface OrderWithMeta extends Order {
  is_dirty: boolean;
  cashier_name?: string | null;
}

const toOrder = (r: OrderRow & { cashier_name?: string | null }): OrderWithMeta => ({
  ...r,
  admin_id: r.admin_id ?? null,
  is_test: !!r.is_test,
  stock_deducted: !!r.stock_deducted,
  is_dirty: !!r.is_dirty,
});

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
}

export function createOrder(input: CreateOrderInput): { order: Order; items: OrderItem[] } {
  const now = nowIso();
  const id = input.id ?? newId();
  const orderNumber = input.orderNumber ?? `${getDeviceCode()}-${nextOrderSequence()}`;
  const subtotal = round2(input.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0));
  const order: Order = {
    id,
    order_number: orderNumber,
    cashier_id: input.cashierId,
    admin_id: input.adminId,
    status: 'completed',
    source: input.source,
    customer_order_id: input.customerOrderId ?? null,
    table_code: input.tableCode ?? null,
    subtotal,
    total: subtotal,
    amount_received: input.amountReceived,
    payment_method: input.paymentMethod,
    note: input.note?.trim() || null,
    is_test: input.isTest,
    stock_deducted: false,
    device_id: getDeviceId(),
    created_at: now,
    completed_at: now,
    updated_at: now,
  };
  const items: OrderItem[] = input.lines.map((l) => ({
    id: newId(),
    order_id: id,
    admin_id: input.adminId,
    menu_item_id: l.menu_item_id,
    variant_id: l.variant_id,
    item_name: l.name,
    variant_name: l.variant_name,
    unit_price: l.unit_price,
    quantity: l.quantity,
    line_total: round2(l.unit_price * l.quantity),
    created_at: now,
    updated_at: now,
  }));

  transaction(() => {
    upsert('orders', { ...order, is_test: order.is_test ? 1 : 0, stock_deducted: 0, is_dirty: 1 });
    for (const it of items) upsert('order_items', { ...it, is_dirty: 1 });
    // Hard gate: test orders never touch stock, locally or on the server.
    if (!order.is_test) deductStockLocally(id);
  });
  requestSync(500);
  return { order, items };
}

export function getOrder(id: string): OrderWithMeta | null {
  const r = get<OrderRow & { cashier_name: string | null }>(
    'SELECT o.*, p.name AS cashier_name FROM orders o LEFT JOIN profiles p ON p.id = o.cashier_id WHERE o.id = ?',
    [id]
  );
  return r ? toOrder(r) : null;
}

export function getOrderItems(orderId: string): OrderItem[] {
  return all<OrderItem>('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at', [orderId]);
}

export interface OrderFilter {
  cashierId?: string | null;
  adminId: string | null;
  from: Date;
  to: Date;
  includeTest?: boolean;
}

function whereFor(f: OrderFilter) {
  const clauses = ['o.created_at >= ?', 'o.created_at < ?', "o.status = 'completed'"];
  const params: (string | number)[] = [f.from.toISOString(), f.to.toISOString()];
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
    `SELECT o.*, p.name AS cashier_name,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o LEFT JOIN profiles p ON p.id = o.cashier_id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT ?`,
    [...params, limit]
  ).map((r) => ({ ...toOrder(r), item_count: r.item_count }));
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
     WHERE ${where}
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
     WHERE ${where} GROUP BY name ORDER BY quantity DESC`,
    params
  );
}

export function countUnsyncedOrders() {
  return get<{ c: number }>('SELECT COUNT(*) AS c FROM orders WHERE is_dirty = 1')?.c ?? 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

import { all, get, nowIso, run, transaction, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import { getTenantId, requireTenantId } from '@/lib/tenant';
import type { StockItem, StockPurchase } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';
import { saveExpense } from '@/features/expenses/expenseRepo';

export const STOCK_UNITS = ['g', 'kg', 'ml', 'l', 'pcs'] as const;
const tenant = () => getTenantId() ?? '';

export function listStockItems(): StockItem[] {
  return all<StockItem>('SELECT * FROM stock_items WHERE admin_id = ? AND deleted_at IS NULL ORDER BY name', [tenant()]);
}

export function getStockItem(id: string): StockItem | null {
  return get<StockItem>('SELECT * FROM stock_items WHERE id = ? AND admin_id = ?', [id, tenant()]);
}

export function saveStockItem(input: { id?: string; name: string; unit: string; quantity: number; low_threshold: number | null }): StockItem {
  const adminId = requireTenantId();
  const now = nowIso();
  const existing = input.id ? getStockItem(input.id) : null;
  const row: StockItem & { is_dirty: number } = {
    id: input.id ?? newId(),
    admin_id: adminId,
    name: input.name.trim(),
    unit: input.unit,
    quantity: input.quantity,
    low_threshold: input.low_threshold,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('stock_items', row);
  requestSync();
  return row;
}

export function deleteStockItem(id: string) {
  const now = nowIso();
  run('UPDATE stock_items SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  run('UPDATE stock_links SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE stock_item_id = ? AND deleted_at IS NULL', [now, now, id]);
  requestSync();
}

export function lowStockItems(): StockItem[] {
  return all<StockItem>(
    'SELECT * FROM stock_items WHERE admin_id = ? AND deleted_at IS NULL AND low_threshold IS NOT NULL AND quantity <= low_threshold ORDER BY name',
    [tenant()]
  );
}

export function stockUsageCount(stockId: string) {
  return get<{ c: number }>('SELECT COUNT(DISTINCT menu_item_id) AS c FROM stock_links WHERE stock_item_id = ? AND deleted_at IS NULL', [stockId])?.c ?? 0;
}

export function deductStockLocally(orderId: string) {
  const rows = all<{ stock_item_id: string; qty: number }>(
    `SELECT sl.stock_item_id, SUM(sl.quantity_per_unit * oi.quantity) AS qty
     FROM order_items oi
     JOIN stock_links sl ON sl.menu_item_id = oi.menu_item_id
       AND sl.deleted_at IS NULL
       AND (sl.variant_id IS NULL OR sl.variant_id = oi.variant_id)
     WHERE oi.order_id = ?
     GROUP BY sl.stock_item_id`,
    [orderId]
  );
  for (const r of rows) run('UPDATE stock_items SET quantity = quantity - ? WHERE id = ?', [r.qty, r.stock_item_id]);
}

export interface PurchaseInput {
  stockItemId: string;
  quantity: number;
  unitCost: number;
  supplier?: string | null;
  note?: string | null;
  purchasedAt?: string;
  recordExpense: boolean;
}

export function recordPurchase(input: PurchaseInput): StockPurchase {
  const adminId = requireTenantId();
  const now = nowIso();
  const item = getStockItem(input.stockItemId);
  if (!item) throw new Error('Stock item not found');
  const totalCost = Math.round(input.quantity * input.unitCost * 100) / 100;
  const purchase: StockPurchase = {
    id: newId(),
    admin_id: adminId,
    stock_item_id: input.stockItemId,
    quantity: input.quantity,
    unit_cost: input.unitCost,
    total_cost: totalCost,
    supplier: input.supplier?.trim() || null,
    note: input.note?.trim() || null,
    purchased_at: input.purchasedAt ?? now,
    expense_id: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };
  transaction(() => {
    if (input.recordExpense && totalCost > 0) {
      const expense = saveExpense({
        title: `${item.name} ${input.quantity} ${item.unit}`,
        amount: -totalCost,
        category: 'stock',
        occurred_at: purchase.purchased_at,
        note: purchase.supplier,
        source: 'stock',
        stock_purchase_id: purchase.id,
      }, false);
      purchase.expense_id = expense.id;
    }
    upsert('stock_purchases', { ...purchase, is_dirty: 1 });
    run('UPDATE stock_items SET quantity = quantity + ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [input.quantity, now, input.stockItemId]);
  });
  requestSync();
  return purchase;
}

export function deletePurchase(id: string) {
  const now = nowIso();
  const p = get<StockPurchase>('SELECT * FROM stock_purchases WHERE id = ?', [id]);
  if (!p) return;
  transaction(() => {
    run('UPDATE stock_purchases SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
    run('UPDATE stock_items SET quantity = quantity - ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [p.quantity, now, p.stock_item_id]);
    if (p.expense_id) run('UPDATE expenses SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, p.expense_id]);
  });
  requestSync();
}

export function listPurchases(opts: { stockItemId?: string; from?: Date; to?: Date } = {}): (StockPurchase & { stock_name: string; unit: string })[] {
  const clauses = ['p.admin_id = ?', 'p.deleted_at IS NULL'];
  const params: (string | number)[] = [tenant()];
  if (opts.stockItemId) {
    clauses.push('p.stock_item_id = ?');
    params.push(opts.stockItemId);
  }
  if (opts.from) {
    clauses.push('p.purchased_at >= ?');
    params.push(opts.from.toISOString());
  }
  if (opts.to) {
    clauses.push('p.purchased_at < ?');
    params.push(opts.to.toISOString());
  }
  return all(
    `SELECT p.*, s.name AS stock_name, s.unit FROM stock_purchases p JOIN stock_items s ON s.id = p.stock_item_id
     WHERE ${clauses.join(' AND ')} ORDER BY p.purchased_at DESC`,
    params
  );
}

export interface PurchaseSummary {
  total: number;
  count: number;
  byItem: { name: string; quantity: number; total: number; unit: string }[];
  byMonth: { month: string; total: number }[];
}

export function purchaseSummary(from: Date, to: Date): PurchaseSummary {
  const params = [tenant(), from.toISOString(), to.toISOString()];
  const where = 'p.admin_id = ? AND p.deleted_at IS NULL AND p.purchased_at >= ? AND p.purchased_at < ?';
  const totals = get<{ total: number | null; count: number }>(`SELECT SUM(p.total_cost) AS total, COUNT(*) AS count FROM stock_purchases p WHERE ${where}`, params);
  const byItem = all<{ name: string; quantity: number; total: number; unit: string }>(
    `SELECT s.name, s.unit, SUM(p.quantity) AS quantity, SUM(p.total_cost) AS total
     FROM stock_purchases p JOIN stock_items s ON s.id = p.stock_item_id WHERE ${where} GROUP BY s.id ORDER BY total DESC LIMIT 12`,
    params
  );
  const byMonth = all<{ month: string; total: number }>(
    `SELECT substr(p.purchased_at, 1, 7) AS month, SUM(p.total_cost) AS total FROM stock_purchases p WHERE ${where} GROUP BY month ORDER BY month`,
    params
  );
  return { total: totals?.total ?? 0, count: totals?.count ?? 0, byItem, byMonth };
}

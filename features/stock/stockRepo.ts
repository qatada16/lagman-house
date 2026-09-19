import { all, get, nowIso, run, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import type { StockItem } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

export const STOCK_UNITS = ['g', 'kg', 'ml', 'l', 'pcs'] as const;

export function listStockItems(): StockItem[] {
  return all<StockItem>('SELECT * FROM stock_items WHERE deleted_at IS NULL ORDER BY name');
}

export function getStockItem(id: string): StockItem | null {
  return get<StockItem>('SELECT * FROM stock_items WHERE id = ?', [id]);
}

export function saveStockItem(input: { id?: string; name: string; unit: string; quantity: number; low_threshold: number | null }): StockItem {
  const now = nowIso();
  const existing = input.id ? getStockItem(input.id) : null;
  const row: StockItem & { is_dirty: number } = {
    id: input.id ?? newId(),
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
  return all<StockItem>('SELECT * FROM stock_items WHERE deleted_at IS NULL AND low_threshold IS NOT NULL AND quantity <= low_threshold ORDER BY name');
}

export function stockUsageCount(stockId: string) {
  return get<{ c: number }>('SELECT COUNT(DISTINCT menu_item_id) AS c FROM stock_links WHERE stock_item_id = ? AND deleted_at IS NULL', [stockId])?.c ?? 0;
}

// Local, immediate deduction. Not marked dirty: the server recomputes from the order.
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

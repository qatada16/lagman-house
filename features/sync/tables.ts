export interface SyncTable {
  name: string;
  key: 'id' | 'key';
  boolCols: string[];
  jsonCols: string[];
  pull: boolean;
  push: boolean;
  // profiles rows belong to other users; only UPDATE passes RLS for admins.
  pushMode: 'upsert' | 'update';
}

// Push order matters: parents before children.
export const SYNC_TABLES: SyncTable[] = [
  { name: 'profiles', key: 'id', boolCols: ['phone_confirmed'], jsonCols: [], pull: true, push: true, pushMode: 'update' },
  { name: 'settings', key: 'key', boolCols: [], jsonCols: ['value'], pull: true, push: true, pushMode: 'upsert' },
  { name: 'categories', key: 'id', boolCols: ['is_active'], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'menu_items', key: 'id', boolCols: ['has_variants', 'is_active'], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'menu_item_variants', key: 'id', boolCols: [], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'stock_items', key: 'id', boolCols: [], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'stock_links', key: 'id', boolCols: [], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'receipt_templates', key: 'id', boolCols: ['is_active'], jsonCols: ['config'], pull: true, push: true, pushMode: 'upsert' },
  { name: 'qr_tables', key: 'id', boolCols: ['is_active'], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'orders', key: 'id', boolCols: ['is_test', 'stock_deducted'], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
  { name: 'order_items', key: 'id', boolCols: [], jsonCols: [], pull: true, push: true, pushMode: 'upsert' },
];

type Row = Record<string, unknown>;

export function fromServer(t: SyncTable, row: Row): Row {
  const out: Row = { ...row, is_dirty: 0 };
  for (const c of t.boolCols) out[c] = row[c] ? 1 : 0;
  for (const c of t.jsonCols) out[c] = JSON.stringify(row[c] ?? null);
  if (t.name === 'orders') delete out.seq;
  return out;
}

export function toServer(t: SyncTable, row: Row): Row {
  const out: Row = { ...row };
  delete out.is_dirty;
  for (const c of t.boolCols) out[c] = !!row[c];
  for (const c of t.jsonCols) {
    const v = row[c];
    out[c] = typeof v === 'string' ? safeParse(v) : v;
  }
  return out;
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export interface SyncTable {
  name: string;
  boolCols: string[];
  jsonCols: string[];
  pushMode: 'upsert' | 'update';
}

export const SYNC_TABLES: SyncTable[] = [
  { name: 'profiles', boolCols: ['phone_confirmed', 'menu_is_default'], jsonCols: [], pushMode: 'update' },
  { name: 'tenant_settings', boolCols: [], jsonCols: ['value'], pushMode: 'upsert' },
  { name: 'categories', boolCols: ['is_active'], jsonCols: [], pushMode: 'upsert' },
  { name: 'menu_items', boolCols: ['has_variants', 'is_active'], jsonCols: [], pushMode: 'upsert' },
  { name: 'menu_item_variants', boolCols: [], jsonCols: [], pushMode: 'upsert' },
  { name: 'stock_items', boolCols: [], jsonCols: [], pushMode: 'upsert' },
  { name: 'stock_links', boolCols: [], jsonCols: [], pushMode: 'upsert' },
  { name: 'stock_purchases', boolCols: [], jsonCols: [], pushMode: 'upsert' },
  { name: 'expenses', boolCols: [], jsonCols: [], pushMode: 'upsert' },
  { name: 'receipt_templates', boolCols: ['is_active'], jsonCols: ['config'], pushMode: 'upsert' },
  { name: 'orders', boolCols: ['is_test', 'stock_deducted'], jsonCols: [], pushMode: 'upsert' },
  { name: 'order_items', boolCols: [], jsonCols: [], pushMode: 'upsert' },
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
  if (t.name === 'profiles') {
    delete out.menu_token;
    delete out.menu_is_default;
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

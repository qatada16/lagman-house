import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('lagman-house.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
  table_name TEXT PRIMARY KEY,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_confirmed INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  push_token TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  admin_id TEXT,
  menu_token TEXT,
  menu_is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_settings_key ON tenant_settings(admin_id, key);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  name TEXT NOT NULL,
  name_ur TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  category_id TEXT,
  name TEXT NOT NULL,
  name_ur TEXT,
  description TEXT,
  image_url TEXT,
  base_price REAL NOT NULL DEFAULT 0,
  has_variants INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_item_variants (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_item ON menu_item_variants(menu_item_id);

CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  quantity REAL NOT NULL DEFAULT 0,
  low_threshold REAL,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_links (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  menu_item_id TEXT NOT NULL,
  variant_id TEXT,
  stock_item_id TEXT NOT NULL,
  quantity_per_unit REAL NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_links_item ON stock_links(menu_item_id);

CREATE TABLE IF NOT EXISTS stock_purchases (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  stock_item_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  supplier TEXT,
  note TEXT,
  purchased_at TEXT NOT NULL,
  expense_id TEXT,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchases_stock ON stock_purchases(stock_item_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  occurred_at TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  stock_purchase_id TEXT,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(occurred_at);

CREATE TABLE IF NOT EXISTS receipt_templates (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}',
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  cashier_id TEXT,
  admin_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  source TEXT NOT NULL DEFAULT 'pos',
  customer_order_id TEXT,
  table_code TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_received REAL,
  payment_method TEXT,
  note TEXT,
  is_test INTEGER NOT NULL DEFAULT 0,
  stock_deducted INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  created_at TEXT,
  completed_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_id);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  admin_id TEXT,
  menu_item_id TEXT,
  variant_id TEXT,
  item_name TEXT NOT NULL,
  variant_name TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

const TENANT_TABLES = [
  'tenant_settings',
  'categories',
  'menu_items',
  'menu_item_variants',
  'stock_items',
  'stock_links',
  'stock_purchases',
  'expenses',
  'receipt_templates',
  'orders',
  'order_items',
  'profiles',
];

const COLUMN_MIGRATIONS: [string, string, string][] = [
  ['profiles', 'admin_id', 'TEXT'],
  ['profiles', 'menu_token', 'TEXT'],
  ['profiles', 'menu_is_default', 'INTEGER NOT NULL DEFAULT 0'],
  ['orders', 'admin_id', 'TEXT'],
  ['order_items', 'admin_id', 'TEXT'],
  ['categories', 'admin_id', 'TEXT'],
  ['menu_items', 'admin_id', 'TEXT'],
  ['menu_item_variants', 'admin_id', 'TEXT'],
  ['stock_items', 'admin_id', 'TEXT'],
  ['stock_links', 'admin_id', 'TEXT'],
  ['receipt_templates', 'admin_id', 'TEXT'],
];

let initialized = false;

function migrate() {
  for (const [table, column, type] of COLUMN_MIGRATIONS) {
    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  db.execSync('DROP TABLE IF EXISTS settings');
  db.execSync('DROP TABLE IF EXISTS qr_tables');
}

export function initDb() {
  if (initialized) return;
  db.execSync(SCHEMA);
  migrate();
  initialized = true;
}

type Row = Record<string, unknown>;

export function all<T = Row>(sql: string, params: SQLite.SQLiteBindParams = []): T[] {
  return db.getAllSync<T>(sql, params);
}

export function get<T = Row>(sql: string, params: SQLite.SQLiteBindParams = []): T | null {
  return db.getFirstSync<T>(sql, params) ?? null;
}

export function run(sql: string, params: SQLite.SQLiteBindParams = []) {
  return db.runSync(sql, params);
}

export function transaction(fn: () => void) {
  db.withTransactionSync(fn);
}

export function upsert<T extends object>(table: string, input: T) {
  const row = input as unknown as Row;
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`).join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}`;
  run(sql, keys.map((k) => toSqlValue(row[k])));
}

function toSqlValue(v: unknown): SQLite.SQLiteBindValue {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v as SQLite.SQLiteBindValue;
}

export function kvGet(key: string): string | null {
  const row = get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function kvSet(key: string, value: string | null) {
  if (value === null) run('DELETE FROM kv WHERE key = ?', [key]);
  else run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export function nowIso() {
  return new Date().toISOString();
}

export function clearUserData() {
  transaction(() => {
    for (const t of TENANT_TABLES) run(`DELETE FROM ${t}`);
    run('DELETE FROM sync_meta');
    run("DELETE FROM kv WHERE key IN ('current_user_id', 'last_sync_at')");
  });
}

initDb();

import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { all, get, kvGet, kvSet, nowIso, run, upsert } from '@/lib/db';
import { useSyncStore } from '@/store/syncStore';
import { SYNC_TABLES, fromServer, toServer, type SyncTable } from './tables';
import { hasPendingUpload, processPendingUploads } from './uploads';

const EPOCH = '1970-01-01T00:00:00.000Z';
const PAGE = 500;
const PUSH_CHUNK = 100;
const BACKOFF_STEPS_MS = [30_000, 60_000, 120_000, 300_000, 900_000];

let running = false;
let queued = false;
let aborted = false;
let backoffIndex = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

type Row = Record<string, unknown>;

export interface SyncResult {
  ok: boolean;
  pulled: number;
  pushed: number;
  error?: string;
}

function getMeta(table: string) {
  return get<{ last_synced_at: string }>('SELECT last_synced_at FROM sync_meta WHERE table_name = ?', [table])?.last_synced_at ?? null;
}

function setMeta(table: string, value: string) {
  run('INSERT INTO sync_meta (table_name, last_synced_at) VALUES (?, ?) ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at', [table, value]);
}

export function countPending() {
  let n = 0;
  for (const t of SYNC_TABLES) {
    n += get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t.name} WHERE is_dirty = 1`)?.c ?? 0;
  }
  useSyncStore.getState().set({ pendingCount: n });
  return n;
}

async function pullTable(t: SyncTable): Promise<number> {
  const since = getMeta(t.name) ?? EPOCH;
  let from = 0;
  let maxUpdated = since;
  let pulled = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(t.name)
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${t.name}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    for (const row of rows) {
      const id = row.id as string;
      const local = get<{ is_dirty: number }>(`SELECT is_dirty FROM ${t.name} WHERE id = ?`, [id]);
      if (local?.is_dirty) continue; // local edit wins until it is pushed
      const incoming = fromServer(t, row);
      if (t.name === 'menu_items' && hasPendingUpload('menu_items', id, 'image_url')) delete incoming.image_url;
      upsert(t.name, incoming);
      pulled++;
      const u = row.updated_at as string;
      if (u > maxUpdated) maxUpdated = u;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  if (maxUpdated !== since) setMeta(t.name, maxUpdated);
  return pulled;
}

async function pushRows(t: SyncTable, rows: Row[]) {
  const payload = rows.map((r) => toServer(t, r));
  if (t.pushMode === 'update') {
    for (const r of payload) {
      const { error } = await supabase.from(t.name).update(r).eq('id', r.id as string);
      if (error) throw new Error(`${t.name}: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from(t.name).upsert(payload, { onConflict: 'id' });
    if (error) throw new Error(`${t.name}: ${error.message}`);
  }
  for (const r of rows) {
    run(`UPDATE ${t.name} SET is_dirty = 0 WHERE id = ? AND updated_at = ?`, [r.id as string, r.updated_at as string]);
  }
}

async function pushTable(t: SyncTable): Promise<number> {
  const rows = all<Row>(`SELECT * FROM ${t.name} WHERE is_dirty = 1`);
  if (rows.length === 0) return 0;
  let pushed = 0;
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    try {
      await pushRows(t, chunk);
      pushed += chunk.length;
    } catch (e) {
      // Fall back to single rows so one bad row does not block the rest.
      for (const r of chunk) {
        try {
          await pushRows(t, [r]);
          pushed++;
        } catch (inner) {
          console.warn('[sync] row push failed', t.name, r.id, (inner as Error).message);
          throw inner;
        }
      }
    }
  }
  return pushed;
}

// Server-side deduction is authoritative and idempotent per order id.
async function reconcileStock(): Promise<boolean> {
  const orders = all<{ id: string }>(
    'SELECT id FROM orders WHERE is_dirty = 0 AND is_test = 0 AND stock_deducted = 0 AND status = ?',
    ['completed']
  );
  let touched = false;
  for (const o of orders) {
    const { error } = await supabase.rpc('deduct_stock_for_order', { p_order_id: o.id });
    if (error) throw new Error(`deduct_stock_for_order: ${error.message}`);
    run('UPDATE orders SET stock_deducted = 1 WHERE id = ?', [o.id]);
    touched = true;
  }
  return touched;
}

export async function runSync(reason = 'manual'): Promise<SyncResult> {
  if (running) {
    queued = true;
    return { ok: false, pulled: 0, pushed: 0, error: 'busy' };
  }
  const store = useSyncStore.getState();
  const net = await NetInfo.fetch();
  const online = !!net.isConnected && net.isInternetReachable !== false;
  store.set({ online });
  if (!online) {
    store.set({ status: 'offline' });
    countPending();
    return { ok: false, pulled: 0, pushed: 0, error: 'offline' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    countPending();
    return { ok: false, pulled: 0, pushed: 0, error: 'no-session' };
  }

  running = true;
  aborted = false;
  store.set({ status: 'syncing' });
  let pulled = 0;
  let pushed = 0;
  try {
    for (const t of SYNC_TABLES) {
      if (aborted) throw new Error('aborted');
      pulled += await pullTable(t);
    }
    if (aborted) throw new Error('aborted');
    await processPendingUploads();
    for (const t of SYNC_TABLES) {
      if (aborted) throw new Error('aborted');
      pushed += await pushTable(t);
    }
    if (aborted) throw new Error('aborted');
    if (await reconcileStock()) {
      const stock = SYNC_TABLES.find((t) => t.name === 'stock_items');
      if (stock) pulled += await pullTable(stock);
    }
    const now = nowIso();
    kvSet('last_sync_at', now);
    backoffIndex = 0;
    store.set({ status: 'idle', lastSyncAt: now, lastError: null });
    countPending();
    console.log(`[sync] ${reason}: pulled ${pulled}, pushed ${pushed}`);
    return { ok: true, pulled, pushed };
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'aborted') {
      store.set({ status: 'idle' });
      return { ok: false, pulled, pushed, error: message };
    }
    console.warn('[sync] failed', message);
    store.set({ status: 'error', lastError: message });
    countPending();
    scheduleRetry();
    return { ok: false, pulled, pushed, error: message };
  } finally {
    running = false;
    if (queued) {
      queued = false;
      setTimeout(() => void runSync('queued'), 500);
    }
  }
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = BACKOFF_STEPS_MS[Math.min(backoffIndex, BACKOFF_STEPS_MS.length - 1)];
  backoffIndex++;
  retryTimer = setTimeout(() => void runSync('retry'), delay);
}

// Called after every local write; coalesces bursts into one push.
export function requestSync(delayMs = 1500) {
  countPending();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void runSync('local-write'), delayMs);
}

export function abortSync() {
  aborted = true;
  queued = false;
  if (retryTimer) clearTimeout(retryTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
}

export function resetSyncState() {
  run('DELETE FROM sync_meta');
  kvSet('last_sync_at', null);
  useSyncStore.getState().set({ lastSyncAt: null, pendingCount: 0, status: 'idle', lastError: null });
}

export function loadSyncState() {
  useSyncStore.getState().set({ lastSyncAt: kvGet('last_sync_at') });
  countPending();
}

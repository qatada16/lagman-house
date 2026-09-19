import { all, get, nowIso, run, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import type { QrTable } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';
import { PUBLIC_MENU_URL } from '@/lib/supabase';

type Row = Omit<QrTable, 'is_active'> & { is_active: number };
const toTable = (r: Row): QrTable => ({ ...r, is_active: !!r.is_active });

export function listTables(): QrTable[] {
  return all<Row>('SELECT * FROM qr_tables WHERE deleted_at IS NULL ORDER BY label').map(toTable);
}

export function saveTable(input: { id?: string; code: string; label: string; is_active: boolean }): QrTable {
  const now = nowIso();
  const existing = input.id ? get<Row>('SELECT * FROM qr_tables WHERE id = ?', [input.id]) : null;
  const row = {
    id: input.id ?? newId(),
    code: input.code.trim().toUpperCase(),
    label: input.label.trim(),
    is_active: input.is_active ? 1 : 0,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('qr_tables', row);
  requestSync();
  return toTable(row);
}

export function deleteTable(id: string) {
  const now = nowIso();
  run('UPDATE qr_tables SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  requestSync();
}

export function tableUrl(code: string) {
  if (!PUBLIC_MENU_URL || PUBLIC_MENU_URL.includes('YOUR-HOSTED')) return null;
  const base = PUBLIC_MENU_URL.replace(/\/$/, '');
  return `${base}/?t=${encodeURIComponent(code)}`;
}

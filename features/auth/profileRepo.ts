import { all, get, kvGet, kvSet, nowIso, run, upsert } from '@/lib/db';
import type { AccountStatus, Profile } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

type LocalProfile = Omit<Profile, 'phone_confirmed'> & { phone_confirmed: number; is_dirty: number };

function toProfile(r: LocalProfile): Profile {
  return { ...r, phone_confirmed: !!r.phone_confirmed };
}

export function cacheProfile(p: Profile, dirty = false) {
  upsert('profiles', { ...p, phone_confirmed: p.phone_confirmed ? 1 : 0, is_dirty: dirty ? 1 : 0 });
}

export function getCachedProfile(id: string): Profile | null {
  const r = get<LocalProfile>('SELECT * FROM profiles WHERE id = ?', [id]);
  return r ? toProfile(r) : null;
}

export function setCurrentUserId(id: string | null) {
  kvSet('current_user_id', id);
}

export function getCurrentUserId() {
  return kvGet('current_user_id');
}

export function listCashiers(): Profile[] {
  return all<LocalProfile>("SELECT * FROM profiles WHERE role = 'cashier' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC").map(toProfile);
}

export function countPendingCashiers() {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM profiles WHERE role = 'cashier' AND status = 'pending'")?.c ?? 0;
}

export function setCashierStatusLocal(id: string, status: AccountStatus) {
  run('UPDATE profiles SET status = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [status, nowIso(), id]);
  requestSync(300);
}

export function updateOwnProfileLocal(id: string, patch: Partial<Pick<Profile, 'name' | 'photo_url' | 'language' | 'push_token'>>) {
  const sets = Object.keys(patch).map((k) => `${k} = ?`);
  if (sets.length === 0) return;
  run(`UPDATE profiles SET ${sets.join(', ')}, updated_at = ?, is_dirty = 1 WHERE id = ?`, [
    ...Object.values(patch).map((v) => (v === undefined ? null : v)),
    nowIso(),
    id,
  ]);
  requestSync(500);
}

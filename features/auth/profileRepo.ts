import { all, get, kvGet, kvSet, nowIso, run, upsert } from '@/lib/db';
import type { AccountStatus, Profile } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

type LocalProfile = Omit<Profile, 'phone_confirmed'> & { phone_confirmed: number; is_dirty: number };

function toProfile(r: LocalProfile): Profile {
  return { ...r, phone_confirmed: !!r.phone_confirmed, admin_id: r.admin_id ?? null };
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

// Cashiers linked to this admin plus orphaned ones (their admin deleted the account).
export function listCashiers(adminId: string | null): Profile[] {
  return all<LocalProfile>(
    "SELECT * FROM profiles WHERE role = 'cashier' AND (admin_id = ? OR admin_id IS NULL) ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC",
    [adminId]
  ).map(toProfile);
}

export function countPendingCashiers(adminId: string | null) {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM profiles WHERE role = 'cashier' AND status = 'pending' AND (admin_id = ? OR admin_id IS NULL)", [adminId])?.c ?? 0;
}

export function setCashierStatusLocal(id: string, status: AccountStatus, adminId: string) {
  run('UPDATE profiles SET status = ?, admin_id = COALESCE(admin_id, ?), updated_at = ?, is_dirty = 1 WHERE id = ?', [status, adminId, nowIso(), id]);
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

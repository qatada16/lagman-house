import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import type { Profile, Role } from '@/lib/types';
import { SESSION_STORAGE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/lib/supabase';

export interface RememberedAccount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  role: Role;
  last_used_at?: string;
}

export const MAX_REMEMBERED = 2;
const LIST_KEY = 'lh.remembered_accounts';
const LEGACY_META_KEY = 'lh.remembered_account';
const LEGACY_TOKEN_KEY = 'lh_remembered_refresh_token';
const SECURE_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const tokenKey = (id: string) => `lh_rt_${id.replace(/[^A-Za-z0-9._-]/g, '')}`;

async function readList(): Promise<RememberedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as RememberedAccount[]) : [];
    }
    const legacy = await AsyncStorage.getItem(LEGACY_META_KEY);
    if (!legacy) return [];
    const account = JSON.parse(legacy) as RememberedAccount;
    const token = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY, SECURE_OPTS);
    await AsyncStorage.removeItem(LEGACY_META_KEY);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY, SECURE_OPTS).catch(() => undefined);
    if (!token) return [];
    await SecureStore.setItemAsync(tokenKey(account.id), token, SECURE_OPTS);
    await writeList([account]);
    return [account];
  } catch {
    return [];
  }
}

async function writeList(list: RememberedAccount[]) {
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export async function getRememberedAccounts(): Promise<RememberedAccount[]> {
  const list = await readList();
  const out: RememberedAccount[] = [];
  for (const a of list) {
    try {
      if (await SecureStore.getItemAsync(tokenKey(a.id), SECURE_OPTS)) out.push(a);
    } catch {
      // keystore unavailable: the account simply is not offered
    }
  }
  return out;
}

export async function rememberAccount(profile: Profile, refreshToken: string) {
  const all = await readList();
  const usable = await getRememberedAccounts();
  for (const stale of all.filter((a) => !usable.some((u) => u.id === a.id) && a.id !== profile.id)) await dropToken(stale.id, false);
  const list = usable;
  const entry: RememberedAccount = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone_confirmed ? profile.phone : null,
    photo_url: profile.photo_url,
    role: profile.role,
    last_used_at: new Date().toISOString(),
  };
  const next = [entry, ...list.filter((a) => a.id !== profile.id)];
  const dropped = next.slice(MAX_REMEMBERED);
  await SecureStore.setItemAsync(tokenKey(profile.id), refreshToken, SECURE_OPTS);
  await writeList(next.slice(0, MAX_REMEMBERED));
  for (const a of dropped) await dropToken(a.id, true);
}

// Refresh tokens rotate; keep the stored one current so it is still valid after logout.
export async function updateRememberedToken(userId: string, refreshToken: string) {
  try {
    const list = await readList();
    if (!list.some((a) => a.id === userId)) return;
    await SecureStore.setItemAsync(tokenKey(userId), refreshToken, SECURE_OPTS);
  } catch {
    // keystore unavailable: quick sign in simply falls back to the password form
  }
}

// Revokes the stored session on the server without touching the client's own auth state.
export async function revokeRefreshToken(refreshToken: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) return;
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${body.access_token}` },
    });
  } catch {
    // offline: the token is still deleted from this device
  }
}

async function dropToken(id: string, revoke: boolean) {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(tokenKey(id), SECURE_OPTS);
  } catch {
    token = null;
  }
  await SecureStore.deleteItemAsync(tokenKey(id), SECURE_OPTS).catch(() => undefined);
  if (revoke && token) await revokeRefreshToken(token);
}

export async function forgetRememberedAccount(id: string, revoke = true) {
  const list = await readList();
  await writeList(list.filter((a) => a.id !== id)).catch(() => undefined);
  await dropToken(id, revoke);
}

export async function rememberedToken(id: string) {
  try {
    return await SecureStore.getItemAsync(tokenKey(id), SECURE_OPTS);
  } catch {
    return null;
  }
}

// Clears only this device's copy of the session, so the remembered refresh token stays valid.
export async function clearLocalSession() {
  supabase.auth.stopAutoRefresh();
  await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, `${SESSION_STORAGE_KEY}-user`, `${SESSION_STORAGE_KEY}-code-verifier`]).catch(() => undefined);
}

export type QuickSignInResult = 'ok' | 'cancelled' | 'expired' | 'error';

export async function quickSignIn(accountId: string, promptMessage: string): Promise<QuickSignInResult> {
  const [hasHardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if ((hasHardware && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE) {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
    if (!auth.success) return 'cancelled';
  }
  const token = await rememberedToken(accountId);
  if (!token) return 'expired';
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error || !data.session) {
    const m = (error?.message ?? '').toLowerCase();
    if (m.includes('network') || m.includes('fetch')) return 'error';
    await forgetRememberedAccount(accountId, false);
    return 'expired';
  }
  supabase.auth.startAutoRefresh();
  return 'ok';
}

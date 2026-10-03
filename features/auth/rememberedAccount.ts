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
}

const META_KEY = 'lh.remembered_account';
const TOKEN_KEY = 'lh_remembered_refresh_token';
const SECURE_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function getRememberedAccount(): Promise<RememberedAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return null;
    const token = await SecureStore.getItemAsync(TOKEN_KEY, SECURE_OPTS);
    return token ? (JSON.parse(raw) as RememberedAccount) : null;
  } catch {
    return null;
  }
}

export async function rememberAccount(profile: Profile, refreshToken: string) {
  try {
    const prev = await AsyncStorage.getItem(META_KEY);
    if (prev && (JSON.parse(prev) as RememberedAccount).id !== profile.id) await forgetRememberedAccount(true);
  } catch {
    // unreadable previous entry is simply overwritten
  }
  const meta: RememberedAccount = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone_confirmed ? profile.phone : null,
    photo_url: profile.photo_url,
    role: profile.role,
  };
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  await SecureStore.setItemAsync(TOKEN_KEY, refreshToken, SECURE_OPTS);
}

// Refresh tokens rotate; keep the stored one current so it is still valid after logout.
export async function updateRememberedToken(userId: string, refreshToken: string) {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw || (JSON.parse(raw) as RememberedAccount).id !== userId) return;
    await SecureStore.setItemAsync(TOKEN_KEY, refreshToken, SECURE_OPTS);
  } catch {
    // keystore unavailable: quick sign in simply falls back to the password form
  }
}

// Revokes the stored session on the server without touching the client's own auth state.
async function revokeRefreshToken(refreshToken: string) {
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

export async function forgetRememberedAccount(revoke = true) {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY, SECURE_OPTS);
  } catch {
    token = null;
  }
  await AsyncStorage.removeItem(META_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(TOKEN_KEY, SECURE_OPTS).catch(() => undefined);
  if (revoke && token) await revokeRefreshToken(token);
}

// Clears only this device's copy of the session, so the remembered refresh token stays valid.
export async function clearLocalSession() {
  supabase.auth.stopAutoRefresh();
  await AsyncStorage.multiRemove([SESSION_STORAGE_KEY, `${SESSION_STORAGE_KEY}-user`, `${SESSION_STORAGE_KEY}-code-verifier`]).catch(() => undefined);
}

export type QuickSignInResult = 'ok' | 'cancelled' | 'expired' | 'error';

export async function quickSignIn(promptMessage: string): Promise<QuickSignInResult> {
  const [hasHardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if ((hasHardware && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE) {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
    if (!auth.success) return 'cancelled';
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY, SECURE_OPTS);
  if (!token) return 'expired';
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error || !data.session) {
    const m = (error?.message ?? '').toLowerCase();
    if (m.includes('network') || m.includes('fetch')) return 'error';
    await forgetRememberedAccount(false);
    return 'expired';
  }
  supabase.auth.startAutoRefresh();
  return 'ok';
}

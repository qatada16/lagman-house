import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, RealtimeChannel } from '@supabase/supabase-js';
import { SESSION_STORAGE_KEY, supabase } from '@/lib/supabase';
import { confirm } from '@/lib/confirm';
import { translate } from '@/lib/i18n';
import { clearUserData, initDb, kvGet, kvSet } from '@/lib/db';
import type { Profile } from '@/lib/types';
import { cacheProfile, getCachedProfile, getCurrentUserId, setCurrentUserId } from '@/features/auth/profileRepo';
import { abortSync, countPending, resetSyncState } from '@/features/sync/syncEngine';
import { clearLocalSession, forgetRememberedAccount, getRememberedAccounts, rememberAccount, revokeRefreshToken, updateRememberedToken } from '@/features/auth/rememberedAccount';
import { useLanguageStore } from './languageStore';

type Status = 'loading' | 'signedOut' | 'signedIn';
export type RecoveryState = 'pending' | 'active' | 'invalid' | null;

interface AuthState {
  status: Status;
  session: Session | null;
  profile: Profile | null;
  resolving: boolean;
  pendingPhotoUri: string | null;
  pendingCredentials: { email: string; password: string } | null;
  recovery: RecoveryState;
  init: () => Promise<void>;
  applySession: (session: Session | null) => Promise<boolean>;
  refreshProfile: () => Promise<Profile | null>;
  setProfile: (p: Profile) => void;
  setPendingPhoto: (uri: string | null) => void;
  setPendingCredentials: (c: { email: string; password: string } | null) => void;
  setRecovery: (r: RecoveryState) => void;
  signOut: (opts?: { forget?: boolean; keepRecovery?: boolean }) => Promise<void>;
}

let profileChannel: RealtimeChannel | null = null;
let listening = false;
const DATA_OWNER_KEY = 'data_owner_id';
let signOutTask: Promise<void> = Promise.resolve();

let ownerDecision: { userId: string; promise: Promise<boolean> } | null = null;

export function signOutSettled() {
  return signOutTask;
}

async function readStoredSession(): Promise<{ refresh_token?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { refresh_token?: string }) : null;
  } catch {
    return null;
  }
}

async function discardStoredSession() {
  const stored = await readStoredSession();
  await clearLocalSession();
  if (stored?.refresh_token) void revokeRefreshToken(stored.refresh_token);
}

async function confirmDataOwnerChange(owner: string) {
  const pending = countPending();
  if (pending === 0) return true;
  const lang = useLanguageStore.getState().lang;
  const name = getCachedProfile(owner)?.name ?? translate(lang, 'anotherAccount');
  return confirm(
    translate(lang, 'unsyncedOtherTitle'),
    translate(lang, 'unsyncedOtherBody', { name, count: pending }),
    translate(lang, 'deleteAndContinue'),
    translate(lang, 'cancel'),
    true
  );
}

function decideDataOwner(owner: string, userId: string) {
  if (ownerDecision && ownerDecision.userId === userId) return ownerDecision.promise;
  const decision = { userId, promise: confirmDataOwnerChange(owner) };
  ownerDecision = decision;
  void decision.promise.finally(() => {
    if (ownerDecision === decision) ownerDecision = null;
  });
  return decision.promise;
}

async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

function subscribeToOwnProfile(id: string, onChange: (p: Profile) => void) {
  if (profileChannel) supabase.removeChannel(profileChannel);
  profileChannel = supabase
    .channel(`profile:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` }, (payload) => {
      onChange(payload.new as Profile);
    })
    .subscribe();
}

export const useAuthStore = create<AuthState>((set, getState) => ({
  status: 'loading',
  session: null,
  profile: null,
  resolving: false,
  pendingPhotoUri: null,
  pendingCredentials: null,
  recovery: null,

  init: async () => {
    initDb();
    const cachedId = getCurrentUserId();
    const cached = cachedId ? getCachedProfile(cachedId) : null;
    if (cached) set({ profile: cached, status: 'signedIn' });

    if (!listening) {
      listening = true;
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          abortSync();
          setCurrentUserId(null);
          set({ status: 'signedOut', session: null, profile: null, resolving: false, recovery: getState().recovery === 'active' ? 'invalid' : getState().recovery });
          return;
        }
        if (session && event === 'TOKEN_REFRESHED') void updateRememberedToken(session.user.id, session.refresh_token);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          void getState().applySession(session);
        }
      });
    }

    const fallback = cached
      ? null
      : setTimeout(() => {
          if (useAuthStore.getState().status === 'loading') set({ status: 'signedOut' });
        }, 2500);
    const { data, error } = await supabase.auth.getSession();
    if (fallback) clearTimeout(fallback);
    if (data.session) {
      await getState().applySession(data.session);
    } else if (!error && !cached) {
      set({ status: 'signedOut', session: null, profile: null });
    } else if (!error && cached) {
      // Session definitively gone (e.g. refresh token revoked): drop cache.
      setCurrentUserId(null);
      set({ status: 'signedOut', session: null, profile: null });
    }
    // On a network error we keep the cached profile so the app works offline.
  },

  applySession: async (session) => {
    if (!session) return false;
    const userId = session.user.id;
    const owner = kvGet(DATA_OWNER_KEY);
    if (owner && owner !== userId) {
      abortSync();
      if (!(await decideDataOwner(owner, userId))) {
        if (getState().session?.user.id !== userId) {
          signOutTask = signOutTask.then(discardStoredSession).catch(() => undefined);
          await signOutTask;
        }
        set({ status: 'signedOut', session: null, profile: null, resolving: false });
        return false;
      }
      if (kvGet(DATA_OWNER_KEY) === owner) {
        clearUserData();
        resetSyncState();
        set({ profile: null });
      }
    }
    kvSet(DATA_OWNER_KEY, userId);
    supabase.auth.startAutoRefresh();
    set({ session });
    const cached = getCachedProfile(userId);
    if (cached) set({ profile: cached, status: 'signedIn' });
    else set({ resolving: true });
    setCurrentUserId(userId);

    const fresh = await fetchProfile(userId);
    if (useAuthStore.getState().session?.user.id !== userId) return true;
    if (fresh) {
      cacheProfile(fresh);
      set({ profile: fresh, status: 'signedIn', resolving: false });
      if (fresh.language !== useLanguageStore.getState().lang) useLanguageStore.getState().setLang(fresh.language);
    } else if (!cached) {
      // Profile row may lag the auth user by a moment right after signup.
      await new Promise((r) => setTimeout(r, 800));
      const retry = await fetchProfile(userId);
      if (retry) {
        cacheProfile(retry);
        set({ profile: retry, status: 'signedIn', resolving: false });
      } else {
        set({ status: 'signedIn', profile: null, resolving: false });
      }
    }
    const known = getState().profile;
    if (known && known.id === userId && !getState().recovery) void rememberAccount(known, session.refresh_token).catch(() => undefined);
    subscribeToOwnProfile(userId, (p) => {
      cacheProfile(p);
      set({ profile: p });
    });
    return true;
  },

  refreshProfile: async () => {
    const id = getState().session?.user.id ?? getState().profile?.id;
    if (!id) return null;
    const fresh = await fetchProfile(id);
    if (fresh) {
      cacheProfile(fresh);
      set({ profile: fresh });
    }
    return fresh;
  },

  setProfile: (p) => {
    cacheProfile(p, true);
    set({ profile: p });
  },

  setPendingPhoto: (uri) => set({ pendingPhotoUri: uri }),
  setPendingCredentials: (c) => set({ pendingCredentials: c }),
  setRecovery: (r) => set({ recovery: r }),

  signOut: async (opts) => {
    abortSync();
    const userId = getState().session?.user.id ?? getState().profile?.id ?? null;
    if (profileChannel) {
      supabase.removeChannel(profileChannel);
      profileChannel = null;
    }
    setCurrentUserId(null);
    clearUserData();
    resetSyncState();
    set({
      status: 'signedOut',
      session: null,
      profile: null,
      resolving: false,
      pendingPhotoUri: null,
      pendingCredentials: null,
      recovery: opts?.keepRecovery ? getState().recovery : null,
    });
    const previous = signOutTask;
    signOutTask = (async () => {
      await previous;
      supabase.auth.stopAutoRefresh();
      const stored = await readStoredSession();
      const remembered = opts?.forget || !userId ? null : (await getRememberedAccounts()).find((a) => a.id === userId) ?? null;
      if (remembered) {
        if (stored?.refresh_token) await updateRememberedToken(remembered.id, stored.refresh_token);
        await clearLocalSession();
        return;
      }
      if (opts?.forget && userId) await forgetRememberedAccount(userId, false);
      await discardStoredSession();
    })().catch(() => undefined);
  },
}));

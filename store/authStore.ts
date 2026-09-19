import { create } from 'zustand';
import type { Session, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearUserData, initDb } from '@/lib/db';
import type { Profile } from '@/lib/types';
import { cacheProfile, getCachedProfile, getCurrentUserId, setCurrentUserId } from '@/features/auth/profileRepo';
import { resetSyncState } from '@/features/sync/syncEngine';
import { useLanguageStore } from './languageStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  session: Session | null;
  profile: Profile | null;
  pendingPhotoUri: string | null;
  init: () => Promise<void>;
  applySession: (session: Session | null) => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  setProfile: (p: Profile) => void;
  setPendingPhoto: (uri: string | null) => void;
  signOut: () => Promise<void>;
}

let profileChannel: RealtimeChannel | null = null;
let listening = false;

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
  pendingPhotoUri: null,

  init: async () => {
    initDb();
    const cachedId = getCurrentUserId();
    const cached = cachedId ? getCachedProfile(cachedId) : null;
    if (cached) set({ profile: cached, status: 'signedIn' });

    if (!listening) {
      listening = true;
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ status: 'signedOut', session: null, profile: null });
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          void getState().applySession(session);
        }
      });
    }

    const { data, error } = await supabase.auth.getSession();
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
    if (!session) return;
    set({ session });
    const userId = session.user.id;
    const cached = getCachedProfile(userId);
    if (cached) set({ profile: cached, status: 'signedIn' });
    setCurrentUserId(userId);

    const fresh = await fetchProfile(userId);
    if (fresh) {
      cacheProfile(fresh);
      set({ profile: fresh, status: 'signedIn' });
      if (fresh.language !== useLanguageStore.getState().lang) useLanguageStore.getState().setLang(fresh.language);
    } else if (!cached) {
      // Profile row may lag the auth user by a moment right after signup.
      await new Promise((r) => setTimeout(r, 800));
      const retry = await fetchProfile(userId);
      if (retry) {
        cacheProfile(retry);
        set({ profile: retry, status: 'signedIn' });
      } else {
        set({ status: 'signedIn', profile: null });
      }
    }
    subscribeToOwnProfile(userId, (p) => {
      cacheProfile(p);
      set({ profile: p });
    });
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

  signOut: async () => {
    if (profileChannel) {
      supabase.removeChannel(profileChannel);
      profileChannel = null;
    }
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // offline: local sign-out still proceeds
    }
    setCurrentUserId(null);
    clearUserData();
    resetSyncState();
    set({ status: 'signedOut', session: null, profile: null, pendingPhotoUri: null });
  },
}));

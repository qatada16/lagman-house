import { supabase } from '@/lib/supabase';
import { confirm } from '@/lib/confirm';
import { translate } from '@/lib/i18n';
import { useLanguageStore } from '@/store/languageStore';
import { signOutSettled, useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { describeAuthError, isLinkUsed, isTokenExpired, jwtSubject, linkFingerprint, linksInFlight, markLinkUsed, parseAuthRedirect, settleLink } from './authApi';

let awaitingChoice = false;
let keepSessionOnCancel = false;

export function recoveryAwaitingChoice() {
  return awaitingChoice;
}

export function recoveryCancelKeepsSession() {
  return keepSessionOnCancel;
}

function authReady() {
  if (useAuthStore.getState().status !== 'loading') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = useAuthStore.subscribe((s) => {
      if (s.status === 'loading') return;
      unsubscribe();
      resolve();
    });
  });
}

export async function beginRecovery(url: string) {
  const link = parseAuthRedirect(url);
  const fingerprint = linkFingerprint(url, link.accessToken);
  if (isLinkUsed(fingerprint) || linksInFlight.has(fingerprint)) return;
  if (link.accessToken && isTokenExpired(link.accessToken)) {
    markLinkUsed(fingerprint);
    return;
  }
  const { setRecovery } = useAuthStore.getState();
  linksInFlight.add(fingerprint);
  try {
    setRecovery('pending');
    await authReady();
    if (link.error || !link.accessToken || !link.refreshToken) {
      markLinkUsed(fingerprint);
      setRecovery('invalid');
      return;
    }

    const target = jwtSubject(link.accessToken);
    const state = useAuthStore.getState();
    const currentId = state.status === 'signedIn' ? state.session?.user.id ?? state.profile?.id ?? null : null;
    keepSessionOnCancel = !!currentId && currentId === target;
    if (currentId && target && currentId !== target) {
      const lang = useLanguageStore.getState().lang;
      awaitingChoice = true;
      const ok = await confirm(
        translate(lang, 'resetOtherAccount'),
        translate(lang, 'resetOtherAccountBody', { name: state.profile?.name ?? state.session?.user.email ?? '' }),
        translate(lang, 'confirm'),
        translate(lang, 'cancel'),
        true
      ).finally(() => {
        awaitingChoice = false;
      });
      if (!ok) {
        setRecovery(null);
        return;
      }
      await useAuthStore.getState().signOut({ keepRecovery: true });
    }

    await signOutSettled();
    const { data, error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    settleLink(fingerprint, error);
    if (error || !data.session) {
      if (error && describeAuthError(error.message) === 'noInternet') toast.error(translate(useLanguageStore.getState().lang, 'noInternet'));
      setRecovery('invalid');
      return;
    }
    setRecovery('active');
    if (!(await useAuthStore.getState().applySession(data.session))) setRecovery(null);
  } finally {
    linksInFlight.delete(fingerprint);
  }
}

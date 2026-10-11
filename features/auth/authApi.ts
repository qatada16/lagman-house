import { supabase } from '@/lib/supabase';
import { kvGet, kvSet } from '@/lib/db';
import { uploadImage } from '@/lib/storage';
import type { AdminSummary, Language, Role } from '@/lib/types';
import { signOutSettled, useAuthStore } from '@/store/authStore';
import { cacheProfile } from './profileRepo';

export const PASSWORD_MIN = 8;
export const EMAIL_REDIRECT = 'lagmanhouse://auth/callback';
export const RESET_REDIRECT = 'lagmanhouse://auth/reset';

export function validatePassword(pw: string) {
  return pw.length >= PASSWORD_MIN && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function toE164(dialCode: string, digits: string) {
  return `+${dialCode.replace(/\D/g, '')}${digits.replace(/\D/g, '')}`;
}

export async function listAdmins(): Promise<AdminSummary[]> {
  const { data, error } = await supabase.rpc('list_admins');
  if (error) throw error;
  return (data ?? []) as AdminSummary[];
}

export async function regenerateMenuToken(): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_menu_token');
  if (error) throw error;
  return data as string;
}

export async function setDefaultMenu(value: boolean) {
  const { error } = await supabase.rpc('set_default_menu', { p_default: value });
  if (error) throw error;
}

export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}

export async function signUp(input: { name: string; email: string; password: string; role: Role; language: Language; adminId: string | null }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: EMAIL_REDIRECT,
      data: { name: input.name.trim(), role: input.role, language: input.language, admin_id: input.role === 'cashier' ? input.adminId : null },
    },
  });
  if (error) throw error;
  return data;
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: EMAIL_REDIRECT } });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: RESET_REDIRECT });
  if (error) throw error;
}

export interface AuthRedirect {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
}

export function parseAuthRedirect(url: string): AuthRedirect {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const query = new URLSearchParams(beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '');
  const hash = new URLSearchParams(hashIndex >= 0 ? url.slice(hashIndex + 1) : '');
  const pick = (key: string) => hash.get(key) || query.get(key) || null;
  return {
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    code: query.get('code'),
    type: pick('type'),
    error: pick('error_code') || pick('error_description') || pick('error'),
  };
}

export function isResetUrl(url: string) {
  return /^[a-z][a-z0-9+.-]*:\/\/+auth\/reset(?=[/?#]|$)/i.test(url);
}

export interface JwtClaims {
  sub: string | null;
  sessionId: string | null;
  exp: number | null;
}

export function jwtClaims(token: string): JwtClaims {
  try {
    const part = token.split('.')[1];
    if (!part) return { sub: null, sessionId: null, exp: null };
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(base64)) as { sub?: unknown; session_id?: unknown; exp?: unknown };
    return {
      sub: typeof payload.sub === 'string' ? payload.sub : null,
      sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
      exp: typeof payload.exp === 'number' ? payload.exp : null,
    };
  } catch {
    return { sub: null, sessionId: null, exp: null };
  }
}

export function jwtSubject(token: string): string | null {
  return jwtClaims(token).sub;
}

const USED_LINKS_KEY = 'used_auth_links';
const USED_LINKS_MAX = 20;

function hashText(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function linkFingerprint(url: string, accessToken: string | null) {
  const sessionId = accessToken ? jwtClaims(accessToken).sessionId : null;
  return sessionId ? `s:${sessionId}` : `u:${hashText(url)}`;
}

function usedLinks(): string[] {
  try {
    const parsed = JSON.parse(kvGet(USED_LINKS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isLinkUsed(fingerprint: string) {
  return usedLinks().includes(fingerprint);
}

export function markLinkUsed(fingerprint: string) {
  const next = [fingerprint, ...usedLinks().filter((f) => f !== fingerprint)].slice(0, USED_LINKS_MAX);
  kvSet(USED_LINKS_KEY, JSON.stringify(next));
}

export const linksInFlight = new Set<string>();

export function settleLink(fingerprint: string, error: { message: string } | null) {
  if (!error || describeAuthError(error.message) !== 'noInternet') markLinkUsed(fingerprint);
}

export function isTokenExpired(accessToken: string, nowMs = Date.now()) {
  const exp = jwtClaims(accessToken).exp;
  return exp != null && exp * 1000 <= nowMs;
}

// Handles the redirect from the confirmation email: tokens in the hash (implicit flow) or a PKCE code.
export async function sessionFromUrl(url: string): Promise<'session' | 'error' | 'ignored'> {
  if (!url.includes('auth/callback')) return 'ignored';
  const r = parseAuthRedirect(url);
  const fingerprint = linkFingerprint(url, r.accessToken);
  if (isLinkUsed(fingerprint) || linksInFlight.has(fingerprint)) return 'ignored';
  if (r.error) {
    markLinkUsed(fingerprint);
    return 'error';
  }
  if (r.accessToken && isTokenExpired(r.accessToken)) {
    markLinkUsed(fingerprint);
    return 'ignored';
  }
  linksInFlight.add(fingerprint);
  try {
    let error: { message: string } | null = null;
    if (r.accessToken && r.refreshToken) {
      ({ error } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken }));
    } else if (r.code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(r.code));
    } else {
      return 'ignored';
    }
    settleLink(fingerprint, error);
    return error ? 'error' : 'session';
  } finally {
    linksInFlight.delete(fingerprint);
  }
}

export async function signIn(identifier: string, password: string) {
  await signOutSettled();
  const id = identifier.trim();
  const credentials = id.includes('@')
    ? { email: id.toLowerCase(), password }
    : { phone: id.startsWith('+') ? id : `+${id.replace(/\D/g, '')}`, password };
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  return data.session;
}

export async function isPhoneInUse(phone: string) {
  const { data, error } = await supabase.rpc('phone_in_use', { p_phone: phone });
  if (error) throw error;
  return !!data;
}

export async function startPhoneLink(phone: string) {
  if (await isPhoneInUse(phone)) {
    const err = new Error('phone_in_use');
    err.name = 'PhoneInUse';
    throw err;
  }
  const { error } = await supabase.auth.updateUser({ phone });
  if (error) throw error;
}

export async function verifyPhoneCode(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
  if (error) throw error;
  const profile = await useAuthStore.getState().refreshProfile();
  if (profile && !profile.phone_confirmed) {
    // Trigger normally handles this; cover the race where profile refresh beat it.
    await supabase.from('profiles').update({ phone, phone_confirmed: true }).eq('id', profile.id);
    await useAuthStore.getState().refreshProfile();
  }
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function uploadAvatarAndSave(userId: string, uri: string) {
  const url = await uploadImage('avatars', `${userId}/avatar`, uri);
  const { data, error } = await supabase.from('profiles').update({ photo_url: url }).eq('id', userId).select('*').single();
  if (error) throw error;
  cacheProfile(data);
  useAuthStore.setState({ profile: data });
  return url;
}

export async function savePushToken(userId: string, token: string) {
  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) throw error;
}

export type AuthErrorKind =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'wrongCode'
  | 'smsProviderMissing'
  | 'phoneAlreadyInUse'
  | 'noInternet'
  | 'tooManyRequests'
  | 'samePassword'
  | 'resetInvalid'
  | 'error';

export function retryAfterSeconds(message: string): number | null {
  const match = /after (\d+) seconds?/i.exec(message);
  return match ? Number(match[1]) : null;
}

export function describeAuthError(message: string): AuthErrorKind {
  const m = message.toLowerCase();
  if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('fetch failed')) return 'noInternet';
  if (m.includes('rate limit') || m.includes('only request this after') || m.includes('too many requests')) return 'tooManyRequests';
  if (m.includes('should be different')) return 'samePassword';
  if (m.includes('auth session missing') || m.includes('session_not_found') || m.includes('session not found')) return 'resetInvalid';
  if (m.includes('invalid login credentials')) return 'invalidCredentials';
  if (m.includes('email not confirmed')) return 'emailNotConfirmed';
  if (m.includes('token has expired') || m.includes('invalid') && m.includes('otp') || m.includes('token')) return 'wrongCode';
  if (m.includes('sms') || m.includes('phone provider') || m.includes('unsupported phone provider')) return 'smsProviderMissing';
  if (m.includes('phone_in_use') || m.includes('already') && m.includes('phone')) return 'phoneAlreadyInUse';
  return 'error';
}

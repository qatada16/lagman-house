import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/storage';
import type { AdminSummary, Language, Role } from '@/lib/types';
import { useAuthStore } from '@/store/authStore';
import { cacheProfile } from './profileRepo';

export const PASSWORD_MIN = 8;
export const EMAIL_REDIRECT = 'lagmanhouse://auth/callback';

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

// Handles the redirect from the confirmation email: tokens in the hash (implicit flow) or a PKCE code.
export async function sessionFromUrl(url: string): Promise<'session' | 'error' | 'ignored'> {
  if (!url.includes('auth/callback')) return 'ignored';
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const hash = url.split('#')[1] ?? '';
  const params = new URLSearchParams(hash || query);
  const queryParams = new URLSearchParams(query);
  if (params.get('error_description') || queryParams.get('error_description')) return 'error';
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return error ? 'error' : 'session';
  }
  const code = queryParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? 'error' : 'session';
  }
  return 'ignored';
}

export async function signIn(identifier: string, password: string) {
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

export function describeAuthError(message: string): 'invalidCredentials' | 'emailNotConfirmed' | 'wrongCode' | 'smsProviderMissing' | 'phoneAlreadyInUse' | 'error' {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'invalidCredentials';
  if (m.includes('email not confirmed')) return 'emailNotConfirmed';
  if (m.includes('token has expired') || m.includes('invalid') && m.includes('otp') || m.includes('token')) return 'wrongCode';
  if (m.includes('sms') || m.includes('phone provider') || m.includes('unsupported phone provider')) return 'smsProviderMissing';
  if (m.includes('phone_in_use') || m.includes('already') && m.includes('phone')) return 'phoneAlreadyInUse';
  return 'error';
}

import { PUBLIC_MENU_URL } from '@/lib/supabase';

export function menuBaseUrl() {
  if (!PUBLIC_MENU_URL || PUBLIC_MENU_URL.includes('YOUR-HOSTED')) return null;
  return PUBLIC_MENU_URL.replace(/\/$/, '') + '/';
}

export function menuUrl(token: string | null) {
  const base = menuBaseUrl();
  if (!base || !token) return null;
  return `${base}?m=${encodeURIComponent(token)}`;
}

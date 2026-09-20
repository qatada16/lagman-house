import { PUBLIC_MENU_URL } from '@/lib/supabase';

export function menuUrl() {
  if (!PUBLIC_MENU_URL || PUBLIC_MENU_URL.includes('YOUR-HOSTED')) return null;
  return PUBLIC_MENU_URL.replace(/\/$/, '') + '/';
}

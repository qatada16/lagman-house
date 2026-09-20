import { all, nowIso, upsert } from '@/lib/db';
import type { RestaurantSettings } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

const DEFAULTS: RestaurantSettings = {
  restaurant_name: 'Lagman House',
  restaurant_name_ur: 'لغمن ہاؤس',
  restaurant_address: '',
  currency_symbol: 'Rs',
  logo_url: '',
};

export function getSettings(): RestaurantSettings {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: RestaurantSettings = { ...DEFAULTS };
  for (const r of rows) {
    if (r.key in out) {
      try {
        const v = JSON.parse(r.value);
        if (typeof v === 'string') (out as unknown as Record<string, string>)[r.key] = v;
      } catch {
        // ignore malformed value
      }
    }
  }
  return out;
}

export function saveSettings(patch: Partial<RestaurantSettings>) {
  const now = nowIso();
  for (const [key, value] of Object.entries(patch)) {
    upsert('settings', { key, value: JSON.stringify(value ?? ''), updated_at: now, is_dirty: 1 });
  }
  requestSync();
}

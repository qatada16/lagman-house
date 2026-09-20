import { all, get, nowIso, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import type { RestaurantSettings } from '@/lib/types';
import { getTenantId } from '@/lib/tenant';
import { requestSync } from '@/features/sync/syncEngine';

const DEFAULTS: RestaurantSettings = {
  restaurant_name: 'Lagman House',
  restaurant_name_ur: 'لغمن ہاؤس',
  restaurant_address: '',
  currency_symbol: 'Rs',
  logo_url: '',
};

export function getSettings(tenantId: string | null = getTenantId()): RestaurantSettings {
  const out: RestaurantSettings = { ...DEFAULTS };
  if (!tenantId) return out;
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM tenant_settings WHERE admin_id = ?', [tenantId]);
  for (const r of rows) {
    if (r.key in out) {
      try {
        const v = JSON.parse(r.value);
        if (typeof v === 'string') (out as unknown as Record<string, string>)[r.key] = v;
      } catch {
        // malformed value is ignored
      }
    }
  }
  return out;
}

export function saveSettings(patch: Partial<RestaurantSettings>) {
  const tenantId = getTenantId();
  if (!tenantId) return;
  const now = nowIso();
  for (const [key, value] of Object.entries(patch)) {
    const existing = get<{ id: string }>('SELECT id FROM tenant_settings WHERE admin_id = ? AND key = ?', [tenantId, key]);
    upsert('tenant_settings', { id: existing?.id ?? newId(), admin_id: tenantId, key, value: JSON.stringify(value ?? ''), updated_at: now, is_dirty: 1 });
  }
  requestSync();
}

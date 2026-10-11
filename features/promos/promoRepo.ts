import { all, get, nowIso, run, transaction, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import { getTenantId, requireTenantId } from '@/lib/tenant';
import type { Coupon, Deal, DealOption, DealSlot, Discount, PromoKind } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

const tenant = () => getTenantId() ?? '';

type DealRow = Omit<Deal, 'is_active'> & { is_active: number };
type SlotRow = Omit<DealSlot, 'options'> & { options: string };
type DiscountRow = Omit<Discount, 'is_active' | 'item_ids'> & { is_active: number; item_ids: string };
type CouponRow = Omit<Coupon, 'is_active'> & { is_active: number };

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

const toDeal = (r: DealRow): Deal => ({ ...r, is_active: !!r.is_active });
const toSlot = (r: SlotRow): DealSlot => ({ ...r, options: parseJson<DealOption[]>(r.options, []) });
const toDiscount = (r: DiscountRow): Discount => ({ ...r, is_active: !!r.is_active, item_ids: parseJson<string[]>(r.item_ids, []) });
const toCoupon = (r: CouponRow): Coupon => ({ ...r, is_active: !!r.is_active });

export function isWithinWindow(startsAt: string | null, endsAt: string | null, at = Date.now()) {
  if (startsAt && new Date(startsAt).getTime() > at) return false;
  if (endsAt && new Date(endsAt).getTime() < at) return false;
  return true;
}

export function listDeals(activeOnly = false): Deal[] {
  const rows = all<DealRow>(`SELECT * FROM deals WHERE admin_id = ? AND deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY sort_order, name`, [tenant()]).map(toDeal);
  return activeOnly ? rows.filter((d) => isWithinWindow(d.starts_at, d.ends_at)) : rows;
}

export function getDeal(id: string): Deal | null {
  const r = get<DealRow>('SELECT * FROM deals WHERE id = ? AND admin_id = ?', [id, tenant()]);
  return r ? toDeal(r) : null;
}

export function listDealSlots(dealId: string): DealSlot[] {
  return all<SlotRow>('SELECT * FROM deal_slots WHERE deal_id = ? AND deleted_at IS NULL ORDER BY sort_order', [dealId]).map(toSlot);
}

export function listAllDealSlots(): DealSlot[] {
  return all<SlotRow>('SELECT * FROM deal_slots WHERE admin_id = ? AND deleted_at IS NULL ORDER BY sort_order', [tenant()]).map(toSlot);
}

export interface SlotInput {
  id?: string;
  name: string;
  options: DealOption[];
  default_index: number;
}

export function saveDeal(
  input: { id?: string; name: string; name_ur?: string | null; description?: string | null; image_url?: string | null; price: number; is_active: boolean; starts_at: string | null; ends_at: string | null },
  slots: SlotInput[]
): Deal {
  const adminId = requireTenantId();
  const now = nowIso();
  const id = input.id ?? newId();
  const existing = input.id ? get<DealRow>('SELECT * FROM deals WHERE id = ?', [input.id]) : null;
  const row = {
    id,
    admin_id: adminId,
    name: input.name.trim(),
    name_ur: input.name_ur?.trim() || null,
    description: input.description?.trim() || null,
    image_url: input.image_url ?? existing?.image_url ?? null,
    price: input.price,
    is_active: input.is_active ? 1 : 0,
    sort_order: existing?.sort_order ?? listDeals().length,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  transaction(() => {
    upsert('deals', row);
    const keep = new Set<string>();
    slots.forEach((s, i) => {
      if (!s.name.trim() || s.options.length === 0) return;
      const sid = s.id ?? newId();
      keep.add(sid);
      const prior = get<SlotRow>('SELECT * FROM deal_slots WHERE id = ?', [sid]);
      upsert('deal_slots', {
        id: sid,
        admin_id: adminId,
        deal_id: id,
        name: s.name.trim(),
        sort_order: i,
        options: JSON.stringify(s.options),
        default_index: Math.min(Math.max(0, s.default_index), s.options.length - 1),
        deleted_at: null,
        created_at: prior?.created_at ?? now,
        updated_at: now,
        is_dirty: 1,
      });
    });
    for (const s of all<{ id: string }>('SELECT id FROM deal_slots WHERE deal_id = ? AND deleted_at IS NULL', [id])) {
      if (!keep.has(s.id)) run('UPDATE deal_slots SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, s.id]);
    }
  });
  requestSync();
  return toDeal(row);
}

export function setDealImage(id: string, imageUrl: string) {
  run('UPDATE deals SET image_url = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [imageUrl, nowIso(), id]);
  requestSync();
}

export function deleteDeal(id: string) {
  const now = nowIso();
  transaction(() => {
    run('UPDATE deals SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
    run('UPDATE deal_slots SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE deal_id = ? AND deleted_at IS NULL', [now, now, id]);
  });
  requestSync();
}

export function listDiscounts(activeOnly = false): Discount[] {
  const rows = all<DiscountRow>(`SELECT * FROM discounts WHERE admin_id = ? AND deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY name`, [tenant()]).map(toDiscount);
  return activeOnly ? rows.filter((d) => isWithinWindow(d.starts_at, d.ends_at)) : rows;
}

export function getDiscount(id: string): Discount | null {
  const r = get<DiscountRow>('SELECT * FROM discounts WHERE id = ? AND admin_id = ?', [id, tenant()]);
  return r ? toDiscount(r) : null;
}

export function saveDiscount(input: { id?: string; name: string; kind: PromoKind; value: number; item_ids: string[]; is_active: boolean; starts_at: string | null; ends_at: string | null }): Discount {
  const adminId = requireTenantId();
  const now = nowIso();
  const existing = input.id ? get<DiscountRow>('SELECT * FROM discounts WHERE id = ?', [input.id]) : null;
  const row = {
    id: input.id ?? newId(),
    admin_id: adminId,
    name: input.name.trim(),
    kind: input.kind,
    value: input.value,
    item_ids: JSON.stringify(input.item_ids),
    is_active: input.is_active ? 1 : 0,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('discounts', row);
  requestSync();
  return toDiscount(row);
}

export function deleteDiscount(id: string) {
  const now = nowIso();
  run('UPDATE discounts SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  requestSync();
}

export function listCoupons(activeOnly = false): Coupon[] {
  const rows = all<CouponRow>(`SELECT * FROM coupons WHERE admin_id = ? AND deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY code`, [tenant()]).map(toCoupon);
  return activeOnly ? rows.filter((c) => isWithinWindow(c.starts_at, c.ends_at) && (c.max_uses == null || c.uses_count < c.max_uses)) : rows;
}

export function getCoupon(id: string): Coupon | null {
  const r = get<CouponRow>('SELECT * FROM coupons WHERE id = ? AND admin_id = ?', [id, tenant()]);
  return r ? toCoupon(r) : null;
}

export function findCouponByCode(code: string): Coupon | null {
  const r = get<CouponRow>('SELECT * FROM coupons WHERE admin_id = ? AND deleted_at IS NULL AND UPPER(code) = ?', [tenant(), code.trim().toUpperCase()]);
  return r ? toCoupon(r) : null;
}

export function saveCoupon(input: {
  id?: string;
  code: string;
  name?: string | null;
  kind: PromoKind;
  value: number;
  min_order: number;
  max_discount: number | null;
  max_uses: number | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}): Coupon {
  const adminId = requireTenantId();
  const now = nowIso();
  const existing = input.id ? get<CouponRow>('SELECT * FROM coupons WHERE id = ?', [input.id]) : null;
  const row = {
    id: input.id ?? newId(),
    admin_id: adminId,
    code: input.code.trim().toUpperCase(),
    name: input.name?.trim() || null,
    kind: input.kind,
    value: input.value,
    min_order: input.min_order,
    max_discount: input.max_discount,
    max_uses: input.max_uses,
    uses_count: existing?.uses_count ?? 0,
    is_active: input.is_active ? 1 : 0,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('coupons', row);
  requestSync();
  return toCoupon(row);
}

export function deleteCoupon(id: string) {
  const now = nowIso();
  run('UPDATE coupons SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  requestSync();
}

export function bumpCouponUseLocally(id: string, delta = 1) {
  run('UPDATE coupons SET uses_count = MAX(0, uses_count + ?) WHERE id = ?', [delta, id]);
}

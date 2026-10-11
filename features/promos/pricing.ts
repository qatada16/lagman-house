import type { CartLine, Coupon, Discount } from '@/lib/types';
import { isWithinWindow } from './promoRepo';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function applyPromo(kind: 'fixed' | 'percent', value: number, price: number, cap?: number | null) {
  const cut = kind === 'percent' ? price * (value / 100) : value;
  const bounded = cap != null ? Math.min(cut, cap) : cut;
  return round2(Math.max(0, Math.min(price, bounded)));
}

export interface PricedItem {
  price: number;
  original: number;
  discountId: string | null;
}

// The best active discount wins; discounts are not stacked.
export function priceWithDiscounts(itemId: string, price: number, discounts: Discount[], at = Date.now()): PricedItem {
  let best: PricedItem = { price, original: price, discountId: null };
  for (const d of discounts) {
    if (!d.is_active || !isWithinWindow(d.starts_at, d.ends_at, at) || !d.item_ids.includes(itemId)) continue;
    const next = round2(price - applyPromo(d.kind, d.value, price));
    if (next < best.price) best = { price: next, original: price, discountId: d.id };
  }
  return best;
}

export function cartSubtotal(lines: CartLine[]) {
  return round2(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0));
}

export function cartItemSavings(lines: CartLine[]) {
  return round2(lines.reduce((s, l) => s + Math.max(0, l.original_unit_price - l.unit_price) * l.quantity, 0));
}

export type CouponProblem = 'inactive' | 'expired' | 'notStarted' | 'exhausted' | 'minOrder';

export function couponProblem(c: Coupon, subtotal: number, at = Date.now()): CouponProblem | null {
  if (!c.is_active) return 'inactive';
  if (c.starts_at && new Date(c.starts_at).getTime() > at) return 'notStarted';
  if (c.ends_at && new Date(c.ends_at).getTime() < at) return 'expired';
  if (c.max_uses != null && c.uses_count >= c.max_uses) return 'exhausted';
  if (subtotal < c.min_order) return 'minOrder';
  return null;
}

export function couponDiscount(c: Coupon, subtotal: number) {
  return applyPromo(c.kind, c.value, subtotal, c.max_discount);
}

export interface Totals {
  subtotal: number;
  itemDiscount: number;
  couponDiscount: number;
  total: number;
  savings: number;
}

export function computeTotals(lines: CartLine[], coupon: Coupon | null): Totals {
  const subtotal = cartSubtotal(lines);
  const itemDiscount = cartItemSavings(lines);
  const cd = coupon && subtotal >= coupon.min_order ? couponDiscount(coupon, subtotal) : 0;
  const total = round2(Math.max(0, subtotal - cd));
  return { subtotal, itemDiscount, couponDiscount: cd, total, savings: round2(itemDiscount + cd) };
}

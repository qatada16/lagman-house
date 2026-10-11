import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type { CartComponent, CartLine, Coupon, Deal, MenuItem, MenuItemVariant, PaymentMethod } from '@/lib/types';
import { listDiscounts } from '@/features/promos/promoRepo';
import { priceWithDiscounts } from '@/features/promos/pricing';

export const NOTE_WORD_LIMIT = 10;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampNote(text: string, limit = NOTE_WORD_LIMIT) {
  const words = text.split(/(\s+)/);
  let count = 0;
  let out = '';
  for (const part of words) {
    if (/^\s+$/.test(part)) {
      if (count < limit) out += part;
      continue;
    }
    if (part === '') continue;
    if (count >= limit) break;
    out += part;
    count++;
  }
  return out;
}

export function itemLine(item: MenuItem, variant: MenuItemVariant | null): CartLine {
  const base = variant ? variant.price : item.base_price;
  const priced = priceWithDiscounts(item.id, base, listDiscounts(true));
  return {
    key: `${item.id}:${variant?.id ?? ''}`,
    menu_item_id: item.id,
    variant_id: variant?.id ?? null,
    name: item.name,
    variant_name: variant?.name ?? null,
    unit_price: priced.price,
    original_unit_price: priced.original,
    discount_id: priced.discountId,
    quantity: 1,
    deal_id: null,
    components: [],
  };
}

export function dealLine(deal: Deal, components: CartComponent[]): CartLine {
  const sig = components.map((c) => `${c.slot_id}=${c.menu_item_id}:${c.variant_id ?? ''}`).join('|');
  return {
    key: `deal:${deal.id}:${sig}`,
    menu_item_id: null,
    variant_id: null,
    name: deal.name,
    variant_name: null,
    unit_price: deal.price,
    original_unit_price: deal.price,
    discount_id: null,
    quantity: 1,
    deal_id: deal.id,
    components,
  };
}

export interface CartState {
  lines: CartLine[];
  note: string;
  isTest: boolean;
  amountReceived: string;
  paymentMethod: PaymentMethod;
  coupon: Coupon | null;
  add: (item: MenuItem, variant: MenuItemVariant | null) => void;
  addLine: (line: CartLine) => void;
  setQuantity: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setNote: (note: string) => void;
  setIsTest: (v: boolean) => void;
  setAmountReceived: (v: string) => void;
  setPaymentMethod: (v: PaymentMethod) => void;
  setCoupon: (c: Coupon | null) => void;
  replaceLines: (lines: CartLine[]) => void;
}

function merge(lines: CartLine[], line: CartLine) {
  const existing = lines.find((l) => l.key === line.key);
  if (existing) return lines.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l));
  return [...lines, line];
}

export function createCartStore() {
  return create<CartState>((set) => ({
    lines: [],
    note: '',
    isTest: false,
    amountReceived: '',
    paymentMethod: 'cash',
    coupon: null,

    add: (item, variant) => set((s) => ({ lines: merge(s.lines, itemLine(item, variant)) })),
    addLine: (line) => set((s) => ({ lines: merge(s.lines, line) })),

    setQuantity: (key, qty) =>
      set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: qty } : l)) })),

    remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

    clear: () => set({ lines: [], note: '', isTest: false, amountReceived: '', paymentMethod: 'cash', coupon: null }),

    setNote: (note) => set({ note: clampNote(note) }),
    setIsTest: (isTest) => set({ isTest }),
    setAmountReceived: (amountReceived) => set({ amountReceived }),
    setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
    setCoupon: (coupon) => set({ coupon }),
    replaceLines: (lines) => set({ lines }),
  }));
}

export type CartStore = ReturnType<typeof createCartStore>;

export const useCartStore = createCartStore();

export const CartStoreContext = createContext<CartStore>(useCartStore);

export function useCart<T>(selector: (s: CartState) => T): T {
  return useContext(CartStoreContext)(selector);
}

export { cartSubtotal } from '@/features/promos/pricing';

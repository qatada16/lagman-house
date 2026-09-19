import { create } from 'zustand';
import type { CartLine, MenuItem, MenuItemVariant, PaymentMethod } from '@/lib/types';

export const NOTE_WORD_LIMIT = 10;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Live cap: keep at most N words, but allow trailing whitespace while typing.
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

interface CartState {
  lines: CartLine[];
  note: string;
  isTest: boolean;
  amountReceived: string;
  paymentMethod: PaymentMethod;
  add: (item: MenuItem, variant: MenuItemVariant | null) => void;
  setQuantity: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setNote: (note: string) => void;
  setIsTest: (v: boolean) => void;
  setAmountReceived: (v: string) => void;
  setPaymentMethod: (v: PaymentMethod) => void;
  replaceLines: (lines: CartLine[]) => void;
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  note: '',
  isTest: false,
  amountReceived: '',
  paymentMethod: 'cash',

  add: (item, variant) =>
    set((s) => {
      const key = `${item.id}:${variant?.id ?? ''}`;
      const existing = s.lines.find((l) => l.key === key);
      if (existing) return { lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)) };
      const line: CartLine = {
        key,
        menu_item_id: item.id,
        variant_id: variant?.id ?? null,
        name: item.name,
        variant_name: variant?.name ?? null,
        unit_price: variant ? variant.price : item.base_price,
        quantity: 1,
      };
      return { lines: [...s.lines, line] };
    }),

  setQuantity: (key, qty) =>
    set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: qty } : l)) })),

  remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

  clear: () => set({ lines: [], note: '', isTest: false, amountReceived: '', paymentMethod: 'cash' }),

  setNote: (note) => set({ note: clampNote(note) }),
  setIsTest: (isTest) => set({ isTest }),
  setAmountReceived: (amountReceived) => set({ amountReceived }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  replaceLines: (lines) => set({ lines }),
}));

export function cartSubtotal(lines: CartLine[]) {
  return Math.round(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 100) / 100;
}

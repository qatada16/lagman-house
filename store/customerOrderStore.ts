import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CustomerOrder } from '@/lib/types';
import { fetchOpenCustomerOrders, subscribeCustomerOrders } from '@/features/qr/customerOrdersApi';

interface State {
  orders: CustomerOrder[];
  loading: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  refresh: () => Promise<void>;
  remove: (id: string) => void;
  upsertLocal: (o: CustomerOrder) => void;
}

let channel: RealtimeChannel | null = null;

export const useCustomerOrderStore = create<State>((set, getState) => ({
  orders: [],
  loading: false,
  error: null,

  start: async () => {
    if (channel) return;
    channel = subscribeCustomerOrders((kind, row) => {
      if (kind === 'DELETE' || row.status === 'completed' || row.status === 'cancelled') getState().remove(row.id);
      else getState().upsertLocal(row);
    });
    await getState().refresh();
  },

  stop: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    set({ orders: [] });
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const orders = await fetchOpenCustomerOrders();
      set({ orders, error: null });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  remove: (id) => set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),

  upsertLocal: (o) =>
    set((s) => {
      const exists = s.orders.some((x) => x.id === o.id);
      const orders = exists ? s.orders.map((x) => (x.id === o.id ? o : x)) : [...s.orders, o];
      orders.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { orders };
    }),
}));

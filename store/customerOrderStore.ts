import { create } from 'zustand';
import { AppState, Vibration, type NativeEventSubscription } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CustomerOrder } from '@/lib/types';
import { fetchOpenCustomerOrders, subscribeCustomerOrders } from '@/features/qr/customerOrdersApi';

interface State {
  orders: CustomerOrder[];
  loading: boolean;
  error: string | null;
  arrivals: number;
  clockOffset: number;
  start: (tenantId: string) => Promise<void>;
  stop: () => void;
  refresh: () => Promise<void>;
  remove: (id: string) => void;
  upsertLocal: (o: CustomerOrder) => void;
}

let channel: RealtimeChannel | null = null;
let appStateSub: NativeEventSubscription | null = null;
const OPEN = new Set(['pending', 'claimed']);

export const useCustomerOrderStore = create<State>((set, getState) => ({
  orders: [],
  loading: false,
  error: null,
  arrivals: 0,
  clockOffset: 0,

  start: async (tenantId) => {
    if (channel) return;
    channel = subscribeCustomerOrders(tenantId, (kind, row) => {
      if (kind === 'DELETE' || !OPEN.has(row.status)) {
        getState().remove(row.id);
        return;
      }
      const isNew = kind === 'INSERT' && !getState().orders.some((o) => o.id === row.id);
      getState().upsertLocal(row);
      if (isNew) {
        Vibration.vibrate([0, 250, 120, 250]);
        set((s) => ({ arrivals: s.arrivals + 1 }));
      }
    });
    appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void getState().refresh();
    });
    await getState().refresh();
  },

  stop: () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    appStateSub?.remove();
    appStateSub = null;
    set({ orders: [] });
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const sent = Date.now();
      const { data } = await supabase.rpc('server_time');
      if (typeof data === 'string') set({ clockOffset: new Date(data).getTime() - (sent + Date.now()) / 2 });
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
      if (!OPEN.has(o.status)) return { orders: s.orders.filter((x) => x.id !== o.id) };
      const exists = s.orders.some((x) => x.id === o.id);
      const orders = exists ? s.orders.map((x) => (x.id === o.id ? o : x)) : [...s.orders, o];
      orders.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { orders };
    }),
}));

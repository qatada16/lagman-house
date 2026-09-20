import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CustomerOrder } from '@/lib/types';

export async function fetchOpenCustomerOrders(): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from('customer_orders')
    .select('*')
    .in('status', ['pending', 'claimed'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerOrder[];
}

// Atomic server-side claim; null means another cashier won.
export async function claimCustomerOrder(orderId: string, cashierId: string): Promise<CustomerOrder | null> {
  const { data, error } = await supabase.rpc('claim_customer_order', { p_order_id: orderId, p_cashier_id: cashierId });
  if (error) throw error;
  const rows = (data ?? []) as CustomerOrder[];
  return rows[0] ?? null;
}

export async function releaseCustomerOrder(orderId: string) {
  const { error } = await supabase.rpc('release_customer_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function completeCustomerOrder(orderId: string, completedOrderId: string) {
  const { error } = await supabase.rpc('complete_customer_order', { p_order_id: orderId, p_completed_order_id: completedOrderId });
  if (error) throw error;
}

export async function cancelCustomerOrder(orderId: string) {
  const { error } = await supabase.rpc('cancel_customer_order', { p_order_id: orderId });
  if (error) throw error;
}

export function subscribeCustomerOrders(tenantId: string, onChange: (kind: 'INSERT' | 'UPDATE' | 'DELETE', row: CustomerOrder) => void): RealtimeChannel {
  return supabase
    .channel(`customer_orders:${tenantId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders', filter: `admin_id=eq.${tenantId}` }, (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as CustomerOrder;
      onChange(payload.eventType, row);
    })
    .subscribe();
}

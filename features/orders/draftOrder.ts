import { useMemo } from 'react';
import type { CartLine, Order, OrderItem, PaymentMethod } from '@/lib/types';
import { getDeviceCode, newId, nextOrderSequence } from '@/lib/device';

export interface Draft {
  id: string;
  orderNumber: string;
}

// Reserve an id and number when checkout opens so receipts printed before
// "Complete order" carry the same number as the saved order.
export function useDraftOrder(): Draft {
  return useMemo(() => ({ id: newId(), orderNumber: `${getDeviceCode()}-${nextOrderSequence()}` }), []);
}

export function draftToOrder(
  draft: Draft,
  lines: CartLine[],
  opts: { cashierId: string | null; adminId?: string | null; note: string; isTest: boolean; amountReceived: string; paymentMethod: PaymentMethod; source: 'pos' | 'qr'; tableCode?: string | null; customerOrderId?: string | null }
): { order: Order; items: OrderItem[] } {
  const now = new Date().toISOString();
  const subtotal = Math.round(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 100) / 100;
  const received = opts.amountReceived === '' ? null : Number(opts.amountReceived);
  const order: Order = {
    id: draft.id,
    order_number: draft.orderNumber,
    cashier_id: opts.cashierId,
    admin_id: opts.adminId ?? null,
    status: 'completed',
    source: opts.source,
    customer_order_id: opts.customerOrderId ?? null,
    table_code: opts.tableCode ?? null,
    subtotal,
    total: subtotal,
    amount_received: received != null && !Number.isNaN(received) ? received : null,
    payment_method: opts.paymentMethod,
    note: opts.note.trim() || null,
    is_test: opts.isTest,
    stock_deducted: false,
    device_id: null,
    created_at: now,
    completed_at: null,
    updated_at: now,
  };
  const items: OrderItem[] = lines.map((l) => ({
    id: l.key,
    order_id: draft.id,
    menu_item_id: l.menu_item_id,
    variant_id: l.variant_id,
    item_name: l.name,
    variant_name: l.variant_name,
    unit_price: l.unit_price,
    quantity: l.quantity,
    line_total: Math.round(l.unit_price * l.quantity * 100) / 100,
    created_at: now,
    updated_at: now,
  }));
  return { order, items };
}

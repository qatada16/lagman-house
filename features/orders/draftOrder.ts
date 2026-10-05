import { useMemo } from 'react';
import type { CartLine, Coupon, Order, OrderItem, PaymentMethod } from '@/lib/types';
import { getDeviceCode, newId, nextOrderSequence } from '@/lib/device';
import { buildOrder } from './buildOrder';

export interface Draft {
  id: string;
  orderNumber: string;
}

export function useDraftOrder(): Draft {
  return useMemo(() => ({ id: newId(), orderNumber: `${getDeviceCode()}-${nextOrderSequence()}` }), []);
}

export function draftToOrder(
  draft: Draft,
  lines: CartLine[],
  opts: {
    cashierId: string | null;
    adminId?: string | null;
    note: string;
    isTest: boolean;
    amountReceived: string;
    paymentMethod: PaymentMethod;
    source: 'pos' | 'qr';
    tableCode?: string | null;
    customerOrderId?: string | null;
    coupon: Coupon | null;
  }
): { order: Order; items: OrderItem[] } {
  return buildOrder(lines, {
    id: draft.id,
    orderNumber: draft.orderNumber,
    cashierId: opts.cashierId,
    adminId: opts.adminId ?? null,
    note: opts.note,
    isTest: opts.isTest,
    amountReceived: opts.amountReceived,
    paymentMethod: opts.paymentMethod,
    source: opts.source,
    tableCode: opts.tableCode,
    customerOrderId: opts.customerOrderId,
    coupon: opts.coupon,
  });
}

import type { CartLine, Coupon, Order, OrderItem, PaymentMethod } from '@/lib/types';
import { computeTotals, round2 } from '@/features/promos/pricing';

export interface BuildOrderOptions {
  id: string;
  orderNumber: string;
  cashierId: string | null;
  adminId: string | null;
  note: string;
  isTest: boolean;
  amountReceived: string | number | null;
  paymentMethod: PaymentMethod | null;
  source: 'pos' | 'qr';
  tableCode?: string | null;
  customerOrderId?: string | null;
  coupon: Coupon | null;
  deviceId?: string | null;
  revisionId?: string | null;
  cashierLabel?: string | null;
  itemId?: (index: number, componentIndex?: number) => string;
}

// Deals become one priced parent line plus zero-priced component lines carrying the real menu item,
// so stock deduction and item statistics see every component sold.
export function buildOrder(lines: CartLine[], opts: BuildOrderOptions): { order: Order; items: OrderItem[] } {
  const now = new Date().toISOString();
  const totals = computeTotals(lines, opts.coupon);
  const coupon = opts.coupon && totals.couponDiscount > 0 ? opts.coupon : null;
  const received = opts.amountReceived === '' || opts.amountReceived == null ? null : Number(opts.amountReceived);
  const idFor = opts.itemId ?? ((i, c) => (c == null ? `${opts.id}:${i}` : `${opts.id}:${i}:${c}`));

  const order: Order = {
    id: opts.id,
    order_number: opts.orderNumber,
    cashier_id: opts.cashierId,
    admin_id: opts.adminId,
    status: 'completed',
    source: opts.source,
    customer_order_id: opts.customerOrderId ?? null,
    table_code: opts.tableCode ?? null,
    subtotal: totals.subtotal,
    total: totals.total,
    amount_received: received != null && !Number.isNaN(received) ? received : null,
    payment_method: opts.paymentMethod,
    note: opts.note.trim() || null,
    item_discount_total: totals.itemDiscount,
    coupon_id: coupon?.id ?? null,
    coupon_code: coupon?.code ?? null,
    coupon_discount: totals.couponDiscount,
    savings_total: totals.savings,
    original_total: totals.total,
    edit_count: 0,
    edited_at: null,
    edited_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    revision_id: opts.revisionId ?? null,
    cashier_label: opts.cashierLabel ?? null,
    is_test: opts.isTest,
    stock_deducted: false,
    device_id: opts.deviceId ?? null,
    created_at: now,
    completed_at: now,
    updated_at: now,
  };

  const items: OrderItem[] = [];
  lines.forEach((l, i) => {
    const parentId = idFor(i);
    items.push({
      id: parentId,
      order_id: opts.id,
      admin_id: opts.adminId,
      menu_item_id: l.menu_item_id,
      variant_id: l.variant_id,
      item_name: l.name,
      variant_name: l.variant_name,
      unit_price: l.unit_price,
      quantity: l.quantity,
      line_total: round2(l.unit_price * l.quantity),
      parent_item_id: null,
      deal_id: l.deal_id,
      original_unit_price: l.original_unit_price,
      discount_id: l.discount_id,
      revision_id: opts.revisionId ?? null,
      created_at: now,
      updated_at: now,
    });
    l.components.forEach((c, ci) => {
      items.push({
        id: idFor(i, ci),
        order_id: opts.id,
        admin_id: opts.adminId,
        menu_item_id: c.menu_item_id || null,
        variant_id: c.variant_id,
        item_name: c.name,
        variant_name: c.variant_name,
        unit_price: 0,
        quantity: l.quantity,
        line_total: 0,
        parent_item_id: parentId,
        deal_id: l.deal_id,
        original_unit_price: null,
        discount_id: null,
        revision_id: opts.revisionId ?? null,
        created_at: now,
        updated_at: now,
      });
    });
  });
  return { order, items };
}

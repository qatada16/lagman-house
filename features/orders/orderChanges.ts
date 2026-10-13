import { nowIso, run, transaction, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import type { CartLine, Coupon, Order, OrderItem, PaymentMethod, Profile } from '@/lib/types';
import { getMenuItem, listVariants } from '@/features/menu/menuRepo';
import { bumpCouponUseLocally } from '@/features/promos/promoRepo';
import { deductStockLocally, restoreStockLocally } from '@/features/stock/stockRepo';
import { requestSync } from '@/features/sync/syncEngine';
import { itemLine } from '@/store/cartStore';
import { buildOrder } from './buildOrder';
import { getOrder, getOrderItems, type OrderWithMeta } from './orderRepo';

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const SAVE_GRACE_MS = 15 * 60 * 1000;

export type ChangeBlock = 'void' | 'expired' | 'notAllowed' | null;

export function changeBlock(order: Pick<Order, 'status' | 'created_at' | 'cashier_id' | 'admin_id'>, profile: Profile | null, now = Date.now(), graceMs = 0): ChangeBlock {
  if (!profile || profile.status !== 'active') return 'notAllowed';
  if (order.status === 'void') return 'void';
  const allowed = profile.role === 'admin' ? order.admin_id === profile.id : order.cashier_id === profile.id;
  if (!allowed) return 'notAllowed';
  if (now - new Date(order.created_at).getTime() > EDIT_WINDOW_MS + graceMs) return 'expired';
  return null;
}

export function orderToCartLines(orderId: string): CartLine[] {
  const items = getOrderItems(orderId);
  const used = new Set<string>();
  return items
    .filter((it) => !it.parent_item_id)
    .map((p) => {
      let key = `edit:${p.id}`;
      if (!p.deal_id && p.menu_item_id) {
        const item = getMenuItem(p.menu_item_id);
        const variant = item && p.variant_id ? listVariants(item.id).find((v) => v.id === p.variant_id) ?? null : null;
        if (item && !item.deleted_at && (!p.variant_id || variant)) {
          const current = itemLine(item, variant);
          if (current.unit_price === p.unit_price && !used.has(current.key)) key = current.key;
        }
      }
      used.add(key);
      return {
        key,
        menu_item_id: p.menu_item_id,
        variant_id: p.variant_id,
        name: p.item_name,
        variant_name: p.variant_name,
        unit_price: p.unit_price,
        original_unit_price: p.original_unit_price ?? p.unit_price,
        discount_id: p.discount_id,
        quantity: p.quantity,
        deal_id: p.deal_id,
        components: items
          .filter((c) => c.parent_item_id === p.id)
          .map((c, i) => ({
            slot_id: `${p.id}:${i}`,
            slot_name: '',
            menu_item_id: c.menu_item_id ?? '',
            variant_id: c.variant_id,
            name: c.item_name,
            variant_name: c.variant_name,
          })),
      };
    });
}

export interface EditOrderInput {
  orderId: string;
  lines: CartLine[];
  coupon: Coupon | null;
  paymentMethod: PaymentMethod | null;
  amountReceived: number | null;
  note: string;
  editor: Profile;
}

export function editOrder(input: EditOrderInput): { order: Order; items: OrderItem[] } {
  const current = getOrder(input.orderId);
  if (!current) throw new Error('order_missing');
  const block = changeBlock(current, input.editor, Date.now(), SAVE_GRACE_MS);
  if (block) throw new Error(block);
  if (input.lines.length === 0) throw new Error('order_empty');

  const now = nowIso();
  const built = buildOrder(input.lines, {
    id: current.id,
    orderNumber: current.order_number,
    cashierId: current.cashier_id,
    adminId: current.admin_id,
    note: input.note,
    isTest: current.is_test,
    amountReceived: input.amountReceived,
    paymentMethod: input.paymentMethod,
    source: current.source,
    tableCode: current.table_code,
    customerOrderId: current.customer_order_id,
    coupon: input.coupon,
    deviceId: current.device_id,
    revisionId: newId(),
    cashierLabel: current.cashier_label ?? null,
    itemId: () => newId(),
  });
  const order: Order = {
    ...built.order,
    original_total: current.original_total ?? current.total,
    edit_count: (current.edit_count ?? 0) + 1,
    edited_at: now,
    edited_by: input.editor.id,
    created_at: current.created_at,
    completed_at: current.completed_at,
    updated_at: now,
  };
  const items = built.items;

  transaction(() => {
    if (!current.is_test) restoreStockLocally(current.id);
    upsert('orders', { ...order, is_test: order.is_test ? 1 : 0, stock_deducted: 0, is_dirty: 1 });
    for (const it of items) upsert('order_items', { ...it, is_dirty: 1 });
    if (!current.is_test) {
      deductStockLocally(current.id);
      if (current.coupon_id !== order.coupon_id) {
        if (current.coupon_id) bumpCouponUseLocally(current.coupon_id, -1);
        if (order.coupon_id) bumpCouponUseLocally(order.coupon_id, 1);
      }
    }
  });
  requestSync(500);
  return { order, items };
}

export function voidOrder(orderId: string, reason: string, profile: Profile): OrderWithMeta {
  const current = getOrder(orderId);
  if (!current) throw new Error('order_missing');
  const block = changeBlock(current, profile, Date.now(), SAVE_GRACE_MS);
  if (block) throw new Error(block);
  const now = nowIso();
  transaction(() => {
    if (!current.is_test) {
      restoreStockLocally(orderId);
      if (current.coupon_id) bumpCouponUseLocally(current.coupon_id, -1);
    }
    run(
      `UPDATE orders SET status = 'void', void_reason = ?, voided_at = ?, voided_by = ?, original_total = COALESCE(original_total, total),
         stock_deducted = 0, updated_at = ?, is_dirty = 1 WHERE id = ?`,
      [reason.trim() || null, now, profile.id, now, orderId]
    );
  });
  requestSync(300);
  return getOrder(orderId) ?? current;
}

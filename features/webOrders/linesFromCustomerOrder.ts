import { getMenuItem, listVariants } from '@/features/menu/menuRepo';
import { getDeal, listDealSlots } from '@/features/promos/promoRepo';
import { dealLine, itemLine } from '@/store/cartStore';
import type { CartComponent, CartLine, CustomerOrder } from '@/lib/types';

// Re-prices the customer's requested items from the local menu; unavailable ones are reported by name.
export function linesFromCustomerOrder(order: CustomerOrder): { lines: CartLine[]; missing: string[] } {
  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const ci of order.items) {
    if (ci.deal_id) {
      const deal = getDeal(ci.deal_id);
      if (!deal || !deal.is_active) {
        missing.push(ci.name);
        continue;
      }
      const components: CartComponent[] = [];
      let ok = true;
      for (const slot of listDealSlots(deal.id)) {
        const chosen = ci.components?.find((c) => c.slot_id === slot.id) ?? null;
        const opt = chosen
          ? slot.options.find((o) => o.menu_item_id === chosen.menu_item_id && (o.variant_id == null || o.variant_id === chosen.variant_id))
          : slot.options[slot.default_index] ?? slot.options[0];
        const item = opt ? getMenuItem(opt.menu_item_id) : null;
        if (!opt || !item) {
          ok = false;
          break;
        }
        const variantId = chosen?.variant_id ?? opt.variant_id ?? (item.has_variants ? listVariants(item.id)[0]?.id ?? null : null);
        const variant = variantId ? listVariants(item.id).find((v) => v.id === variantId) ?? null : null;
        components.push({ slot_id: slot.id, slot_name: slot.name, menu_item_id: item.id, variant_id: variant?.id ?? null, name: item.name, variant_name: variant?.name ?? null });
      }
      if (!ok) {
        missing.push(ci.name);
        continue;
      }
      lines.push({ ...dealLine(deal, components), quantity: Math.max(1, ci.quantity) });
      continue;
    }
    const item = ci.menu_item_id ? getMenuItem(ci.menu_item_id) : null;
    if (!item || item.deleted_at || !item.is_active) {
      missing.push(ci.name);
      continue;
    }
    const variant = ci.variant_id ? listVariants(item.id).find((v) => v.id === ci.variant_id) ?? null : null;
    if (item.has_variants && !variant) {
      missing.push(ci.name);
      continue;
    }
    lines.push({ ...itemLine(item, variant), quantity: Math.max(1, ci.quantity) });
  }
  return { lines, missing };
}

import { all, get, nowIso, run, transaction, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import { getTenantId, requireTenantId } from '@/lib/tenant';
import type { Category, MenuItem, MenuItemVariant, StockLink } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

type CategoryRow = Omit<Category, 'is_active'> & { is_active: number };
type ItemRow = Omit<MenuItem, 'has_variants' | 'is_active'> & { has_variants: number; is_active: number };

const toCategory = (r: CategoryRow): Category => ({ ...r, is_active: !!r.is_active });
const toItem = (r: ItemRow): MenuItem => ({ ...r, has_variants: !!r.has_variants, is_active: !!r.is_active });
const tenant = () => getTenantId() ?? '';

export function listCategories(includeInactive = false): Category[] {
  const where = includeInactive ? 'deleted_at IS NULL' : 'deleted_at IS NULL AND is_active = 1';
  return all<CategoryRow>(`SELECT * FROM categories WHERE admin_id = ? AND ${where} ORDER BY sort_order, name`, [tenant()]).map(toCategory);
}

export function saveCategory(input: { id?: string; name: string; name_ur?: string | null; sort_order?: number; is_active?: boolean }): Category {
  const adminId = requireTenantId();
  const now = nowIso();
  const existing = input.id ? get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [input.id]) : null;
  const row = {
    id: input.id ?? newId(),
    admin_id: adminId,
    name: input.name.trim(),
    name_ur: input.name_ur?.trim() || null,
    sort_order: input.sort_order ?? existing?.sort_order ?? listCategories(true).length,
    is_active: (input.is_active ?? (existing ? !!existing.is_active : true)) ? 1 : 0,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('categories', row);
  requestSync();
  return toCategory(row);
}

export function deleteCategory(id: string) {
  const now = nowIso();
  transaction(() => {
    run('UPDATE categories SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
    run('UPDATE menu_items SET category_id = NULL, updated_at = ?, is_dirty = 1 WHERE category_id = ?', [now, id]);
  });
  requestSync();
}

export function listMenuItems(opts: { activeOnly?: boolean; categoryId?: string | null; search?: string } = {}): MenuItem[] {
  const clauses = ['admin_id = ?', 'deleted_at IS NULL'];
  const params: (string | number)[] = [tenant()];
  if (opts.activeOnly) clauses.push('is_active = 1');
  if (opts.categoryId) {
    clauses.push('category_id = ?');
    params.push(opts.categoryId);
  }
  if (opts.search?.trim()) {
    clauses.push('(name LIKE ? OR name_ur LIKE ?)');
    const q = `%${opts.search.trim()}%`;
    params.push(q, q);
  }
  return all<ItemRow>(`SELECT * FROM menu_items WHERE ${clauses.join(' AND ')} ORDER BY sort_order, name`, params).map(toItem);
}

export function getMenuItem(id: string): MenuItem | null {
  const r = get<ItemRow>('SELECT * FROM menu_items WHERE id = ? AND admin_id = ?', [id, tenant()]);
  return r ? toItem(r) : null;
}

export function listVariants(itemId: string): MenuItemVariant[] {
  return all<MenuItemVariant>('SELECT * FROM menu_item_variants WHERE menu_item_id = ? AND deleted_at IS NULL ORDER BY sort_order, price', [itemId]);
}

export function listAllVariants(): MenuItemVariant[] {
  return all<MenuItemVariant>('SELECT * FROM menu_item_variants WHERE admin_id = ? AND deleted_at IS NULL ORDER BY sort_order, price', [tenant()]);
}

export function listStockLinks(itemId: string): StockLink[] {
  return all<StockLink>('SELECT * FROM stock_links WHERE menu_item_id = ? AND deleted_at IS NULL', [itemId]);
}

export interface VariantInput {
  id?: string;
  name: string;
  price: number;
}
export interface StockLinkInput {
  id?: string;
  variant_id: string | null;
  stock_item_id: string;
  quantity_per_unit: number;
}

export function saveMenuItem(
  input: {
    id?: string;
    category_id: string | null;
    name: string;
    name_ur?: string | null;
    description?: string | null;
    image_url?: string | null;
    base_price: number;
    has_variants: boolean;
    is_active: boolean;
    sort_order?: number;
  },
  variants: VariantInput[],
  links: StockLinkInput[]
): MenuItem {
  const adminId = requireTenantId();
  const now = nowIso();
  const id = input.id ?? newId();
  const existing = input.id ? get<ItemRow>('SELECT * FROM menu_items WHERE id = ?', [input.id]) : null;
  const row = {
    id,
    admin_id: adminId,
    category_id: input.category_id,
    name: input.name.trim(),
    name_ur: input.name_ur?.trim() || null,
    description: input.description?.trim() || null,
    image_url: input.image_url ?? existing?.image_url ?? null,
    base_price: input.has_variants ? 0 : input.base_price,
    has_variants: input.has_variants ? 1 : 0,
    is_active: input.is_active ? 1 : 0,
    sort_order: input.sort_order ?? existing?.sort_order ?? 0,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };

  transaction(() => {
    upsert('menu_items', row);

    const keepVariantIds = new Set<string>();
    if (input.has_variants) {
      variants.forEach((v, i) => {
        const vid = v.id ?? newId();
        keepVariantIds.add(vid);
        const prior = get<MenuItemVariant>('SELECT * FROM menu_item_variants WHERE id = ?', [vid]);
        upsert('menu_item_variants', {
          id: vid,
          admin_id: adminId,
          menu_item_id: id,
          name: v.name.trim(),
          price: v.price,
          sort_order: i,
          deleted_at: null,
          created_at: prior?.created_at ?? now,
          updated_at: now,
          is_dirty: 1,
        });
      });
    }
    for (const v of all<{ id: string }>('SELECT id FROM menu_item_variants WHERE menu_item_id = ? AND deleted_at IS NULL', [id])) {
      if (!keepVariantIds.has(v.id)) run('UPDATE menu_item_variants SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, v.id]);
    }

    const keepLinkIds = new Set<string>();
    for (const l of links) {
      if (!l.stock_item_id || l.quantity_per_unit <= 0) continue;
      if (l.variant_id && !keepVariantIds.has(l.variant_id)) continue;
      const lid = l.id ?? newId();
      keepLinkIds.add(lid);
      const prior = get<StockLink>('SELECT * FROM stock_links WHERE id = ?', [lid]);
      upsert('stock_links', {
        id: lid,
        admin_id: adminId,
        menu_item_id: id,
        variant_id: l.variant_id,
        stock_item_id: l.stock_item_id,
        quantity_per_unit: l.quantity_per_unit,
        deleted_at: null,
        created_at: prior?.created_at ?? now,
        updated_at: now,
        is_dirty: 1,
      });
    }
    for (const l of all<{ id: string }>('SELECT id FROM stock_links WHERE menu_item_id = ? AND deleted_at IS NULL', [id])) {
      if (!keepLinkIds.has(l.id)) run('UPDATE stock_links SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, l.id]);
    }
  });
  requestSync();
  return toItem(row);
}

export function setMenuItemImage(id: string, imageUrl: string) {
  run('UPDATE menu_items SET image_url = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [imageUrl, nowIso(), id]);
  requestSync();
}

export function deleteMenuItem(id: string) {
  const now = nowIso();
  transaction(() => {
    run('UPDATE menu_items SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
    run('UPDATE menu_item_variants SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE menu_item_id = ? AND deleted_at IS NULL', [now, now, id]);
    run('UPDATE stock_links SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE menu_item_id = ? AND deleted_at IS NULL', [now, now, id]);
  });
  requestSync();
}

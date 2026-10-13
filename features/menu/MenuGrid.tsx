import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { AppText, Badge, Button, EmptyState, Input, Segmented, Sheet } from '@/components/ui';
import { useLayout, useT, localizedName } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listAllVariants, listCategories, listMenuItems } from './menuRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney } from '@/lib/format';
import { dealLine, useCart } from '@/store/cartStore';
import { listDeals, listDiscounts } from '@/features/promos/promoRepo';
import { priceWithDiscounts } from '@/features/promos/pricing';
import { DealPickerSheet } from '@/features/promos/DealPickerSheet';
import type { Deal, MenuItem, MenuItemVariant } from '@/lib/types';

const DEALS = '__deals__';

type Tile = { kind: 'item'; item: MenuItem } | { kind: 'deal'; deal: Deal };

export function MenuGrid({ availableWidth }: { availableWidth?: number }) {
  const t = useT();
  const { lang, row } = useLayout();
  const { width: windowWidth } = useWindowDimensions();
  const width = availableWidth ?? windowWidth;
  const add = useCart((s) => s.add);
  const addLine = useCart((s) => s.addLine);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [pickingDeal, setPickingDeal] = useState<Deal | null>(null);

  const [data] = useLocalQuery(
    () => ({
      categories: listCategories(),
      items: listMenuItems({ activeOnly: true, categoryId: category === 'all' || category === DEALS ? null : category, search }),
      variants: listAllVariants(),
      deals: listDeals(true).filter((d) => !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase())),
      discounts: listDiscounts(true),
      currency: getSettings().currency_symbol,
    }),
    [category, search]
  );

  const columns = Math.max(2, Math.min(5, Math.floor((width - spacing.lg * 2) / 150)));
  const variantsFor = (id: string) => data.variants.filter((v) => v.menu_item_id === id);
  const priced = (item: MenuItem, base: number) => priceWithDiscounts(item.id, base, data.discounts);

  const tiles: Tile[] = useMemo(() => {
    if (category === DEALS) return data.deals.map((deal) => ({ kind: 'deal' as const, deal }));
    const items = data.items.map((item) => ({ kind: 'item' as const, item }));
    return category === 'all' ? [...data.deals.map((deal) => ({ kind: 'deal' as const, deal })), ...items] : items;
  }, [category, data.items, data.deals]);

  const tap = (item: MenuItem) => {
    if (item.has_variants) {
      const vs = variantsFor(item.id);
      if (vs.length === 1) add(item, vs[0]);
      else setPicking(item);
    } else add(item, null);
  };

  const pickingVariants = useMemo(() => (picking ? variantsFor(picking.id) : []), [picking, data.variants]);

  const renderPrice = (item: MenuItem) => {
    if (!item.has_variants) {
      const p = priced(item, item.base_price);
      return (
        <View style={[row, { gap: spacing.xs, alignItems: 'center' }]}>
          {p.price < p.original ? (
            <AppText variant="small" style={styles.strike}>
              {formatMoney(p.original, data.currency)}
            </AppText>
          ) : null}
          <AppText variant="small" color={p.price < p.original ? colors.success : colors.action} weight="600">
            {formatMoney(p.price, data.currency)}
          </AppText>
        </View>
      );
    }
    const vs = variantsFor(item.id);
    if (!vs.length) return <AppText variant="small">-</AppText>;
    const low = vs.map((v) => priced(item, v.price)).sort((a, b) => a.price - b.price)[0];
    return (
      <View style={[row, { gap: spacing.xs, alignItems: 'center' }]}>
        {low.price < low.original ? (
          <AppText variant="small" style={styles.strike}>
            {formatMoney(low.original, data.currency)}
          </AppText>
        ) : null}
        <AppText variant="small" color={low.price < low.original ? colors.success : colors.action} weight="600">
          {`${formatMoney(low.price, data.currency)}+`}
        </AppText>
      </View>
    );
  };

  const renderTile = (tile: Tile) => {
    if (tile.kind === 'deal') {
      const d = tile.deal;
      return (
        <Pressable collapsable={false} onPress={() => setPickingDeal(d)} style={({ pressed }) => [styles.card, styles.dealCard, pressed ? styles.pressed : null]}>
          {d.image_url ? (
            <Image source={{ uri: d.image_url }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center' }]}>
              <AppText variant="title" color={colors.surfaceHighlight}>
                {d.name[0]?.toUpperCase()}
              </AppText>
            </View>
          )}
          <View style={{ padding: spacing.sm, gap: 4 }}>
            <Badge label={t('deals')} tone="warning" />
            <AppText weight="600" numberOfLines={2}>
              {localizedName(lang, d.name, d.name_ur)}
            </AppText>
            <AppText variant="small" color={colors.action} weight="600">
              {formatMoney(d.price, data.currency)}
            </AppText>
          </View>
        </Pressable>
      );
    }
    const item = tile.item;
    return (
      <Pressable collapsable={false} onPress={() => tap(item)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.surfaceSidebar, alignItems: 'center', justifyContent: 'center' }]}>
            <AppText variant="title" color={colors.surfaceHighlight}>
              {item.name[0]?.toUpperCase()}
            </AppText>
          </View>
        )}
        <View style={{ padding: spacing.sm, gap: 2 }}>
          <AppText weight="600" numberOfLines={2}>
            {localizedName(lang, item.name, item.name_ur)}
          </AppText>
          <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            {renderPrice(item)}
            {item.has_variants ? <AppText variant="label">{t('size')}</AppText> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const chips = [{ value: 'all', label: t('allCategories') }, ...(data.deals.length ? [{ value: DEALS, label: t('deals') }] : []), ...data.categories.map((c) => ({ value: c.id, label: localizedName(lang, c.name, c.name_ur) }))];

  return (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <Input placeholder={t('searchMenu')} value={search} onChangeText={setSearch} />
      <Segmented scroll value={category} onChange={setCategory} options={chips} />
      <FlatList
        key={columns}
        data={tiles}
        numColumns={columns}
        keyExtractor={(tile) => (tile.kind === 'deal' ? `deal:${tile.deal.id}` : tile.item.id)}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState title={category === DEALS ? t('noDeals') : t('noItems')} icon="book-open" />}
        renderItem={({ item }) => renderTile(item)}
      />
      <Sheet visible={!!picking} onClose={() => setPicking(null)} title={picking ? `${t('chooseSize')}: ${localizedName(lang, picking.name, picking.name_ur)}` : ''}>
        {pickingVariants.map((v: MenuItemVariant) => {
          const p = picking ? priced(picking, v.price) : null;
          const label = p && p.price < p.original ? `${v.name}  ${formatMoney(p.price, data.currency)}  (${formatMoney(p.original, data.currency)})` : `${v.name}  ${formatMoney(v.price, data.currency)}`;
          return (
            <Button
              key={v.id}
              title={label}
              variant="outline"
              onPress={() => {
                if (picking) add(picking, v);
                setPicking(null);
              }}
            />
          );
        })}
      </Sheet>
      {pickingDeal ? <DealPickerSheet deal={pickingDeal} currency={data.currency} onClose={() => setPickingDeal(null)} onAdd={(deal, components) => addLine(dealLine(deal, components))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  dealCard: { borderColor: colors.surfaceHighlight },
  pressed: { borderColor: colors.action },
  image: { width: '100%', aspectRatio: 4 / 3 },
  strike: { textDecorationLine: 'line-through', color: colors.disabled },
});

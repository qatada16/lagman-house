import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { AppText, Button, EmptyState, Input, Segmented, Sheet } from '@/components/ui';
import { useLayout, useT, localizedName } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listAllVariants, listCategories, listMenuItems } from './menuRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney } from '@/lib/format';
import { useCartStore } from '@/store/cartStore';
import type { MenuItem, MenuItemVariant } from '@/lib/types';

export function MenuGrid({ availableWidth }: { availableWidth?: number }) {
  const t = useT();
  const { lang, row } = useLayout();
  const { width: windowWidth } = useWindowDimensions();
  const width = availableWidth ?? windowWidth;
  const add = useCartStore((s) => s.add);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [picking, setPicking] = useState<MenuItem | null>(null);

  const [data] = useLocalQuery(
    () => ({
      categories: listCategories(),
      items: listMenuItems({ activeOnly: true, categoryId: category === 'all' ? null : category, search }),
      variants: listAllVariants(),
      currency: getSettings().currency_symbol,
    }),
    [category, search]
  );

  const columns = Math.max(2, Math.min(5, Math.floor((width - spacing.lg * 2) / 150)));
  const variantsFor = (id: string) => data.variants.filter((v) => v.menu_item_id === id);

  const priceText = (item: MenuItem) => {
    if (!item.has_variants) return formatMoney(item.base_price, data.currency);
    const prices = variantsFor(item.id).map((v) => v.price);
    return prices.length ? `${formatMoney(Math.min(...prices), data.currency)}+` : '-';
  };

  const tap = (item: MenuItem) => {
    if (item.has_variants) {
      const vs = variantsFor(item.id);
      if (vs.length === 1) add(item, vs[0]);
      else setPicking(item);
    } else add(item, null);
  };

  const pickingVariants = useMemo(() => (picking ? variantsFor(picking.id) : []), [picking, data.variants]);

  return (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <Input placeholder={t('searchMenu')} value={search} onChangeText={setSearch} />
      <Segmented scroll value={category} onChange={setCategory} options={[{ value: 'all', label: t('allCategories') }, ...data.categories.map((c) => ({ value: c.id, label: localizedName(lang, c.name, c.name_ur) }))]} />
      <FlatList
        key={columns}
        data={data.items}
        numColumns={columns}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState title={t('noItems')} icon="book-open" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => tap(item)} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
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
                <AppText variant="small" color={colors.action} weight="600">
                  {priceText(item)}
                </AppText>
                {item.has_variants ? <AppText variant="label">{t('size')}</AppText> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
      <Sheet visible={!!picking} onClose={() => setPicking(null)} title={picking ? `${t('chooseSize')}: ${localizedName(lang, picking.name, picking.name_ur)}` : ''}>
        {pickingVariants.map((v: MenuItemVariant) => (
          <Button
            key={v.id}
            title={`${v.name}  ${formatMoney(v.price, data.currency)}`}
            variant="outline"
            onPress={() => {
              if (picking) add(picking, v);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pressed: { borderColor: colors.action },
  image: { width: '100%', aspectRatio: 4 / 3 },
});

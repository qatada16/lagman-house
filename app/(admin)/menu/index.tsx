import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, Input, ListRow, Screen, Segmented } from '@/components/ui';
import { useLayout, useT, localizedName } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listCategories, listMenuItems, listAllVariants } from '@/features/menu/menuRepo';
import { CategoryManager } from '@/features/menu/CategoryManager';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney } from '@/lib/format';

export default function MenuAdminScreen() {
  const t = useT();
  const router = useRouter();
  const { row, lang } = useLayout();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [showCategories, setShowCategories] = useState(false);

  const [data, refresh] = useLocalQuery(
    () => ({
      categories: listCategories(true),
      items: listMenuItems({ categoryId: category === 'all' ? null : category, search }),
      variants: listAllVariants(),
      currency: getSettings().currency_symbol,
    }),
    [category, search]
  );

  const priceLabel = (id: string, base: number, hasVariants: boolean) => {
    if (!hasVariants) return formatMoney(base, data.currency);
    const prices = data.variants.filter((v) => v.menu_item_id === id).map((v) => v.price);
    if (prices.length === 0) return '-';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatMoney(min, data.currency) : `${formatMoney(min, data.currency)} - ${formatMoney(max, data.currency)}`;
  };

  return (
    <Screen
      title={t('menuTitle')}
      actions={
        <View style={[row, { gap: spacing.sm }]}>
          <Button title={t('categories')} variant="outline" size="sm" icon="tag" onPress={() => setShowCategories(true)} />
          <Button title={t('addItem')} variant="action" size="sm" icon="plus" onPress={() => router.push('/(admin)/menu/new')} />
        </View>
      }
    >
      <Input placeholder={t('searchMenu')} value={search} onChangeText={setSearch} />
      <Segmented
        scroll
        value={category}
        onChange={setCategory}
        options={[{ value: 'all', label: t('allCategories') }, ...data.categories.map((c) => ({ value: c.id, label: localizedName(lang, c.name, c.name_ur) }))]}
      />
      <Card padded={false}>
        {data.items.length === 0 ? (
          <EmptyState title={t('noItems')} icon="book-open" />
        ) : (
          data.items.map((item) => (
            <ListRow
              key={item.id}
              title={localizedName(lang, item.name, item.name_ur)}
              subtitle={`${priceLabel(item.id, item.base_price, item.has_variants)}${item.description ? `  ${item.description}` : ''}`}
              onPress={() => router.push({ pathname: '/(admin)/menu/[id]', params: { id: item.id } })}
              chevron
              left={
                item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={{ width: 48, height: 48, borderRadius: radius.sm }} contentFit="cover" />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceSidebar }} />
                )
              }
              right={!item.is_active ? <Badge label={t('inactive')} /> : item.has_variants ? <Badge label={t('variants')} tone="info" /> : null}
            />
          ))
        )}
      </Card>
      <AppText variant="small">{`${data.items.length} ${t('items').toLowerCase()}`}</AppText>
      {showCategories ? <CategoryManager visible onClose={() => setShowCategories(false)} onChanged={refresh} /> : null}
    </Screen>
  );
}

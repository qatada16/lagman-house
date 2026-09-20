import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card, IconButton, Input, Screen, Select, SectionTitle, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { deleteMenuItem, getMenuItem, listCategories, listStockLinks, listVariants, saveMenuItem, setMenuItemImage, type StockLinkInput, type VariantInput } from '@/features/menu/menuRepo';
import { listStockItems } from '@/features/stock/stockRepo';
import { pickImage } from '@/features/menu/useImagePick';
import { uploadImage } from '@/lib/storage';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import { useSyncStore } from '@/store/syncStore';
import { newId } from '@/lib/device';

type VariantDraft = VariantInput & { id: string; priceText: string };
type LinkDraft = StockLinkInput & { id: string; qtyText: string };

export default function MenuItemEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const online = useSyncStore((s) => s.online);

  const existing = useMemo(() => (isNew ? null : getMenuItem(id)), [id, isNew]);
  const categories = useMemo(() => listCategories(true), []);
  const stockItems = useMemo(() => listStockItems(), []);

  const [name, setName] = useState(existing?.name ?? '');
  const [nameUr, setNameUr] = useState(existing?.name_ur ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? categories[0]?.id ?? null);
  const [priceText, setPriceText] = useState(existing ? String(existing.base_price) : '');
  const [hasVariants, setHasVariants] = useState(existing?.has_variants ?? false);
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [imageUri, setImageUri] = useState<string | null>(existing?.image_url ?? null);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    existing ? listVariants(existing.id).map((v) => ({ id: v.id, name: v.name, price: v.price, priceText: String(v.price) })) : []
  );
  const [links, setLinks] = useState<LinkDraft[]>(() =>
    existing
      ? listStockLinks(existing.id).map((l) => ({ id: l.id, variant_id: l.variant_id, stock_item_id: l.stock_item_id, quantity_per_unit: l.quantity_per_unit, qtyText: String(l.quantity_per_unit) }))
      : []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const choosePhoto = async () => {
    const uri = await pickImage([4, 3]);
    if (uri) {
      setLocalImage(uri);
      setImageUri(uri);
    }
  };

  const save = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('fieldRequired');
    const price = Number(priceText);
    if (!hasVariants && (priceText === '' || Number.isNaN(price) || price < 0)) next.price = t('invalidNumber');
    if (hasVariants && variants.length === 0) next.variants = t('fieldRequired');
    for (const v of variants) {
      if (!v.name.trim() || Number.isNaN(Number(v.priceText))) next.variants = t('invalidNumber');
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const saved = saveMenuItem(
        {
          id: existing?.id,
          category_id: categoryId,
          name,
          name_ur: nameUr,
          description,
          image_url: localImage ? existing?.image_url ?? null : imageUri,
          base_price: hasVariants ? 0 : price,
          has_variants: hasVariants,
          is_active: isActive,
        },
        variants.map((v) => ({ id: v.id, name: v.name, price: Number(v.priceText) })),
        links.map((l) => ({ id: l.id, variant_id: l.variant_id, stock_item_id: l.stock_item_id, quantity_per_unit: Number(l.qtyText) || 0 }))
      );
      if (localImage) {
        if (online) {
          try {
            const url = await uploadImage('images', `menu/${saved.admin_id}/${saved.id}`, localImage);
            setMenuItemImage(saved.id, url);
          } catch (e) {
            toast.error(`${t('error')}: ${(e as Error).message}`);
          }
        } else {
          toast.info(t('imageOfflineHint'));
        }
      }
      toast.success(t('itemSaved'));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteItemConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteMenuItem(existing.id);
      router.back();
    }
  };

  const stockOptions = stockItems.map((s) => ({ value: s.id, label: s.name, hint: `${s.quantity} ${s.unit}` }));
  const variantOptions = [{ value: '__all__', label: t('allVariants') }, ...variants.filter((v) => v.name.trim()).map((v) => ({ value: v.id, label: v.name }))];

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('newItem') : t('editItem')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('save')} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card>
        <View style={[row, { gap: spacing.lg, alignItems: 'center' }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: colors.surfaceSidebar }]} />
          )}
          <View style={{ gap: spacing.sm }}>
            <Button title={imageUri ? t('changeImage') : t('uploadImage')} variant="outline" size="sm" icon="image" onPress={choosePhoto} />
            {imageUri ? (
              <Button
                title={t('remove')}
                variant="ghost"
                size="sm"
                onPress={() => {
                  setImageUri(null);
                  setLocalImage(null);
                }}
              />
            ) : null}
          </View>
        </View>
        <View style={{ height: spacing.md }} />
        <Input label={t('itemName')} value={name} onChangeText={setName} error={errors.name} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('itemNameUr')} value={nameUr} onChangeText={setNameUr} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('description')} value={description} onChangeText={setDescription} multiline />
        <View style={{ height: spacing.sm }} />
        <Select
          label={t('category')}
          value={categoryId}
          options={[...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={setCategoryId}
          placeholder={t('noCategory')}
        />
        <View style={{ height: spacing.sm }} />
        <Toggle label={t('isActive')} value={isActive} onChange={setIsActive} />
      </Card>

      <Card title={t('price')}>
        <Toggle label={t('hasVariants')} hint={t('hasVariantsHint')} value={hasVariants} onChange={setHasVariants} />
        {!hasVariants ? (
          <Input label={t('basePrice')} value={priceText} onChangeText={setPriceText} decimal error={errors.price} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <SectionTitle title={t('variants')} right={<Button title={t('addVariant')} size="sm" variant="outline" icon="plus" onPress={() => setVariants((v) => [...v, { id: newId(), name: '', price: 0, priceText: '' }])} />} />
            {variants.map((v, i) => (
              <View key={v.id} style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
                <Input
                  label={i === 0 ? t('variantName') : undefined}
                  value={v.name}
                  onChangeText={(text) => setVariants((all) => all.map((x) => (x.id === v.id ? { ...x, name: text } : x)))}
                  containerStyle={{ flex: 2 }}
                  placeholder="Small"
                />
                <Input
                  label={i === 0 ? t('variantPrice') : undefined}
                  value={v.priceText}
                  onChangeText={(text) => setVariants((all) => all.map((x) => (x.id === v.id ? { ...x, priceText: text } : x)))}
                  decimal
                  containerStyle={{ flex: 1 }}
                />
                <IconButton icon="trash-2" color={colors.danger} onPress={() => setVariants((all) => all.filter((x) => x.id !== v.id))} />
              </View>
            ))}
            {errors.variants ? (
              <AppText variant="small" color={colors.danger}>
                {errors.variants}
              </AppText>
            ) : null}
          </View>
        )}
      </Card>

      <Card title={t('stockLinks')}>
        <AppText variant="small">{t('stockLinksHint')}</AppText>
        <View style={{ height: spacing.sm }} />
        {links.map((l) => {
          const stock = stockItems.find((s) => s.id === l.stock_item_id);
          return (
            <View key={l.id} style={styles.linkRow}>
              <Select label={t('stockItem')} value={l.stock_item_id || null} options={stockOptions} onChange={(v) => setLinks((all) => all.map((x) => (x.id === l.id ? { ...x, stock_item_id: v } : x)))} searchable />
              <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
                <Input
                  label={`${t('quantityPerUnit')}${stock ? ` (${stock.unit})` : ''}`}
                  value={l.qtyText}
                  onChangeText={(text) => setLinks((all) => all.map((x) => (x.id === l.id ? { ...x, qtyText: text } : x)))}
                  decimal
                  containerStyle={{ flex: 1 }}
                />
                {hasVariants ? (
                  <View style={{ flex: 1 }}>
                    <Select
                      label={t('appliesTo')}
                      value={l.variant_id ?? '__all__'}
                      options={variantOptions}
                      onChange={(v) => setLinks((all) => all.map((x) => (x.id === l.id ? { ...x, variant_id: v === '__all__' ? null : v } : x)))}
                    />
                  </View>
                ) : null}
                <IconButton icon="trash-2" color={colors.danger} onPress={() => setLinks((all) => all.filter((x) => x.id !== l.id))} />
              </View>
            </View>
          );
        })}
        <Button
          title={t('addStockLink')}
          variant="outline"
          size="sm"
          icon="plus"
          disabled={stockItems.length === 0}
          onPress={() => setLinks((all) => [...all, { id: newId(), variant_id: null, stock_item_id: stockItems[0]?.id ?? '', quantity_per_unit: 0, qtyText: '' }])}
        />
        {stockItems.length === 0 ? <AppText variant="small">{t('noStock')}</AppText> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: 120, height: 90, borderRadius: radius.md },
  linkRow: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm },
});

import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, IconButton, Input, Screen, Select, SectionTitle, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { deleteDeal, getDeal, listDealSlots, saveDeal, setDealImage, type SlotInput } from '@/features/promos/promoRepo';
import { dateTimeInputValue, parseDateTimeInput } from '@/features/promos/dateInput';
import { ValidityFields } from '@/features/promos/ValidityFields';
import { listMenuItems, listVariants } from '@/features/menu/menuRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { pickImage } from '@/features/menu/useImagePick';
import { uploadImage } from '@/lib/storage';
import { queueImageUpload } from '@/features/sync/uploads';
import { useSyncStore } from '@/store/syncStore';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import { newId } from '@/lib/device';
import { formatMoney } from '@/lib/format';
import type { DealOption } from '@/lib/types';

type SlotDraft = SlotInput & { id: string };
const ANY = '__any__';

export default function DealEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const online = useSyncStore((s) => s.online);
  const existing = useMemo(() => (isNew ? null : getDeal(id)), [id, isNew]);
  const items = useMemo(() => listMenuItems({}), []);
  const currency = getSettings().currency_symbol;

  const [name, setName] = useState(existing?.name ?? '');
  const [nameUr, setNameUr] = useState(existing?.name_ur ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priceText, setPriceText] = useState(existing ? String(existing.price) : '');
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [from, setFrom] = useState(dateTimeInputValue(existing?.starts_at ?? null));
  const [to, setTo] = useState(dateTimeInputValue(existing?.ends_at ?? null));
  const [imageUri, setImageUri] = useState<string | null>(existing?.image_url ?? null);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDraft[]>(() => (existing ? listDealSlots(existing.id).map((s) => ({ id: s.id, name: s.name, options: s.options, default_index: s.default_index })) : []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const regular = slots.reduce((sum, s) => {
    const opt = s.options[s.default_index] ?? s.options[0];
    const item = opt ? items.find((i) => i.id === opt.menu_item_id) : null;
    if (!item) return sum;
    const variants = item.has_variants ? listVariants(item.id) : [];
    const variant = opt?.variant_id ? variants.find((v) => v.id === opt.variant_id) : variants[0];
    return sum + (item.has_variants ? variant?.price ?? 0 : item.base_price);
  }, 0);

  const updateSlot = (sid: string, patch: Partial<SlotDraft>) => setSlots((all) => all.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
  const updateOption = (sid: string, idx: number, opt: DealOption) =>
    setSlots((all) => all.map((s) => (s.id === sid ? { ...s, options: s.options.map((o, i) => (i === idx ? opt : o)) } : s)));
  const removeOption = (sid: string, idx: number) =>
    setSlots((all) => all.map((s) => (s.id === sid ? { ...s, options: s.options.filter((_, i) => i !== idx), default_index: Math.min(s.default_index, Math.max(0, s.options.length - 2)) } : s)));

  const save = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('fieldRequired');
    const price = Number(priceText);
    if (priceText === '' || Number.isNaN(price) || price < 0) next.price = t('invalidNumber');
    const startsAt = parseDateTimeInput(from);
    const endsAt = parseDateTimeInput(to, true);
    if (startsAt === undefined) next.from = t('dateTimeFormatHint');
    if (endsAt === undefined) next.to = t('dateTimeFormatHint');
    if (slots.filter((s) => s.name.trim() && s.options.length).length === 0) next.slots = t('fieldRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = saveDeal(
        { id: existing?.id, name, name_ur: nameUr, description, image_url: localImage ? existing?.image_url ?? null : imageUri, price, is_active: isActive, starts_at: startsAt ?? null, ends_at: endsAt ?? null },
        slots
      );
      if (localImage) {
        const remotePath = `deals/${saved.admin_id}/${saved.id}`;
        let uploaded = false;
        if (online) {
          try {
            setDealImage(saved.id, await uploadImage('images', remotePath, localImage));
            uploaded = true;
          } catch {
            uploaded = false;
          }
        }
        if (!uploaded) {
          setDealImage(saved.id, queueImageUpload({ bucket: 'images', path: remotePath, sourceUri: localImage, targetTable: 'deals', targetId: saved.id, targetColumn: 'image_url' }));
          toast.info(t('imageQueuedHint'));
        }
      }
      toast.success(t('saved'));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteDealConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteDeal(existing.id);
      router.back();
    }
  };

  const itemOptions = items.map((i) => ({ value: i.id, label: i.name }));

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('newDeal') : t('editDeal')}
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
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" /> : <View style={[styles.image, { backgroundColor: colors.surfaceSidebar }]} />}
          <Button
            title={imageUri ? t('changeImage') : t('uploadImage')}
            variant="outline"
            size="sm"
            icon="image"
            onPress={async () => {
              const uri = await pickImage([4, 3]);
              if (uri) {
                setLocalImage(uri);
                setImageUri(uri);
              }
            }}
          />
        </View>
        <View style={{ height: spacing.md }} />
        <Input label={t('dealName')} value={name} onChangeText={setName} error={errors.name} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('dealNameUr')} value={nameUr} onChangeText={setNameUr} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('description')} value={description} onChangeText={setDescription} multiline />
        <View style={{ height: spacing.sm }} />
        <Input label={`${t('dealPrice')} (${currency})`} value={priceText} onChangeText={setPriceText} decimal error={errors.price} hint={regular > 0 ? `${t('dealRegularPrice', { amount: formatMoney(regular, currency) })}${Number(priceText) > 0 && regular > Number(priceText) ? `  ${t('dealSave', { amount: formatMoney(regular - Number(priceText), currency) })}` : ''}` : undefined} />
        <View style={{ height: spacing.sm }} />
        <Toggle label={t('isActive')} value={isActive} onChange={setIsActive} />
        <ValidityFields from={from} to={to} onFrom={setFrom} onTo={setTo} errors={errors} />
      </Card>

      <Card title={t('dealSlots')}>
        <AppText variant="small">{t('dealSlotsHint')}</AppText>
        {errors.slots ? (
          <AppText variant="small" color={colors.danger}>
            {errors.slots}
          </AppText>
        ) : null}
        {slots.map((slot, si) => (
          <View key={slot.id} style={styles.slot}>
            <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
              <Input label={`${si + 1}. ${t('slotName')}`} value={slot.name} onChangeText={(v) => updateSlot(slot.id, { name: v })} containerStyle={{ flex: 1 }} />
              <IconButton icon="trash-2" color={colors.danger} onPress={() => setSlots((all) => all.filter((s) => s.id !== slot.id))} />
            </View>
            <SectionTitle title={t('slotOptions')} right={<Button title={t('addOption')} size="sm" variant="outline" icon="plus" disabled={items.length === 0} onPress={() => updateSlot(slot.id, { options: [...slot.options, { menu_item_id: items[0]?.id ?? '', variant_id: null }] })} />} />
            {slot.options.map((opt, oi) => {
              const item = items.find((i) => i.id === opt.menu_item_id);
              const variants = item?.has_variants ? listVariants(item.id) : [];
              const isDefault = slot.default_index === oi;
              return (
                <View key={`${slot.id}-${oi}`} style={styles.option}>
                  <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
                    <View style={{ flex: 1 }}>
                      <Select label={t('item')} value={opt.menu_item_id || null} options={itemOptions} onChange={(v) => updateOption(slot.id, oi, { menu_item_id: v, variant_id: null })} searchable />
                    </View>
                    {variants.length > 0 ? (
                      <View style={{ flex: 1 }}>
                        <Select label={t('size')} value={opt.variant_id ?? ANY} options={[{ value: ANY, label: t('anySize') }, ...variants.map((v) => ({ value: v.id, label: v.name }))]} onChange={(v) => updateOption(slot.id, oi, { ...opt, variant_id: v === ANY ? null : v })} />
                      </View>
                    ) : null}
                    <IconButton icon="trash-2" color={colors.danger} onPress={() => removeOption(slot.id, oi)} />
                  </View>
                  <View style={[row, { gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs }]}>
                    {isDefault ? <Badge label={t('defaultChoice')} tone="success" /> : <Button title={t('defaultChoice')} variant="ghost" size="sm" onPress={() => updateSlot(slot.id, { default_index: oi })} />}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <Button title={t('addSlot')} variant="outline" icon="plus" style={{ marginTop: spacing.sm }} onPress={() => setSlots((all) => [...all, { id: newId(), name: '', options: items[0] ? [{ menu_item_id: items[0].id, variant_id: null }] : [], default_index: 0 }])} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: 120, height: 90, borderRadius: radius.md },
  slot: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  option: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSidebar, marginBottom: spacing.sm },
});

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card, IconButton, Input, Screen, Segmented, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { deleteDiscount, getDiscount, saveDiscount } from '@/features/promos/promoRepo';
import { dateTimeInputValue, parseDateTimeInput } from '@/features/promos/dateInput';
import { ValidityFields } from '@/features/promos/ValidityFields';
import { applyPromo } from '@/features/promos/pricing';
import { listMenuItems } from '@/features/menu/menuRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import type { PromoKind } from '@/lib/types';

export default function DiscountEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getDiscount(id)), [id, isNew]);
  const items = useMemo(() => listMenuItems({}), []);
  const currency = getSettings().currency_symbol;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<PromoKind>(existing?.kind ?? 'percent');
  const [valueText, setValueText] = useState(existing ? String(existing.value) : '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(existing?.item_ids ?? []));
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [from, setFrom] = useState(dateTimeInputValue(existing?.starts_at ?? null));
  const [to, setTo] = useState(dateTimeInputValue(existing?.ends_at ?? null));
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = (itemId: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });

  const save = () => {
    const next: Record<string, string> = {};
    const value = Number(valueText);
    if (!name.trim()) next.name = t('fieldRequired');
    if (valueText === '' || Number.isNaN(value) || value <= 0 || (kind === 'percent' && value > 100)) next.value = t('invalidNumber');
    if (selected.size === 0) next.items = t('fieldRequired');
    const startsAt = parseDateTimeInput(from);
    const endsAt = parseDateTimeInput(to, true);
    if (startsAt === undefined) next.from = t('dateTimeFormatHint');
    if (endsAt === undefined) next.to = t('dateTimeFormatHint');
    setErrors(next);
    if (Object.keys(next).length) return;
    saveDiscount({ id: existing?.id, name, kind, value, item_ids: [...selected], is_active: isActive, starts_at: startsAt ?? null, ends_at: endsAt ?? null });
    toast.success(t('saved'));
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteDiscountConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteDiscount(existing.id);
      router.back();
    }
  };

  const visible = items.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const value = Number(valueText) || 0;

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('newDiscount') : t('editDiscount')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card>
        <Input label={t('discountName')} value={name} onChangeText={setName} error={errors.name} placeholder="Weekend 20% off" />
        <View style={{ height: spacing.md }} />
        <Segmented<PromoKind> label={t('discountKind')} value={kind} onChange={setKind} options={[{ value: 'percent', label: t('kindPercent') }, { value: 'fixed', label: t('kindFixed') }]} />
        <View style={{ height: spacing.md }} />
        <Input label={`${t('discountValue')} (${kind === 'percent' ? '%' : currency})`} value={valueText} onChangeText={setValueText} decimal error={errors.value} />
        <View style={{ height: spacing.sm }} />
        <Toggle label={t('isActive')} value={isActive} onChange={setIsActive} />
        <ValidityFields from={from} to={to} onFrom={setFrom} onTo={setTo} errors={errors} />
      </Card>

      <Card title={t('appliesToItems')} right={<AppText variant="small">{t('itemsSelected', { n: selected.size })}</AppText>}>
        {errors.items ? (
          <AppText variant="small" color={colors.danger}>
            {errors.items}
          </AppText>
        ) : null}
        <Input placeholder={t('search')} value={search} onChangeText={setSearch} />
        <View style={{ height: spacing.sm }} />
        {visible.map((item) => {
          const on = selected.has(item.id);
          const base = item.has_variants ? null : item.base_price;
          return (
            <Pressable key={item.id} onPress={() => toggle(item.id)} style={[styles.itemRow, row, on ? styles.itemRowOn : null]}>
              <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? colors.action : colors.surfaceMuted} />
              <AppText style={{ flex: 1 }}>{item.name}</AppText>
              {base != null ? (
                <View style={{ alignItems: 'flex-end' }}>
                  {on && value > 0 ? (
                    <AppText variant="small" style={styles.strike}>
                      {formatMoney(base, currency)}
                    </AppText>
                  ) : null}
                  <AppText variant="small" weight="600" color={on && value > 0 ? colors.success : colors.textSecondary}>
                    {formatMoney(on && value > 0 ? base - applyPromo(kind, value, base) : base, currency)}
                  </AppText>
                </View>
              ) : (
                <AppText variant="small">{t('variants')}</AppText>
              )}
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemRow: { alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemRowOn: { backgroundColor: colors.surfaceSidebar },
  strike: { textDecorationLine: 'line-through', color: colors.disabled },
});

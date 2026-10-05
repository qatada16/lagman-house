import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, IconButton, Input, Screen, Segmented, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { deleteCoupon, findCouponByCode, getCoupon, saveCoupon } from '@/features/promos/promoRepo';
import { dateTimeInputValue, parseDateTimeInput } from '@/features/promos/dateInput';
import { ValidityFields } from '@/features/promos/ValidityFields';
import { getSettings } from '@/features/settings/settingsRepo';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import type { PromoKind } from '@/lib/types';

export default function CouponEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getCoupon(id)), [id, isNew]);
  const currency = getSettings().currency_symbol;

  const [code, setCode] = useState(existing?.code ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<PromoKind>(existing?.kind ?? 'percent');
  const [valueText, setValueText] = useState(existing ? String(existing.value) : '');
  const [minOrder, setMinOrder] = useState(existing && existing.min_order > 0 ? String(existing.min_order) : '');
  const [maxDiscount, setMaxDiscount] = useState(existing?.max_discount != null ? String(existing.max_discount) : '');
  const [unlimited, setUnlimited] = useState(existing ? existing.max_uses == null : true);
  const [maxUses, setMaxUses] = useState(existing?.max_uses != null ? String(existing.max_uses) : '');
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [from, setFrom] = useState(dateTimeInputValue(existing?.starts_at ?? null));
  const [to, setTo] = useState(dateTimeInputValue(existing?.ends_at ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const next: Record<string, string> = {};
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(normalized)) next.code = t('fieldRequired');
    const clash = normalized ? findCouponByCode(normalized) : null;
    if (clash && clash.id !== existing?.id) next.code = t('codeTaken');
    const value = Number(valueText);
    if (valueText === '' || Number.isNaN(value) || value <= 0 || (kind === 'percent' && value > 100)) next.value = t('invalidNumber');
    if (minOrder !== '' && Number.isNaN(Number(minOrder))) next.minOrder = t('invalidNumber');
    if (maxDiscount !== '' && Number.isNaN(Number(maxDiscount))) next.maxDiscount = t('invalidNumber');
    if (!unlimited && (maxUses === '' || !Number.isInteger(Number(maxUses)) || Number(maxUses) <= 0)) next.maxUses = t('invalidNumber');
    const startsAt = parseDateTimeInput(from);
    const endsAt = parseDateTimeInput(to, true);
    if (startsAt === undefined) next.from = t('dateTimeFormatHint');
    if (endsAt === undefined) next.to = t('dateTimeFormatHint');
    setErrors(next);
    if (Object.keys(next).length) return;
    saveCoupon({
      id: existing?.id,
      code: normalized,
      name,
      kind,
      value,
      min_order: minOrder === '' ? 0 : Number(minOrder),
      max_discount: maxDiscount === '' ? null : Number(maxDiscount),
      max_uses: unlimited ? null : Number(maxUses),
      is_active: isActive,
      starts_at: startsAt ?? null,
      ends_at: endsAt ?? null,
    });
    toast.success(t('saved'));
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteCouponConfirm', { code: existing.code }), t('delete'), t('cancel'), true)) {
      deleteCoupon(existing.id);
      router.back();
    }
  };

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('newCoupon') : t('editCoupon')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card>
        {existing ? (
          <View style={[row, { marginBottom: spacing.sm }]}>
            <Badge label={existing.max_uses != null ? t('usesSoFar', { used: existing.uses_count, max: existing.max_uses }) : t('usesUnlimited', { used: existing.uses_count })} tone="info" />
          </View>
        ) : null}
        <Input label={t('couponCode')} value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} autoCapitalize="characters" error={errors.code} placeholder="WELCOME10" maxLength={20} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('couponName')} value={name} onChangeText={setName} />
        <View style={{ height: spacing.md }} />
        <Segmented<PromoKind> label={t('discountKind')} value={kind} onChange={setKind} options={[{ value: 'percent', label: t('kindPercent') }, { value: 'fixed', label: t('kindFixed') }]} />
        <View style={{ height: spacing.md }} />
        <Input label={`${t('discountValue')} (${kind === 'percent' ? '%' : currency})`} value={valueText} onChangeText={setValueText} decimal error={errors.value} />
        <View style={{ height: spacing.sm }} />
        <View style={[row, { gap: spacing.sm }]}>
          <Input label={`${t('minOrder')} (${currency})`} value={minOrder} onChangeText={setMinOrder} decimal containerStyle={{ flex: 1 }} error={errors.minOrder} />
          {kind === 'percent' ? <Input label={`${t('maxDiscount')} (${currency})`} value={maxDiscount} onChangeText={setMaxDiscount} decimal containerStyle={{ flex: 1 }} error={errors.maxDiscount} /> : null}
        </View>
      </Card>

      <Card title={t('maxUses')}>
        <Toggle label={t('unlimited')} value={unlimited} onChange={setUnlimited} />
        {!unlimited ? <Input label={t('maxUses')} value={maxUses} onChangeText={setMaxUses} digitsOnly error={errors.maxUses} /> : null}
        <View style={{ height: spacing.sm }} />
        <Toggle label={t('isActive')} value={isActive} onChange={setIsActive} />
        <ValidityFields from={from} to={to} onFrom={setFrom} onTo={setTo} errors={errors} />
      </Card>
    </Screen>
  );
}

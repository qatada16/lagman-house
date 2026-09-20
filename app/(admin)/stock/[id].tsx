import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card, IconButton, Input, Screen, Segmented } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { deleteStockItem, getStockItem, saveStockItem, STOCK_UNITS } from '@/features/stock/stockRepo';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';

export default function StockEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getStockItem(id)), [id, isNew]);

  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState<string>(existing?.unit ?? 'g');
  const [qty, setQty] = useState(existing ? String(existing.quantity) : '');
  const [threshold, setThreshold] = useState(existing?.low_threshold != null ? String(existing.low_threshold) : '');
  const [adjust, setAdjust] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('fieldRequired');
    if (qty === '' || Number.isNaN(Number(qty))) next.qty = t('invalidNumber');
    if (threshold !== '' && Number.isNaN(Number(threshold))) next.threshold = t('invalidNumber');
    setErrors(next);
    if (Object.keys(next).length) return;
    saveStockItem({ id: existing?.id, name, unit, quantity: Number(qty), low_threshold: threshold === '' ? null : Number(threshold) });
    toast.success(t('saved'));
    router.back();
  };

  const applyAdjust = (sign: 1 | -1) => {
    const n = Number(adjust);
    if (!adjust || Number.isNaN(n)) return;
    setQty(String(Math.round(((Number(qty) || 0) + sign * n) * 1000) / 1000));
    setAdjust('');
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteStockConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteStockItem(existing.id);
      router.back();
    }
  };

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('addStock') : t('editStock')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card>
        <Input label={t('name')} value={name} onChangeText={setName} error={errors.name} />
        <View style={{ height: spacing.md }} />
        <Segmented label={t('unit')} value={unit} onChange={setUnit} options={STOCK_UNITS.map((u) => ({ value: u, label: u }))} />
        <View style={{ height: spacing.md }} />
        <Input label={`${t('quantityOnHand')} (${unit})`} value={qty} onChangeText={setQty} decimal error={errors.qty} />
        <View style={{ height: spacing.md }} />
        <Input label={`${t('lowThreshold')} (${unit})`} value={threshold} onChangeText={setThreshold} decimal error={errors.threshold} hint={t('optional')} />
      </Card>
      <Card title={t('adjustQuantity')}>
        <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
          <Input value={adjust} onChangeText={setAdjust} decimal containerStyle={{ flex: 1 }} placeholder="0" />
          <Button title="+" variant="secondary" onPress={() => applyAdjust(1)} />
          <Button title="-" variant="outline" onPress={() => applyAdjust(-1)} />
        </View>
        <AppText variant="small" style={{ marginTop: spacing.sm }}>
          {t('quantityOnHand')}: {qty || '0'} {unit}
        </AppText>
      </Card>
    </Screen>
  );
}

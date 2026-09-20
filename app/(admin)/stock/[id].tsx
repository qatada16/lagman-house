import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, IconButton, Input, ListRow, Screen, Segmented, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { deletePurchase, deleteStockItem, getStockItem, listPurchases, recordPurchase, saveStockItem, STOCK_UNITS } from '@/features/stock/stockRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { formatDateTime, formatMoney } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';

export default function StockEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getStockItem(id)), [id, isNew]);
  const currency = getSettings().currency_symbol;

  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState<string>(existing?.unit ?? 'g');
  const [qty, setQty] = useState(existing ? String(existing.quantity) : '');
  const [threshold, setThreshold] = useState(existing?.low_threshold != null ? String(existing.low_threshold) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [pQty, setPQty] = useState('');
  const [pCost, setPCost] = useState('');
  const [pSupplier, setPSupplier] = useState('');
  const [pExpense, setPExpense] = useState(true);
  const [pError, setPError] = useState<string | null>(null);

  const [purchases, refreshPurchases] = useLocalQuery(() => (existing ? listPurchases({ stockItemId: existing.id }) : []), [existing?.id]);
  const [current, refreshCurrent] = useLocalQuery(() => (existing ? getStockItem(existing.id) : null), [existing?.id]);

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

  const addPurchase = () => {
    if (!existing) return;
    const q = Number(pQty);
    const c = Number(pCost);
    if (!pQty || Number.isNaN(q) || q <= 0 || Number.isNaN(c) || c < 0) {
      setPError(t('invalidNumber'));
      return;
    }
    setPError(null);
    recordPurchase({ stockItemId: existing.id, quantity: q, unitCost: c, supplier: pSupplier, recordExpense: pExpense });
    setPQty('');
    setPCost('');
    setPSupplier('');
    refreshPurchases();
    refreshCurrent();
    const fresh = getStockItem(existing.id);
    if (fresh) setQty(String(fresh.quantity));
    toast.success(t('purchaseSaved'));
  };

  const removePurchase = async (pid: string) => {
    if (!(await confirm(t('delete'), t('deletePurchaseConfirm'), t('delete'), t('cancel'), true))) return;
    deletePurchase(pid);
    refreshPurchases();
    refreshCurrent();
    if (existing) {
      const fresh = getStockItem(existing.id);
      if (fresh) setQty(String(fresh.quantity));
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteStockConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteStockItem(existing.id);
      router.back();
    }
  };

  const totalCost = Math.round((Number(pQty) || 0) * (Number(pCost) || 0) * 100) / 100;

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

      {existing ? (
        <>
          <Card title={t('addPurchase')} right={current ? <Badge label={`${current.quantity} ${current.unit}`} tone="info" /> : undefined}>
            <View style={[row, { gap: spacing.sm }]}>
              <Input label={`${t('purchaseQty')} (${existing.unit})`} value={pQty} onChangeText={setPQty} decimal containerStyle={{ flex: 1 }} />
              <Input label={`${t('unitCost')} (${currency})`} value={pCost} onChangeText={setPCost} decimal containerStyle={{ flex: 1 }} />
            </View>
            <View style={{ height: spacing.sm }} />
            <Input label={t('supplier')} value={pSupplier} onChangeText={setPSupplier} />
            <View style={[row, { justifyContent: 'space-between', marginTop: spacing.sm }]}>
              <AppText variant="small">{t('totalCost')}</AppText>
              <AppText weight="700">{formatMoney(totalCost, currency)}</AppText>
            </View>
            <Toggle label={t('recordAsExpense')} value={pExpense} onChange={setPExpense} />
            {pError ? (
              <AppText variant="small" color={colors.danger}>
                {pError}
              </AppText>
            ) : null}
            <Button title={t('addPurchase')} variant="action" icon="plus" onPress={addPurchase} style={{ marginTop: spacing.sm }} />
          </Card>

          <Card title={t('purchaseHistory')} padded={false}>
            {purchases.length === 0 ? (
              <EmptyState title={t('noPurchases')} icon="shopping-cart" />
            ) : (
              purchases.map((p) => (
                <ListRow
                  key={p.id}
                  title={`${p.quantity} ${p.unit}  ${formatMoney(p.total_cost, currency)}`}
                  subtitle={`${formatDateTime(p.purchased_at)}${p.supplier ? `  ${p.supplier}` : ''}  @ ${formatMoney(p.unit_cost, currency)}`}
                  right={
                    <View style={[row, { gap: spacing.xs, alignItems: 'center' }]}>
                      {p.expense_id ? <Badge label={t('navExpenses')} tone="warning" /> : null}
                      <IconButton icon="trash-2" color={colors.danger} onPress={() => removePurchase(p.id)} />
                    </View>
                  }
                />
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

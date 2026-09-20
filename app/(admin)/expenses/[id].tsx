import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, IconButton, Input, Screen, Segmented, Select } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { deleteExpense, EXPENSE_CATEGORIES, getExpense, saveExpense } from '@/features/expenses/expenseRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDate, parseLocalDate } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import { categoryLabelKey } from './index';

type Kind = 'outflow' | 'inflow';

export default function ExpenseEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getExpense(id)), [id, isNew]);
  const currency = getSettings().currency_symbol;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? String(Math.abs(existing.amount)) : '');
  const [kind, setKind] = useState<Kind>(existing && existing.amount > 0 ? 'inflow' : 'outflow');
  const [category, setCategory] = useState<string>(existing?.category ?? 'general');
  const [date, setDate] = useState(formatDate(existing?.occurred_at ?? new Date().toISOString()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = existing?.source === 'stock';

  const save = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t('fieldRequired');
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) next.amount = t('invalidNumber');
    const d = parseLocalDate(date);
    if (!d) next.date = t('dateFormatHint');
    setErrors(next);
    if (Object.keys(next).length || !d) return;
    const occurred = existing ? new Date(existing.occurred_at) : new Date();
    d.setHours(occurred.getHours(), occurred.getMinutes(), occurred.getSeconds());
    saveExpense({ id: existing?.id, title, amount: kind === 'outflow' ? -n : n, category, occurred_at: d.toISOString(), note });
    toast.success(t('saved'));
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteExpenseConfirm', { title: existing.title }), t('delete'), t('cancel'), true)) {
      deleteExpense(existing.id);
      router.back();
    }
  };

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('addExpense') : t('editExpense')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card>
        {locked ? (
          <View style={[row, { marginBottom: spacing.sm }]}>
            <Badge label={t('fromStockPurchase')} tone="info" />
          </View>
        ) : null}
        <Segmented<Kind>
          label={t('expenseType')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'outflow', label: t('outflow') },
            { value: 'inflow', label: t('inflow') },
          ]}
        />
        <View style={{ height: spacing.md }} />
        <Input label={t('expenseTitle')} value={title} onChangeText={setTitle} error={errors.title} />
        <View style={{ height: spacing.md }} />
        <Input label={`${t('expenseAmount')} (${currency})`} value={amount} onChangeText={setAmount} decimal error={errors.amount} />
        <View style={{ height: spacing.md }} />
        <Select label={t('expenseCategory')} value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(categoryLabelKey(c)) }))} />
        <View style={{ height: spacing.md }} />
        <Input label={t('expenseDate')} value={date} onChangeText={setDate} placeholder={t('dateFormatHint')} error={errors.date} />
        <View style={{ height: spacing.md }} />
        <Input label={t('notes')} value={note} onChangeText={setNote} multiline />
        <AppText variant="small" color={kind === 'outflow' ? colors.danger : colors.success} style={{ marginTop: spacing.sm }}>
          {kind === 'outflow' ? `- ${amount || '0'}` : `+ ${amount || '0'}`} {currency}
        </AppText>
      </Card>
    </Screen>
  );
}

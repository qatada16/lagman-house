import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, Input, ListRow, Screen, Segmented, Select, StatTile } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BarChart, HBarChart } from '@/components/charts/BarChart';
import { PeriodPicker, periodFileSuffix, usePeriod } from '@/features/reports/PeriodPicker';
import { useLayout, useT, type StringKey } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { EXPENSE_CATEGORIES, expenseSummary, listExpenses } from '@/features/expenses/expenseRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { shareCsv, toCsv } from '@/features/orders/exportCsv';
import { toast } from '@/store/toastStore';
import type { Expense } from '@/lib/types';

type ViewMode = 'cards' | 'table';

export function categoryLabelKey(category: string): StringKey {
  const map: Record<string, StringKey> = {
    general: 'catGeneral',
    stock: 'catStock',
    rent: 'catRent',
    salary: 'catSalary',
    utilities: 'catUtilities',
    maintenance: 'catMaintenance',
    marketing: 'catMarketing',
    transport: 'catTransport',
    income: 'catIncome',
    other: 'catOther',
  };
  return map[category] ?? 'catOther';
}

export default function ExpensesScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const state = usePeriod('30');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [exporting, setExporting] = useState(false);

  const [data] = useLocalQuery(() => {
    const filter = { ...state.period, category: category === 'all' ? null : category, search };
    return { summary: expenseSummary(filter), rows: listExpenses(filter), currency: getSettings().currency_symbol };
  }, [state.period, category, search]);

  const money = (v: number) => formatMoney(v, data.currency);
  const short = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));
  const catLabel = (c: string) => t(categoryLabelKey(c));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = toCsv(
        [t('colDate'), t('expenseTitle'), t('expenseCategory'), t('expenseAmount'), t('expenseType'), t('source'), t('notes')],
        data.rows.map((e) => [formatDateTime(e.occurred_at), e.title, catLabel(e.category), e.amount, e.amount < 0 ? t('outflow') : t('inflow'), e.source, e.note ?? ''])
      );
      await shareCsv(`lagman-house-expenses-${periodFileSuffix(state.period)}.csv`, csv);
      toast.success(t('exported'));
    } catch (e) {
      toast.error(`${t('exportFailed')}: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Expense>[] = [
    { key: 'date', title: t('colDate'), width: 110, render: (e) => formatDate(e.occurred_at), sortValue: (e) => e.occurred_at },
    { key: 'title', title: t('expenseTitle'), width: 170, render: (e) => e.title, sortValue: (e) => e.title },
    { key: 'category', title: t('expenseCategory'), width: 110, render: (e) => catLabel(e.category), sortValue: (e) => e.category },
    {
      key: 'amount',
      title: t('expenseAmount'),
      width: 120,
      align: 'right',
      render: (e) => (
        <AppText variant="small" weight="600" color={e.amount < 0 ? colors.danger : colors.success}>
          {money(e.amount)}
        </AppText>
      ),
      sortValue: (e) => e.amount,
    },
    { key: 'source', title: t('source'), width: 90, render: (e) => (e.source === 'stock' ? <Badge label={t('catStock')} tone="info" /> : '-'), sortValue: (e) => e.source },
  ];

  const open = (e: Expense) => router.push({ pathname: '/(admin)/expenses/[id]', params: { id: e.id } });

  return (
    <Screen
      safeTop={false}
      title={t('expensesTitle')}
      subtitle={t('expensesHint')}
      actions={
        <View style={[row, { gap: spacing.xs }]}>
          <Button title={t('exportCsv')} variant="outline" size="sm" icon="download" onPress={exportCsv} loading={exporting} disabled={data.rows.length === 0} />
          <Button title={t('addExpense')} variant="action" size="sm" icon="plus" onPress={() => router.push('/(admin)/expenses/new')} />
        </View>
      }
    >
      <Card>
        <PeriodPicker state={state} />
        <View style={{ height: spacing.sm }} />
        <Select label={t('expenseCategory')} value={category} onChange={setCategory} options={[{ value: 'all', label: t('all') }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: catLabel(c) }))]} />
        <View style={{ height: spacing.sm }} />
        <Input placeholder={t('search')} value={search} onChangeText={setSearch} />
      </Card>

      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('totalOutflow')} value={money(data.summary.outflow)} tone="action" />
        <StatTile label={t('totalInflow')} value={money(data.summary.inflow)} tone="dark" />
        <StatTile label={t('netBalance')} value={money(data.summary.net)} tone={data.summary.net < 0 ? 'muted' : 'highlight'} />
      </View>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('cashFlowByDay')} style={{ flex: 1, minWidth: 300 }}>
          <BarChart data={data.summary.byDay.map((d) => ({ label: d.day.slice(5).replace('-', '/'), value: d.outflow }))} formatValue={short} emptyLabel={t('noData')} color={colors.action} width={300} />
          {data.summary.inflow > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              <AppText variant="label" style={{ textTransform: 'uppercase' }}>
                {t('inflow')}
              </AppText>
              <BarChart data={data.summary.byDay.map((d) => ({ label: d.day.slice(5).replace('-', '/'), value: d.inflow }))} formatValue={short} emptyLabel={t('noData')} color={colors.success} width={300} height={120} />
            </View>
          ) : null}
        </Card>
        <Card title={t('byCategory')} style={{ flex: 1, minWidth: 300 }}>
          <HBarChart data={data.summary.byCategory.map((c) => ({ label: catLabel(c.category), value: c.total }))} formatValue={short} emptyLabel={t('noData')} color={colors.accentDark} />
        </Card>
      </View>

      <Card title={t('expensesTitle')} right={<Segmented<ViewMode> value={view} onChange={setView} scroll options={[{ value: 'cards', label: t('viewCards') }, { value: 'table', label: t('viewTable') }]} />}>
        {view === 'table' ? (
          <DataTable columns={columns} rows={data.rows} keyOf={(e) => e.id} onRowPress={open} initialSort={{ key: 'date', dir: 'desc' }} emptyLabel={t('noExpenses')} />
        ) : data.rows.length === 0 ? (
          <EmptyState title={t('noExpenses')} icon="credit-card" />
        ) : (
          <View style={{ marginHorizontal: -spacing.lg, marginBottom: -spacing.lg }}>
            {data.rows.map((e, i) => (
              <ListRow
                key={e.id}
                title={e.title}
                subtitle={`${formatDate(e.occurred_at)}  ${catLabel(e.category)}${e.note ? `  ${e.note}` : ''}`}
                onPress={() => open(e)}
                chevron
                style={i === data.rows.length - 1 ? { borderBottomWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } : null}
                right={
                  <AppText weight="700" color={e.amount < 0 ? colors.danger : colors.success}>
                    {money(e.amount)}
                  </AppText>
                }
              />
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

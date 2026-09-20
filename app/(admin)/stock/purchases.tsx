import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, IconButton, Screen, StatTile } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BarChart, HBarChart } from '@/components/charts/BarChart';
import { PeriodPicker, periodFileSuffix, usePeriod } from '@/features/reports/PeriodPicker';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listPurchases, purchaseSummary } from '@/features/stock/stockRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { shareCsv, toCsv } from '@/features/orders/exportCsv';
import { toast } from '@/store/toastStore';
import type { StockPurchase } from '@/lib/types';

type Row = StockPurchase & { stock_name: string; unit: string };

export default function PurchaseReportScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const state = usePeriod('30');
  const [exporting, setExporting] = useState(false);

  const [data] = useLocalQuery(
    () => ({ summary: purchaseSummary(state.period.from, state.period.to), rows: listPurchases({ from: state.period.from, to: state.period.to }), currency: getSettings().currency_symbol }),
    [state.period]
  );
  const money = (v: number) => formatMoney(v, data.currency);
  const short = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = toCsv(
        [t('colDate'), t('stockItem'), t('colQuantity'), t('unit'), t('unitCost'), t('totalCost'), t('supplier'), t('notes')],
        data.rows.map((p) => [formatDateTime(p.purchased_at), p.stock_name, p.quantity, p.unit, p.unit_cost, p.total_cost, p.supplier ?? '', p.note ?? ''])
      );
      await shareCsv(`lagman-house-purchases-${periodFileSuffix(state.period)}.csv`, csv);
      toast.success(t('exported'));
    } catch (e) {
      toast.error(`${t('exportFailed')}: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Row>[] = [
    { key: 'date', title: t('colDate'), width: 140, render: (p) => formatDateTime(p.purchased_at), sortValue: (p) => p.purchased_at },
    { key: 'item', title: t('stockItem'), width: 150, render: (p) => p.stock_name, sortValue: (p) => p.stock_name },
    { key: 'qty', title: t('colQuantity'), width: 90, align: 'right', render: (p) => `${p.quantity} ${p.unit}`, sortValue: (p) => p.quantity },
    { key: 'unit', title: t('unitCost'), width: 100, align: 'right', render: (p) => money(p.unit_cost), sortValue: (p) => p.unit_cost },
    { key: 'total', title: t('totalCost'), width: 110, align: 'right', render: (p) => money(p.total_cost), sortValue: (p) => p.total_cost },
    { key: 'supplier', title: t('supplier'), width: 130, render: (p) => p.supplier ?? '-', sortValue: (p) => p.supplier ?? '' },
  ];

  return (
    <Screen
      safeTop={false}
      title={t('purchaseReport')}
      actions={
        <View style={[row, { gap: spacing.xs }]}>
          <Button title={t('exportCsv')} variant="outline" size="sm" icon="download" onPress={exportCsv} loading={exporting} disabled={data.rows.length === 0} />
          <IconButton icon="x" onPress={() => router.back()} />
        </View>
      }
    >
      <Card>
        <PeriodPicker state={state} />
      </Card>
      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('totalCost')} value={money(data.summary.total)} tone="action" />
        <StatTile label={t('purchases')} value={String(data.summary.count)} tone="dark" />
      </View>
      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('spendByItem')} style={{ flex: 1, minWidth: 300 }}>
          <HBarChart data={data.summary.byItem.map((i) => ({ label: i.name, value: i.total }))} formatValue={short} emptyLabel={t('noData')} color={colors.action} />
        </Card>
        <Card title={t('spendByMonth')} style={{ flex: 1, minWidth: 300 }}>
          <BarChart data={data.summary.byMonth.map((m) => ({ label: m.month.slice(2).replace('-', '/'), value: m.total }))} formatValue={short} emptyLabel={t('noData')} color={colors.accentDark} width={300} />
        </Card>
      </View>
      <Card title={t('purchaseHistory')}>
        <DataTable columns={columns} rows={data.rows} keyOf={(p) => p.id} initialSort={{ key: 'date', dir: 'desc' }} emptyLabel={t('noPurchases')} />
      </Card>
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Screen, Segmented, Select, StatTile, Toggle } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BarChart, HBarChart } from '@/components/charts/BarChart';
import { PeriodPicker, periodFileSuffix, usePeriod } from '@/features/reports/PeriodPicker';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { analytics, cashierStats, hourlyStats, itemStats, listOrdersWithCounts, ordersByDay, type CashierStat, type ItemStat, type OrderWithMeta } from '@/features/orders/orderRepo';
import { listCashiers } from '@/features/auth/profileRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { OrderDetailSheet } from '@/features/orders/OrderDetailSheet';
import { shareCsv, toCsv } from '@/features/orders/exportCsv';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';

type ViewMode = 'cards' | 'table';
type Tab = 'orders' | 'items' | 'cashiers';
type Row = OrderWithMeta & { item_count: number };

export default function HistoryScreen() {
  const t = useT();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const state = usePeriod('today');
  const [view, setView] = useState<ViewMode>('cards');
  const [tab, setTab] = useState<Tab>('orders');
  const [cashierId, setCashierId] = useState<string>('all');
  const [includeTest, setIncludeTest] = useState(false);
  const [selected, setSelected] = useState<OrderWithMeta | null>(null);
  const [exporting, setExporting] = useState(false);

  const [data] = useLocalQuery(() => {
    const filter = { ...state.period, cashierId: cashierId === 'all' ? null : cashierId, includeTest, adminId: profile?.id ?? null };
    return {
      stats: analytics(filter),
      orders: listOrdersWithCounts(filter),
      days: ordersByDay(filter),
      cashiers: cashierStats(filter),
      hours: hourlyStats(filter),
      items: itemStats(filter),
      cashierList: listCashiers(profile?.id ?? null),
      currency: getSettings().currency_symbol,
    };
  }, [state.period, cashierId, includeTest, profile?.id]);

  const money = (v: number) => formatMoney(v, data.currency);
  const shortMoney = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

  const exportCsv = async () => {
    setExporting(true);
    try {
      let csv: string;
      let name: string;
      if (tab === 'items') {
        csv = toCsv([t('item'), t('colQuantity'), t('orders'), t('colRevenue')], data.items.map((i) => [i.name, i.quantity, i.orders, i.revenue]));
        name = 'items';
      } else if (tab === 'cashiers') {
        csv = toCsv([t('colCashier'), t('orders'), t('colRevenue'), t('colAvg')], data.cashiers.map((c) => [c.name, c.count, c.revenue, Math.round(c.average * 100) / 100]));
        name = 'cashiers';
      } else {
        csv = toCsv(
          [t('colOrder'), t('colDate'), t('colCashier'), t('colItems'), t('subtotal'), t('colTotal'), t('amountReceived'), t('paymentMethod'), t('colSource'), t('testOrder'), t('notes')],
          data.orders.map((o) => [o.order_number, formatDateTime(o.created_at), o.cashier_name ?? '', o.item_count, o.subtotal, o.total, o.amount_received ?? '', o.payment_method ?? '', o.source, o.is_test ? 'yes' : 'no', o.note ?? ''])
        );
        name = 'orders';
      }
      await shareCsv(`lagman-house-${name}-${periodFileSuffix(state.period)}.csv`, csv);
      toast.success(t('exported'));
    } catch (e) {
      toast.error(`${t('exportFailed')}: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const orderColumns: Column<Row>[] = [
    { key: 'order', title: t('colOrder'), width: 110, render: (o) => o.order_number, sortValue: (o) => o.order_number },
    { key: 'date', title: t('colDate'), width: 140, render: (o) => formatDateTime(o.created_at), sortValue: (o) => o.created_at },
    { key: 'cashier', title: t('colCashier'), width: 130, render: (o) => o.cashier_name ?? '-', sortValue: (o) => o.cashier_name ?? '' },
    { key: 'items', title: t('colItems'), width: 70, align: 'center', render: (o) => String(o.item_count), sortValue: (o) => o.item_count },
    { key: 'total', title: t('colTotal'), width: 110, align: 'right', render: (o) => money(o.total), sortValue: (o) => o.total },
    { key: 'payment', title: t('paymentMethod'), width: 90, render: (o) => (o.payment_method === 'cash' ? t('paymentCash') : o.payment_method === 'online' ? t('paymentOnline') : '-'), sortValue: (o) => o.payment_method ?? '' },
    {
      key: 'source',
      title: t('colSource'),
      width: 110,
      render: (o) => (
        <View style={[row, { gap: 4 }]}>
          <Badge label={o.source === 'qr' ? t('sourceQr') : t('sourcePos')} tone="info" />
          {o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
        </View>
      ),
      sortValue: (o) => `${o.source}${o.is_test ? '-test' : ''}`,
    },
    { key: 'sync', title: t('status'), width: 90, render: (o) => <Badge label={o.is_dirty ? t('unsynced') : t('syncedBadge')} tone={o.is_dirty ? 'neutral' : 'success'} />, sortValue: (o) => (o.is_dirty ? 1 : 0) },
  ];

  const itemColumns: Column<ItemStat>[] = [
    { key: 'name', title: t('item'), width: 200, render: (i) => i.name, sortValue: (i) => i.name },
    { key: 'qty', title: t('colQuantity'), width: 80, align: 'right', render: (i) => String(i.quantity), sortValue: (i) => i.quantity },
    { key: 'orders', title: t('orders'), width: 80, align: 'right', render: (i) => String(i.orders), sortValue: (i) => i.orders },
    { key: 'revenue', title: t('colRevenue'), width: 120, align: 'right', render: (i) => money(i.revenue), sortValue: (i) => i.revenue },
  ];

  const cashierColumns: Column<CashierStat>[] = [
    { key: 'name', title: t('colCashier'), width: 160, render: (c) => c.name, sortValue: (c) => c.name },
    { key: 'count', title: t('orders'), width: 80, align: 'right', render: (c) => String(c.count), sortValue: (c) => c.count },
    { key: 'revenue', title: t('colRevenue'), width: 120, align: 'right', render: (c) => money(c.revenue), sortValue: (c) => c.revenue },
    { key: 'avg', title: t('colAvg'), width: 110, align: 'right', render: (c) => money(c.average), sortValue: (c) => c.average },
  ];

  const dayLabel = (d: string) => d.slice(5).replace('-', '/');
  const hourLabel = (h: number) => `${String(h).padStart(2, '0')}`;
  const busy = data.hours.filter((h) => h.count > 0);
  const hourRange = busy.length ? data.hours.slice(Math.max(0, busy[0].hour - 1), Math.min(24, busy[busy.length - 1].hour + 2)) : [];

  return (
    <Screen safeTop={false} title={t('historyTitle')} actions={<Button title={t('exportCsv')} variant="outline" size="sm" icon="download" onPress={exportCsv} loading={exporting} disabled={data.orders.length === 0} />}>
      <Card>
        <PeriodPicker state={state} />
        <View style={{ height: spacing.sm }} />
        <Select label={t('filterCashier')} value={cashierId} onChange={setCashierId} options={[{ value: 'all', label: t('allCashiers') }, ...data.cashierList.map((c) => ({ value: c.id, label: c.name }))]} />
        <Toggle label={t('includeTest')} value={includeTest} onChange={setIncludeTest} />
      </Card>

      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('revenue')} value={money(data.stats.revenue)} tone="action" />
        <StatTile label={t('orders')} value={String(data.stats.count)} tone="dark" />
        <StatTile label={t('avgOrder')} value={money(data.stats.average)} tone="highlight" />
      </View>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('revenueByDay')} style={{ flex: 1, minWidth: 300 }}>
          <BarChart data={data.days.map((d) => ({ label: dayLabel(d.day), value: d.revenue }))} formatValue={shortMoney} emptyLabel={t('noData')} color={colors.action} width={300} />
        </Card>
        <Card title={t('hotHours')} style={{ flex: 1, minWidth: 300 }}>
          <BarChart data={hourRange.map((h) => ({ label: hourLabel(h.hour), value: h.count }))} emptyLabel={t('noData')} color={colors.accentDark} width={300} />
        </Card>
      </View>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('cashierRanking')} style={{ flex: 1, minWidth: 300 }}>
          <HBarChart data={data.cashiers.map((c) => ({ label: c.name, value: c.count }))} emptyLabel={t('noOrdersRange')} color={colors.surfaceHighlight} />
        </Card>
        <Card title={t('mostSold')} style={{ flex: 1, minWidth: 300 }}>
          <HBarChart data={data.items.slice(0, 8).map((i) => ({ label: i.name, value: i.quantity }))} emptyLabel={t('noOrdersRange')} color={colors.action} />
        </Card>
      </View>

      <Card
        title={tab === 'orders' ? t('orderList') : tab === 'items' ? t('itemsTable') : t('cashiersTable')}
        right={<Segmented<Tab> value={tab} onChange={setTab} scroll options={[{ value: 'orders', label: t('orders') }, { value: 'items', label: t('items') }, { value: 'cashiers', label: t('cashiersTable') }]} />}
      >
        {tab === 'items' ? (
          <DataTable columns={itemColumns} rows={data.items} keyOf={(i) => i.name} initialSort={{ key: 'qty', dir: 'desc' }} emptyLabel={t('noOrdersRange')} />
        ) : tab === 'cashiers' ? (
          <DataTable columns={cashierColumns} rows={data.cashiers} keyOf={(c) => c.cashier_id ?? 'none'} initialSort={{ key: 'count', dir: 'desc' }} emptyLabel={t('noOrdersRange')} />
        ) : (
          <>
            <View style={[row, { marginBottom: spacing.sm }]}>
              <Segmented<ViewMode> value={view} onChange={setView} scroll options={[{ value: 'cards', label: t('viewCards') }, { value: 'table', label: t('viewTable') }]} />
            </View>
            {view === 'table' ? (
              <DataTable columns={orderColumns} rows={data.orders} keyOf={(o) => o.id} onRowPress={setSelected} initialSort={{ key: 'date', dir: 'desc' }} emptyLabel={t('noOrdersRange')} />
            ) : data.orders.length === 0 ? (
              <EmptyState title={t('noOrdersRange')} icon="shopping-bag" />
            ) : (
              <View style={{ marginHorizontal: -spacing.lg, marginBottom: -spacing.lg }}>
                {data.orders.map((o, i) => (
                  <ListRow
                    key={o.id}
                    title={`${o.order_number}  ${money(o.total)}`}
                    subtitle={`${formatDateTime(o.created_at)}  ${o.cashier_name ?? ''}`}
                    onPress={() => setSelected(o)}
                    chevron
                    style={i === data.orders.length - 1 ? { borderBottomWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } : null}
                    right={
                      <View style={[row, { gap: 4 }]}>
                        {o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
                        {o.source === 'qr' ? <Badge label={t('sourceQr')} tone="info" /> : null}
                        {o.is_dirty ? <Badge label={t('unsynced')} /> : null}
                      </View>
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </Card>
      {data.stats.topItems.length > 0 ? (
        <AppText variant="small" align="center">
          {`${data.orders.length} ${t('orders').toLowerCase()}`}
        </AppText>
      ) : null}
      <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, EmptyState, Input, ListRow, Screen, Segmented, Select, StatTile, Toggle } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BarChart, HBarChart } from '@/components/charts/BarChart';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { analytics, listOrdersWithCounts, ordersByDay, type OrderWithMeta } from '@/features/orders/orderRepo';
import { listCashiers } from '@/features/auth/profileRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { daysAgo, formatDate, formatDateTime, formatMoney, parseLocalDate, startOfDay } from '@/lib/format';
import { OrderDetailSheet } from '@/features/orders/OrderDetailSheet';
import { shareCsv, toCsv } from '@/features/orders/exportCsv';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';

type Range = 'today' | '7' | '30' | '90' | 'custom';
type ViewMode = 'cards' | 'table';
type Row = OrderWithMeta & { item_count: number };

export default function HistoryScreen() {
  const t = useT();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const [range, setRange] = useState<Range>('today');
  const [view, setView] = useState<ViewMode>('cards');
  const [cashierId, setCashierId] = useState<string>('all');
  const [includeTest, setIncludeTest] = useState(false);
  const [fromText, setFromText] = useState(formatDate(daysAgo(7).toISOString()));
  const [toText, setToText] = useState(formatDate(new Date().toISOString()));
  const [selected, setSelected] = useState<OrderWithMeta | null>(null);
  const [exporting, setExporting] = useState(false);

  const period = useMemo(() => {
    const end = new Date(Date.now() + 60_000);
    if (range === 'today') return { from: startOfDay(new Date()), to: end };
    if (range === 'custom') {
      const from = parseLocalDate(fromText) ?? daysAgo(7);
      const toDay = parseLocalDate(toText) ?? new Date();
      const to = new Date(toDay);
      to.setDate(to.getDate() + 1);
      return { from: startOfDay(from), to };
    }
    return { from: daysAgo(Number(range) - 1), to: end };
  }, [range, fromText, toText]);

  const [data] = useLocalQuery(
    () => {
      const filter = { ...period, cashierId: cashierId === 'all' ? null : cashierId, includeTest, adminId: profile?.id ?? null };
      return {
        stats: analytics(filter),
        orders: listOrdersWithCounts(filter),
        days: ordersByDay(filter),
        cashiers: listCashiers(profile?.id ?? null),
        currency: getSettings().currency_symbol,
      };
    },
    [period, cashierId, includeTest, profile?.id]
  );

  const money = (v: number) => formatMoney(v, data.currency);
  const shortMoney = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = toCsv(
        [t('colOrder'), t('colDate'), t('colCashier'), t('colItems'), t('subtotal'), t('colTotal'), t('amountReceived'), t('paymentMethod'), t('colSource'), t('testOrder'), t('notes')],
        data.orders.map((o) => [
          o.order_number,
          formatDateTime(o.created_at),
          o.cashier_name ?? '',
          o.item_count,
          o.subtotal,
          o.total,
          o.amount_received ?? '',
          o.payment_method ?? '',
          o.source,
          o.is_test ? 'yes' : 'no',
          o.note ?? '',
        ])
      );
      await shareCsv(`lagman-house-orders-${formatDate(period.from.toISOString())}-to-${formatDate(new Date(period.to.getTime() - 1).toISOString())}.csv`, csv);
      toast.success(t('exported'));
    } catch (e) {
      toast.error(`${t('exportFailed')}: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<Row>[] = [
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

  const dayLabel = (d: string) => d.slice(5).replace('-', '/');

  return (
    <Screen safeTop={false} title={t('historyTitle')} actions={<Button title={t('exportCsv')} variant="outline" size="sm" icon="download" onPress={exportCsv} loading={exporting} disabled={data.orders.length === 0} />}>
      <Card>
        <Segmented<Range>
          label={t('dateRange')}
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: t('rangeToday') },
            { value: '7', label: t('range7') },
            { value: '30', label: t('range30') },
            { value: '90', label: t('range90') },
            { value: 'custom', label: t('rangeCustom') },
          ]}
          scroll
        />
        {range === 'custom' ? (
          <View style={[row, { gap: spacing.sm, marginTop: spacing.sm }]}>
            <Input label={t('from')} value={fromText} onChangeText={setFromText} placeholder={t('dateFormatHint')} containerStyle={{ flex: 1 }} />
            <Input label={t('to')} value={toText} onChangeText={setToText} placeholder={t('dateFormatHint')} containerStyle={{ flex: 1 }} />
          </View>
        ) : null}
        <View style={{ height: spacing.sm }} />
        <Select label={t('filterCashier')} value={cashierId} onChange={setCashierId} options={[{ value: 'all', label: t('allCashiers') }, ...data.cashiers.map((c) => ({ value: c.id, label: c.name }))]} />
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
        <Card title={t('ordersByDay')} style={{ flex: 1, minWidth: 300 }}>
          <BarChart data={data.days.map((d) => ({ label: dayLabel(d.day), value: d.count }))} emptyLabel={t('noData')} color={colors.accentDark} width={300} />
        </Card>
      </View>

      <Card title={t('mostSold')}>
        <HBarChart data={data.stats.topItems.map((it) => ({ label: it.name, value: it.quantity }))} emptyLabel={t('noOrdersRange')} color={colors.surfaceHighlight} />
        {data.stats.topItems.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            {data.stats.topItems.map((it) => (
              <View key={it.name} style={[row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
                <AppText variant="small" style={{ flex: 1 }}>
                  {it.name}
                </AppText>
                <AppText variant="small" weight="600">
                  {t('soldCount', { n: it.quantity })}
                </AppText>
                <AppText variant="small" style={{ minWidth: 80 }} align="right">
                  {money(it.revenue)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card title={t('orderList')} right={<Segmented<ViewMode> value={view} onChange={setView} scroll options={[{ value: 'cards', label: t('viewCards') }, { value: 'table', label: t('viewTable') }]} />}>
        {view === 'table' ? (
          <DataTable columns={columns} rows={data.orders} keyOf={(o) => o.id} onRowPress={setSelected} initialSort={{ key: 'date', dir: 'desc' }} emptyLabel={t('noOrdersRange')} />
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
      </Card>
      <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

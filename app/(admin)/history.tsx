import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Card, EmptyState, Input, ListRow, Screen, Segmented, Select, StatTile, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { analytics, listOrders, type OrderWithMeta } from '@/features/orders/orderRepo';
import { listCashiers } from '@/features/auth/profileRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { daysAgo, formatDate, formatDateTime, formatMoney, parseLocalDate, startOfDay } from '@/lib/format';
import { OrderDetailSheet } from '@/features/orders/OrderDetailSheet';

type Range = 'today' | '7' | '30' | '90' | 'custom';

export default function HistoryScreen() {
  const t = useT();
  const { row } = useLayout();
  const [range, setRange] = useState<Range>('today');
  const [cashierId, setCashierId] = useState<string>('all');
  const [includeTest, setIncludeTest] = useState(false);
  const [fromText, setFromText] = useState(formatDate(daysAgo(7).toISOString()));
  const [toText, setToText] = useState(formatDate(new Date().toISOString()));
  const [selected, setSelected] = useState<OrderWithMeta | null>(null);

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
      const filter = { ...period, cashierId: cashierId === 'all' ? null : cashierId, includeTest };
      return { stats: analytics(filter), orders: listOrders(filter, 300), cashiers: listCashiers(), currency: getSettings().currency_symbol };
    },
    [period, cashierId, includeTest]
  );

  return (
    <Screen title={t('historyTitle')}>
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
        <StatTile label={t('revenue')} value={formatMoney(data.stats.revenue, data.currency)} tone="action" />
        <StatTile label={t('orders')} value={String(data.stats.count)} tone="dark" />
        <StatTile label={t('avgOrder')} value={formatMoney(data.stats.average, data.currency)} tone="highlight" />
      </View>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('mostSold')} style={{ flex: 1, minWidth: 300 }}>
          {data.stats.topItems.length === 0 ? (
            <EmptyState title={t('noOrdersRange')} icon="trending-up" />
          ) : (
            data.stats.topItems.map((it, i) => (
              <View key={it.name} style={[row, { justifyContent: 'space-between', paddingVertical: 6, gap: spacing.sm }]}>
                <AppText variant="small" style={{ width: 20 }}>{`${i + 1}.`}</AppText>
                <AppText style={{ flex: 1 }}>{it.name}</AppText>
                <AppText weight="600">{t('soldCount', { n: it.quantity })}</AppText>
                <AppText variant="small" style={{ minWidth: 70 }} align="right">
                  {formatMoney(it.revenue, data.currency)}
                </AppText>
              </View>
            ))
          )}
        </Card>

        <Card title={t('orderList')} style={{ flex: 1.4, minWidth: 320 }} padded={false}>
          <View style={{ height: spacing.md }} />
          {data.orders.length === 0 ? (
            <EmptyState title={t('noOrdersRange')} icon="shopping-bag" />
          ) : (
            data.orders.map((o) => (
              <ListRow
                key={o.id}
                title={`${o.order_number}  ${formatMoney(o.total, data.currency)}`}
                subtitle={`${formatDateTime(o.created_at)}  ${o.cashier_name ?? ''}`}
                onPress={() => setSelected(o)}
                chevron
                right={
                  <View style={[row, { gap: 4 }]}>
                    {o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
                    {o.source === 'qr' ? <Badge label={t('sourceQr')} tone="info" /> : null}
                    {o.is_dirty ? <Badge label={t('unsynced')} /> : null}
                  </View>
                }
              />
            ))
          )}
        </Card>
      </View>
      <OrderDetailSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

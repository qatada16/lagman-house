import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Screen, StatTile } from '@/components/ui';
import { SyncIndicator } from '@/components/Indicators';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { analytics, listOrders } from '@/features/orders/orderRepo';
import { countPendingCashiers } from '@/features/auth/profileRepo';
import { lowStockItems } from '@/features/stock/stockRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { daysAgo, formatMoney, formatTime, startOfDay } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

export default function DashboardScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);

  const [data] = useLocalQuery(() => {
    const today = { from: startOfDay(new Date()), to: new Date(Date.now() + 60_000) };
    const month = { from: daysAgo(30), to: new Date(Date.now() + 60_000) };
    return {
      today: analytics(today),
      topItems: analytics(month).topItems.slice(0, 5),
      recent: listOrders({ ...today, includeTest: true }, 6),
      pending: countPendingCashiers(),
      low: lowStockItems(),
      currency: getSettings().currency_symbol,
    };
  });

  return (
    <Screen title={t('dashboardTitle')} subtitle={profile?.name} actions={<SyncIndicator />}>
      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('revenueToday')} value={formatMoney(data.today.revenue, data.currency)} tone="action" />
        <StatTile label={t('ordersToday')} value={String(data.today.count)} tone="dark" />
        <StatTile label={t('pendingRequests')} value={String(data.pending)} tone="highlight" />
        <StatTile label={t('lowStock')} value={String(data.low.length)} tone="muted" />
      </View>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('recentOrders')} style={{ flex: 1, minWidth: 300 }} padded={false}>
          <View style={{ padding: spacing.lg, paddingBottom: 0 }} />
          {data.recent.length === 0 ? (
            <EmptyState title={t('noOrdersYet')} icon="shopping-bag" />
          ) : (
            data.recent.map((o) => (
              <ListRow
                key={o.id}
                title={`${o.order_number}  ${formatMoney(o.total, data.currency)}`}
                subtitle={`${formatTime(o.created_at)}  ${o.cashier_name ?? ''}`}
                right={o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : !o.is_dirty ? <Badge label={t('syncedBadge')} tone="success" /> : <Badge label={t('unsynced')} />}
              />
            ))
          )}
          <View style={{ padding: spacing.md }}>
            <Button title={t('seeAll')} variant="ghost" size="sm" onPress={() => router.push('/(admin)/history')} />
          </View>
        </Card>

        <View style={{ flex: 1, minWidth: 300, gap: spacing.lg }}>
          <Card title={t('topItems')}>
            {data.topItems.length === 0 ? (
              <EmptyState title={t('noOrdersYet')} icon="trending-up" />
            ) : (
              data.topItems.map((it) => (
                <View key={it.name} style={[row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                  <AppText style={{ flex: 1 }}>{it.name}</AppText>
                  <AppText weight="600">{t('soldCount', { n: it.quantity })}</AppText>
                </View>
              ))
            )}
          </Card>
          <Card title={t('lowStock')}>
            {data.low.length === 0 ? (
              <AppText variant="small">{t('noLowStock')}</AppText>
            ) : (
              data.low.map((s) => (
                <View key={s.id} style={[row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                  <AppText style={{ flex: 1 }}>{s.name}</AppText>
                  <Badge label={`${s.quantity} ${s.unit}`} tone="danger" />
                </View>
              ))
            )}
          </Card>
        </View>
      </View>
    </Screen>
  );
}

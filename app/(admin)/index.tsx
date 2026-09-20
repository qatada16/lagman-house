import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Screen, StatTile } from '@/components/ui';
import { BarChart } from '@/components/charts/BarChart';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { analytics, listOrders, ordersByDay } from '@/features/orders/orderRepo';
import { expenseSummary } from '@/features/expenses/expenseRepo';
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
    const to = new Date(Date.now() + 60_000);
    const today = { from: startOfDay(new Date()), to, adminId: profile?.id ?? null };
    const month = { from: daysAgo(29), to, adminId: profile?.id ?? null };
    const monthStats = analytics(month);
    const monthExpenses = expenseSummary(month);
    const revenueDays = ordersByDay(month);
    const byDay = new Map<string, { revenue: number; expenses: number }>();
    for (const d of revenueDays) byDay.set(d.day, { revenue: d.revenue, expenses: 0 });
    for (const d of monthExpenses.byDay) byDay.set(d.day, { revenue: byDay.get(d.day)?.revenue ?? 0, expenses: d.outflow });
    const series = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      today: analytics(today),
      topItems: monthStats.topItems.slice(0, 5),
      recent: listOrders({ ...today, includeTest: true }, 6),
      pending: countPendingCashiers(profile?.id ?? null),
      low: lowStockItems(),
      currency: getSettings().currency_symbol,
      monthRevenue: monthStats.revenue,
      monthExpenses: monthExpenses.outflow,
      series,
    };
  }, [profile?.id]);

  const money = (v: number) => formatMoney(v, data.currency);
  const short = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));
  const net = data.monthRevenue - data.monthExpenses;

  return (
    <Screen title={t('dashboardTitle')} subtitle={profile?.name} safeTop={false}>
      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('revenueToday')} value={money(data.today.revenue)} tone="action" />
        <StatTile label={t('ordersToday')} value={String(data.today.count)} tone="dark" />
        <StatTile label={t('expenses30')} value={money(data.monthExpenses)} tone="muted" />
        <StatTile label={t('net30')} value={money(net)} tone={net < 0 ? 'muted' : 'highlight'} sub={`${t('revenue')}: ${money(data.monthRevenue)}`} />
      </View>
      <View style={[row, { gap: spacing.md, flexWrap: 'wrap' }]}>
        <StatTile label={t('pendingRequests')} value={String(data.pending)} tone="highlight" />
        <StatTile label={t('lowStock')} value={String(data.low.length)} tone={data.low.length ? 'action' : 'dark'} />
      </View>

      <Card title={t('revenueVsExpenses')}>
        <BarChart data={data.series.map(([day, v]) => ({ label: day.slice(5).replace('-', '/'), value: v.revenue }))} formatValue={short} emptyLabel={t('noData')} color={colors.action} height={160} />
        <View style={{ height: spacing.sm }} />
        <AppText variant="label" style={{ textTransform: 'uppercase' }}>
          {t('navExpenses')}
        </AppText>
        <BarChart data={data.series.map(([day, v]) => ({ label: day.slice(5).replace('-', '/'), value: v.expenses }))} formatValue={short} emptyLabel={t('noData')} color={colors.surfaceMuted} height={120} />
      </Card>

      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <Card title={t('recentOrders')} style={{ flex: 1, minWidth: 300 }} right={<Button title={t('seeAll')} variant="ghost" size="sm" onPress={() => router.push('/(admin)/history')} />}>
          {data.recent.length === 0 ? (
            <EmptyState title={t('noOrdersYet')} icon="shopping-bag" />
          ) : (
            <View style={{ marginHorizontal: -spacing.lg, marginBottom: -spacing.lg }}>
              {data.recent.map((o, i) => (
                <ListRow
                  key={o.id}
                  title={`${o.order_number}  ${money(o.total)}`}
                  subtitle={`${formatTime(o.created_at)}  ${o.cashier_name ?? ''}`}
                  style={i === data.recent.length - 1 ? { borderBottomWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } : null}
                  right={o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : o.is_dirty ? <Badge label={t('unsynced')} /> : <Badge label={t('syncedBadge')} tone="success" />}
                />
              ))}
            </View>
          )}
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

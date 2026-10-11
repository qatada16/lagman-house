import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Card, EmptyState, IconButton, ListRow, Screen, Segmented } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney, formatTime } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { listRecentOrders, type OrderWithMeta } from './orderRepo';
import { EDIT_WINDOW_MS } from './orderChanges';
import { OrderDetailSheet } from './OrderDetailSheet';

type Filter = 'all' | 'completed' | 'void';

export function RecentOrdersScreen({ editPath, safeTop = true }: { editPath: (id: string) => string; safeTop?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<OrderWithMeta | null>(null);
  const [orders, refresh] = useLocalQuery(() => listRecentOrders(profile, new Date(Date.now() - EDIT_WINDOW_MS)), [profile?.id]);
  const currency = getSettings().currency_symbol;
  const isAdmin = profile?.role === 'admin';

  const shown = orders.filter((o) => filter === 'all' || o.status === filter);
  const cancelledCount = orders.filter((o) => o.status === 'void').length;

  return (
    <Screen safeTop={safeTop} title={t('recentOrders')} subtitle={t('last24h')} actions={<IconButton icon="refresh-cw" onPress={refresh} />}>
      <Card>
        <AppText variant="small">{t('editWindowHint')}</AppText>
        <View style={{ height: spacing.sm }} />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          scroll
          options={[
            { value: 'all', label: `${t('allOrders')} (${orders.length})` },
            { value: 'completed', label: `${t('statusCompleted')} (${orders.length - cancelledCount})` },
            { value: 'void', label: `${t('orderCancelledBadge')} (${cancelledCount})` },
          ]}
        />
      </Card>
      <Card padded={false}>
        {shown.length === 0 ? (
          <EmptyState title={t('noRecentOrders')} icon="clock" />
        ) : (
          shown.map((o, i) => (
            <ListRow
              key={o.id}
              title={`${o.order_number}  ${formatMoney(o.total, currency)}`}
              subtitle={[formatTime(o.created_at), isAdmin ? o.cashier_name ?? '' : '', t('itemsCount', { n: o.item_count })].filter(Boolean).join('  ')}
              onPress={() => setSelected(o)}
              chevron
              style={i === shown.length - 1 ? { borderBottomWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } : null}
              right={
                <View style={[row, { gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 180 }]}>
                  {o.status === 'void' ? <Badge label={t('orderCancelledBadge')} tone="danger" /> : null}
                  {o.edit_count > 0 && o.status !== 'void' ? <Badge label={t('orderEditedBadge')} tone="warning" /> : null}
                  {o.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
                  {o.source === 'qr' ? <Badge label={t('sourceQr')} tone="info" /> : null}
                  {o.is_dirty ? <Badge label={t('unsynced')} /> : null}
                </View>
              }
            />
          ))
        )}
      </Card>
      {orders.length > 0 ? (
        <AppText variant="small" align="center" color={colors.textSecondary}>
          {t('recentOrdersFooter')}
        </AppText>
      ) : null}
      <OrderDetailSheet
        order={selected}
        onClose={() => setSelected(null)}
        onChanged={refresh}
        onEdit={(o) => {
          setSelected(null);
          router.push(editPath(o.id) as never);
        }}
      />
    </Screen>
  );
}

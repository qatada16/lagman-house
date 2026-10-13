import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, IconButton, Screen } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { claimCustomerOrder, secondsLeft } from '@/features/qr/customerOrdersApi';
import { formatTime } from '@/lib/format';
import { toast } from '@/store/toastStore';
import { formatCountdown, useNow } from './useNow';

export function WebOrdersScreen({ basePath, safeTop = true, closable = true }: { basePath: string; safeTop?: boolean; closable?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const online = useSyncStore((s) => s.online);
  const { orders, loading, refresh, remove, upsertLocal } = useCustomerOrderStore();
  const [claiming, setClaiming] = useState<string | null>(null);
  const clockOffset = useCustomerOrderStore((s) => s.clockOffset);
  const now = useNow(1000, orders.length > 0) + clockOffset;

  const open = (id: string) => router.push(`${basePath}/${id}` as never);

  const claim = async (id: string) => {
    if (!profile) return;
    setClaiming(id);
    try {
      const won = await claimCustomerOrder(id, profile.id);
      if (!won) {
        toast.info(t('alreadyTaken'));
        remove(id);
        return;
      }
      upsertLocal(won);
      open(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Screen
      safeTop={safeTop}
      title={t('customerOrders')}
      subtitle={t('webOrdersHint')}
      actions={
        <View style={[row, { gap: spacing.xs }]}>
          <IconButton icon="refresh-cw" onPress={() => void refresh()} />
          {closable ? <IconButton icon="x" onPress={() => router.back()} /> : null}
        </View>
      }
    >
      {!online ? (
        <Card tone="highlight">
          <AppText color={colors.accentDark}>{t('requiresInternet')}</AppText>
        </Card>
      ) : null}
      {orders.length === 0 ? (
        <Card>
          <EmptyState title={loading ? t('loading') : t('noCustomerOrders')} icon="bell" />
        </Card>
      ) : (
        orders.map((o) => {
          const mine = o.claimed_by === profile?.id;
          const count = o.items.reduce((s, i) => s + i.quantity, 0);
          const left = o.status === 'pending' ? secondsLeft(o, now) : null;
          return (
            <Card key={o.id}>
              <View style={[row, { justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{`#${o.ticket_no ?? '-'}${o.table_code ? `  ·  ${t('tableShort', { code: o.table_code })}` : ''}`}</AppText>
                  <AppText variant="small">{`${t('itemsCount', { n: count })}  ·  ${formatTime(o.created_at)}`}</AppText>
                </View>
                {o.status === 'pending' ? (
                  <AppText variant="heading" color={left != null && left <= 60 ? colors.danger : left != null && left <= 180 ? colors.action : colors.success}>
                    {left != null ? formatCountdown(left) : t('pending')}
                  </AppText>
                ) : (
                  <Badge label={mine ? t('claimedByYou') : t('webAcceptedBy', { name: o.claimed_by_name ?? '-' })} tone={mine ? 'success' : 'info'} />
                )}
              </View>
              <View style={{ marginTop: spacing.sm, gap: 2 }}>
                {o.items.slice(0, 4).map((i, idx) => (
                  <AppText key={idx} variant="small">{`${i.quantity} x ${i.name}${i.variant_name ? ` (${i.variant_name})` : ''}`}</AppText>
                ))}
                {o.items.length > 4 ? <AppText variant="small">...</AppText> : null}
                {o.note ? <AppText variant="small" weight="600">{`${t('notes')}: ${o.note}`}</AppText> : null}
              </View>
              <View style={[row, { marginTop: spacing.md, gap: spacing.sm }]}>
                <Button title={t('webDetails')} variant="outline" onPress={() => open(o.id)} style={{ flex: 1 }} />
                {o.status === 'pending' ? (
                  <Button title={t('webAccept')} variant="action" icon="check" loading={claiming === o.id} disabled={!online || (left != null && left <= 0)} onPress={() => void claim(o.id)} style={{ flex: 1 }} />
                ) : mine ? (
                  <Button title={t('confirmCustomerOrder')} variant="action" icon="arrow-right" onPress={() => open(o.id)} style={{ flex: 1 }} />
                ) : null}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

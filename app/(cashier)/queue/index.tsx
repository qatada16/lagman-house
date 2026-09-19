import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, IconButton, Screen } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { claimCustomerOrder } from '@/features/qr/customerOrdersApi';
import { relativeTime } from '@/lib/format';
import { toast } from '@/store/toastStore';

export default function QueueScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const online = useSyncStore((s) => s.online);
  const { orders, loading, refresh, remove } = useCustomerOrderStore();
  const [claiming, setClaiming] = useState<string | null>(null);

  const visible = orders.filter((o) => o.status === 'pending' || o.claimed_by === profile?.id);

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
      router.push({ pathname: '/(cashier)/queue/[id]', params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Screen title={t('customerOrders')} actions={<View style={[row, { gap: spacing.xs }]}><IconButton icon="refresh-cw" onPress={() => void refresh()} /><IconButton icon="x" onPress={() => router.back()} /></View>}>
      {!online ? (
        <Card tone="highlight">
          <AppText color={colors.accentDark}>{t('requiresInternet')}</AppText>
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <Card>
          <EmptyState title={loading ? t('loading') : t('noCustomerOrders')} icon="bell" />
        </Card>
      ) : (
        visible.map((o) => {
          const mine = o.claimed_by === profile?.id;
          const count = o.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <Card key={o.id}>
              <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{o.table_code ? t('tableShort', { code: o.table_code }) : t('customerOrders')}</AppText>
                  <AppText variant="small">{`${count} ${t('items').toLowerCase()}  ${relativeTime(o.created_at, '')}`}</AppText>
                </View>
                <Badge label={mine ? t('claimedByYou') : t('pending')} tone={mine ? 'success' : 'warning'} />
              </View>
              <View style={{ marginTop: spacing.sm, gap: 2 }}>
                {o.items.slice(0, 5).map((i, idx) => (
                  <AppText key={idx} variant="small">{`${i.quantity} x ${i.name}${i.variant_name ? ` (${i.variant_name})` : ''}`}</AppText>
                ))}
                {o.items.length > 5 ? <AppText variant="small">...</AppText> : null}
                {o.note ? <AppText variant="small" weight="600">{`${t('notes')}: ${o.note}`}</AppText> : null}
              </View>
              <View style={{ marginTop: spacing.md }}>
                {mine ? (
                  <Button title={t('confirmCustomerOrder')} variant="action" icon="arrow-right" onPress={() => router.push({ pathname: '/(cashier)/queue/[id]', params: { id: o.id } })} />
                ) : (
                  <Button title={t('claim')} icon="check" loading={claiming === o.id} disabled={!online} onPress={() => claim(o.id)} />
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

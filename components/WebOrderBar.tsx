import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout, useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { expireCustomerOrders, secondsLeft } from '@/features/qr/customerOrdersApi';
import { formatCountdown, useNow } from '@/features/webOrders/useNow';
import type { CustomerOrder } from '@/lib/types';

export function useOpenWebOrderCount() {
  return useCustomerOrderStore((s) => s.orders.length);
}

function tone(order: CustomerOrder, left: number | null, mine: boolean) {
  if (order.status === 'claimed') return mine ? { bg: '#DCE6EE', fg: colors.accentDark } : { bg: colors.surfaceSidebar, fg: colors.surfaceMuted };
  if (left != null && left <= 60) return { bg: colors.danger, fg: colors.white };
  if (left != null && left <= 180) return { bg: colors.action, fg: colors.white };
  return { bg: colors.success, fg: colors.white };
}

export function WebOrderBar({ basePath, padTop }: { basePath: string; padTop?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const orders = useCustomerOrderStore((s) => s.orders);
  const clockOffset = useCustomerOrderStore((s) => s.clockOffset);
  const now = useNow(1000, orders.length > 0) + clockOffset;
  const expiring = useRef(false);

  const overdue = orders.some((o) => o.status === 'pending' && (secondsLeft(o, now) ?? 1) <= 0);
  useEffect(() => {
    if (!overdue || expiring.current) return;
    expiring.current = true;
    void expireCustomerOrders()
      .catch(() => undefined)
      .finally(() => {
        expiring.current = false;
        void useCustomerOrderStore.getState().refresh();
      });
  }, [overdue]);

  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return (a.expires_at ?? a.created_at).localeCompare(b.expires_at ?? b.created_at);
  });

  return (
    <View style={[styles.bar, { paddingTop: (padTop ? insets.top : 0) + spacing.xs }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[row, styles.list]}>
        <View style={[row, styles.label]}>
          <Feather name="globe" size={14} color={colors.textOnDark} />
          <AppText variant="label" color={colors.textOnDark}>
            {t('webOrdersShort', { n: orders.length })}
          </AppText>
        </View>
        {sorted.map((o) => {
          const left = o.status === 'pending' ? secondsLeft(o, now) : null;
          const mine = o.claimed_by === profile?.id;
          const c = tone(o, left, mine);
          const count = o.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <Pressable
              key={o.id}
              collapsable={false}
              onPress={() => router.push(`${basePath}/${o.id}` as never)}
              style={({ pressed }) => [styles.chip, row, { backgroundColor: c.bg }, pressed ? { opacity: 0.8 } : null]}
            >
              <AppText weight="700" color={c.fg}>{`#${o.ticket_no ?? '-'}`}</AppText>
              <AppText variant="small" color={c.fg}>
                {[o.table_code ? t('tableShort', { code: o.table_code }) : null, t('itemsCount', { n: count })].filter(Boolean).join(' · ')}
              </AppText>
              <AppText weight="700" color={c.fg}>
                {o.status === 'claimed' ? (mine ? t('webMine') : o.claimed_by_name ?? t('webAccepted')) : left != null ? formatCountdown(left) : t('pending')}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.accentDark, paddingBottom: spacing.xs },
  list: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  label: { alignItems: 'center', gap: 4, paddingEnd: spacing.xs },
  chip: { alignItems: 'center', gap: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md },
});

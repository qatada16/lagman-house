import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { PrinterDot, SyncIndicator } from '@/components/Indicators';
import { MenuGrid } from '@/features/menu/MenuGrid';
import { useLayout, useT } from '@/lib/i18n';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { useAuthStore } from '@/store/authStore';
import { CartPanel } from './CartPanel';

interface Props {
  title: string;
  cartPath: string;
  printerPath: string;
  queuePath?: string;
  safeTop?: boolean;
}

export function PosScreen({ title, cartPath, printerPath, queuePath, safeTop = true }: Props) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { row } = useLayout();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const profile = useAuthStore((s) => s.profile);
  const pendingQueue = useCustomerOrderStore((s) => s.orders.filter((o) => o.status === 'pending' || o.claimed_by === profile?.id).length);
  const go = (path: string) => router.push(path as never);

  const header = (
    <View style={[styles.header, row]}>
      <View style={{ flex: 1 }}>
        <AppText variant="title">{title}</AppText>
        <SyncIndicator />
      </View>
      <PrinterDot onPress={() => go(printerPath)} showLabel={wide} />
      {queuePath ? (
        <Pressable onPress={() => go(queuePath)} style={[styles.queueBtn, row]}>
          <Feather name="bell" size={16} color={colors.textOnDark} />
          <AppText variant="small" color={colors.textOnDark} weight="600">
            {t('queue')}
          </AppText>
          {pendingQueue > 0 ? (
            <View style={styles.badge}>
              <AppText variant="label" color={colors.white} style={{ fontSize: 10 }}>
                {pendingQueue}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );

  const paddingTop = safeTop ? insets.top : 0;

  if (wide) {
    const cartWidth = 340;
    return (
      <View style={[styles.root, { paddingTop }]}>
        {header}
        <View style={[row, { flex: 1, gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
          <View style={{ flex: 1 }}>
            <MenuGrid availableWidth={width - cartWidth - spacing.lg * 3} />
          </View>
          <View style={{ width: cartWidth }}>
            <CartPanel onProceed={() => go(cartPath)} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop }]}>
      {header}
      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        <MenuGrid />
      </View>
      <View style={{ padding: spacing.md }}>
        <CartPanel compact onProceed={() => go(cartPath)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  queueBtn: { alignItems: 'center', gap: 6, backgroundColor: colors.accentDark, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md },
  badge: { backgroundColor: colors.action, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});

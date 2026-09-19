import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { useLayout, useT, type StringKey } from '@/lib/i18n';
import { AppText } from '@/components/ui';

const TABS: { key: StringKey; icon: keyof typeof Feather.glyphMap; href: string; match: (p: string) => boolean }[] = [
  { key: 'tabMenu', icon: 'grid', href: '/(cashier)', match: (p) => p === '/' || p === '' || p.startsWith('/cart') || p.startsWith('/queue') },
  { key: 'tabAccount', icon: 'user', href: '/(cashier)/account', match: (p) => p.startsWith('/account') },
  { key: 'tabSettings', icon: 'settings', href: '/(cashier)/settings', match: (p) => p.startsWith('/settings') },
];

export function CashierTabBar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isRTL } = useLayout();
  const tabs = isRTL ? [...TABS].reverse() : TABS;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Pressable key={tab.key} onPress={() => router.navigate(tab.href as never)} style={styles.tab}>
            <Feather name={tab.icon} size={20} color={active ? colors.action : colors.surfaceMuted} />
            <AppText variant="label" color={active ? colors.action : colors.surfaceMuted} align="center">
              {t(tab.key)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSidebar,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
});

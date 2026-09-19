import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '@/constants/theme';
import { useLayout, useT, type StringKey } from '@/lib/i18n';
import { AppText } from '@/components/ui';
import { LanguageToggle } from './LanguageToggle';
import { SyncIndicator } from './Indicators';
import { useAuthStore } from '@/store/authStore';
import { confirm } from '@/lib/confirm';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { countPendingCashiers } from '@/features/auth/profileRepo';

interface Item {
  key: StringKey;
  icon: keyof typeof Feather.glyphMap;
  href: string;
  match: (p: string) => boolean;
}

const ITEMS: Item[] = [
  { key: 'navDashboard', icon: 'grid', href: '/(admin)', match: (p) => p === '/' || p === '/(admin)' || p === '' },
  { key: 'navCashiers', icon: 'users', href: '/(admin)/cashiers', match: (p) => p.startsWith('/cashiers') },
  { key: 'navMenu', icon: 'book-open', href: '/(admin)/menu', match: (p) => p.startsWith('/menu') },
  { key: 'navStock', icon: 'package', href: '/(admin)/stock', match: (p) => p.startsWith('/stock') },
  { key: 'navTemplates', icon: 'file-text', href: '/(admin)/templates', match: (p) => p.startsWith('/templates') },
  { key: 'navPrinter', icon: 'printer', href: '/(admin)/printer', match: (p) => p.startsWith('/printer') },
  { key: 'navHistory', icon: 'bar-chart-2', href: '/(admin)/history', match: (p) => p.startsWith('/history') },
  { key: 'navQr', icon: 'maximize', href: '/(admin)/qr', match: (p) => p.startsWith('/qr') },
  { key: 'navSettings', icon: 'settings', href: '/(admin)/settings', match: (p) => p.startsWith('/settings') },
  { key: 'navAccount', icon: 'user', href: '/(admin)/account', match: (p) => p.startsWith('/account') },
];

export function AdminSidebar() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isRTL } = useLayout();
  const wide = width >= layout.wideBreakpoint;
  const signOut = useAuthStore((s) => s.signOut);
  const [pending] = useLocalQuery(countPendingCashiers);

  const logout = async () => {
    if (await confirm(t('logout'), t('logoutConfirm'), t('logout'), t('cancel'), true)) await signOut();
  };

  return (
    <View
      style={[
        styles.bar,
        { width: wide ? layout.sidebarWidth : layout.railWidth, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
        isRTL ? styles.barRTL : styles.barLTR,
      ]}
    >
      <View style={[styles.brand, wide ? null : { justifyContent: 'center' }]}>
        <Image source={require('@/assets/brand/logo.png')} style={{ width: wide ? 48 : 36, height: wide ? 48 : 36 }} contentFit="contain" />
        {wide ? (
          <AppText variant="subheading" color={colors.accentDark} align="center">
            {t('appName')}
          </AppText>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const badge = item.key === 'navCashiers' && pending > 0 ? pending : 0;
          return (
            <Pressable
              key={item.key}
              onPress={() => router.navigate(item.href as never)}
              style={[styles.item, { flexDirection: isRTL ? 'row-reverse' : 'row' }, active ? styles.itemActive : null, wide ? null : styles.itemRail]}
            >
              <View>
                <Feather name={item.icon} size={18} color={active ? colors.textOnDark : colors.accentDark} />
                {badge ? (
                  <View style={styles.badge}>
                    <AppText variant="label" color={colors.white} align="center" style={{ fontSize: 10 }}>
                      {badge}
                    </AppText>
                  </View>
                ) : null}
              </View>
              {wide ? (
                <AppText variant="small" weight={active ? '700' : '500'} color={active ? colors.textOnDark : colors.accentDark} style={{ flex: 1 }}>
                  {t(item.key)}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, wide ? null : { alignItems: 'center' }]}>
        {wide ? <SyncIndicator /> : null}
        <LanguageToggle compact={!wide} />
        <Pressable onPress={logout} style={[styles.item, { flexDirection: isRTL ? 'row-reverse' : 'row' }, wide ? null : styles.itemRail]}>
          <Feather name="log-out" size={18} color={colors.danger} />
          {wide ? (
            <AppText variant="small" color={colors.danger} weight="600">
              {t('logout')}
            </AppText>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surfaceSidebar, paddingHorizontal: spacing.sm, gap: spacing.md },
  barLTR: { borderRightWidth: 1, borderRightColor: colors.border },
  barRTL: { borderLeftWidth: 1, borderLeftColor: colors.border },
  brand: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  items: { gap: 2 },
  item: { alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.md },
  itemRail: { justifyContent: 'center', paddingHorizontal: 0 },
  itemActive: { backgroundColor: colors.accentDark },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  footer: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});

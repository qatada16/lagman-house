import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout, useT, localizedName, type StringKey } from '@/lib/i18n';
import { AppText, Badge } from '@/components/ui';
import { LanguageToggle } from './LanguageToggle';
import { Avatar, SyncIndicator } from './Indicators';
import { useAuthStore } from '@/store/authStore';
import { useDrawerStore } from '@/store/drawerStore';
import { confirm } from '@/lib/confirm';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { countPendingCashiers } from '@/features/auth/profileRepo';
import { getSettings } from '@/features/settings/settingsRepo';

interface Item {
  key: StringKey;
  icon: keyof typeof Feather.glyphMap;
  href: string;
  match: (p: string) => boolean;
}

export const ADMIN_ITEMS: Item[] = [
  { key: 'navDashboard', icon: 'grid', href: '/(admin)', match: (p) => p === '/' || p === '' },
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

const DURATION = 260;

export function AdminDrawer() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isRTL, row, lang } = useLayout();
  const open = useDrawerStore((s) => s.open);
  const setOpen = useDrawerStore((s) => s.setOpen);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [pending] = useLocalQuery(() => countPendingCashiers(profile?.id ?? null), [profile?.id]);
  const [settings] = useLocalQuery(getSettings);

  const drawerWidth = Math.min(300, width * 0.82);
  const hidden = isRTL ? drawerWidth : -drawerWidth;
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: DURATION, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [open, progress]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: hidden * (1 - progress.value) }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!mounted) return null;

  const go = (href: string) => {
    setOpen(false);
    router.navigate(href as never);
  };

  const logout = async () => {
    setOpen(false);
    if (await confirm(t('logout'), t('logoutConfirm'), t('logout'), t('cancel'), true)) await signOut();
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={30} tint="dark" experimentalBlurMethod="dimezisBlurView" style={styles.fill}>
          <Pressable style={styles.fill} onPress={() => setOpen(false)} accessibilityLabel={t('closeMenu')} />
        </BlurView>
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { width: drawerWidth, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
          isRTL ? { right: 0, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg } : { left: 0, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
          panelStyle,
        ]}
      >
        <View style={[styles.brand, row]}>
          <Image source={require('@/assets/brand/logo.png')} style={{ width: 44, height: 44 }} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <AppText variant="subheading" color={colors.accentDark}>
              {localizedName(lang, settings.restaurant_name, settings.restaurant_name_ur)}
            </AppText>
            <AppText variant="small">{t('roleAdmin')}</AppText>
          </View>
          <Pressable onPress={() => setOpen(false)} hitSlop={10}>
            <Feather name="x" size={22} color={colors.surfaceMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
          {ADMIN_ITEMS.map((item) => {
            const active = item.match(pathname);
            const badge = item.key === 'navCashiers' && pending > 0 ? pending : 0;
            return (
              <Pressable key={item.key} onPress={() => go(item.href)} style={[styles.item, row, active ? styles.itemActive : null]}>
                <Feather name={item.icon} size={18} color={active ? colors.textOnDark : colors.accentDark} />
                <AppText variant="small" weight={active ? '700' : '500'} color={active ? colors.textOnDark : colors.accentDark} style={{ flex: 1 }}>
                  {t(item.key)}
                </AppText>
                {badge ? <Badge label={String(badge)} tone={active ? 'warning' : 'dark'} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={[row, { alignItems: 'center', gap: spacing.sm }]}>
            <Avatar uri={profile?.photo_url} name={profile?.name} size={36} />
            <View style={{ flex: 1 }}>
              <AppText variant="small" weight="600" numberOfLines={1}>
                {profile?.name}
              </AppText>
              <SyncIndicator />
            </View>
          </View>
          <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <LanguageToggle />
            <Pressable onPress={logout} style={[styles.logout, row]}>
              <Feather name="log-out" size={16} color={colors.danger} />
              <AppText variant="small" color={colors.danger} weight="600">
                {t('logout')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export function AdminTopBar() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { row, lang } = useLayout();
  const toggle = useDrawerStore((s) => s.toggle);
  const profile = useAuthStore((s) => s.profile);
  const [pending] = useLocalQuery(() => countPendingCashiers(profile?.id ?? null), [profile?.id]);
  const [settings] = useLocalQuery(getSettings);
  return (
    <View style={[styles.topbar, row, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={toggle} hitSlop={10} style={styles.menuBtn} accessibilityLabel={t('openMenu')}>
        <Feather name="menu" size={22} color={colors.accentDark} />
        {pending > 0 ? <View style={styles.dot} /> : null}
      </Pressable>
      <AppText variant="subheading" color={colors.accentDark} style={{ flex: 1 }} numberOfLines={1}>
        {localizedName(lang, settings.restaurant_name, settings.restaurant_name_ur)}
      </AppText>
      <SyncIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,30,27,0.35)' },
  fill: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSidebar,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  brand: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  items: { gap: 2 },
  item: { alignItems: 'center', gap: spacing.md, paddingVertical: 11, paddingHorizontal: spacing.md, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.accentDark },
  footer: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  logout: { alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: spacing.sm },
  topbar: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    backgroundColor: colors.surfaceSidebar,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  dot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.action },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText, Screen } from '@/components/ui';
import { LanguageToggle } from './LanguageToggle';
import { useLayout } from '@/lib/i18n';

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { row } = useLayout();
  return (
    <Screen padded>
      <View style={[styles.top, row]}>
        <Image source={require('@/assets/brand/logo.png')} style={styles.logo} contentFit="contain" />
        <LanguageToggle />
      </View>
      <View style={styles.card}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="small">{subtitle}</AppText> : null}
        <View style={{ height: spacing.sm }} />
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 84, height: 84 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
});

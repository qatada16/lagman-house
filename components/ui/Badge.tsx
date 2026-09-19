import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'dark';

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSidebar, fg: colors.surfaceMuted },
  success: { bg: '#E3EFE4', fg: colors.success },
  warning: { bg: '#F5E6D3', fg: colors.action },
  danger: { bg: '#F4E1E1', fg: colors.danger },
  info: { bg: '#DCE6EE', fg: colors.accentDark },
  dark: { bg: colors.accentDark, fg: colors.textOnDark },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <AppText variant="label" color={t.fg} align="center">
        {label}
      </AppText>
    </View>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'completed':
      return 'success';
    case 'pending':
    case 'claimed':
      return 'warning';
    case 'suspended':
    case 'rejected':
    case 'void':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { useLayout } from '@/lib/i18n';

interface Props extends ViewProps {
  title?: string;
  right?: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'dark' | 'action' | 'highlight' | 'muted';
}

const tones = {
  default: colors.white,
  dark: colors.accentDark,
  action: colors.action,
  highlight: colors.surfaceHighlight,
  muted: colors.surfaceMuted,
};

export function Card({ title, right, padded = true, style, tone = 'default', children, ...rest }: Props) {
  const { row } = useLayout();
  return (
    <View {...rest} style={[styles.card, { backgroundColor: tones[tone] }, padded ? styles.padded : null, style]}>
      {title || right ? (
        <View style={[styles.header, row, padded ? null : styles.headerUnpadded]}>
          {title ? (
            <AppText variant="heading" color={tone === 'default' ? colors.textPrimary : colors.textOnDark}>
              {title}
            </AppText>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  padded: { padding: spacing.lg },
  header: { justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  headerUnpadded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, marginBottom: 0 },
});

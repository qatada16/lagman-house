import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

type Variant = 'primary' | 'action' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accentDark, fg: colors.textOnDark, border: colors.accentDark },
  action: { bg: colors.action, fg: colors.white, border: colors.action },
  secondary: { bg: colors.surfaceHighlight, fg: colors.accentDark, border: colors.surfaceHighlight },
  outline: { bg: 'transparent', fg: colors.accentDark, border: colors.accentDark },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.accentDark, border: 'transparent' },
};

const heights: Record<Size, number> = { sm: 34, md: 44, lg: 52 };

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, fullWidth }: Props) {
  const { row } = useLayout();
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        row,
        { backgroundColor: p.bg, borderColor: p.border, height: heights[size], opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth ? { alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? <Feather name={icon} size={size === 'sm' ? 14 : 17} color={p.fg} /> : null}
          <AppText variant={size === 'sm' ? 'small' : 'subheading'} color={p.fg} align="center" weight="600">
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

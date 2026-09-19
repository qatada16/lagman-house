import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

export function EmptyState({ icon = 'inbox', title, body }: { icon?: keyof typeof Feather.glyphMap; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={28} color={colors.surfaceHighlight} />
      <AppText variant="subheading" align="center" color={colors.surfaceMuted}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="small" align="center">
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({ title, subtitle, right, left, onPress, chevron, style }: RowProps) {
  const { row, isRTL } = useLayout();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, row, pressed && onPress ? styles.pressed : null, style]}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="600">{title}</AppText>
        {subtitle ? <AppText variant="small">{subtitle}</AppText> : null}
      </View>
      {right}
      {chevron ? <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={colors.surfaceMuted} /> : null}
    </Pressable>
  );
}

export function StatTile({ label, value, tone = 'dark', sub }: { label: string; value: string; tone?: 'dark' | 'action' | 'highlight' | 'muted'; sub?: string }) {
  const bg = { dark: colors.accentDark, action: colors.action, highlight: colors.surfaceHighlight, muted: colors.surfaceMuted }[tone];
  const fg = tone === 'highlight' ? colors.accentDark : colors.textOnDark;
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <AppText variant="label" color={fg} style={{ opacity: 0.85 }}>
        {label}
      </AppText>
      <AppText variant="title" color={fg} style={{ fontSize: 26 }}>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="small" color={fg} style={{ opacity: 0.8 }}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const { row } = useLayout();
  return (
    <View style={[styles.stepper, row]}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn} hitSlop={6}>
        <Feather name="minus" size={16} color={colors.accentDark} />
      </Pressable>
      <AppText weight="600" align="center" style={{ minWidth: 28 }}>
        {value}
      </AppText>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepBtn} hitSlop={6}>
        <Feather name="plus" size={16} color={colors.accentDark} />
      </Pressable>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const { row } = useLayout();
  return (
    <View style={[styles.section, row]}>
      <AppText variant="label" style={{ textTransform: 'uppercase' }}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

export function IconButton({ icon, onPress, color = colors.accentDark, size = 20, style }: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed ? { opacity: 0.6 } : null, style]}>
      <Feather name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  row: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  pressed: { backgroundColor: colors.surfaceSidebar },
  tile: { flex: 1, minWidth: 140, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  stepper: { alignItems: 'center', gap: spacing.xs },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  section: { justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
});

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  scroll?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, label, scroll }: Props<T>) {
  const { row, isRTL } = useLayout();
  const items = isRTL ? [...options].reverse() : options;
  const content = (
    <View style={[styles.group, row, scroll ? null : { alignSelf: 'stretch' }]}>
      {items.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, scroll ? null : { flex: 1 }, active ? styles.active : null]}
          >
            <AppText variant="small" align="center" weight="600" color={active ? colors.textOnDark : colors.accentDark}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="label" style={{ textTransform: 'uppercase' }}>
          {label}
        </AppText>
      ) : null}
      {scroll ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{content}</ScrollView> : content}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.accentDark,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  segment: { paddingVertical: 9, paddingHorizontal: spacing.md, justifyContent: 'center' },
  active: { backgroundColor: colors.accentDark },
});

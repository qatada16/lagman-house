import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, hint, value, onChange, disabled }: Props) {
  const { row } = useLayout();
  return (
    <Pressable onPress={() => !disabled && onChange(!value)} style={[styles.row, row, disabled ? { opacity: 0.5 } : null]}>
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        {hint ? <AppText variant="small">{hint}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.surfaceHighlight }}
        thumbColor={value ? colors.action : colors.white}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
});

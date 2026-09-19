import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  digitsOnly?: boolean;
  decimal?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  right?: React.ReactNode;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, digitsOnly, decimal, containerStyle, onChangeText, style, right, editable = true, ...rest },
  ref
) {
  const { isRTL, row } = useLayout();

  const handleChange = (text: string) => {
    let next = text;
    if (digitsOnly) next = text.replace(/[^0-9]/g, '');
    else if (decimal) {
      next = text.replace(/[^0-9.]/g, '');
      const parts = next.split('.');
      if (parts.length > 2) next = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    onChangeText?.(next);
  };

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, row, error ? styles.fieldError : null, !editable ? styles.fieldDisabled : null]}>
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          onChangeText={handleChange}
          keyboardType={digitsOnly ? 'number-pad' : decimal ? 'decimal-pad' : rest.keyboardType}
          placeholderTextColor={colors.disabled}
          style={[styles.input, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }, style]}
        />
        {right}
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small">{hint}</AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { textTransform: 'uppercase' },
  field: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { backgroundColor: colors.surfaceSidebar },
  input: { flex: 1, ...typography.body, paddingVertical: spacing.sm },
});

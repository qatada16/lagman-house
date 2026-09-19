import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';

type Variant = keyof typeof typography;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  align?: 'auto' | 'left' | 'center' | 'right' | 'start';
  weight?: TextStyle['fontWeight'];
}

export function AppText({ variant = 'body', color, align = 'start', weight, style, children, ...rest }: Props) {
  const { isRTL } = useLayout();
  const base = typography[variant] as TextStyle;
  const textAlign: TextStyle['textAlign'] =
    align === 'start' ? (isRTL ? 'right' : 'left') : align;
  return (
    <Text
      {...rest}
      style={[
        base,
        { textAlign, writingDirection: isRTL ? 'rtl' : 'ltr' },
        color ? { color } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const textColors = colors;

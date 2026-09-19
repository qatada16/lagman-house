import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

interface Props {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  safeTop?: boolean;
  footer?: React.ReactNode;
}

export function Screen({ title, subtitle, actions, children, scroll = true, padded = true, style, contentStyle, safeTop = true, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { row } = useLayout();
  const header =
    title || actions ? (
      <View style={[styles.header, row]}>
        <View style={{ flex: 1 }}>
          {title ? <AppText variant="title">{title}</AppText> : null}
          {subtitle ? <AppText variant="small">{subtitle}</AppText> : null}
        </View>
        {actions}
      </View>
    ) : null;

  const inner = (
    <>
      {header}
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: safeTop ? insets.top : 0 }, style]}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[padded ? styles.padded : null, styles.content, contentStyle]}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded ? styles.padded : null, contentStyle]}>{inner}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.lg },
  content: { gap: spacing.lg, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: spacing.xxl },
  header: { justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSidebar,
    gap: spacing.sm,
  },
});

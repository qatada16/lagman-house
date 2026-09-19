import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';
import { useToastStore } from '@/store/toastStore';
import { AppText } from './AppText';

const bg = { info: colors.accentDark, success: colors.success, error: colors.danger };

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => dismiss(t.id)} style={[styles.toast, { backgroundColor: bg[t.tone] }]}>
          <AppText color={colors.white} align="center">
            {t.message}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, alignItems: 'center', zIndex: 100 },
  toast: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, maxWidth: 480, width: '100%' },
});

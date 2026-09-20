import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useConfirmStore } from '@/store/confirmStore';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';
import { Button } from './Button';

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const close = useConfirmStore((s) => s.close);
  const { rowReverse } = useLayout();
  if (!request) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(false)} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => close(false)} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog}>
          <View style={[styles.iconWrap, { backgroundColor: request.destructive ? '#F4E1E1' : colors.surfaceSidebar }]}>
            <Feather name={request.destructive ? 'alert-triangle' : 'help-circle'} size={22} color={request.destructive ? colors.danger : colors.accentDark} />
          </View>
          <AppText variant="heading" align="center">
            {request.title}
          </AppText>
          <AppText align="center" color={colors.textSecondary}>
            {request.message}
          </AppText>
          <View style={[styles.actions, rowReverse]}>
            <Button title={request.confirmLabel} variant={request.destructive ? 'danger' : 'primary'} onPress={() => close(true)} style={{ flex: 1 }} />
            <Button title={request.cancelLabel} variant="outline" onPress={() => close(false)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
});

import React from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { MenuGrid } from '@/features/menu/MenuGrid';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useCart } from '@/store/cartStore';

export function AddItemsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { row } = useLayout();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[row, styles.header]}>
          <AppText variant="title" style={{ flex: 1 }}>
            {t('addItems')}
          </AppText>
        </View>
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <MenuGrid availableWidth={width - spacing.lg * 2} />
        </View>
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Button title={t('doneWithItems', { n: count })} variant="action" size="lg" icon="check" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSidebar },
});

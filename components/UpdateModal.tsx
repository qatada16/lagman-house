import React from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Button } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { currentVersion, useUpdateCheck } from '@/features/app/useUpdateCheck';

export function UpdateModal() {
  const t = useT();
  const { row } = useLayout();
  const { release, dismiss } = useUpdateCheck();
  if (!release) return null;
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={() => (release.mandatory ? undefined : void dismiss())}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.iconWrap}>
            <Feather name="download-cloud" size={24} color={colors.action} />
          </View>
          <AppText variant="heading" align="center">
            {t('updateAvailable')}
          </AppText>
          <AppText align="center" color={colors.textSecondary}>
            {t('updateBody', { latest: release.version, current: currentVersion() })}
          </AppText>
          {release.mandatory ? (
            <AppText variant="small" align="center" color={colors.danger}>
              {t('updateMandatory')}
            </AppText>
          ) : null}
          {release.notes ? (
            <View style={styles.notes}>
              <AppText variant="label" style={{ textTransform: 'uppercase' }}>
                {t('updateNotes')}
              </AppText>
              <AppText variant="small">{release.notes}</AppText>
            </View>
          ) : null}
          <View style={[styles.actions, row]}>
            {!release.mandatory ? <Button title={t('updateLater')} variant="outline" onPress={() => void dismiss()} style={{ flex: 1 }} /> : null}
            {release.apk_url ? <Button title={t('updateDownload')} variant="action" icon="download" onPress={() => void Linking.openURL(release.apk_url!)} style={{ flex: 1 }} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F5E6D3', alignItems: 'center', justifyContent: 'center' },
  notes: { alignSelf: 'stretch', gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSidebar },
  actions: { gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
});

import React from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Button } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { formatInstalledVersion, isSafeDownloadUrl, useUpdateCheck } from '@/features/app/useUpdateCheck';
import { toast } from '@/store/toastStore';

export function UpdateModal() {
  const t = useT();
  const { row } = useLayout();
  const { release, dismiss, opened } = useUpdateCheck();
  if (!release) return null;
  const latest = release.build_number > 0 ? `${release.version} (${release.build_number})` : release.version;

  const download = async () => {
    if (!isSafeDownloadUrl(release.apk_url)) return;
    try {
      await Linking.openURL(release.apk_url);
      opened();
    } catch {
      toast.error(t('updateOpenFailed'));
    }
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={() => (release.mandatory ? undefined : dismiss())}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.iconWrap}>
            <Feather name="download-cloud" size={24} color={colors.action} />
          </View>
          <AppText variant="heading" align="center">
            {t('updateAvailable')}
          </AppText>
          <AppText align="center" color={colors.textSecondary}>
            {t('updateBody', { latest, current: formatInstalledVersion() })}
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
          <AppText variant="small" align="center">
            {t('updateInstallHint')}
          </AppText>
          <View style={[styles.actions, row]}>
            {!release.mandatory ? <Button title={t('updateLater')} variant="outline" onPress={dismiss} style={{ flex: 1 }} /> : null}
            <Button title={t('updateDownload')} variant="action" icon="download" onPress={() => void download()} style={{ flex: 1 }} />
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

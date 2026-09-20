import React, { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText, Button, Card, Screen, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { menuBaseUrl, menuUrl } from '@/features/qr/qrRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { regenerateMenuToken, setDefaultMenu } from '@/features/auth/authApi';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';

export default function QrScreen() {
  const t = useT();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const refresh = useAuthStore((s) => s.refreshProfile);
  const online = useSyncStore((s) => s.online);
  const [busy, setBusy] = useState(false);
  const settings = getSettings();
  const url = menuUrl(profile?.menu_token ?? null);

  const regenerate = async () => {
    if (!(await confirm(t('regenerateCode'), t('regenerateCodeConfirm'), t('confirm'), t('cancel'), true))) return;
    setBusy(true);
    try {
      await regenerateMenuToken();
      await refresh();
      toast.success(t('codeRegenerated'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleDefault = async (v: boolean) => {
    setBusy(true);
    try {
      await setDefaultMenu(v);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen safeTop={false} title={t('qrTitle')} subtitle={t('qrTokenHint')}>
      {!menuBaseUrl() ? (
        <Card tone="highlight">
          <AppText color={colors.accentDark}>{t('publicMenuUrlMissing')}</AppText>
        </Card>
      ) : url ? (
        <Card>
          <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
            <View style={{ padding: spacing.lg, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
              <QRCode value={url} size={260} color={colors.accentDark} backgroundColor={colors.white} />
            </View>
            <AppText variant="title" align="center">
              {settings.restaurant_name}
            </AppText>
            <AppText variant="small" align="center">
              {t('scanToOrder')}
            </AppText>
            <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
              <AppText variant="label" style={{ textTransform: 'uppercase' }}>
                {t('qrMenuLink')}
              </AppText>
              <AppText variant="mono" selectable>
                {url}
              </AppText>
            </View>
            <View style={[row, { gap: spacing.sm }]}>
              <Button title={t('copyLink')} variant="outline" icon="share-2" onPress={() => void Share.share({ message: url })} />
              <Button title={t('regenerateCode')} variant="ghost" icon="refresh-cw" onPress={regenerate} loading={busy} disabled={!online} />
            </View>
          </View>
        </Card>
      ) : null}

      <Card title={t('menuCode')}>
        <AppText variant="mono">{profile?.menu_token ?? '-'}</AppText>
        <View style={{ height: spacing.sm }} />
        <Toggle label={t('defaultMenu')} hint={t('defaultMenuHint')} value={!!profile?.menu_is_default} onChange={toggleDefault} disabled={busy || !online} />
        <AppText variant="small" style={{ marginTop: spacing.sm }}>
          {t('qrSingleHint')}
        </AppText>
      </Card>
    </Screen>
  );
}

import React from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { menuUrl } from '@/features/qr/qrRepo';
import { getSettings } from '@/features/settings/settingsRepo';

export default function QrScreen() {
  const t = useT();
  const url = menuUrl();
  const settings = getSettings();

  return (
    <Screen safeTop={false} title={t('qrTitle')} subtitle={t('qrSingleHint')}>
      {!url ? (
        <Card tone="highlight">
          <AppText color={colors.accentDark}>{t('publicMenuUrlMissing')}</AppText>
        </Card>
      ) : (
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
            <Button title={t('copyLink')} variant="outline" icon="share-2" onPress={() => void Share.share({ message: url })} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

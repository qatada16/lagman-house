import React from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useSyncStore } from '@/store/syncStore';
import { runSync } from '@/features/sync/syncEngine';
import { relativeTime } from '@/lib/format';

export function SyncPanel() {
  const t = useT();
  const { row } = useLayout();
  const { status, online, lastSyncAt, pendingCount, lastError } = useSyncStore();
  return (
    <Card title={t('dataSync')} right={<Badge label={online ? t('online') : t('offline')} tone={online ? 'success' : 'danger'} />}>
      <View style={{ gap: spacing.xs }}>
        <AppText>{`${t('lastSynced')}: ${relativeTime(lastSyncAt, t('never'))}`}</AppText>
        <AppText variant="small">{t('pendingChanges', { n: pendingCount })}</AppText>
        {status === 'error' && lastError ? (
          <AppText variant="small" color={colors.danger}>
            {`${t('syncFailed')}: ${lastError}`}
          </AppText>
        ) : null}
      </View>
      <View style={[row, { marginTop: spacing.md }]}>
        <Button title={status === 'syncing' ? t('syncing') : t('syncNow')} icon="refresh-cw" loading={status === 'syncing'} onPress={() => void runSync('manual')} disabled={!online} />
      </View>
    </Card>
  );
}

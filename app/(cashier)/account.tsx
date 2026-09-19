import React from 'react';
import { Screen } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { SyncIndicator } from '@/components/Indicators';
import { useT } from '@/lib/i18n';

export default function CashierAccountScreen() {
  const t = useT();
  return (
    <Screen title={t('accountTitle')} actions={<SyncIndicator />}>
      <AccountPanel />
    </Screen>
  );
}

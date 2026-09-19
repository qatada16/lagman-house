import React from 'react';
import { Screen } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { useT } from '@/lib/i18n';

export default function AdminAccountScreen() {
  const t = useT();
  return (
    <Screen title={t('accountTitle')}>
      <AccountPanel />
    </Screen>
  );
}

import React from 'react';
import { Card, Screen } from '@/components/ui';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PrinterPanel } from '@/features/printer/PrinterPanel';
import { SyncPanel } from '@/features/settings/SyncPanel';
import { useT } from '@/lib/i18n';

export default function CashierSettingsScreen() {
  const t = useT();
  return (
    <Screen title={t('settingsTitle')}>
      <PrinterPanel />
      <Card title={t('language')}>
        <LanguageToggle />
      </Card>
      <SyncPanel />
    </Screen>
  );
}

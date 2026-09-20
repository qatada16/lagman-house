import React from 'react';
import { Screen } from '@/components/ui';
import { PrinterPanel } from '@/features/printer/PrinterPanel';
import { useT } from '@/lib/i18n';

export default function PrinterScreen() {
  const t = useT();
  return (
    <Screen safeTop={false} title={t('printerTitle')} subtitle={t('printerHint')}>
      <PrinterPanel />
    </Screen>
  );
}

import React from 'react';
import { PosScreen } from '@/features/orders/PosScreen';
import { useT } from '@/lib/i18n';

export default function CashierMenuScreen() {
  const t = useT();
  return <PosScreen title={t('tabMenu')} cartPath="/(cashier)/cart" printerPath="/(cashier)/settings" queuePath="/(cashier)/queue" />;
}

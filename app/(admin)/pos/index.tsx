import React from 'react';
import { PosScreen } from '@/features/orders/PosScreen';
import { useT } from '@/lib/i18n';

export default function AdminPosScreen() {
  const t = useT();
  return <PosScreen title={t('navPos')} cartPath="/(admin)/pos/cart" printerPath="/(admin)/printer" queuePath="/(admin)/queue" safeTop={false} />;
}

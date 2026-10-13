import React from 'react';
import { WebOrdersScreen } from '@/features/webOrders/WebOrdersScreen';

export default function AdminWebOrders() {
  return <WebOrdersScreen basePath="/(admin)/queue" safeTop={false} closable={false} />;
}

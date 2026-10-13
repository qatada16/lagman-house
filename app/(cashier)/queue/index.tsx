import React from 'react';
import { WebOrdersScreen } from '@/features/webOrders/WebOrdersScreen';

export default function CashierWebOrders() {
  return <WebOrdersScreen basePath="/(cashier)/queue" />;
}

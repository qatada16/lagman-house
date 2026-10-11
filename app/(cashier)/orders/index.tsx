import React from 'react';
import { RecentOrdersScreen } from '@/features/orders/RecentOrdersScreen';

export default function CashierRecentOrders() {
  return <RecentOrdersScreen editPath={(id) => `/(cashier)/orders/${id}`} />;
}

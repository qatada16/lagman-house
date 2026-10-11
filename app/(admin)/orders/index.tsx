import React from 'react';
import { RecentOrdersScreen } from '@/features/orders/RecentOrdersScreen';

export default function AdminRecentOrders() {
  return <RecentOrdersScreen safeTop={false} editPath={(id) => `/(admin)/orders/${id}`} />;
}

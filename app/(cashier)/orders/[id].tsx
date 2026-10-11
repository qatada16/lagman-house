import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EditOrderScreen } from '@/features/orders/EditOrderScreen';

export default function CashierEditOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditOrderScreen key={id} orderId={id} backPath="/(cashier)/orders" />;
}

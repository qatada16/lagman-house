import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { WebOrderScreen } from '@/features/webOrders/WebOrderScreen';

export default function AdminWebOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WebOrderScreen key={id} orderId={id} basePath="/(admin)/queue" safeTop={false} />;
}

import React from 'react';
import { CheckoutScreen } from '@/features/orders/CheckoutScreen';

export default function AdminCheckout() {
  return <CheckoutScreen menuPath="/(admin)/pos" safeTop={false} />;
}

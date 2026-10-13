import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { CashierTabBar } from '@/components/CashierTabBar';
import { InsetHandled } from '@/components/ui';
import { WebOrderBar, useOpenWebOrderCount } from '@/components/WebOrderBar';

export default function CashierLayout() {
  const webOrders = useOpenWebOrderCount();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebOrderBar basePath="/(cashier)/queue" padTop />
      <View style={{ flex: 1 }}>
        <InsetHandled bottom top={webOrders > 0}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />
        </InsetHandled>
      </View>
      <CashierTabBar />
    </View>
  );
}

import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { CashierTabBar } from '@/components/CashierTabBar';

export default function CashierLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />
      </View>
      <CashierTabBar />
    </View>
  );
}

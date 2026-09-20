import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { AdminDrawer, AdminTopBar } from '@/components/AdminDrawer';

export default function AdminLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AdminTopBar />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
      </View>
      <AdminDrawer />
    </View>
  );
}

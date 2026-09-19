import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { AdminSidebar } from '@/components/AdminSidebar';
import { useLayout } from '@/lib/i18n';

export default function AdminLayout() {
  const { row } = useLayout();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, row]}>
      <AdminSidebar />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
      </View>
    </View>
  );
}

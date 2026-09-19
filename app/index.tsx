import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { areaFor } from '@/features/auth/useAuthGate';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }
  const area = areaFor(status, profile);
  if (area === 'auth') return <Redirect href="/(auth)/login" />;
  if (area === 'pending') return <Redirect href="/pending" />;
  if (area === 'admin') return <Redirect href="/(admin)" />;
  return <Redirect href="/(cashier)" />;
}

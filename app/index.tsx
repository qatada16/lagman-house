import React from 'react';
import { Redirect } from 'expo-router';
import { SkeletonScreen } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { areaFor } from '@/features/auth/useAuthGate';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const resolving = useAuthStore((s) => s.resolving);
  if (status === 'loading' || resolving) return <SkeletonScreen />;
  const area = areaFor(status, profile);
  if (area === 'auth') return <Redirect href="/(auth)/login" />;
  if (area === 'pending') return <Redirect href="/pending" />;
  if (area === 'admin') return <Redirect href="/(admin)" />;
  return <Redirect href="/(cashier)" />;
}

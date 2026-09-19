import { useEffect } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export type Area = 'auth' | 'admin' | 'cashier' | 'pending';

export function areaFor(status: string, profile: { role: string; status: string } | null): Area {
  if (status !== 'signedIn' || !profile) return 'auth';
  if (profile.status !== 'active') return 'pending';
  return profile.role === 'admin' ? 'admin' : 'cashier';
}

const SHARED_SEGMENTS = new Set(['phone']);

export function useAuthGate() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const segments = useSegments();
  const router = useRouter();
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (status === 'loading' || !navReady) return;
    const area = areaFor(status, profile);
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    const inAdmin = first === '(admin)';
    const inCashier = first === '(cashier)';
    const inPending = first === 'pending';
    const inShared = !!first && SHARED_SEGMENTS.has(first);

    if (area === 'auth') {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }
    if (area === 'pending') {
      if (!inPending) router.replace('/pending');
      return;
    }
    if (inShared) return;
    if (area === 'admin' && !inAdmin) router.replace('/(admin)');
    if (area === 'cashier' && !inCashier) router.replace('/(cashier)');
  }, [status, profile, segments, router, navReady]);
}

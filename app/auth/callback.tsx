import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SkeletonScreen } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';

// Landing route for lagmanhouse://auth/callback. The URL listener in useAppServices
// exchanges the tokens; this screen only waits, then the auth gate routes onward.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    const id = setTimeout(() => {
      if (useAuthStore.getState().status !== 'signedIn') router.replace('/(auth)/login');
    }, 8000);
    return () => clearTimeout(id);
  }, [router, status]);

  return <SkeletonScreen />;
}

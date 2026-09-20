import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/constants/theme';
import { AppText } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';

// Landing route for lagmanhouse://auth/callback. The URL listener in useAppServices
// exchanges the tokens; this screen only waits, then the auth gate routes onward.
export default function AuthCallbackScreen() {
  const t = useT();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    const id = setTimeout(() => {
      if (useAuthStore.getState().status !== 'signedIn') router.replace('/(auth)/login');
    }, 8000);
    return () => clearTimeout(id);
  }, [router, status]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.action} />
      <AppText variant="small">{t('loading')}</AppText>
    </View>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AuthFrame } from '@/components/AuthFrame';
import { AppText, Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { describeAuthError, resendSignupCode, signIn, uploadAvatarAndSave } from '@/features/auth/authApi';
import { useCooldown } from '@/features/auth/useCooldown';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const POLL_MS = 5000;

// The confirmation email carries a link. Same phone: the deep link sets the session.
// Other device: we poll a password login until Supabase reports the email as confirmed.
export default function VerifyEmailScreen() {
  const t = useT();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const credentials = useAuthStore((s) => s.pendingCredentials);
  const status = useAuthStore((s) => s.status);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const cooldown = useCooldown(60);
  const finished = useRef(false);

  useEffect(() => {
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    if (finished.current) return;
    finished.current = true;
    const { pendingPhotoUri, session } = useAuthStore.getState();
    const userId = session?.user.id;
    if (pendingPhotoUri && userId) {
      uploadAvatarAndSave(userId, pendingPhotoUri).catch(() => undefined);
      useAuthStore.getState().setPendingPhoto(null);
    }
    useAuthStore.getState().setPendingCredentials(null);
  };

  useEffect(() => {
    if (status === 'signedIn') void finish();
  }, [status]);

  const tryLogin = async (manual: boolean) => {
    if (!credentials || finished.current) return;
    if (manual) setChecking(true);
    try {
      const session = await signIn(credentials.email, credentials.password);
      if (session) await useAuthStore.getState().applySession(session);
    } catch (e) {
      const kind = describeAuthError((e as Error).message);
      if (manual) setError(kind === 'emailNotConfirmed' ? t('waitingConfirmation') : kind === 'error' ? (e as Error).message : t(kind));
    } finally {
      if (manual) setChecking(false);
    }
  };

  useEffect(() => {
    if (!credentials) return;
    const id = setInterval(() => void tryLogin(false), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  const resend = async () => {
    if (!email) return;
    try {
      await resendSignupCode(email);
      toast.success(t('codeSent'));
      cooldown.start();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AuthFrame title={t('verifyEmailTitle')} subtitle={t('verifyEmailBody', { email: email ?? '' })}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <Feather name="mail" size={40} color={colors.action} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator color={colors.surfaceMuted} size="small" />
          <AppText variant="small">{t('waitingConfirmation')}</AppText>
        </View>
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger} align="center">
          {error}
        </AppText>
      ) : null}
      <AppText variant="small" align="center">
        {t('confirmedElsewhereHint')}
      </AppText>
      <Button title={t('iConfirmed')} onPress={() => void tryLogin(true)} loading={checking} disabled={!credentials} size="lg" />
      <Button title={cooldown.ready ? t('resendLink') : t('resendIn', { s: cooldown.remaining })} variant="ghost" onPress={resend} disabled={!cooldown.ready} />
      <Button title={t('back')} variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </AuthFrame>
  );
}

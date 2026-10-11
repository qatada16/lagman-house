import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { AuthFrame } from '@/components/AuthFrame';
import { AppText, Button, Input } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { describeAuthError, requestPasswordReset, retryAfterSeconds, validateEmail } from '@/features/auth/authApi';
import { useCooldown } from '@/features/auth/useCooldown';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { toast } from '@/store/toastStore';

export default function ForgotPasswordScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const online = useSyncStore((s) => s.online);
  const [email, setEmail] = useState(params.email && params.email.includes('@') ? params.email : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cooldown = useCooldown(60);

  useEffect(() => {
    if (useAuthStore.getState().recovery === 'invalid') useAuthStore.getState().setRecovery(null);
  }, []);

  const send = async (resend = false) => {
    const address = (resend && sentTo ? sentTo : email).trim().toLowerCase();
    if (!validateEmail(address)) {
      setError(t('invalidEmail'));
      return;
    }
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      setError(t('noInternet'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
      cooldown.start();
      if (resend) toast.success(t('resetLinkResent'));
    } catch (e) {
      const message = (e as Error).message;
      const kind = describeAuthError(message);
      if (kind === 'tooManyRequests') {
        const wait = retryAfterSeconds(message);
        if (wait) cooldown.start(wait);
        setError(wait ? t('resendIn', { s: wait }) : t('tooManyRequests'));
      } else {
        setError(kind === 'error' ? `${t('error')}: ${message}` : t(kind));
      }
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthFrame title={t('resetSentTitle')}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Feather name="mail" size={40} color={colors.action} />
        </View>
        <AppText align="center">{t('resetSentBody', { email: sentTo })}</AppText>
        <AppText variant="small" align="center">
          {t('resetLinkNote')}
        </AppText>
        {error ? (
          <AppText variant="small" color={colors.danger} align="center">
            {error}
          </AppText>
        ) : null}
        <Button
          title={cooldown.ready ? t('resendLink') : t('resendIn', { s: cooldown.remaining })}
          variant="outline"
          onPress={() => void send(true)}
          loading={loading}
          disabled={!cooldown.ready || !online}
        />
        <Button title={t('useDifferentEmail')} variant="ghost" onPress={() => { setSentTo(null); setError(null); }} />
        <Button title={t('backToLogin')} variant="ghost" onPress={() => router.replace('/(auth)/login')} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t('forgotTitle')} subtitle={t('forgotSubtitle')}>
      <Input
        label={t('email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={() => void send()}
      />
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      <Button
        title={!online ? t('noInternet') : cooldown.ready ? t('sendResetLink') : t('resendIn', { s: cooldown.remaining })}
        onPress={() => void send()}
        loading={loading}
        size="lg"
        disabled={!online || !cooldown.ready}
      />
      <Button title={t('backToLogin')} variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </AuthFrame>
  );
}

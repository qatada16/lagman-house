import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OtpInput } from '@/components/OtpInput';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { describeAuthError, startPhoneLink, verifyPhoneCode } from '@/features/auth/authApi';
import { useCooldown } from '@/features/auth/useCooldown';
import { toast } from '@/store/toastStore';

export default function VerifyPhoneScreen() {
  const t = useT();
  const router = useRouter();
  const { phone, country, digits } = useLocalSearchParams<{ phone: string; country: string; digits: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useCooldown(45);

  useEffect(() => {
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value: string) => {
    if (!phone || value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await verifyPhoneCode(phone, value);
      toast.success(t('phoneLinked'));
      router.dismissTo?.('/');
      router.replace('/');
    } catch (e) {
      const kind = describeAuthError((e as Error).message);
      setError(kind === 'error' ? (e as Error).message : t(kind));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!phone) return;
    try {
      await startPhoneLink(phone);
      toast.success(t('codeSent'));
      cooldown.start();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Screen title={t('verifyPhoneTitle')} subtitle={t('verifyPhoneBody', { phone: phone ?? '' })}>
      <Card>
        <View style={{ paddingVertical: spacing.md }}>
          <OtpInput value={code} onChange={setCode} onComplete={verify} />
        </View>
        {error ? (
          <AppText variant="small" color={colors.danger} align="center">
            {error}
          </AppText>
        ) : null}
        <Button title={t('verify')} onPress={() => verify(code)} loading={loading} disabled={code.length !== 6} />
        <Button title={cooldown.ready ? t('resendCode') : t('resendIn', { s: cooldown.remaining })} variant="ghost" onPress={resend} disabled={!cooldown.ready} />
        <Button
          title={t('changeNumber')}
          variant="outline"
          onPress={() => router.replace({ pathname: '/phone/link', params: { country: country ?? 'PK', digits: digits ?? '' } })}
        />
      </Card>
    </Screen>
  );
}

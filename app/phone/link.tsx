import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { PhoneField } from '@/features/auth/PhoneField';
import { useT } from '@/lib/i18n';
import { colors } from '@/constants/theme';
import { describeAuthError, startPhoneLink, toE164 } from '@/features/auth/authApi';
import { COUNTRIES } from '@/features/auth/countries';

export default function LinkPhoneScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ country?: string; digits?: string }>();
  const [country, setCountry] = useState(params.country ?? 'PK');
  const [digits, setDigits] = useState(params.digits ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (digits.length < 6) {
      setError(t('phoneTooShort'));
      return;
    }
    const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? '';
    const phone = toE164(dial, digits);
    setLoading(true);
    setError(null);
    try {
      await startPhoneLink(phone);
      router.push({ pathname: '/phone/verify', params: { phone, country, digits } });
    } catch (e) {
      const err = e as Error;
      if (err.name === 'PhoneInUse') setError(t('phoneAlreadyInUse'));
      else {
        const kind = describeAuthError(err.message);
        setError(kind === 'smsProviderMissing' ? t('smsProviderMissing') : err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={t('linkPhone')} subtitle={t('linkPhoneHint')}>
      <Card>
        <PhoneField countryCode={country} onCountryChange={setCountry} digits={digits} onDigitsChange={setDigits} error={error} />
        {error && error === t('smsProviderMissing') ? (
          <AppText variant="small" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
        <Button title={t('sendCode')} onPress={send} loading={loading} style={{ marginTop: 12 }} />
        <Button title={t('cancel')} variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

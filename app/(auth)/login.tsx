import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { AuthFrame } from '@/components/AuthFrame';
import { AppText, Button, Input } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { describeAuthError, signIn } from '@/features/auth/authApi';

export default function LoginScreen() {
  const t = useT();
  const { row } = useLayout();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError(t('fieldRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (e) {
      const kind = describeAuthError((e as Error).message);
      setError(kind === 'error' ? `${t('loginFailed')}: ${(e as Error).message}` : t(kind));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title={t('welcomeBack')} subtitle={t('loginSubtitle')}>
      <Input
        label={t('emailOrPhone')}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        hint={t('emailOrPhoneHint')}
        textContentType="username"
      />
      <Input
        label={t('password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={submit}
        right={
          <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
            <AppText variant="small" color={colors.action}>
              {showPw ? 'Hide' : 'Show'}
            </AppText>
          </Pressable>
        }
      />
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      <Button title={t('login')} onPress={submit} loading={loading} size="lg" />
      <View style={[row, { gap: spacing.xs, justifyContent: 'center', marginTop: spacing.sm }]}>
        <AppText variant="small">{t('noAccount')}</AppText>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <AppText variant="small" color={colors.action} weight="600">
              {t('signup')}
            </AppText>
          </Pressable>
        </Link>
      </View>
    </AuthFrame>
  );
}

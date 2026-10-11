import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { AuthFrame } from '@/components/AuthFrame';
import { AppText, Button, Input } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { describeAuthError, updatePassword, validatePassword } from '@/features/auth/authApi';
import { recoveryAwaitingChoice, recoveryCancelKeepsSession } from '@/features/auth/recovery';
import { rememberAccount } from '@/features/auth/rememberedAccount';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const PENDING_TIMEOUT_MS = 15000;

export default function ResetPasswordScreen() {
  const t = useT();
  const router = useRouter();
  const recovery = useAuthStore((s) => s.recovery);
  const status = useAuthStore((s) => s.status);
  const resolving = useAuthStore((s) => s.resolving);
  const session = useAuthStore((s) => s.session);
  const setRecovery = useAuthStore((s) => s.setRecovery);
  const [password, setPassword] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recovery !== 'pending') return;
    const id = setTimeout(() => {
      if (useAuthStore.getState().recovery === 'pending' && !recoveryAwaitingChoice()) setRecovery('invalid');
    }, PENDING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [recovery, setRecovery]);

  const ready = recovery === 'active' && status === 'signedIn' && !resolving && !!session;

  const save = async () => {
    const next: typeof errors = {};
    if (!validatePassword(password)) next.password = t('passwordRules');
    if (confirmValue !== password) next.confirm = t('passwordMismatch');
    setErrors(next);
    if (next.password || next.confirm) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      setErrors({ form: t('noInternet') });
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      setRecovery(null);
      toast.success(t('passwordResetDone'));
      const { profile } = useAuthStore.getState();
      const { data } = await supabase.auth.getSession();
      if (profile && data.session && data.session.user.id === profile.id) await rememberAccount(profile, data.session.refresh_token).catch(() => undefined);
    } catch (e) {
      const message = (e as Error).message;
      const kind = describeAuthError(message);
      if (kind === 'resetInvalid' || kind === 'wrongCode') setRecovery('invalid');
      else setErrors({ form: kind === 'error' ? `${t('error')}: ${message}` : t(kind) });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (recoveryCancelKeepsSession()) setRecovery(null);
    else await useAuthStore.getState().signOut();
  };

  if (recovery === 'invalid') {
    return (
      <AuthFrame title={t('resetLinkProblem')}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <Feather name="alert-circle" size={40} color={colors.danger} />
        </View>
        <AppText align="center">{t('resetInvalid')}</AppText>
        {status !== 'signedIn' ? <Button title={t('sendNewLink')} size="lg" onPress={() => router.replace('/(auth)/forgot-password')} /> : null}
        <Button title={t('back')} variant="ghost" onPress={() => setRecovery(null)} />
      </AuthFrame>
    );
  }

  if (!ready) {
    return (
      <AuthFrame title={t('resetTitle')}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.action} />
          <AppText variant="small">{t('resetVerifying')}</AppText>
        </View>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t('resetTitle')} subtitle={session?.user.email ? t('resetFor', { email: session.user.email }) : undefined}>
      <Input
        label={t('newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        error={errors.password}
        hint={t('passwordRules')}
        right={
          <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
            <AppText variant="small" color={colors.action}>
              {showPw ? t('hide') : t('show')}
            </AppText>
          </Pressable>
        }
      />
      <Input
        label={t('confirmPassword')}
        value={confirmValue}
        onChangeText={setConfirmValue}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        error={errors.confirm}
        onSubmitEditing={() => void save()}
      />
      {errors.form ? (
        <AppText variant="small" color={colors.danger}>
          {errors.form}
        </AppText>
      ) : null}
      <Button title={t('savePassword')} size="lg" onPress={() => void save()} loading={saving} />
      <Button title={t('cancel')} variant="ghost" onPress={() => void cancel()} disabled={saving} />
    </AuthFrame>
  );
}

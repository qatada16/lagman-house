import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AuthFrame } from '@/components/AuthFrame';
import { Avatar } from '@/components/Indicators';
import { AppText, Button, Input } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { signUp, validateEmail, validatePassword } from '@/features/auth/authApi';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import type { Role } from '@/lib/types';

export default function SignupScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const lang = useLanguageStore((s) => s.lang);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('fieldRequired');
    if (!validateEmail(email)) next.email = t('invalidEmail');
    if (!validatePassword(password)) next.password = t('passwordRules');
    if (password !== confirm) next.confirm = t('passwordMismatch');
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await signUp({ name, email, password, role, language: lang });
      useAuthStore.getState().setPendingPhoto(photo);
      router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setErrors({ form: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title={t('createAccount')} subtitle={t('signupSubtitle')}>
      <View style={[row, { alignItems: 'center', gap: spacing.md }]}>
        <Avatar uri={photo} name={name} size={56} />
        <View style={{ gap: 4 }}>
          <AppText variant="label" style={{ textTransform: 'uppercase' }}>
            {t('photoOptional')}
          </AppText>
          <View style={[row, { gap: spacing.sm }]}>
            <Button title={t('choosePhoto')} variant="outline" size="sm" onPress={pickPhoto} />
            {photo ? <Button title={t('removePhoto')} variant="ghost" size="sm" onPress={() => setPhoto(null)} /> : null}
          </View>
        </View>
      </View>
      <Input label={t('name')} value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <Input label={t('email')} value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
      <Input label={t('password')} value={password} onChangeText={setPassword} error={errors.password} hint={t('passwordRules')} secureTextEntry autoCapitalize="none" />
      <Input label={t('confirmPassword')} value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" />

      <AppText variant="label" style={{ textTransform: 'uppercase' }}>
        {t('role')}
      </AppText>
      <View style={[row, { gap: spacing.sm }]}>
        {(['cashier', 'admin'] as Role[]).map((r) => {
          const active = role === r;
          return (
            <Pressable key={r} onPress={() => setRole(r)} style={[styles.roleCard, active ? styles.roleActive : null]}>
              <AppText weight="700" color={active ? colors.textOnDark : colors.textPrimary}>
                {r === 'admin' ? t('roleAdmin') : t('roleCashier')}
              </AppText>
              <AppText variant="small" color={active ? colors.textOnDark : colors.textSecondary}>
                {r === 'admin' ? t('roleAdminHint') : t('roleCashierHint')}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {errors.form ? (
        <AppText variant="small" color={colors.danger}>
          {errors.form}
        </AppText>
      ) : null}
      <Button title={t('createAccount')} onPress={submit} loading={loading} size="lg" />
      <View style={[row, { gap: spacing.xs, justifyContent: 'center', marginTop: spacing.sm }]}>
        <AppText variant="small">{t('haveAccount')}</AppText>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <AppText variant="small" color={colors.action} weight="600">
              {t('login')}
            </AppText>
          </Pressable>
        </Link>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  roleCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4, backgroundColor: colors.background },
  roleActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
});

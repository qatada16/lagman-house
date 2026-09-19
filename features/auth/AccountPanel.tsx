import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, Input, statusTone } from '@/components/ui';
import { Avatar } from '@/components/Indicators';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { updateOwnProfileLocal } from './profileRepo';
import { updatePassword, uploadAvatarAndSave, validatePassword } from './authApi';
import { pickImage } from '@/features/menu/useImagePick';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/format';
import { toast } from '@/store/toastStore';

export function AccountPanel() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const online = useSyncStore((s) => s.online);
  const [name, setName] = useState(profile?.name ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const saveName = () => {
    if (!name.trim()) return;
    updateOwnProfileLocal(profile.id, { name: name.trim() });
    useAuthStore.setState({ profile: { ...profile, name: name.trim() } });
    toast.success(t('profileSaved'));
  };

  const changePhoto = async () => {
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    if (!online) {
      toast.error(t('requiresInternet'));
      return;
    }
    setBusy(true);
    try {
      await uploadAvatarAndSave(profile.id, uri);
      toast.success(t('profileSaved'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!validatePassword(password)) {
      toast.error(t('passwordRules'));
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setPassword('');
      toast.success(t('passwordUpdated'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (await confirm(t('logout'), t('logoutConfirm'), t('logout'), t('cancel'), true)) await signOut();
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <View style={[row, { gap: spacing.lg, alignItems: 'center' }]}>
          <Avatar uri={profile.photo_url} name={profile.name} size={72} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{profile.name}</AppText>
            <View style={[row, { gap: spacing.sm }]}>
              <Badge label={profile.role === 'admin' ? t('roleAdmin') : t('roleCashier')} tone="dark" />
              <Badge label={t(profile.status)} tone={statusTone(profile.status)} />
            </View>
            <AppText variant="small">{t('memberSince', { date: formatDate(profile.created_at) })}</AppText>
          </View>
        </View>
        <Button title={t('changePhoto')} variant="outline" size="sm" icon="camera" onPress={changePhoto} loading={busy} style={{ marginTop: spacing.md }} />
      </Card>

      <Card title={t('accountTitle')}>
        <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
          <Input label={t('name')} value={name} onChangeText={setName} containerStyle={{ flex: 1 }} />
          <Button title={t('save')} size="md" onPress={saveName} disabled={name.trim() === profile.name} />
        </View>
        <View style={{ height: spacing.sm }} />
        <Input label={t('email')} value={profile.email ?? ''} editable={false} />
        <View style={{ height: spacing.sm }} />
        <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
          <Input label={t('phone')} value={profile.phone_confirmed && profile.phone ? profile.phone : t('phoneNotLinked')} editable={false} containerStyle={{ flex: 1 }} />
          <Button title={profile.phone_confirmed ? t('changePhone') : t('linkPhoneNumber')} variant="outline" onPress={() => router.push('/phone/link')} disabled={!online} />
        </View>
        {profile.phone_confirmed ? (
          <AppText variant="small" color={colors.success} style={{ marginTop: spacing.xs }}>
            {t('phoneLinked')}
          </AppText>
        ) : (
          <AppText variant="small" style={{ marginTop: spacing.xs }}>
            {t('linkPhoneHint')}
          </AppText>
        )}
      </Card>

      <Card title={t('password')}>
        <View style={[row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
          <Input label={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry containerStyle={{ flex: 1 }} hint={t('passwordRules')} />
          <Button title={t('updatePassword')} onPress={changePassword} loading={busy} disabled={!password || !online} />
        </View>
      </Card>

      <Card title={t('language')}>
        <LanguageToggle />
      </Card>

      <Button title={t('logout')} variant="danger" icon="log-out" onPress={logout} />
    </View>
  );
}

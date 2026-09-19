import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AppText, Badge, Button, Card, Screen, statusTone } from '@/components/ui';
import { Avatar, SyncIndicator } from '@/components/Indicators';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/format';

// Locked screen for cashiers who are not active. Only Account (read-only) and Logout are reachable.
export default function PendingScreen() {
  const t = useT();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const refresh = useAuthStore((s) => s.refreshProfile);
  if (!profile) return null;

  const copy =
    profile.status === 'rejected'
      ? { title: t('pendingRejectedTitle'), body: t('pendingRejectedBody'), icon: 'x-circle' as const, color: colors.danger }
      : profile.status === 'suspended'
        ? { title: t('pendingSuspendedTitle'), body: t('pendingSuspendedBody'), icon: 'slash' as const, color: colors.danger }
        : { title: t('pendingTitle'), body: t('pendingBody'), icon: 'clock' as const, color: colors.action };

  const logout = async () => {
    if (await confirm(t('logout'), t('logoutConfirm'), t('logout'), t('cancel'), true)) await signOut();
  };

  return (
    <Screen>
      <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Image source={require('@/assets/brand/logo.png')} style={{ width: 64, height: 64 }} contentFit="contain" />
        <LanguageToggle />
      </View>
      <Card>
        <View style={styles.iconWrap}>
          <Feather name={copy.icon} size={36} color={copy.color} />
        </View>
        <AppText variant="title" align="center">
          {copy.title}
        </AppText>
        <AppText align="center" style={{ marginTop: spacing.sm }}>
          {copy.body}
        </AppText>
        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <Badge label={t(profile.status)} tone={statusTone(profile.status)} />
        </View>
        <Button title={t('refresh')} variant="outline" icon="refresh-cw" onPress={() => void refresh()} style={{ marginTop: spacing.lg }} />
      </Card>

      <Card title={t('accountTitle')}>
        <View style={[row, { gap: spacing.md, alignItems: 'center' }]}>
          <Avatar uri={profile.photo_url} name={profile.name} size={52} />
          <View style={{ flex: 1 }}>
            <AppText weight="700">{profile.name}</AppText>
            <AppText variant="small">{profile.email}</AppText>
            {profile.phone_confirmed && profile.phone ? <AppText variant="small">{profile.phone}</AppText> : null}
            <AppText variant="small">{t('memberSince', { date: formatDate(profile.created_at) })}</AppText>
          </View>
        </View>
        <AppText variant="small" style={{ marginTop: spacing.md }}>
          {t('pendingReadOnly')}
        </AppText>
      </Card>

      <SyncIndicator />
      <Button title={t('logout')} variant="danger" icon="log-out" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginBottom: spacing.md },
});

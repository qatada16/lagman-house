import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { AppText, Badge, IconButton } from '@/components/ui';
import { Avatar } from '@/components/Indicators';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { forgetRememberedAccount, getRememberedAccount, quickSignIn, type RememberedAccount } from './rememberedAccount';

interface Props {
  onExpired: (identifier: string) => void;
  onError: (message: string) => void;
}

export function RememberedAccountCard({ onExpired, onError }: Props) {
  const t = useT();
  const { row, isRTL } = useLayout();
  const [account, setAccount] = useState<RememberedAccount | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getRememberedAccount().then(setAccount);
  }, []);

  if (!account) return null;

  const signIn = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      onError(t('noInternet'));
      return;
    }
    setBusy(true);
    try {
      const result = await quickSignIn(`${t('quickLoginPrompt')}: ${account.name}`);
      if (result === 'expired') {
        onExpired(account.email ?? account.phone ?? '');
        setAccount(null);
      } else if (result === 'error') onError(t('noInternet'));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    if (!(await confirm(t('forgetAccount'), t('forgetAccountConfirm', { name: account.name }), t('remove'), t('cancel'), true))) return;
    await forgetRememberedAccount(true);
    setAccount(null);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" style={{ textTransform: 'uppercase' }}>
        {t('rememberedAccount')}
      </AppText>
      <Pressable onPress={() => void signIn()} disabled={busy} style={({ pressed }) => [styles.card, row, pressed ? { opacity: 0.8 } : null]}>
        <Avatar uri={account.photo_url} name={account.name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="700" numberOfLines={1}>
            {account.name}
          </AppText>
          <AppText variant="small" numberOfLines={1}>
            {account.email ?? account.phone ?? ''}
          </AppText>
          <View style={row}>
            <Badge label={account.role === 'admin' ? t('roleAdmin') : t('roleCashier')} tone="dark" />
          </View>
        </View>
        {busy ? <ActivityIndicator color={colors.action} /> : <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={22} color={colors.action} />}
      </Pressable>
      <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <AppText variant="small">{t('useAnotherAccount')}</AppText>
        <IconButton icon="trash-2" size={16} color={colors.surfaceMuted} onPress={() => void forget()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.action,
    backgroundColor: '#FDF3E7',
  },
});

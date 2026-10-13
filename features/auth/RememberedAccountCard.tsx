import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { AppText, Badge } from '@/components/ui';
import { Avatar } from '@/components/Indicators';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { signOutSettled } from '@/store/authStore';
import { forgetRememberedAccount, getRememberedAccounts, quickSignIn, type RememberedAccount } from './rememberedAccount';

interface Props {
  onExpired: (identifier: string) => void;
  onError: (message: string) => void;
}

export function RememberedAccountCard({ onExpired, onError }: Props) {
  const t = useT();
  const { row, isRTL } = useLayout();
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getRememberedAccounts().then(setAccounts);
  }, []);

  if (accounts.length === 0) return null;

  const signIn = async (account: RememberedAccount) => {
    if (busy) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      onError(t('noInternet'));
      return;
    }
    setBusy(account.id);
    try {
      await signOutSettled();
      const result = await quickSignIn(account.id, `${t('quickLoginPrompt')}: ${account.name}`);
      if (result === 'expired') {
        onExpired(account.email ?? account.phone ?? '');
        setAccounts((list) => list.filter((a) => a.id !== account.id));
      } else if (result === 'error') onError(t('noInternet'));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const forget = async (account: RememberedAccount) => {
    if (!(await confirm(t('forgetAccount'), t('forgetAccountConfirm', { name: account.name }), t('remove'), t('cancel'), true))) return;
    await forgetRememberedAccount(account.id, true);
    setAccounts((list) => list.filter((a) => a.id !== account.id));
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" style={{ textTransform: 'uppercase' }}>
        {t('rememberedAccount')}
      </AppText>
      {accounts.map((account) => (
        <View key={account.id} style={[styles.card, row]}>
          <Pressable
            collapsable={false}
            onPress={() => void signIn(account)}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={account.name}
            style={({ pressed }) => [styles.main, row, pressed ? { opacity: 0.75 } : null]}
          >
            <Avatar uri={account.photo_url} name={account.name} size={36} />
            <View style={{ flex: 1 }} pointerEvents="none">
              <View style={[row, { alignItems: 'center', gap: spacing.xs }]}>
                <AppText weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {account.name}
                </AppText>
                <Badge label={account.role === 'admin' ? t('roleAdmin') : t('roleCashier')} tone={account.role === 'admin' ? 'dark' : 'info'} />
              </View>
              <AppText variant="small" numberOfLines={1}>
                {account.email ?? account.phone ?? ''}
              </AppText>
            </View>
            {busy === account.id ? <ActivityIndicator color={colors.action} /> : <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={20} color={colors.action} />}
          </Pressable>
          <Pressable onPress={() => void forget(account)} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('forgetAccount')}>
            <Feather name="x" size={16} color={colors.surfaceMuted} />
          </Pressable>
        </View>
      ))}
      <AppText variant="small" align="center">
        {t('useAnotherAccount')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.action,
    backgroundColor: '#FDF3E7',
  },
  main: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  remove: { paddingHorizontal: spacing.md, alignSelf: 'stretch', justifyContent: 'center' },
});

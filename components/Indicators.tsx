import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout, useT } from '@/lib/i18n';
import { relativeTime } from '@/lib/format';
import { useSyncStore } from '@/store/syncStore';
import { usePrinterStore } from '@/store/printerStore';
import { runSync } from '@/features/sync/syncEngine';
import { AppText } from '@/components/ui';

export function SyncIndicator({ dark }: { dark?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const { status, lastSyncAt, pendingCount, online } = useSyncStore();
  const fg = dark ? colors.textOnDark : colors.surfaceMuted;
  const label =
    status === 'syncing' ? t('syncing') : !online ? t('offline') : status === 'error' ? t('syncFailed') : `${t('lastSynced')}: ${relativeTime(lastSyncAt, t('never'))}`;
  return (
    <Pressable onPress={() => void runSync('manual')} style={[styles.sync, row]}>
      <Feather name={status === 'syncing' ? 'refresh-cw' : !online ? 'cloud-off' : status === 'error' ? 'alert-circle' : 'check-circle'} size={13} color={status === 'error' ? colors.danger : fg} />
      <AppText variant="small" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
        {pendingCount > 0 ? ` (${pendingCount})` : ''}
      </AppText>
    </Pressable>
  );
}

export function PrinterDot({ onPress, showLabel = true }: { onPress?: () => void; showLabel?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const status = usePrinterStore((s) => s.status);
  const device = usePrinterStore((s) => s.device);
  const color = status === 'connected' ? colors.success : status === 'connecting' ? colors.action : colors.danger;
  const label = status === 'connected' ? device?.name ?? t('connected') : status === 'connecting' ? t('connecting') : t('printerNotConnected');
  return (
    <Pressable onPress={onPress} style={[styles.printer, row]}>
      <Feather name="printer" size={14} color={colors.surfaceMuted} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      {showLabel ? (
        <AppText variant="small" numberOfLines={1} style={{ maxWidth: 140 }}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string; size?: number }) {
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText color={colors.textOnDark} weight="700" style={{ fontSize: size * 0.4 }} align="center">
        {initials || '?'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sync: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  printer: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: { backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center' },
});

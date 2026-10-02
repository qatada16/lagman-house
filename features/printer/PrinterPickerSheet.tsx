import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Badge, Button, Sheet } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import { usePrinterStore } from '@/store/printerStore';
import { isLikelyPrinter, type ScannedDevice } from './detect';

export function PrinterPickerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { row } = useLayout();
  const devices = usePrinterStore((s) => s.devices);
  const scanning = usePrinterStore((s) => s.scanning);
  const status = usePrinterStore((s) => s.status);
  const current = usePrinterStore((s) => s.device);
  const lastConnected = usePrinterStore((s) => s.lastConnected);
  const connectingAddress = usePrinterStore((s) => s.connectingAddress);
  const lastError = usePrinterStore((s) => s.lastError);
  const scan = usePrinterStore((s) => s.scan);
  const stopScan = usePrinterStore((s) => s.stopScan);
  const connect = usePrinterStore((s) => s.connect);

  const paired = devices.filter((d) => d.paired);
  const nearby = devices.filter((d) => !d.paired);

  const choose = async (d: ScannedDevice) => {
    const ok = await connect({ name: d.name, address: d.address });
    if (ok) onClose();
  };

  const close = () => {
    if (scanning) stopScan();
    onClose();
  };

  const renderRow = (d: ScannedDevice) => {
    const likely = isLikelyPrinter(d);
    const isLast = lastConnected?.address === d.address;
    const isCurrent = current?.address === d.address && status === 'connected';
    const busy = connectingAddress === d.address;
    return (
      <Pressable
        key={d.address}
        onPress={() => void choose(d)}
        disabled={!!connectingAddress}
        style={({ pressed }) => [styles.row, row, likely ? styles.rowLikely : null, isCurrent ? styles.rowCurrent : null, pressed ? styles.pressed : null]}
      >
        <View style={[styles.icon, { backgroundColor: likely ? colors.action : colors.surfaceSidebar }]}>
          <Feather name={likely ? 'printer' : 'bluetooth'} size={18} color={likely ? colors.white : colors.surfaceMuted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight="700" numberOfLines={1}>
            {d.name}
          </AppText>
          <AppText variant="small">{d.address}</AppText>
          <View style={[row, { gap: spacing.xs, flexWrap: 'wrap' }]}>
            {likely ? <Badge label={t('likelyPrinter')} tone="warning" /> : null}
            {isLast ? <Badge label={t('lastConnected')} tone="info" /> : null}
            {isCurrent ? <Badge label={t('connected')} tone="success" /> : null}
          </View>
        </View>
        {busy ? <ActivityIndicator color={colors.action} /> : <Feather name="chevron-right" size={18} color={colors.surfaceMuted} />}
      </Pressable>
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('selectPrinter')}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          <Button title={t('bluetoothSettings')} variant="outline" icon="settings" onPress={() => void Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => Linking.openSettings())} style={{ flex: 1 }} />
          <Button title={scanning ? t('scanning') : t('scanAgain')} icon="refresh-cw" loading={scanning} onPress={() => void scan()} style={{ flex: 1 }} />
        </View>
      }
    >
      {lastConnected ? (
        <View style={[styles.lastBox, row]}>
          <Feather name="clock" size={16} color={colors.accentDark} />
          <AppText variant="small" style={{ flex: 1 }}>
            {t('lastConnectedTo', { name: lastConnected.name, time: relativeTime(lastConnected.at, t('never')) })}
          </AppText>
        </View>
      ) : null}
      {lastError ? (
        <AppText variant="small" color={colors.danger}>
          {lastError}
        </AppText>
      ) : null}

      <AppText variant="label" style={{ textTransform: 'uppercase' }}>
        {t('pairedDevices')}
      </AppText>
      {paired.length === 0 ? (
        <View style={styles.empty}>
          {scanning ? <ActivityIndicator color={colors.action} /> : <Feather name="bluetooth" size={24} color={colors.surfaceHighlight} />}
          <AppText variant="small" align="center">
            {scanning ? t('scanning') : t('noPairedDevices')}
          </AppText>
        </View>
      ) : (
        paired.map(renderRow)
      )}

      {nearby.length > 0 ? (
        <>
          <AppText variant="label" style={{ textTransform: 'uppercase', marginTop: spacing.sm }}>
            {t('foundDevices')}
          </AppText>
          <AppText variant="small">{t('nearbyPairHint')}</AppText>
          {nearby.map(renderRow)}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  rowLikely: { borderColor: colors.action, borderWidth: 2, backgroundColor: '#FDF3E7' },
  rowCurrent: { borderColor: colors.success },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lastBox: { alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSidebar },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
});

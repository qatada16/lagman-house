import React, { useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { AppText, Button, Card, Input, Screen } from '@/components/ui';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SyncPanel } from '@/features/settings/SyncPanel';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { getSettings, saveSettings } from '@/features/settings/settingsRepo';
import { getDeviceCode, getDeviceId } from '@/lib/device';
import { toast } from '@/store/toastStore';

export default function AdminSettingsScreen() {
  const t = useT();
  const { row } = useLayout();
  const [settings, setSettings] = useState(getSettings);

  const save = () => {
    saveSettings(settings);
    toast.success(t('saved'));
  };

  return (
    <Screen title={t('settingsTitle')}>
      <Card title={t('restaurantName')}>
        <Input label={t('restaurantName')} value={settings.restaurant_name} onChangeText={(v) => setSettings((s) => ({ ...s, restaurant_name: v }))} />
        <View style={{ height: spacing.sm }} />
        <Input label={t('restaurantAddress')} value={settings.restaurant_address} onChangeText={(v) => setSettings((s) => ({ ...s, restaurant_address: v }))} multiline />
        <View style={{ height: spacing.sm }} />
        <Input label={t('currencySymbol')} value={settings.currency_symbol} onChangeText={(v) => setSettings((s) => ({ ...s, currency_symbol: v }))} maxLength={5} />
        <Button title={t('save')} onPress={save} style={{ marginTop: spacing.md }} />
      </Card>
      <Card title={t('language')}>
        <LanguageToggle />
      </Card>
      <SyncPanel />
      <Card title={t('aboutSection')}>
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="small">{t('version')}</AppText>
          <AppText variant="small">{Constants.expoConfig?.version ?? '-'}</AppText>
        </View>
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="small">{t('deviceId')}</AppText>
          <AppText variant="small">{`${getDeviceCode()}  ${getDeviceId().slice(0, 8)}`}</AppText>
        </View>
      </Card>
    </Screen>
  );
}

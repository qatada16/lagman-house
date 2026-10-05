import React from 'react';
import { View } from 'react-native';
import { Input } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';

export function ValidityFields({ from, to, onFrom, onTo, errors }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; errors: Record<string, string> }) {
  const t = useT();
  const { row } = useLayout();
  return (
    <View style={[row, { gap: spacing.sm }]}>
      <Input label={t('validFrom')} value={from} onChangeText={onFrom} placeholder={t('dateTimeFormatHint')} containerStyle={{ flex: 1 }} error={errors.from} hint={t('alwaysValid')} />
      <Input label={t('validTo')} value={to} onChangeText={onTo} placeholder={t('dateTimeFormatHint')} containerStyle={{ flex: 1 }} error={errors.to} />
    </View>
  );
}

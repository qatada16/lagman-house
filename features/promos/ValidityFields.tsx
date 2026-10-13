import React from 'react';
import { View } from 'react-native';
import { DateField } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';

export function ValidityFields({ from, to, onFrom, onTo, errors }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; errors: Record<string, string> }) {
  const t = useT();
  const { row } = useLayout();
  return (
    <View style={[row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
      <DateField label={t('validFrom')} value={from} onChange={onFrom} withTime clearable placeholder={t('alwaysValid')} maxDate={to ? to.slice(0, 10) : undefined} containerStyle={{ flex: 1, minWidth: 150 }} error={errors.from} />
      <DateField label={t('validTo')} value={to} onChange={onTo} withTime endOfDay clearable placeholder={t('alwaysValid')} minDate={from ? from.slice(0, 10) : undefined} containerStyle={{ flex: 1, minWidth: 150 }} error={errors.to} />
    </View>
  );
}

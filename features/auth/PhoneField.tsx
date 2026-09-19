import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Input, Select } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { COUNTRIES } from './countries';

interface Props {
  countryCode: string;
  onCountryChange: (code: string) => void;
  digits: string;
  onDigitsChange: (digits: string) => void;
  error?: string | null;
}

// Searchable country picker plus a digits-only number field (non-digits are rejected on keystroke).
export function PhoneField({ countryCode, onCountryChange, digits, onDigitsChange, error }: Props) {
  const t = useT();
  const { row } = useLayout();
  const options = useMemo(() => COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (+${c.dial})`, hint: c.code })), []);
  const dial = COUNTRIES.find((c) => c.code === countryCode)?.dial ?? '';
  return (
    <View style={{ gap: spacing.sm }}>
      <Select label={t('countryCode')} value={countryCode} options={options} onChange={onCountryChange} searchable placeholder={t('searchCountry')} />
      <View style={[row, { gap: spacing.sm, alignItems: 'flex-start' }]}>
        <Input value={`+${dial}`} editable={false} containerStyle={{ width: 84 }} label=" " />
        <Input
          label={t('phoneNumber')}
          value={digits}
          onChangeText={onDigitsChange}
          digitsOnly
          error={error}
          hint={t('phoneDigitsOnly')}
          containerStyle={{ flex: 1 }}
          maxLength={15}
        />
      </View>
    </View>
  );
}

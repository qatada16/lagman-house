import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Input, Segmented } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { daysAgo, formatDate, parseLocalDate, startOfDay } from '@/lib/format';

export type Range = 'today' | 'date' | '7' | '30' | '90' | 'custom';

export interface Period {
  from: Date;
  to: Date;
}

export function usePeriod(initial: Range = 'today') {
  const [range, setRange] = useState<Range>(initial);
  const [dateText, setDateText] = useState(formatDate(new Date().toISOString()));
  const [fromText, setFromText] = useState(formatDate(daysAgo(7).toISOString()));
  const [toText, setToText] = useState(formatDate(new Date().toISOString()));

  const period: Period = useMemo(() => {
    const end = new Date(Date.now() + 60_000);
    if (range === 'today') return { from: startOfDay(new Date()), to: end };
    if (range === 'date') {
      const d = startOfDay(parseLocalDate(dateText) ?? new Date());
      const to = new Date(d);
      to.setDate(to.getDate() + 1);
      return { from: d, to };
    }
    if (range === 'custom') {
      const from = startOfDay(parseLocalDate(fromText) ?? daysAgo(7));
      const to = new Date(startOfDay(parseLocalDate(toText) ?? new Date()));
      to.setDate(to.getDate() + 1);
      return { from, to };
    }
    return { from: daysAgo(Number(range) - 1), to: end };
  }, [range, dateText, fromText, toText]);

  return { range, setRange, dateText, setDateText, fromText, setFromText, toText, setToText, period };
}

export function PeriodPicker({ state }: { state: ReturnType<typeof usePeriod> }) {
  const t = useT();
  const { row } = useLayout();
  return (
    <View style={{ gap: spacing.sm }}>
      <Segmented<Range>
        label={t('dateRange')}
        value={state.range}
        onChange={state.setRange}
        scroll
        options={[
          { value: 'today', label: t('rangeToday') },
          { value: 'date', label: t('rangeDate') },
          { value: '7', label: t('range7') },
          { value: '30', label: t('range30') },
          { value: '90', label: t('range90') },
          { value: 'custom', label: t('rangeCustom') },
        ]}
      />
      {state.range === 'date' ? <Input label={t('date')} value={state.dateText} onChangeText={state.setDateText} placeholder={t('dateFormatHint')} /> : null}
      {state.range === 'custom' ? (
        <View style={[row, { gap: spacing.sm }]}>
          <Input label={t('from')} value={state.fromText} onChangeText={state.setFromText} placeholder={t('dateFormatHint')} containerStyle={{ flex: 1 }} />
          <Input label={t('to')} value={state.toText} onChangeText={state.setToText} placeholder={t('dateFormatHint')} containerStyle={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

export function periodFileSuffix(p: Period) {
  return `${formatDate(p.from.toISOString())}-to-${formatDate(new Date(p.to.getTime() - 1).toISOString())}`;
}

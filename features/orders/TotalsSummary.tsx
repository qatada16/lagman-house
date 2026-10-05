import React from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { Totals } from '@/features/promos/pricing';

export function TotalsSummary({ totals, currency }: { totals: Totals; currency: string }) {
  const t = useT();
  const { row } = useLayout();
  const line = (label: string, value: string, opts: { muted?: boolean; color?: string; big?: boolean } = {}) => (
    <View style={[row, { justifyContent: 'space-between', paddingVertical: 2 }]}>
      <AppText variant={opts.big ? 'heading' : 'small'} color={opts.color ?? (opts.muted ? colors.textSecondary : colors.textPrimary)}>
        {label}
      </AppText>
      <AppText variant={opts.big ? 'heading' : 'small'} weight={opts.big ? '700' : '500'} color={opts.color ?? colors.textPrimary}>
        {value}
      </AppText>
    </View>
  );
  const showBreakdown = totals.couponDiscount > 0 || totals.itemDiscount > 0;
  return (
    <View style={{ gap: spacing.xs }}>
      {showBreakdown ? line(t('subtotal'), formatMoney(totals.subtotal, currency), { muted: true }) : null}
      {totals.itemDiscount > 0 ? line(t('discountLine'), `-${formatMoney(totals.itemDiscount, currency)}`, { color: colors.success }) : null}
      {totals.couponDiscount > 0 ? line(t('couponLine'), `-${formatMoney(totals.couponDiscount, currency)}`, { color: colors.success }) : null}
      {line(t('total'), formatMoney(totals.total, currency), { big: true })}
      {totals.savings > 0 ? line(t('youSave'), formatMoney(totals.savings, currency), { color: colors.success }) : null}
    </View>
  );
}

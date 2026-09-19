import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { listTemplates } from '@/features/receipts/templateRepo';
import { usePrint } from '@/features/printer/usePrint';
import type { Order, OrderItem } from '@/lib/types';

// One button per active receipt template; rendering is shared with the admin preview.
export function PrintButtons({ order, items, cashierName }: { order: Order; items: OrderItem[]; cashierName?: string | null }) {
  const t = useT();
  const { row } = useLayout();
  const templates = useMemo(() => listTemplates(true), []);
  const { printOrder, hasPrinter, printing } = usePrint();

  if (templates.length === 0) return <AppText variant="small" color={colors.danger}>{t('noActiveTemplates')}</AppText>;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
        {templates.map((tpl) => (
          <Button
            key={tpl.id}
            title={`${t('printReceipt')}: ${tpl.name}`}
            variant="outline"
            icon="printer"
            disabled={!hasPrinter || items.length === 0}
            loading={printing}
            onPress={() => void printOrder(order, items, tpl, cashierName)}
          />
        ))}
      </View>
      {!hasPrinter ? <AppText variant="small">{t('connectPrinterFirst')}</AppText> : null}
    </View>
  );
}

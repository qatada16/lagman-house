import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listStockItems, stockUsageCount } from '@/features/stock/stockRepo';

export default function StockScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const [items] = useLocalQuery(() => listStockItems().map((s) => ({ ...s, usedBy: stockUsageCount(s.id) })));

  return (
    <Screen
      safeTop={false}
      title={t('stockTitle')}
      actions={
        <View style={[row, { gap: spacing.sm }]}>
          <Button title={t('purchaseReport')} variant="outline" size="sm" icon="bar-chart-2" onPress={() => router.push('/(admin)/stock/purchases')} />
          <Button title={t('addStock')} variant="action" size="sm" icon="plus" onPress={() => router.push('/(admin)/stock/new')} />
        </View>
      }
    >
      <Card padded={false}>
        {items.length === 0 ? (
          <EmptyState title={t('noStock')} icon="package" />
        ) : (
          items.map((s) => {
            const low = s.low_threshold != null && s.quantity <= s.low_threshold;
            return (
              <ListRow
                key={s.id}
                title={s.name}
                subtitle={t('usedBy', { n: s.usedBy })}
                chevron
                onPress={() => router.push({ pathname: '/(admin)/stock/[id]', params: { id: s.id } })}
                right={<Badge label={`${formatQty(s.quantity)} ${s.unit}`} tone={low ? 'danger' : 'info'} />}
              />
            );
          })
        )}
      </Card>
    </Screen>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Divider, Sheet } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { getOrderItems, type OrderWithMeta } from './orderRepo';
import { listTemplates } from '@/features/receipts/templateRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { usePrint } from '@/features/printer/usePrint';

export function OrderDetailSheet({ order, onClose }: { order: OrderWithMeta | null; onClose: () => void }) {
  const t = useT();
  const { row } = useLayout();
  const { printOrder, hasPrinter, printing } = usePrint();
  const items = useMemo(() => (order ? getOrderItems(order.id) : []), [order]);
  const templates = useMemo(() => listTemplates(true), []);
  const currency = getSettings().currency_symbol;

  if (!order) return null;
  return (
    <Sheet visible onClose={onClose} title={`${t('orderDetail')} ${order.order_number}`}>
      <View style={[row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
        {order.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
        <Badge label={order.source === 'qr' ? t('sourceQr') : t('sourcePos')} tone="info" />
        <Badge label={order.is_dirty ? t('unsynced') : t('syncedBadge')} tone={order.is_dirty ? 'neutral' : 'success'} />
      </View>
      <AppText variant="small">{formatDateTime(order.created_at)}</AppText>
      {order.cashier_name ? <AppText variant="small">{`${t('cashier')}: ${order.cashier_name}`}</AppText> : null}
      {order.table_code ? <AppText variant="small">{t('tableShort', { code: order.table_code })}</AppText> : null}
      <Divider />
      {items.map((it) => (
        <View key={it.id} style={[row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
          <AppText style={{ flex: 1 }}>{`${it.quantity} x ${it.item_name}${it.variant_name ? ` (${it.variant_name})` : ''}`}</AppText>
          <AppText weight="600">{formatMoney(it.line_total, currency)}</AppText>
        </View>
      ))}
      <Divider />
      <View style={[row, { justifyContent: 'space-between' }]}>
        <AppText variant="heading">{t('total')}</AppText>
        <AppText variant="heading">{formatMoney(order.total, currency)}</AppText>
      </View>
      {order.amount_received != null ? (
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="small">{t('amountReceived')}</AppText>
          <AppText variant="small">{formatMoney(order.amount_received, currency)}</AppText>
        </View>
      ) : null}
      {order.payment_method ? <AppText variant="small">{`${t('paymentMethod')}: ${order.payment_method === 'cash' ? t('paymentCash') : t('paymentOnline')}`}</AppText> : null}
      {order.note ? <AppText variant="small">{`${t('notes')}: ${order.note}`}</AppText> : null}
      {templates.length > 0 ? (
        <View style={[row, { gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md }]}>
          {templates.map((tpl) => (
            <Button key={tpl.id} title={`${t('printReceipt')}: ${tpl.name}`} variant="outline" size="sm" icon="printer" disabled={!hasPrinter} loading={printing} onPress={() => void printOrder(order, items, tpl, order.cashier_name)} />
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

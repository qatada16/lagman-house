import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Badge, Button, Divider, Input, Sheet } from '@/components/ui';
import { useLayout, useT, type StringKey } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { getOrderItems, type OrderWithMeta } from './orderRepo';
import { changeBlock, voidOrder } from './orderChanges';
import { listTemplates } from '@/features/receipts/templateRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { usePrint } from '@/features/printer/usePrint';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const REASONS: StringKey[] = ['cancelReasonCustomer', 'cancelReasonMistake', 'cancelReasonDuplicate', 'cancelReasonOther'];

interface Props {
  order: OrderWithMeta | null;
  onClose: () => void;
  onEdit?: (order: OrderWithMeta) => void;
  onChanged?: () => void;
}

export function OrderDetailSheet({ order, onClose, onEdit, onChanged }: Props) {
  const t = useT();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const { printOrder, hasPrinter, printing } = usePrint();
  const items = useMemo(() => (order ? getOrderItems(order.id) : []), [order]);
  const templates = useMemo(() => listTemplates(true), []);
  const currency = getSettings().currency_symbol;
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<StringKey | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCancelling(false);
    setReason(null);
    setDetail('');
  }, [order?.id]);

  if (!order) return null;
  const block = changeBlock(order, profile);
  const canChange = !!onEdit && block === null;
  const money = (v: number) => formatMoney(v, currency);
  const reasonText = reason ? (reason === 'cancelReasonOther' ? detail.trim() : [t(reason), detail.trim()].filter(Boolean).join(': ')) : '';

  const confirmCancel = () => {
    if (!profile || !reasonText) return;
    setBusy(true);
    try {
      voidOrder(order.id, reasonText, profile);
      toast.success(t('orderCancelled', { number: order.order_number }));
      onChanged?.();
      onClose();
    } catch (e) {
      const code = (e as Error).message;
      toast.error(code === 'expired' ? t('editWindowClosed') : code === 'void' ? t('orderAlreadyCancelled') : t('error'));
    } finally {
      setBusy(false);
    }
  };

  if (cancelling) {
    return (
      <Sheet
        visible
        onClose={() => setCancelling(false)}
        title={t('cancelOrderTitle', { number: order.order_number })}
        footer={
          <View style={[row, { gap: spacing.sm }]}>
            <Button title={t('keepOrder')} variant="outline" onPress={() => setCancelling(false)} style={{ flex: 1 }} />
            <Button title={t('cancelOrder')} variant="danger" icon="x-circle" onPress={confirmCancel} loading={busy} disabled={!reasonText} style={{ flex: 1 }} />
          </View>
        }
      >
        <AppText>{t('cancelOrderBody', { total: money(order.total) })}</AppText>
        <AppText variant="label" style={{ textTransform: 'uppercase', marginTop: spacing.sm }}>
          {t('cancelReason')}
        </AppText>
        <View style={{ gap: spacing.xs }}>
          {REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, reason === r ? styles.reasonActive : null]}>
              <AppText weight={reason === r ? '700' : '400'} color={reason === r ? colors.textOnDark : colors.textPrimary}>
                {t(r)}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Input
          label={reason === 'cancelReasonOther' ? t('cancelReasonDetail') : `${t('cancelReasonDetail')} (${t('optional')})`}
          value={detail}
          onChangeText={setDetail}
          maxLength={160}
          placeholder={t('cancelReasonPlaceholder')}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${t('orderDetail')} ${order.order_number}`}
      footer={
        canChange ? (
          <View style={[row, { gap: spacing.sm }]}>
            <Button title={t('cancelOrder')} variant="outline" icon="x-circle" onPress={() => setCancelling(true)} style={{ flex: 1 }} />
            <Button title={t('editOrder')} variant="action" icon="edit-2" onPress={() => onEdit?.(order)} style={{ flex: 1 }} />
          </View>
        ) : undefined
      }
    >
      <View style={[row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
        {order.status === 'void' ? <Badge label={t('orderCancelledBadge')} tone="danger" /> : null}
        {order.edit_count > 0 ? <Badge label={t('orderEditedBadge')} tone="warning" /> : null}
        {order.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
        <Badge label={order.source === 'qr' ? t('sourceQr') : t('sourcePos')} tone="info" />
        <Badge label={order.is_dirty ? t('unsynced') : t('syncedBadge')} tone={order.is_dirty ? 'neutral' : 'success'} />
      </View>
      <AppText variant="small">{formatDateTime(order.created_at)}</AppText>
      {order.cashier_name ? <AppText variant="small">{`${t('cashier')}: ${order.cashier_name}`}</AppText> : null}
      {order.table_code ? <AppText variant="small">{t('tableShort', { code: order.table_code })}</AppText> : null}

      {order.status === 'void' ? (
        <View style={[styles.notice, { borderColor: colors.danger }]}>
          <AppText variant="small" weight="700" color={colors.danger}>
            {t('cancelledInfo', { time: formatDateTime(order.voided_at), name: order.voided_by_name ?? '-' })}
          </AppText>
          {order.void_reason ? <AppText variant="small">{`${t('cancelReason')}: ${order.void_reason}`}</AppText> : null}
        </View>
      ) : null}
      {order.edit_count > 0 ? (
        <View style={styles.notice}>
          <AppText variant="small" weight="700">
            {t('editedInfo', { count: order.edit_count, time: formatDateTime(order.edited_at), name: order.edited_by_name ?? '-' })}
          </AppText>
          {order.original_total != null && order.original_total !== order.total ? (
            <AppText variant="small">{`${t('originalTotal')}: ${money(order.original_total)}`}</AppText>
          ) : null}
        </View>
      ) : null}

      <Divider />
      {items
        .filter((it) => !it.parent_item_id)
        .map((it) => (
          <View key={it.id} style={{ paddingVertical: 4 }}>
            <View style={[row, { justifyContent: 'space-between' }]}>
              <AppText style={{ flex: 1 }}>{`${it.quantity} x ${it.item_name}${it.variant_name ? ` (${it.variant_name})` : ''}`}</AppText>
              <AppText weight="600">{money(it.line_total)}</AppText>
            </View>
            {items
              .filter((c) => c.parent_item_id === it.id)
              .map((c) => (
                <AppText key={c.id} variant="small" style={{ paddingStart: spacing.md }}>
                  {`${c.item_name}${c.variant_name ? ` (${c.variant_name})` : ''}`}
                </AppText>
              ))}
          </View>
        ))}
      <Divider />
      {order.coupon_discount > 0 ? (
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="small">{`${t('couponLine')} ${order.coupon_code ?? ''}`}</AppText>
          <AppText variant="small">{`-${money(order.coupon_discount)}`}</AppText>
        </View>
      ) : null}
      <View style={[row, { justifyContent: 'space-between' }]}>
        <AppText variant="heading" style={order.status === 'void' ? styles.strike : null}>
          {t('total')}
        </AppText>
        <AppText variant="heading" style={order.status === 'void' ? styles.strike : null}>
          {money(order.total)}
        </AppText>
      </View>
      {order.amount_received != null ? (
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="small">{t('amountReceived')}</AppText>
          <AppText variant="small">{money(order.amount_received)}</AppText>
        </View>
      ) : null}
      {order.payment_method ? <AppText variant="small">{`${t('paymentMethod')}: ${order.payment_method === 'cash' ? t('paymentCash') : t('paymentOnline')}`}</AppText> : null}
      {order.savings_total > 0 ? <AppText variant="small">{`${t('youSave')}: ${money(order.savings_total)}`}</AppText> : null}
      {order.note ? <AppText variant="small">{`${t('notes')}: ${order.note}`}</AppText> : null}
      {onEdit && order.status === 'completed' && block === 'expired' ? (
        <AppText variant="small" color={colors.textSecondary}>
          {t('editWindowClosed')}
        </AppText>
      ) : null}
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

const styles = StyleSheet.create({
  notice: { gap: 2, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSidebar },
  reason: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  reasonActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  strike: { textDecorationLine: 'line-through', color: colors.disabled },
});

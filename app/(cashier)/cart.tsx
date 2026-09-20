import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, Divider, IconButton, Screen } from '@/components/ui';
import { CartLines } from '@/features/orders/CartPanel';
import { CheckoutForm } from '@/features/orders/CheckoutForm';
import { PrintButtons } from '@/features/orders/PrintButtons';
import { draftToOrder, useDraftOrder } from '@/features/orders/draftOrder';
import { createOrder } from '@/features/orders/orderRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { cartSubtotal, useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { formatMoney } from '@/lib/format';
import { toast } from '@/store/toastStore';
import type { Order, OrderItem } from '@/lib/types';

export default function CartReviewScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const cart = useCartStore();
  const draft = useDraftOrder();
  const currency = getSettings().currency_symbol;
  const total = cartSubtotal(cart.lines);
  const [completed, setCompleted] = useState<{ order: Order; items: OrderItem[] } | null>(null);

  const preview = draftToOrder(draft, cart.lines, {
    cashierId: profile?.id ?? null,
    note: cart.note,
    isTest: cart.isTest,
    amountReceived: cart.amountReceived,
    paymentMethod: cart.paymentMethod,
    source: 'pos',
  });

  const complete = () => {
    if (!profile || cart.lines.length === 0) return;
    const received = cart.amountReceived === '' ? null : Number(cart.amountReceived);
    const result = createOrder({
      id: draft.id,
      orderNumber: draft.orderNumber,
      cashierId: profile.id,
      adminId: profile.admin_id,
      lines: cart.lines,
      note: cart.note,
      isTest: cart.isTest,
      amountReceived: received != null && !Number.isNaN(received) ? received : null,
      paymentMethod: cart.paymentMethod,
      source: 'pos',
    });
    setCompleted(result);
    cart.clear();
    toast.success(t('orderCompleted', { number: result.order.order_number }));
  };

  if (completed) {
    return (
      <Screen title={t('orderCompleted', { number: completed.order.order_number })} footer={<Button title={t('newOrder')} variant="action" size="lg" icon="plus" onPress={() => router.replace('/(cashier)')} />}>
        <Card>
          <View style={[row, { gap: spacing.sm, marginBottom: spacing.sm }]}>
            {completed.order.is_test ? <Badge label={t('testOrder')} tone="warning" /> : null}
            <Badge label={completed.order.payment_method === 'cash' ? t('paymentCash') : t('paymentOnline')} tone="info" />
          </View>
          {completed.items.map((it) => (
            <View key={it.id} style={[row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
              <AppText style={{ flex: 1 }}>{`${it.quantity} x ${it.item_name}${it.variant_name ? ` (${it.variant_name})` : ''}`}</AppText>
              <AppText weight="600">{formatMoney(it.line_total, currency)}</AppText>
            </View>
          ))}
          <Divider />
          <View style={[row, { justifyContent: 'space-between' }]}>
            <AppText variant="heading">{t('total')}</AppText>
            <AppText variant="heading">{formatMoney(completed.order.total, currency)}</AppText>
          </View>
          {completed.order.note ? <AppText variant="small">{`${t('notes')}: ${completed.order.note}`}</AppText> : null}
        </Card>
        <Card title={t('printReceipt')}>
          <PrintButtons order={completed.order} items={completed.items} cashierName={profile?.name} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('reviewOrder')}
      subtitle={`#${draft.orderNumber}`}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <Button
          title={cart.isTest ? t('completeTestOrder') : t('completeOrder')}
          variant={cart.isTest ? 'secondary' : 'action'}
          size="lg"
          icon="check"
          disabled={cart.lines.length === 0}
          onPress={complete}
        />
      }
    >
      <Card padded={false}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <CartLines />
        </View>
        <View style={[row, { justifyContent: 'space-between', padding: spacing.md }]}>
          <AppText variant="heading">{t('total')}</AppText>
          <AppText variant="heading">{formatMoney(total, currency)}</AppText>
        </View>
      </Card>
      <Card>
        <CheckoutForm total={total} currency={currency} />
      </Card>
      <Card title={t('printReceipt')}>
        <PrintButtons order={preview.order} items={preview.items} cashierName={profile?.name} />
      </Card>
    </Screen>
  );
}

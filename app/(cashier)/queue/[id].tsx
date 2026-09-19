import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, Divider, IconButton, Screen } from '@/components/ui';
import { CartLines } from '@/features/orders/CartPanel';
import { CheckoutForm } from '@/features/orders/CheckoutForm';
import { PrintButtons } from '@/features/orders/PrintButtons';
import { draftToOrder, useDraftOrder } from '@/features/orders/draftOrder';
import { createOrder } from '@/features/orders/orderRepo';
import { getMenuItem, listVariants } from '@/features/menu/menuRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { cancelCustomerOrder, completeCustomerOrder, releaseCustomerOrder } from '@/features/qr/customerOrdersApi';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { cartSubtotal, clampNote, useCartStore } from '@/store/cartStore';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { useAuthStore } from '@/store/authStore';
import { formatMoney } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import type { CartLine } from '@/lib/types';

export default function ClaimedOrderScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore((s) => s.profile);
  const customerOrder = useCustomerOrderStore((s) => s.orders.find((o) => o.id === id));
  const removeFromQueue = useCustomerOrderStore((s) => s.remove);
  const cart = useCartStore();
  const draft = useDraftOrder();
  const currency = getSettings().currency_symbol;
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  // Re-price the customer's provisional items from the local menu.
  useEffect(() => {
    if (!customerOrder) return;
    const lines: CartLine[] = [];
    const missing: string[] = [];
    for (const ci of customerOrder.items) {
      const item = getMenuItem(ci.menu_item_id);
      if (!item || item.deleted_at || !item.is_active) {
        missing.push(ci.name);
        continue;
      }
      const variant = ci.variant_id ? listVariants(item.id).find((v) => v.id === ci.variant_id) ?? null : null;
      if (item.has_variants && !variant) {
        missing.push(ci.name);
        continue;
      }
      lines.push({
        key: `${item.id}:${variant?.id ?? ''}`,
        menu_item_id: item.id,
        variant_id: variant?.id ?? null,
        name: item.name,
        variant_name: variant?.name ?? null,
        unit_price: variant ? variant.price : item.base_price,
        quantity: Math.max(1, ci.quantity),
      });
    }
    cart.replaceLines(lines);
    cart.setNote(clampNote(customerOrder.note ?? ''));
    cart.setIsTest(false);
    setUnavailable(missing);
    return () => cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerOrder?.id]);

  const total = cartSubtotal(cart.lines);
  const preview = useMemo(
    () =>
      draftToOrder(draft, cart.lines, {
        cashierId: profile?.id ?? null,
        note: cart.note,
        isTest: false,
        amountReceived: cart.amountReceived,
        paymentMethod: cart.paymentMethod,
        source: 'qr',
        tableCode: customerOrder?.table_code ?? null,
        customerOrderId: customerOrder?.id ?? null,
      }),
    [draft, cart.lines, cart.note, cart.amountReceived, cart.paymentMethod, profile?.id, customerOrder?.table_code, customerOrder?.id]
  );

  if (!customerOrder) {
    return (
      <Screen title={t('confirmCustomerOrder')} actions={<IconButton icon="x" onPress={() => router.back()} />}>
        <Card>
          <AppText>{t('alreadyTaken')}</AppText>
          <Button title={t('back')} variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </Card>
      </Screen>
    );
  }

  const complete = async () => {
    if (!profile || cart.lines.length === 0) return;
    setBusy(true);
    try {
      const received = cart.amountReceived === '' ? null : Number(cart.amountReceived);
      const result = createOrder({
        id: draft.id,
        orderNumber: draft.orderNumber,
        cashierId: profile.id,
        lines: cart.lines,
        note: cart.note,
        isTest: false,
        amountReceived: received != null && !Number.isNaN(received) ? received : null,
        paymentMethod: cart.paymentMethod,
        source: 'qr',
        customerOrderId: customerOrder.id,
        tableCode: customerOrder.table_code,
      });
      try {
        await completeCustomerOrder(customerOrder.id, result.order.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
      removeFromQueue(customerOrder.id);
      toast.success(t('orderCompleted', { number: result.order.order_number }));
      router.replace('/(cashier)/queue');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      await releaseCustomerOrder(customerOrder.id);
      router.back();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!(await confirm(t('cancelCustomerOrder'), t('cancelCustomerOrderConfirm'), t('confirm'), t('cancel'), true))) return;
    setBusy(true);
    try {
      await cancelCustomerOrder(customerOrder.id);
      removeFromQueue(customerOrder.id);
      router.replace('/(cashier)/queue');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t('confirmCustomerOrder')}
      subtitle={`${customerOrder.table_code ? t('tableShort', { code: customerOrder.table_code }) : ''}  #${draft.orderNumber}`}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          <Button title={t('releaseOrder')} variant="outline" onPress={release} disabled={busy} />
          <Button title={t('cancel')} variant="ghost" onPress={cancel} disabled={busy} />
          <Button title={t('completeOrder')} variant="action" icon="check" loading={busy} disabled={cart.lines.length === 0} onPress={complete} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card padded={false}>
        <View style={{ padding: spacing.md, paddingBottom: 0 }}>
          <Badge label={t('claimedByYou')} tone="success" />
          <AppText variant="small" style={{ marginTop: spacing.xs }}>
            {t('priceUpdatedHint')}
          </AppText>
        </View>
        <View style={{ paddingHorizontal: spacing.md }}>
          <CartLines />
        </View>
        {unavailable.length > 0 ? (
          <View style={{ padding: spacing.md }}>
            {unavailable.map((n) => (
              <AppText key={n} variant="small" color={colors.danger}>{`${n}: ${t('itemUnavailable')}`}</AppText>
            ))}
          </View>
        ) : null}
        <Divider style={{ marginVertical: 0 }} />
        <View style={[row, { justifyContent: 'space-between', padding: spacing.md }]}>
          <AppText variant="heading">{t('total')}</AppText>
          <AppText variant="heading">{formatMoney(total, currency)}</AppText>
        </View>
      </Card>
      <Card>
        <CheckoutForm total={total} currency={currency} showTestToggle={false} />
      </Card>
      <Card title={t('printReceipt')}>
        <PrintButtons order={preview.order} items={preview.items} cashierName={profile?.name} />
      </Card>
    </Screen>
  );
}

import React, { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText, Button, Card, Divider, IconButton, Screen, useBottomInset, useTopInset } from '@/components/ui';
import { MenuGrid } from '@/features/menu/MenuGrid';
import { getCoupon } from '@/features/promos/promoRepo';
import { computeTotals } from '@/features/promos/pricing';
import { getSettings } from '@/features/settings/settingsRepo';
import { useLayout, useT } from '@/lib/i18n';
import { colors, layout, spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { useAuthStore } from '@/store/authStore';
import { CartStoreContext, createCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import type { CartLine, Coupon, Order, OrderItem } from '@/lib/types';
import { CartLines, CartPanel } from './CartPanel';
import { CheckoutForm } from './CheckoutForm';
import { PrintButtons } from './PrintButtons';
import { TotalsSummary } from './TotalsSummary';
import { getOrder } from './orderRepo';
import { changeBlock, editOrder, orderToCartLines } from './orderChanges';

type Step = 'items' | 'review' | 'done';

function couponFor(order: Order): Coupon | null {
  if (!order.coupon_id) return null;
  const found = getCoupon(order.coupon_id);
  if (found) return found;
  return {
    id: order.coupon_id,
    admin_id: order.admin_id ?? '',
    code: order.coupon_code ?? '',
    name: null,
    kind: 'fixed',
    value: order.coupon_discount,
    min_order: 0,
    max_discount: null,
    max_uses: null,
    uses_count: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    deleted_at: null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function signature(s: { lines: CartLine[]; coupon: Coupon | null; paymentMethod: string; amountReceived: string; note: string }) {
  return JSON.stringify([s.lines.map((l) => [l.key, l.quantity, l.unit_price]), s.coupon?.id ?? null, s.paymentMethod, s.amountReceived.trim(), s.note.trim()]);
}

export function EditOrderScreen({ orderId, backPath, safeTop = true }: { orderId: string; backPath: string; safeTop?: boolean }) {
  const t = useT();
  const router = useRouter();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const { row } = useLayout();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const profile = useAuthStore((s) => s.profile);
  const currency = getSettings().currency_symbol;
  const [order] = useState(() => getOrder(orderId));
  const [block] = useState(() => (order ? changeBlock(order, useAuthStore.getState().profile) : 'notAllowed'));
  const [step, setStep] = useState<Step>('items');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [{ store, initialSig }] = useState(() => {
    const cart = createCartStore();
    if (!order || block) return { store: cart, initialSig: '' };
    const start = {
      lines: orderToCartLines(order.id),
      note: order.note ?? '',
      isTest: order.is_test,
      amountReceived: order.amount_received != null ? String(order.amount_received) : '',
      paymentMethod: order.payment_method ?? 'cash',
      coupon: couponFor(order),
    };
    cart.setState(start);
    return { store: cart, initialSig: signature(start) };
  });
  const lines = store((s) => s.lines);
  const coupon = store((s) => s.coupon);
  const paymentMethod = store((s) => s.paymentMethod);
  const amountReceived = store((s) => s.amountReceived);
  const note = store((s) => s.note);
  const money = (v: number) => formatMoney(v, currency);

  const changed = signature({ lines, coupon, paymentMethod, amountReceived, note }) !== initialSig;
  const totals = computeTotals(lines, coupon);
  const previous = order?.total ?? 0;
  const difference = Math.round((totals.total - previous) * 100) / 100;

  const leave = useCallback(async () => {
    if (step === 'review') {
      setStep('items');
      return;
    }
    if (step === 'items' && changed && !(await confirm(t('discardChanges'), t('discardChangesBody'), t('discard'), t('keepEditing'), true))) return;
    if (router.canGoBack()) router.back();
    else router.replace(backPath as never);
  }, [step, changed, router, backPath, t]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 'done' || block) return false;
        void leave();
        return true;
      });
      return () => sub.remove();
    }, [leave, step, block])
  );

  if (!order || block) {
    const message = !order ? t('orderNotFound') : block === 'void' ? t('orderAlreadyCancelled') : block === 'expired' ? t('editWindowClosed') : t('notAllowedToEdit');
    return (
      <Screen safeTop={safeTop} title={t('editOrder')} actions={<IconButton icon="x" onPress={() => router.replace(backPath as never)} />}>
        <Card>
          <AppText>{message}</AppText>
        </Card>
      </Screen>
    );
  }

  const save = () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      const s = store.getState();
      const received = s.amountReceived.trim() === '' ? null : Number(s.amountReceived);
      const res = editOrder({
        orderId: order.id,
        lines: s.lines,
        coupon: s.coupon,
        paymentMethod: s.paymentMethod,
        amountReceived: received != null && !Number.isNaN(received) ? received : null,
        note: s.note,
        editor: profile,
      });
      setResult(res);
      setStep('done');
      toast.success(t('orderUpdated', { number: order.order_number }));
    } catch (e) {
      const code = (e as Error).message;
      const key = code === 'expired' ? 'editWindowClosed' : code === 'void' ? 'orderAlreadyCancelled' : code === 'order_empty' ? 'editEmptyHint' : code === 'notAllowed' ? 'notAllowedToEdit' : 'error';
      toast.error(t(key));
    } finally {
      setSaving(false);
    }
  };

  const differenceText = difference > 0 ? t('collectMore', { amount: money(difference) }) : difference < 0 ? t('refundAmount', { amount: money(-difference) }) : t('noDifference');
  const differenceCard = (
    <Card title={t('paymentDifference')}>
      <View style={[row, styles.pair]}>
        <AppText variant="small">{t('previousTotal')}</AppText>
        <AppText variant="small">{money(previous)}</AppText>
      </View>
      <View style={[row, styles.pair]}>
        <AppText variant="small">{t('newTotal')}</AppText>
        <AppText variant="small">{money(result ? result.order.total : totals.total)}</AppText>
      </View>
      <Divider />
      <AppText variant="heading" color={difference > 0 ? colors.action : difference < 0 ? colors.success : colors.textPrimary}>
        {differenceText}
      </AppText>
    </Card>
  );

  if (step === 'done' && result) {
    return (
      <Screen
        safeTop={safeTop}
        title={t('orderUpdated', { number: order.order_number })}
        footer={<Button title={t('done')} variant="action" size="lg" icon="check" onPress={() => router.replace(backPath as never)} />}
      >
        {differenceCard}
        <Card title={t('printReceipt')}>
          <AppText variant="small" style={{ marginBottom: spacing.sm }}>
            {t('revisedReceiptHint')}
          </AppText>
          <PrintButtons order={result.order} items={result.items} cashierName={order.cashier_name ?? profile?.name} />
        </Card>
      </Screen>
    );
  }

  if (step === 'review') {
    return (
      <CartStoreContext.Provider value={store}>
        <Screen
          safeTop={safeTop}
          title={t('reviewChanges')}
          subtitle={`#${order.order_number}`}
          actions={<IconButton icon={'arrow-left'} onPress={() => setStep('items')} />}
          footer={<Button title={t('saveChanges')} variant="action" size="lg" icon="check" onPress={save} loading={saving} disabled={lines.length === 0 || !changed} />}
        >
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              <CartLines />
            </View>
            <View style={{ padding: spacing.md }}>
              <TotalsSummary totals={totals} currency={currency} />
            </View>
          </Card>
          {lines.length === 0 ? (
            <Card>
              <AppText color={colors.danger}>{t('editEmptyHint')}</AppText>
            </Card>
          ) : null}
          {differenceCard}
          <Card>
            <CheckoutForm total={totals.total} currency={currency} showTestToggle={false} lockedCouponId={order.coupon_id} />
          </Card>
        </Screen>
      </CartStoreContext.Provider>
    );
  }

  const header = (
    <View style={[styles.header, row]}>
      <IconButton icon="x" onPress={() => void leave()} />
      <View style={{ flex: 1 }}>
        <AppText variant="title" numberOfLines={1}>
          {t('editOrderTitle', { number: order.order_number })}
        </AppText>
        <AppText variant="small">{`${t('previousTotal')}: ${money(previous)}`}</AppText>
      </View>
    </View>
  );
  const panel = (
    <CartPanel compact={!wide} clearable={false} title={t('orderItems')} proceedLabel={t('reviewChanges')} onProceed={() => setStep('review')} />
  );

  return (
    <CartStoreContext.Provider value={store}>
      <View style={[styles.root, { paddingTop: safeTop ? topInset : 0 }]}>
        {header}
        {lines.length === 0 ? (
          <AppText variant="small" color={colors.danger} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {t('editEmptyHint')}
          </AppText>
        ) : null}
        {wide ? (
          <View style={[row, { flex: 1, gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg + bottomInset }]}>
            <View style={{ flex: 1 }}>
              <MenuGrid availableWidth={width - 340 - spacing.lg * 3} />
            </View>
            <View style={{ width: 340 }}>{panel}</View>
          </View>
        ) : (
          <>
            <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
              <MenuGrid />
            </View>
            <View style={{ padding: spacing.md, paddingBottom: spacing.md + bottomInset }}>{panel}</View>
          </>
        )}
      </View>
    </CartStoreContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pair: { justifyContent: 'space-between', paddingVertical: 2 },
});

import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, Divider, IconButton, Screen } from '@/components/ui';
import { CartLines } from '@/features/orders/CartPanel';
import { CheckoutForm } from '@/features/orders/CheckoutForm';
import { PrintButtons } from '@/features/orders/PrintButtons';
import { TotalsSummary } from '@/features/orders/TotalsSummary';
import { draftToOrder, useDraftOrder } from '@/features/orders/draftOrder';
import { createOrder, findOrderByCustomerOrder } from '@/features/orders/orderRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { computeTotals } from '@/features/promos/pricing';
import { runSync } from '@/features/sync/syncEngine';
import {
  cancelCustomerOrder,
  claimCustomerOrder,
  completeCustomerOrder,
  fetchCustomerOrder,
  releaseCustomerOrder,
  secondsLeft,
} from '@/features/qr/customerOrdersApi';
import { useLayout, useT } from '@/lib/i18n';
import { useTenantId } from '@/lib/tenant';
import { colors, spacing } from '@/constants/theme';
import { formatDateTime } from '@/lib/format';
import { CartStoreContext, clampNote, createCartStore } from '@/store/cartStore';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { toast } from '@/store/toastStore';
import type { CustomerOrder } from '@/lib/types';
import { AddItemsModal } from './AddItemsModal';
import { CancelReasonSheet } from './CancelReasonSheet';
import { linesFromCustomerOrder } from './linesFromCustomerOrder';
import { formatCountdown, useNow } from './useNow';

export function WebOrderScreen({ orderId, basePath, safeTop = true }: { orderId: string; basePath: string; safeTop?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const profile = useAuthStore((s) => s.profile);
  const tenantId = useTenantId();
  const online = useSyncStore((s) => s.online);
  const live = useCustomerOrderStore((s) => s.orders.find((o) => o.id === orderId) ?? null);
  const removeFromQueue = useCustomerOrderStore((s) => s.remove);
  const upsertLocal = useCustomerOrderStore((s) => s.upsertLocal);
  const [fetched, setFetched] = useState<CustomerOrder | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [store] = useState(createCartStore);
  const cart = store();
  const draft = useDraftOrder();
  const currency = getSettings().currency_symbol;
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const order = live ?? fetched;
  const mine = !!order && order.status === 'claimed' && order.claimed_by === profile?.id;
  const isAdmin = profile?.role === 'admin';
  const clockOffset = useCustomerOrderStore((s) => s.clockOffset);
  const now = useNow(1000, order?.status === 'pending') + clockOffset;
  const left = order && order.status === 'pending' ? secondsLeft(order, now) : null;

  useEffect(() => {
    if (live) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void fetchCustomerOrder(orderId)
      .then((o) => {
        if (!cancelled) setFetched(o);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, live]);

  useEffect(() => {
    if (!order || !mine) return;
    const { lines, missing } = linesFromCustomerOrder(order);
    cart.replaceLines(lines);
    cart.setNote(clampNote(order.note ?? ''));
    cart.setIsTest(false);
    setUnavailable(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, mine]);

  const totals = computeTotals(cart.lines, cart.coupon);
  const preview = useMemo(
    () =>
      draftToOrder(draft, cart.lines, {
        cashierId: profile?.id ?? null,
        adminId: tenantId,
        note: cart.note,
        isTest: false,
        amountReceived: cart.amountReceived,
        paymentMethod: cart.paymentMethod,
        source: 'qr',
        tableCode: order?.table_code ?? null,
        customerOrderId: order?.id ?? null,
        coupon: cart.coupon,
      }),
    [draft, cart.lines, cart.note, cart.amountReceived, cart.paymentMethod, cart.coupon, profile?.id, tenantId, order?.table_code, order?.id]
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace(basePath as never));
  const title = order?.ticket_no ? t('webOrderTitle', { n: order.ticket_no }) : t('customerOrders');

  if (!order) {
    return (
      <Screen safeTop={safeTop} title={t('customerOrders')} actions={<IconButton icon="x" onPress={back} />}>
        <Card>
          <AppText>{loaded ? t('webOrderGone') : t('loading')}</AppText>
        </Card>
      </Screen>
    );
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('web_order_not_open')) {
        toast.error(t('webOrderGone'));
        void useCustomerOrderStore.getState().refresh();
      } else toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const accept = () =>
    run('accept', async () => {
      if (!profile) return;
      const won = await claimCustomerOrder(order.id, profile.id);
      if (!won) {
        toast.info(t('alreadyTaken'));
        removeFromQueue(order.id);
        return;
      }
      upsertLocal(won);
      setFetched(won);
    });

  const release = () =>
    run('release', async () => {
      await releaseCustomerOrder(order.id);
      back();
    });

  const cancel = (reason: string) =>
    run('cancel', async () => {
      await cancelCustomerOrder(order.id, reason);
      removeFromQueue(order.id);
      setCancelOpen(false);
      toast.success(t('webOrderCancelled', { n: order.ticket_no ?? '' }));
      router.replace(basePath as never);
    });

  const complete = () =>
    run('complete', async () => {
      if (!profile || !tenantId || cart.lines.length === 0) return;
      const existing = findOrderByCustomerOrder(order.id);
      await completeCustomerOrder(order.id, existing?.id ?? draft.id);
      removeFromQueue(order.id);
      if (existing) {
        void runSync('web-order');
        toast.success(t('orderCompleted', { number: existing.order_number }));
        router.replace(basePath as never);
        return;
      }
      const received = cart.amountReceived === '' ? null : Number(cart.amountReceived);
      const result = createOrder({
        id: draft.id,
        orderNumber: draft.orderNumber,
        cashierId: profile.id,
        adminId: tenantId,
        lines: cart.lines,
        note: cart.note,
        isTest: false,
        amountReceived: received != null && !Number.isNaN(received) ? received : null,
        paymentMethod: cart.paymentMethod,
        source: 'qr',
        customerOrderId: order.id,
        tableCode: order.table_code,
        coupon: cart.coupon,
      });
      void runSync('web-order');
      toast.success(t('orderCompleted', { number: result.order.order_number }));
      router.replace(basePath as never);
    });

  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const header = (
    <Card>
      <View style={[row, { justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{[order.table_code ? t('tableShort', { code: order.table_code }) : null, t('itemsCount', { n: count })].filter(Boolean).join('  ·  ')}</AppText>
          <AppText variant="small">{`${formatDateTime(order.created_at)}${order.customer_name ? `  ·  ${order.customer_name}` : ''}`}</AppText>
        </View>
        {order.status === 'pending' && left != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="label">{t('webRespondIn')}</AppText>
            <AppText variant="title" color={left <= 60 ? colors.danger : left <= 180 ? colors.action : colors.success}>
              {formatCountdown(left)}
            </AppText>
          </View>
        ) : (
          <Badge label={mine ? t('claimedByYou') : order.status === 'claimed' ? t('webAcceptedBy', { name: order.claimed_by_name ?? '-' }) : t(order.status === 'pending' ? 'pending' : 'webOrderClosed')} tone={mine ? 'success' : 'info'} />
        )}
      </View>
      {order.note ? <AppText variant="small" weight="600" style={{ marginTop: spacing.xs }}>{`${t('notes')}: ${order.note}`}</AppText> : null}
    </Card>
  );

  if (!mine) {
    const closed = order.status !== 'pending' && order.status !== 'claimed';
    return (
      <Screen safeTop={safeTop} title={title} actions={<IconButton icon="x" onPress={back} />}
        footer={
          order.status === 'pending' ? (
            <View style={[row, { gap: spacing.sm }]}>
              <Button title={t('cancel')} variant="outline" icon="x-circle" onPress={() => setCancelOpen(true)} disabled={!!busy || !online} />
              <Button title={t('webAccept')} variant="action" icon="check" style={{ flex: 1 }} loading={busy === 'accept'} disabled={!!busy || !online || (left != null && left <= 0)} onPress={() => void accept()} />
            </View>
          ) : order.status === 'claimed' && isAdmin ? (
            <View style={[row, { gap: spacing.sm }]}>
              <Button title={t('cancel')} variant="outline" icon="x-circle" onPress={() => setCancelOpen(true)} disabled={!!busy || !online} />
              <Button title={t('releaseOrder')} variant="secondary" style={{ flex: 1 }} loading={busy === 'release'} disabled={!!busy || !online} onPress={() => void release()} />
            </View>
          ) : undefined
        }
      >
        {header}
        <Card title={t('webRequestedItems')}>
          {order.items.map((i, idx) => (
            <View key={idx} style={{ paddingVertical: 2 }}>
              <AppText>{`${i.quantity} x ${i.name}${i.variant_name ? ` (${i.variant_name})` : ''}`}</AppText>
              {(i.components ?? []).map((c, ci) => (
                <AppText key={ci} variant="small" style={{ paddingStart: spacing.md }}>{`${c.name}${c.variant_name ? ` (${c.variant_name})` : ''}`}</AppText>
              ))}
            </View>
          ))}
        </Card>
        {closed ? (
          <Card>
            <AppText>{order.status === 'expired' ? t('webOrderExpired') : order.status === 'cancelled' ? t('webOrderWasCancelled') : t('webOrderClosed')}</AppText>
            {order.cancel_reason && order.cancel_reason !== 'timeout' ? <AppText variant="small">{`${t('cancelReason')}: ${order.cancel_reason}`}</AppText> : null}
          </Card>
        ) : null}
        {!online ? <AppText variant="small" color={colors.danger}>{t('requiresInternet')}</AppText> : null}
        <CancelReasonSheet visible={cancelOpen} title={t('webCancelTitle', { n: order.ticket_no ?? '' })} onClose={() => setCancelOpen(false)} onConfirm={(r) => void cancel(r)} busy={busy === 'cancel'} />
      </Screen>
    );
  }

  return (
    <CartStoreContext.Provider value={store}>
      <Screen
        safeTop={safeTop}
        title={title}
        subtitle={`#${draft.orderNumber}`}
        actions={<IconButton icon="x" onPress={back} />}
        footer={
          <View style={[row, { gap: spacing.sm }]}>
            <Button title={t('releaseOrder')} variant="outline" onPress={() => void release()} disabled={!!busy} />
            <Button title={t('cancel')} variant="ghost" onPress={() => setCancelOpen(true)} disabled={!!busy} />
            <Button title={online ? t('completeOrder') : t('noInternet')} variant="action" icon="check" loading={busy === 'complete'} disabled={cart.lines.length === 0 || !!busy || !online} onPress={() => void complete()} style={{ flex: 1 }} />
          </View>
        }
      >
        {header}
        <Card padded={false}>
          <View style={{ padding: spacing.md, paddingBottom: 0 }}>
            <AppText variant="small">{t('priceUpdatedHint')}</AppText>
          </View>
          <View style={{ paddingHorizontal: spacing.md }}>
            <CartLines />
          </View>
          <View style={{ padding: spacing.md }}>
            <Button title={t('addItems')} variant="outline" icon="plus" onPress={() => setAddOpen(true)} />
          </View>
          {unavailable.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              {unavailable.map((n) => (
                <AppText key={n} variant="small" color={colors.danger}>{`${n}: ${t('itemUnavailable')}`}</AppText>
              ))}
            </View>
          ) : null}
          <Divider style={{ marginVertical: 0 }} />
          <View style={{ padding: spacing.md }}>
            <TotalsSummary totals={totals} currency={currency} />
          </View>
        </Card>
        <Card>
          <CheckoutForm total={totals.total} currency={currency} showTestToggle={false} />
        </Card>
        <Card title={t('printReceipt')}>
          <PrintButtons order={preview.order} items={preview.items} cashierName={profile?.name} />
        </Card>
        <AddItemsModal visible={addOpen} onClose={() => setAddOpen(false)} />
        <CancelReasonSheet visible={cancelOpen} title={t('webCancelTitle', { n: order.ticket_no ?? '' })} onClose={() => setCancelOpen(false)} onConfirm={(r) => void cancel(r)} busy={busy === 'cancel'} />
      </Screen>
    </CartStoreContext.Provider>
  );
}

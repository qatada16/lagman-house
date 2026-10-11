import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Badge, Button, Input, Segmented, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { countWords, NOTE_WORD_LIMIT, useCart } from '@/store/cartStore';
import { formatMoney } from '@/lib/format';
import { findCouponByCode, listCoupons } from '@/features/promos/promoRepo';
import { cartSubtotal, couponDiscount, couponProblem, type CouponProblem } from '@/features/promos/pricing';
import { toast } from '@/store/toastStore';
import type { Coupon, PaymentMethod } from '@/lib/types';

const PROBLEM_KEY: Record<CouponProblem, 'couponInactive' | 'couponExpired' | 'couponNotStarted' | 'couponExhausted' | 'couponMinOrder'> = {
  inactive: 'couponInactive',
  expired: 'couponExpired',
  notStarted: 'couponNotStarted',
  exhausted: 'couponExhausted',
  minOrder: 'couponMinOrder',
};

export function CheckoutForm({
  total,
  currency,
  showTestToggle = true,
  showNote = true,
  lockedCouponId = null,
}: {
  total: number;
  currency: string;
  showTestToggle?: boolean;
  showNote?: boolean;
  lockedCouponId?: string | null;
}) {
  const t = useT();
  const { row } = useLayout();
  const note = useCart((s) => s.note);
  const setNote = useCart((s) => s.setNote);
  const isTest = useCart((s) => s.isTest);
  const setIsTest = useCart((s) => s.setIsTest);
  const amountReceived = useCart((s) => s.amountReceived);
  const setAmountReceived = useCart((s) => s.setAmountReceived);
  const paymentMethod = useCart((s) => s.paymentMethod);
  const setPaymentMethod = useCart((s) => s.setPaymentMethod);
  const lines = useCart((s) => s.lines);
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [code, setCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotal = cartSubtotal(lines);
  const active = useMemo(() => listCoupons(true), [lines.length]);

  const problemFor = (c: Coupon) => (c.id === lockedCouponId ? (subtotal < c.min_order ? 'minOrder' : null) : couponProblem(c, subtotal));

  const tryApply = (c: Coupon | null) => {
    if (!c) {
      setCouponError(t('couponNotFound'));
      return;
    }
    const problem = problemFor(c);
    if (problem) {
      setCouponError(t(PROBLEM_KEY[problem], { amount: formatMoney(c.min_order, currency) }));
      return;
    }
    setCouponError(null);
    setCoupon(c);
    setCode('');
    toast.success(t('couponApplied', { code: c.code }));
  };

  const received = Number(amountReceived);
  const change = amountReceived && !Number.isNaN(received) ? received - total : null;
  const wordsLeft = NOTE_WORD_LIMIT - countWords(note);
  const liveProblem = coupon ? problemFor(coupon) : null;

  return (
    <View style={{ gap: spacing.md }}>
      {showNote ? (
        <Input label={t('noteLabel')} value={note} onChangeText={setNote} placeholder={t('notePlaceholder')} hint={t('wordsLeft', { n: Math.max(0, wordsLeft) })} multiline />
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label" style={{ textTransform: 'uppercase' }}>
          {t('applyCoupon')}
        </AppText>
        {coupon ? (
          <View style={[styles.applied, row]}>
            <Feather name="tag" size={16} color={colors.success} />
            <View style={{ flex: 1 }}>
              <AppText weight="700">{coupon.code}</AppText>
              <AppText variant="small" color={liveProblem ? colors.danger : colors.success}>
                {liveProblem ? t(PROBLEM_KEY[liveProblem], { amount: formatMoney(coupon.min_order, currency) }) : `-${formatMoney(couponDiscount(coupon, subtotal), currency)}`}
              </AppText>
            </View>
            <Button title={t('removeCoupon')} variant="ghost" size="sm" onPress={() => setCoupon(null)} />
          </View>
        ) : (
          <>
            <View style={[row, { gap: spacing.sm, alignItems: 'flex-start' }]}>
              <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={t('enterCoupon')} autoCapitalize="characters" autoCorrect={false} containerStyle={{ flex: 1 }} error={couponError} />
              <Button title={t('apply')} variant="outline" onPress={() => tryApply(findCouponByCode(code))} disabled={!code.trim()} />
            </View>
            {active.length > 0 ? (
              <View style={[row, { gap: spacing.xs, flexWrap: 'wrap' }]}>
                {active.map((c) => (
                  <Pressable key={c.id} onPress={() => tryApply(c)} style={styles.chip}>
                    <AppText variant="small" weight="600" color={colors.accentDark}>
                      {c.code}
                    </AppText>
                    <Badge label={c.kind === 'percent' ? `${c.value}%` : formatMoney(c.value, currency)} tone="warning" />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      <Segmented<PaymentMethod>
        label={t('paymentMethod')}
        value={paymentMethod}
        onChange={setPaymentMethod}
        options={[
          { value: 'cash', label: t('paymentCash') },
          { value: 'online', label: t('paymentOnline') },
        ]}
      />
      <View style={[row, { gap: spacing.md, alignItems: 'flex-end' }]}>
        <Input label={`${t('amountReceived')} (${t('optional')})`} value={amountReceived} onChangeText={setAmountReceived} decimal containerStyle={{ flex: 1 }} />
        <View style={{ flex: 1, paddingBottom: 12 }}>
          <AppText variant="label" style={{ textTransform: 'uppercase' }}>
            {t('changeDue')}
          </AppText>
          <AppText variant="heading" color={change != null && change < 0 ? colors.danger : colors.textPrimary}>
            {change == null ? '-' : formatMoney(change, currency)}
          </AppText>
        </View>
      </View>
      {showTestToggle ? <Toggle label={t('testOrderToggle')} hint={t('testOrderHint')} value={isTest} onChange={setIsTest} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  applied: { alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success, backgroundColor: '#E3EFE4' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});

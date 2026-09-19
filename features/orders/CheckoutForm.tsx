import React from 'react';
import { View } from 'react-native';
import { AppText, Input, Segmented, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { countWords, NOTE_WORD_LIMIT, useCartStore } from '@/store/cartStore';
import { formatMoney } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';

// Shared between the counter cart review and the claimed customer-order confirmation.
export function CheckoutForm({ total, currency, showTestToggle = true, showNote = true }: { total: number; currency: string; showTestToggle?: boolean; showNote?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const note = useCartStore((s) => s.note);
  const setNote = useCartStore((s) => s.setNote);
  const isTest = useCartStore((s) => s.isTest);
  const setIsTest = useCartStore((s) => s.setIsTest);
  const amountReceived = useCartStore((s) => s.amountReceived);
  const setAmountReceived = useCartStore((s) => s.setAmountReceived);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);

  const received = Number(amountReceived);
  const change = amountReceived && !Number.isNaN(received) ? received - total : null;
  const wordsLeft = NOTE_WORD_LIMIT - countWords(note);

  return (
    <View style={{ gap: spacing.md }}>
      {showNote ? (
        <Input
          label={t('noteLabel')}
          value={note}
          onChangeText={setNote}
          placeholder={t('notePlaceholder')}
          hint={t('wordsLeft', { n: Math.max(0, wordsLeft) })}
          multiline
        />
      ) : null}
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

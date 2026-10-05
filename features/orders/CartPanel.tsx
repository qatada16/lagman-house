import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, EmptyState, IconButton, Stepper } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { useCartStore } from '@/store/cartStore';
import { computeTotals } from '@/features/promos/pricing';
import { formatMoney } from '@/lib/format';
import { getSettings } from '@/features/settings/settingsRepo';
import { confirm } from '@/lib/confirm';

export function CartLines({ editable = true }: { editable?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const currency = getSettings().currency_symbol;
  if (lines.length === 0) return <EmptyState title={t('cartEmpty')} icon="shopping-cart" />;
  return (
    <View>
      {lines.map((l) => {
        const discounted = l.unit_price < l.original_unit_price;
        return (
          <View key={l.key} style={[styles.line, row]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="600" numberOfLines={2}>
                {l.name}
                {l.variant_name ? ` (${l.variant_name})` : ''}
              </AppText>
              {l.components.map((c) => (
                <AppText key={c.slot_id} variant="small" color={colors.textSecondary}>
                  {`${c.slot_name}: ${c.name}${c.variant_name ? ` (${c.variant_name})` : ''}`}
                </AppText>
              ))}
              <View style={[row, { gap: spacing.xs, alignItems: 'center' }]}>
                {discounted ? (
                  <AppText variant="small" style={styles.strike}>
                    {formatMoney(l.original_unit_price, currency)}
                  </AppText>
                ) : null}
                <AppText variant="small" color={discounted ? colors.success : colors.textSecondary}>
                  {`${formatMoney(l.unit_price, currency)} x ${l.quantity} = ${formatMoney(l.unit_price * l.quantity, currency)}`}
                </AppText>
              </View>
            </View>
            {editable ? (
              <>
                <Stepper value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />
                <IconButton icon="x" color={colors.surfaceMuted} size={16} onPress={() => remove(l.key)} />
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function CartPanel({ onProceed, compact }: { onProceed: () => void; compact?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const lines = useCartStore((s) => s.lines);
  const coupon = useCartStore((s) => s.coupon);
  const clear = useCartStore((s) => s.clear);
  const currency = getSettings().currency_symbol;
  const totals = computeTotals(lines, coupon);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  const clearAll = async () => {
    if (lines.length && (await confirm(t('clearCart'), t('clearCartConfirm'), t('clearCart'), t('cancel'), true))) clear();
  };

  return (
    <View style={[styles.panel, compact ? styles.compact : null]}>
      <View style={[styles.header, row]}>
        <AppText variant="heading">{`${t('cart')} (${count})`}</AppText>
        {lines.length ? <Button title={t('clearCart')} variant="ghost" size="sm" onPress={clearAll} /> : null}
      </View>
      <ScrollView style={{ flexShrink: 1, maxHeight: compact ? 220 : undefined }} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        <CartLines />
      </ScrollView>
      <View style={styles.footer}>
        <View style={[row, { justifyContent: 'space-between' }]}>
          <AppText variant="subheading">{t('total')}</AppText>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="heading">{formatMoney(totals.total, currency)}</AppText>
            {totals.savings > 0 ? (
              <AppText variant="small" color={colors.success}>{`${t('youSave')} ${formatMoney(totals.savings, currency)}`}</AppText>
            ) : null}
          </View>
        </View>
        <Button title={t('proceed')} variant="action" size="lg" disabled={lines.length === 0} onPress={onProceed} icon="arrow-right" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, flex: 1 },
  compact: { flex: 0 },
  header: { justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  line: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  strike: { textDecorationLine: 'line-through', color: colors.disabled },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSidebar, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});

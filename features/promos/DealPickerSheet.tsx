import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Badge, Button, Sheet } from '@/components/ui';
import { useLayout, useT, localizedName } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { getMenuItem, listVariants } from '@/features/menu/menuRepo';
import { listDealSlots } from './promoRepo';
import type { CartComponent, Deal, DealSlot } from '@/lib/types';

interface Selection {
  menu_item_id: string;
  variant_id: string | null;
}

function defaultSelection(slot: DealSlot): Selection | null {
  const opt = slot.options[slot.default_index] ?? slot.options[0];
  if (!opt) return null;
  const item = getMenuItem(opt.menu_item_id);
  const variantId = opt.variant_id ?? (item?.has_variants ? listVariants(item.id)[0]?.id ?? null : null);
  return { menu_item_id: opt.menu_item_id, variant_id: variantId };
}

export function dealRegularPrice(slots: DealSlot[]) {
  let total = 0;
  for (const slot of slots) {
    const sel = defaultSelection(slot);
    if (!sel) continue;
    const item = getMenuItem(sel.menu_item_id);
    if (!item) continue;
    const variant = sel.variant_id ? listVariants(item.id).find((v) => v.id === sel.variant_id) : null;
    total += variant ? variant.price : item.base_price;
  }
  return total;
}

export function DealPickerSheet({ deal, currency, onClose, onAdd }: { deal: Deal | null; currency: string; onClose: () => void; onAdd: (deal: Deal, components: CartComponent[]) => void }) {
  const t = useT();
  const { row, lang } = useLayout();
  const slots = useMemo(() => (deal ? listDealSlots(deal.id) : []), [deal]);
  const [selection, setSelection] = useState<Record<string, Selection | null>>({});

  React.useEffect(() => {
    const init: Record<string, Selection | null> = {};
    for (const s of slots) init[s.id] = defaultSelection(s);
    setSelection(init);
  }, [slots]);

  if (!deal) return null;

  const complete = slots.every((s) => {
    const sel = selection[s.id];
    if (!sel) return false;
    const item = getMenuItem(sel.menu_item_id);
    return !!item && (!item.has_variants || !!sel.variant_id);
  });

  const add = () => {
    const components: CartComponent[] = [];
    for (const s of slots) {
      const sel = selection[s.id];
      const item = sel ? getMenuItem(sel.menu_item_id) : null;
      if (!sel || !item) return;
      const variant = sel.variant_id ? listVariants(item.id).find((v) => v.id === sel.variant_id) ?? null : null;
      components.push({ slot_id: s.id, slot_name: s.name, menu_item_id: item.id, variant_id: variant?.id ?? null, name: item.name, variant_name: variant?.name ?? null });
    }
    onAdd(deal, components);
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={localizedName(lang, deal.name, deal.name_ur)}
      footer={<Button title={`${t('addDeal')}  ${formatMoney(deal.price, currency)}`} variant="action" icon="plus" size="lg" disabled={!complete} onPress={add} />}
    >
      {deal.description ? <AppText variant="small">{deal.description}</AppText> : null}
      {slots.map((slot) => {
        const sel = selection[slot.id];
        const selectedItem = sel ? getMenuItem(sel.menu_item_id) : null;
        const variants = selectedItem?.has_variants ? listVariants(selectedItem.id) : [];
        const fixedVariant = slot.options.find((o) => o.menu_item_id === sel?.menu_item_id)?.variant_id ?? null;
        const distinctItems = [...new Map(slot.options.map((o) => [o.menu_item_id, o])).values()];
        return (
          <View key={slot.id} style={styles.slot}>
            <AppText variant="label" style={{ textTransform: 'uppercase' }}>
              {slot.name}
            </AppText>
            <View style={[row, { gap: spacing.xs, flexWrap: 'wrap' }]}>
              {distinctItems.map((o) => {
                const item = getMenuItem(o.menu_item_id);
                if (!item) return null;
                const active = sel?.menu_item_id === o.menu_item_id;
                return (
                  <Pressable collapsable={false}
                    key={o.menu_item_id}
                    onPress={() => {
                      const vid = o.variant_id ?? (item.has_variants ? listVariants(item.id)[0]?.id ?? null : null);
                      setSelection((s) => ({ ...s, [slot.id]: { menu_item_id: o.menu_item_id, variant_id: vid } }));
                    }}
                    style={[styles.chip, active ? styles.chipActive : null]}
                  >
                    {active ? <Feather name="check" size={14} color={colors.textOnDark} /> : null}
                    <AppText variant="small" weight="600" color={active ? colors.textOnDark : colors.accentDark}>
                      {localizedName(lang, item.name, item.name_ur)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            {selectedItem?.has_variants && variants.length > 0 ? (
              <View style={[row, { gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs }]}>
                {fixedVariant ? (
                  <Badge label={variants.find((v) => v.id === fixedVariant)?.name ?? ''} tone="info" />
                ) : (
                  variants.map((v) => {
                    const active = sel?.variant_id === v.id;
                    return (
                      <Pressable collapsable={false} key={v.id} onPress={() => setSelection((s) => ({ ...s, [slot.id]: { menu_item_id: selectedItem.id, variant_id: v.id } }))} style={[styles.sizeChip, active ? styles.sizeChipActive : null]}>
                        <AppText variant="small" weight="600" color={active ? colors.white : colors.action}>
                          {v.name}
                        </AppText>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  slot: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accentDark, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.accentDark },
  sizeChip: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.action, backgroundColor: colors.white },
  sizeChipActive: { backgroundColor: colors.action },
});

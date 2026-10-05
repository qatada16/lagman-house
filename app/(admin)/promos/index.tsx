import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Screen, Segmented, statusTone } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listCoupons, listDeals, listDealSlots, listDiscounts } from '@/features/promos/promoRepo';
import { windowStatus } from '@/features/promos/dateInput';
import { getSettings } from '@/features/settings/settingsRepo';
import { formatMoney } from '@/lib/format';

type Tab = 'deals' | 'discounts' | 'coupons';

export default function PromosScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const [tab, setTab] = useState<Tab>('deals');
  const [data] = useLocalQuery(() => ({
    deals: listDeals().map((d) => ({ ...d, slots: listDealSlots(d.id).length })),
    discounts: listDiscounts(),
    coupons: listCoupons(),
    currency: getSettings().currency_symbol,
  }));

  const statusBadge = (isActive: boolean, startsAt: string | null, endsAt: string | null) => {
    if (!isActive) return <Badge label={t('inactive')} />;
    const w = windowStatus(startsAt, endsAt);
    if (w === 'scheduled') return <Badge label={t('scheduled')} tone="info" />;
    if (w === 'expired') return <Badge label={t('expired')} tone="danger" />;
    return <Badge label={t('active')} tone={statusTone('active')} />;
  };

  const addHref = tab === 'deals' ? '/(admin)/promos/deal/new' : tab === 'discounts' ? '/(admin)/promos/discount/new' : '/(admin)/promos/coupon/new';
  const addLabel = tab === 'deals' ? t('newDeal') : tab === 'discounts' ? t('newDiscount') : t('newCoupon');

  return (
    <Screen safeTop={false} title={t('promosTitle')} actions={<Button title={addLabel} variant="action" size="sm" icon="plus" onPress={() => router.push(addHref as never)} />}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'deals', label: t('tabDeals') },
          { value: 'discounts', label: t('tabDiscounts') },
          { value: 'coupons', label: t('tabCoupons') },
        ]}
      />

      {tab === 'deals' ? (
        <Card padded={false}>
          {data.deals.length === 0 ? (
            <EmptyState title={t('noDeals')} icon="gift" />
          ) : (
            data.deals.map((d) => (
              <ListRow
                key={d.id}
                title={d.name}
                subtitle={`${formatMoney(d.price, data.currency)}  ${d.slots} ${t('items').toLowerCase()}`}
                chevron
                onPress={() => router.push({ pathname: '/(admin)/promos/deal/[id]', params: { id: d.id } })}
                right={statusBadge(d.is_active, d.starts_at, d.ends_at)}
              />
            ))
          )}
        </Card>
      ) : null}

      {tab === 'discounts' ? (
        <Card padded={false}>
          {data.discounts.length === 0 ? (
            <EmptyState title={t('noDiscounts')} icon="percent" />
          ) : (
            data.discounts.map((d) => (
              <ListRow
                key={d.id}
                title={d.name}
                subtitle={`${d.kind === 'percent' ? `${d.value}%` : formatMoney(d.value, data.currency)}  ${t('itemsSelected', { n: d.item_ids.length })}`}
                chevron
                onPress={() => router.push({ pathname: '/(admin)/promos/discount/[id]', params: { id: d.id } })}
                right={statusBadge(d.is_active, d.starts_at, d.ends_at)}
              />
            ))
          )}
        </Card>
      ) : null}

      {tab === 'coupons' ? (
        <Card padded={false}>
          {data.coupons.length === 0 ? (
            <EmptyState title={t('noCoupons')} icon="tag" />
          ) : (
            data.coupons.map((c) => (
              <ListRow
                key={c.id}
                title={c.code}
                subtitle={`${c.kind === 'percent' ? `${c.value}%` : formatMoney(c.value, data.currency)}  ${c.max_uses != null ? t('usesSoFar', { used: c.uses_count, max: c.max_uses }) : t('usesUnlimited', { used: c.uses_count })}${c.name ? `  ${c.name}` : ''}`}
                chevron
                onPress={() => router.push({ pathname: '/(admin)/promos/coupon/[id]', params: { id: c.id } })}
                right={
                  <View style={[row, { gap: spacing.xs }]}>
                    {c.max_uses != null && c.uses_count >= c.max_uses ? <Badge label={t('couponExhausted')} tone="danger" /> : statusBadge(c.is_active, c.starts_at, c.ends_at)}
                  </View>
                }
              />
            ))
          )}
        </Card>
      ) : null}
      <AppText variant="small">{t('dealSlotsHint')}</AppText>
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, EmptyState, ListRow, Screen, Segmented, statusTone } from '@/components/ui';
import { Avatar } from '@/components/Indicators';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { listCashiers, setCashierStatusLocal } from '@/features/auth/profileRepo';
import { formatDate } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import type { AccountStatus, Profile } from '@/lib/types';

type Filter = 'all' | 'pending' | 'active' | 'suspended';

export default function CashiersScreen() {
  const t = useT();
  const { row } = useLayout();
  const [filter, setFilter] = useState<Filter>('all');
  const [cashiers, refresh] = useLocalQuery(listCashiers);

  const visible = cashiers.filter((c) => filter === 'all' || c.status === filter || (filter === 'suspended' && c.status === 'rejected'));

  const change = async (c: Profile, status: AccountStatus, key: 'approveConfirm' | 'rejectConfirm' | 'suspendConfirm' | 'reactivateConfirm') => {
    const destructive = status !== 'active';
    if (!(await confirm(t(key === 'approveConfirm' ? 'approve' : key === 'rejectConfirm' ? 'reject' : key === 'suspendConfirm' ? 'suspend' : 'reactivate'), t(key, { name: c.name }), t('confirm'), t('cancel'), destructive))) return;
    setCashierStatusLocal(c.id, status);
    refresh();
    toast.success(t('statusUpdated'));
  };

  return (
    <Screen title={t('cashiersTitle')}>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('all') },
          { value: 'pending', label: t('pending') },
          { value: 'active', label: t('active') },
          { value: 'suspended', label: t('suspended') },
        ]}
      />
      <Card padded={false}>
        {visible.length === 0 ? (
          <EmptyState title={t('noCashiers')} icon="users" />
        ) : (
          visible.map((c) => (
            <ListRow
              key={c.id}
              title={c.name}
              subtitle={`${c.email ?? c.phone ?? ''}  ${t('requestedOn', { date: formatDate(c.created_at) })}`}
              left={<Avatar uri={c.photo_url} name={c.name} size={40} />}
              right={
                <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
                  <Badge label={t(c.status)} tone={statusTone(c.status)} />
                  <View style={[row, { gap: spacing.xs }]}>
                    {c.status === 'pending' ? (
                      <>
                        <Button title={t('approve')} size="sm" variant="action" onPress={() => change(c, 'active', 'approveConfirm')} />
                        <Button title={t('reject')} size="sm" variant="outline" onPress={() => change(c, 'rejected', 'rejectConfirm')} />
                      </>
                    ) : c.status === 'active' ? (
                      <Button title={t('suspend')} size="sm" variant="outline" onPress={() => change(c, 'suspended', 'suspendConfirm')} />
                    ) : (
                      <Button title={t('reactivate')} size="sm" variant="secondary" onPress={() => change(c, 'active', 'reactivateConfirm')} />
                    )}
                  </View>
                </View>
              }
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

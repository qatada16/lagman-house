import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Input, Sheet } from '@/components/ui';
import { useLayout, useT, type StringKey } from '@/lib/i18n';
import { colors, radius, spacing } from '@/constants/theme';

const REASONS: StringKey[] = ['webCancelOutOfStock', 'webCancelKitchenBusy', 'webCancelCustomerLeft', 'webCancelDuplicate', 'cancelReasonOther'];

export function CancelReasonSheet({ visible, title, onClose, onConfirm, busy }: { visible: boolean; title: string; onClose: () => void; onConfirm: (reason: string) => void; busy?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const [reason, setReason] = useState<StringKey | null>(null);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetail('');
  }, [visible]);

  const text = reason ? (reason === 'cancelReasonOther' ? detail.trim() : [t(reason), detail.trim()].filter(Boolean).join(': ')) : '';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          <Button title={t('keepOrder')} variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('cancelOrder')} variant="danger" icon="x-circle" onPress={() => onConfirm(text)} disabled={!text} loading={busy} style={{ flex: 1 }} />
        </View>
      }
    >
      <AppText variant="small">{t('webCancelHint')}</AppText>
      <View style={{ gap: spacing.xs }}>
        {REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, reason === r ? styles.active : null]}>
            <AppText weight={reason === r ? '700' : '400'} color={reason === r ? colors.textOnDark : colors.textPrimary}>
              {t(r)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <Input
        label={reason === 'cancelReasonOther' ? t('cancelReasonDetail') : `${t('cancelReasonDetail')} (${t('optional')})`}
        value={detail}
        onChangeText={setDetail}
        maxLength={120}
        placeholder={t('cancelReasonPlaceholder')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reason: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  active: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
});

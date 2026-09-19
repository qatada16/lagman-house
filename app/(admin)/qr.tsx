import React, { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText, Badge, Button, Card, EmptyState, IconButton, Input, ListRow, Screen, Sheet, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { useLocalQuery } from '@/features/app/useLocalQuery';
import { deleteTable, listTables, saveTable, tableUrl } from '@/features/qr/qrRepo';
import { confirm } from '@/lib/confirm';
import type { QrTable } from '@/lib/types';

export default function QrTablesScreen() {
  const t = useT();
  const { row } = useLayout();
  const [tables, refresh] = useLocalQuery(listTables);
  const [editing, setEditing] = useState<Partial<QrTable> | null>(null);
  const [showing, setShowing] = useState<QrTable | null>(null);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (tbl?: QrTable) => {
    setEditing(tbl ?? {});
    setCode(tbl?.code ?? '');
    setLabel(tbl?.label ?? '');
    setActive(tbl?.is_active ?? true);
    setError(null);
  };

  const save = () => {
    if (!code.trim() || !label.trim()) {
      setError(t('fieldRequired'));
      return;
    }
    const clash = tables.find((x) => x.code === code.trim().toUpperCase() && x.id !== editing?.id);
    if (clash) {
      setError(t('tableCodeHint'));
      return;
    }
    saveTable({ id: editing?.id, code, label, is_active: active });
    setEditing(null);
    refresh();
  };

  const remove = async (tbl: QrTable) => {
    if (await confirm(t('delete'), t('deleteTableConfirm', { label: tbl.label }), t('delete'), t('cancel'), true)) {
      deleteTable(tbl.id);
      refresh();
    }
  };

  const url = showing ? tableUrl(showing.code) : null;

  return (
    <Screen title={t('qrTitle')} subtitle={t('qrHint')} actions={<Button title={t('addTable')} variant="action" size="sm" icon="plus" onPress={() => startEdit()} />}>
      {!tableUrl('X') ? (
        <Card tone="highlight">
          <AppText color={colors.accentDark}>{t('publicMenuUrlMissing')}</AppText>
        </Card>
      ) : null}
      <Card padded={false}>
        {tables.length === 0 ? (
          <EmptyState title={t('none')} icon="maximize" />
        ) : (
          tables.map((tbl) => (
            <ListRow
              key={tbl.id}
              title={tbl.label}
              subtitle={tbl.code}
              onPress={() => setShowing(tbl)}
              right={
                <View style={[row, { gap: spacing.xs, alignItems: 'center' }]}>
                  {!tbl.is_active ? <Badge label={t('inactive')} /> : null}
                  <IconButton icon="edit-2" onPress={() => startEdit(tbl)} />
                  <IconButton icon="trash-2" color={colors.danger} onPress={() => remove(tbl)} />
                </View>
              }
            />
          ))
        )}
      </Card>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('editTable') : t('addTable')}>
        <Input label={t('tableCode')} value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} hint={t('tableCodeHint')} autoCapitalize="characters" error={error} />
        <Input label={t('tableLabel')} value={label} onChangeText={setLabel} />
        <Toggle label={t('active')} value={active} onChange={setActive} />
        <Button title={t('save')} onPress={save} />
      </Sheet>

      <Sheet visible={!!showing} onClose={() => setShowing(null)} title={showing?.label}>
        {url ? (
          <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
            <View style={{ padding: spacing.lg, backgroundColor: colors.white, borderRadius: 8 }}>
              <QRCode value={url} size={220} color={colors.accentDark} backgroundColor={colors.white} />
            </View>
            <AppText variant="title" align="center">
              {showing?.label}
            </AppText>
            <AppText variant="small" align="center">
              {t('scanToOrder')}
            </AppText>
            <AppText variant="mono" align="center" selectable>
              {url}
            </AppText>
            <Button title={t('copyLink')} variant="outline" icon="share-2" onPress={() => void Share.share({ message: url })} />
          </View>
        ) : (
          <AppText color={colors.danger}>{t('publicMenuUrlMissing')}</AppText>
        )}
      </Sheet>
    </Screen>
  );
}

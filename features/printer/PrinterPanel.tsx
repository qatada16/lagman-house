import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, EmptyState, ListRow, Select } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { usePrinterStore, type PrinterDevice } from '@/store/printerStore';
import { usePrint, testSlipNodes } from './usePrint';
import { listMenuItems, listVariants } from '@/features/menu/menuRepo';
import { listTemplates } from '@/features/receipts/templateRepo';
import { getSettings } from '@/features/settings/settingsRepo';
import { makeSampleOrder } from '@/features/receipts/render';
import { useAuthStore } from '@/store/authStore';

// Shared by the admin printer page and the cashier printer screen. Never creates orders.
export function PrinterPanel({ showSamplePrint = true }: { showSamplePrint?: boolean }) {
  const t = useT();
  const { row } = useLayout();
  const printer = usePrinterStore();
  const { printOrder, printRaw, printing } = usePrint();
  const profile = useAuthStore((s) => s.profile);

  const items = useMemo(() => listMenuItems({ activeOnly: true }), []);
  const templates = useMemo(() => listTemplates(true), []);
  const [itemId, setItemId] = useState<string | null>(items[0]?.id ?? null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(templates[0]?.id ?? null);

  const item = items.find((i) => i.id === itemId) ?? null;
  const variants = useMemo(() => (item?.has_variants ? listVariants(item.id) : []), [item]);
  const template = templates.find((x) => x.id === templateId) ?? null;

  const connect = (d: PrinterDevice) => void printer.connect(d);

  const statusTone = printer.status === 'connected' ? 'success' : printer.status === 'connecting' ? 'warning' : 'danger';

  const printSample = () => {
    if (!template) return;
    const variant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;
    const sample = makeSampleOrder(item, variant, profile?.id ?? null);
    void printOrder(sample.order, sample.items, template);
  };

  const deviceRow = (d: PrinterDevice) => {
    const isCurrent = printer.device?.address === d.address;
    return (
      <ListRow
        key={d.address}
        title={d.name}
        subtitle={d.address}
        right={
          isCurrent ? (
            <Badge label={t(printer.status)} tone={statusTone} />
          ) : (
            <Button title={t('connect')} size="sm" variant="outline" onPress={() => connect(d)} />
          )
        }
        onPress={isCurrent ? undefined : () => connect(d)}
      />
    );
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card title={t('printerStatus')} right={<Badge label={t(printer.status)} tone={statusTone} />}>
        {printer.device ? (
          <View style={[row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <AppText weight="600">{printer.device.name}</AppText>
              <AppText variant="small">{printer.device.address}</AppText>
            </View>
            <View style={[row, { gap: spacing.sm }]}>
              <Button title={t('connect')} size="sm" variant="secondary" onPress={() => connect(printer.device!)} loading={printer.status === 'connecting'} />
              <Button title={t('forgetPrinter')} size="sm" variant="ghost" onPress={() => void printer.forget()} />
            </View>
          </View>
        ) : (
          <AppText variant="small">{t('printerNotConnected')}</AppText>
        )}
        {!printer.bluetoothOn ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <AppText color={colors.danger}>{t('bluetoothOff')}</AppText>
            <Button title={t('enableBluetooth')} variant="outline" size="sm" onPress={() => void printer.enableBluetooth()} />
          </View>
        ) : null}
        {printer.permission === false ? (
          <AppText variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>
            {t('permissionDenied')}
          </AppText>
        ) : null}
        {printer.lastError ? (
          <AppText variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>
            {printer.lastError}
          </AppText>
        ) : null}
        <View style={[row, { gap: spacing.sm, marginTop: spacing.md }]}>
          <Button title={printer.scanning ? t('scanning') : t('scan')} icon="bluetooth" onPress={() => void printer.scan()} loading={printer.scanning} style={{ flex: 1 }} />
          <Button title={t('printTestSlip')} variant="action" icon="printer" disabled={!printer.device} loading={printing} onPress={() => void printRaw(testSlipNodes(getSettings().restaurant_name), template?.config.paperWidthMm ?? 58)} />
        </View>
      </Card>

      {(printer.paired.length > 0 || printer.found.length > 0) && (
        <Card padded={false}>
          <View style={{ padding: spacing.md, paddingBottom: 0 }}>
            <AppText variant="label" style={{ textTransform: 'uppercase' }}>
              {t('pairedDevices')}
            </AppText>
          </View>
          {printer.paired.length === 0 ? <EmptyState title={t('noDevices')} icon="bluetooth" /> : printer.paired.map(deviceRow)}
          {printer.found.length > 0 ? (
            <>
              <View style={{ padding: spacing.md, paddingBottom: 0 }}>
                <AppText variant="label" style={{ textTransform: 'uppercase' }}>
                  {t('foundDevices')}
                </AppText>
              </View>
              {printer.found.map(deviceRow)}
            </>
          ) : null}
        </Card>
      )}
      {!printer.scanning && printer.paired.length === 0 && printer.found.length === 0 && printer.permission !== false ? <AppText variant="small">{t('noDevices')}</AppText> : null}

      {showSamplePrint ? (
        <Card title={t('printItemReceipt')}>
          <AppText variant="small">{t('testPrintSampleBody')}</AppText>
          <View style={{ height: spacing.sm }} />
          <Select label={t('selectItem')} value={itemId} options={items.map((i) => ({ value: i.id, label: i.name }))} onChange={(v) => { setItemId(v); setVariantId(null); }} searchable placeholder={t('noItems')} />
          {variants.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              <Select label={t('size')} value={variantId ?? variants[0]?.id ?? null} options={variants.map((v) => ({ value: v.id, label: v.name }))} onChange={setVariantId} />
            </View>
          ) : null}
          <View style={{ marginTop: spacing.sm }}>
            <Select label={t('selectTemplate')} value={templateId} options={templates.map((x) => ({ value: x.id, label: x.name }))} onChange={setTemplateId} placeholder={t('noActiveTemplates')} />
          </View>
          <Button title={t('printReceipt')} icon="printer" style={{ marginTop: spacing.md }} disabled={!printer.device || !template} loading={printing} onPress={printSample} />
          <AppText variant="small" style={{ marginTop: spacing.sm }}>
            {t('printerHint')}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

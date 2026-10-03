import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, Select } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { colors, spacing } from '@/constants/theme';
import { usePrinterStore } from '@/store/printerStore';
import { PrinterPickerSheet } from './PrinterPickerSheet';
import { relativeTime } from '@/lib/format';
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

  const [pickerOpen, setPickerOpen] = useState(false);

  const statusTone = printer.status === 'connected' ? 'success' : printer.status === 'connecting' ? 'warning' : 'danger';

  const openPicker = () => {
    setPickerOpen(true);
    void printer.scan();
  };

  const printSample = () => {
    if (!template) return;
    const variant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;
    const sample = makeSampleOrder(item, variant, profile?.id ?? null);
    void printOrder(sample.order, sample.items, template);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card title={t('printerStatus')} right={<Badge label={t(printer.status)} tone={statusTone} />}>
        {printer.device ? (
          <View style={[row, { justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <AppText weight="600">{printer.device.name}</AppText>
              <AppText variant="small">{printer.device.address}</AppText>
            </View>
            <View style={[row, { gap: spacing.sm }]}>
              <Button title={printer.status === 'connected' ? t('reconnect') : t('connect')} size="sm" variant="secondary" onPress={() => void printer.connect(printer.device!)} loading={printer.status === 'connecting'} />
              <Button title={t('forgetPrinter')} size="sm" variant="ghost" onPress={() => void printer.forget()} />
            </View>
          </View>
        ) : (
          <AppText variant="small">{t('printerNotConnected')}</AppText>
        )}
        {printer.lastConnected ? (
          <AppText variant="small" style={{ marginTop: spacing.sm }}>
            {t('lastConnectedTo', { name: printer.lastConnected.name, time: relativeTime(printer.lastConnected.at, t('never')) })}
          </AppText>
        ) : null}
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
          <Button title={t('scan')} icon="bluetooth" onPress={openPicker} style={{ flex: 1 }} />
          <Button title={t('printTestSlip')} variant="action" icon="printer" disabled={!printer.device} loading={printing} onPress={() => void printRaw(testSlipNodes(getSettings().restaurant_name, template?.config.paperWidthMm ?? 58, template?.config.style.textSize ?? 'large', template?.config.style.charsPerLine ?? null), template?.config.paperWidthMm ?? 58)} />
        </View>
      </Card>

      <PrinterPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} />

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

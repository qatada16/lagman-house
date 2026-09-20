import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, IconButton, Input, Screen, Segmented, Select, Toggle } from '@/components/ui';
import { useLayout, useT } from '@/lib/i18n';
import { spacing } from '@/constants/theme';
import { DEFAULT_TEMPLATE_CONFIG, deleteTemplate, getTemplate, saveTemplate } from '@/features/receipts/templateRepo';
import { ReceiptPreview } from '@/features/receipts/ReceiptPreview';
import { makeSampleOrder } from '@/features/receipts/render';
import { getSettings } from '@/features/settings/settingsRepo';
import { listMenuItems, listVariants } from '@/features/menu/menuRepo';
import { usePrint } from '@/features/printer/usePrint';
import { confirm } from '@/lib/confirm';
import { toast } from '@/store/toastStore';
import type { ReceiptTemplate, ReceiptTemplateConfig } from '@/lib/types';

export default function TemplateEditScreen() {
  const t = useT();
  const router = useRouter();
  const { row } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? null : getTemplate(id)), [id, isNew]);
  const { printOrder, hasPrinter, printing } = usePrint();

  const [name, setName] = useState(existing?.name ?? '');
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [cfg, setCfg] = useState<ReceiptTemplateConfig>(existing?.config ?? DEFAULT_TEMPLATE_CONFIG);
  const [error, setError] = useState<string | null>(null);

  const sample = useMemo(() => {
    const item = listMenuItems({ activeOnly: true })[0] ?? null;
    const variant = item?.has_variants ? listVariants(item.id)[0] ?? null : null;
    return makeSampleOrder(item, variant, null);
  }, []);
  const settings = useMemo(() => getSettings(), []);

  const patch = <K extends keyof ReceiptTemplateConfig>(key: K, value: Partial<ReceiptTemplateConfig[K]>) =>
    setCfg((c) => ({ ...c, [key]: typeof c[key] === 'object' ? { ...(c[key] as object), ...(value as object) } : value }));

  const previewTemplate: ReceiptTemplate = {
    id: existing?.id ?? 'preview',
    name,
    is_active: isActive,
    sort_order: 0,
    config: cfg,
    deleted_at: null,
    created_at: '',
    updated_at: '',
  };

  const save = () => {
    if (!name.trim()) {
      setError(t('fieldRequired'));
      return;
    }
    saveTemplate({ id: existing?.id, name, is_active: isActive, config: cfg });
    toast.success(t('saved'));
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm(t('delete'), t('deleteTemplateConfirm', { name: existing.name }), t('delete'), t('cancel'), true)) {
      deleteTemplate(existing.id);
      router.back();
    }
  };

  const linesToText = (lines: string[]) => lines.join('\n');
  const textToLines = (text: string) => text.split('\n');

  return (
    <Screen
      safeTop={false}
      title={isNew ? t('newTemplate') : t('editTemplate')}
      actions={<IconButton icon="x" onPress={() => router.back()} />}
      footer={
        <View style={[row, { gap: spacing.sm }]}>
          {!isNew ? <Button title={t('delete')} variant="danger" onPress={remove} /> : null}
          <Button title={t('printTestSlip')} variant="outline" icon="printer" disabled={!hasPrinter} loading={printing} onPress={() => void printOrder(sample.order, sample.items, previewTemplate)} />
          <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      <View style={[row, { gap: spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, minWidth: 300, gap: spacing.lg }}>
          <Card>
            <Input label={t('templateName')} value={name} onChangeText={setName} error={error} placeholder="Customer" />
            <View style={{ height: spacing.sm }} />
            <Toggle label={t('templateActive')} value={isActive} onChange={setIsActive} />
            <Segmented label={t('paperWidth')} value={String(cfg.paperWidthMm)} onChange={(v) => setCfg((c) => ({ ...c, paperWidthMm: v === '80' ? 80 : 58 }))} options={[{ value: '58', label: '58 mm' }, { value: '80', label: '80 mm' }]} />
          </Card>

          <Card title={t('sectionStyle')}>
            <Select
              label={t('printerFont')}
              value={cfg.style.font}
              onChange={(v) => patch('style', { font: v })}
              options={[
                { value: 'A', label: t('fontA') },
                { value: 'B', label: t('fontB') },
              ]}
            />
            <Toggle label={t('boldHeader')} value={cfg.style.boldHeader} onChange={(v) => patch('style', { boldHeader: v })} />
            <Toggle label={t('boldItems')} value={cfg.style.boldItems} onChange={(v) => patch('style', { boldItems: v })} />
            <Toggle label={t('boldTotals')} value={cfg.style.boldTotals} onChange={(v) => patch('style', { boldTotals: v })} />
            <Toggle label={t('boldFooter')} value={cfg.style.boldFooter} onChange={(v) => patch('style', { boldFooter: v })} />
          </Card>

          <Card title={t('sectionHeader')}>
            <Toggle label={t('showRestaurantName')} value={cfg.header.showName} onChange={(v) => patch('header', { showName: v })} />
            <Toggle label={t('showLogo')} value={cfg.header.showLogo} onChange={(v) => patch('header', { showLogo: v })} />
            <Segmented label={t('position')} value={cfg.header.position} onChange={(v) => patch('header', { position: v })} options={[{ value: 'top', label: t('top') }, { value: 'bottom', label: t('bottom') }]} />
            <View style={{ height: spacing.sm }} />
            <Segmented label={t('alignment')} value={cfg.header.align} onChange={(v) => patch('header', { align: v })} options={[{ value: 'left', label: t('left') }, { value: 'center', label: t('center') }, { value: 'right', label: t('right') }]} />
            <View style={{ height: spacing.sm }} />
            <Input label={t('extraHeaderLines')} hint={t('oneLinePerRow')} value={linesToText(cfg.header.extraLines)} onChangeText={(v) => patch('header', { extraLines: textToLines(v) })} multiline />
          </Card>

          <Card title={t('sectionDateTime')}>
            <Toggle label={t('showDateTime')} value={cfg.dateTime.show} onChange={(v) => patch('dateTime', { show: v })} />
            <Segmented label={t('position')} value={cfg.dateTime.position} onChange={(v) => patch('dateTime', { position: v })} options={[{ value: 'top', label: t('top') }, { value: 'bottom', label: t('bottom') }]} />
            <View style={{ height: spacing.sm }} />
            <Segmented label={t('format')} value={cfg.dateTime.format} onChange={(v) => patch('dateTime', { format: v })} options={[{ value: 'datetime', label: t('formatDateTime') }, { value: 'date', label: t('formatDate') }, { value: 'time', label: t('formatTime') }]} />
          </Card>

          <Card title={t('sectionOrderNumber')}>
            <Toggle label={t('showOrderNumber')} value={cfg.orderNumber.show} onChange={(v) => patch('orderNumber', { show: v })} />
            <View style={[row, { gap: spacing.sm }]}>
              <Input label={t('label')} value={cfg.orderNumber.label} onChangeText={(v) => patch('orderNumber', { label: v })} containerStyle={{ flex: 2 }} />
              <Input label={t('prefix')} value={cfg.orderNumber.prefix} onChangeText={(v) => patch('orderNumber', { prefix: v })} containerStyle={{ flex: 1 }} />
            </View>
            <View style={{ height: spacing.sm }} />
            <Select
              label={t('numberFormat')}
              value={cfg.orderNumber.format}
              onChange={(v) => patch('orderNumber', { format: v })}
              options={[
                { value: 'sequence', label: t('formatSequence') },
                { value: 'short_id', label: t('formatShortId') },
                { value: 'date_sequence', label: t('formatDateSequence') },
              ]}
            />
            <Toggle label={t('showCashier')} value={cfg.cashier.show} onChange={(v) => patch('cashier', { show: v })} />
            <Toggle label={t('showTable')} value={cfg.table.show} onChange={(v) => patch('table', { show: v })} />
          </Card>

          <Card title={t('sectionItems')}>
            <Toggle label={t('colItem')} value disabled onChange={() => undefined} />
            <Toggle label={t('colSize')} value={cfg.items.columns.size} onChange={(v) => setCfg((c) => ({ ...c, items: { ...c.items, columns: { ...c.items.columns, size: v } } }))} />
            <Toggle label={t('sizeInline')} value={cfg.items.sizeInline} disabled={!cfg.items.columns.size} onChange={(v) => setCfg((c) => ({ ...c, items: { ...c.items, sizeInline: v } }))} />
            <Toggle label={t('colQty')} value={cfg.items.columns.qty} onChange={(v) => setCfg((c) => ({ ...c, items: { ...c.items, columns: { ...c.items.columns, qty: v } } }))} />
            <Toggle label={t('colPrice')} value={cfg.items.columns.price} onChange={(v) => setCfg((c) => ({ ...c, items: { ...c.items, columns: { ...c.items.columns, price: v } } }))} />
            <Toggle label={t('colSubtotal')} value={cfg.items.columns.subtotal} onChange={(v) => setCfg((c) => ({ ...c, items: { ...c.items, columns: { ...c.items.columns, subtotal: v } } }))} />
          </Card>

          <Card title={t('sectionTotals')}>
            <Toggle label={t('showTotal')} value={cfg.total.show} onChange={(v) => patch('total', { show: v })} />
            <Toggle label={t('showSubtotal')} value={cfg.total.showSubtotal} onChange={(v) => patch('total', { showSubtotal: v })} />
            <Input label={t('label')} value={cfg.total.label} onChangeText={(v) => patch('total', { label: v })} />
            <View style={{ height: spacing.sm }} />
            <Segmented label={t('totalStyle')} value={cfg.total.style} onChange={(v) => patch('total', { style: v })} options={[{ value: 'plain', label: t('stylePlain') }, { value: 'bold', label: t('styleBold') }, { value: 'double', label: t('styleDouble') }]} />
          </Card>

          <Card title={t('sectionPayment')}>
            <Toggle label={t('showAmountReceived')} value={cfg.amountReceived.show} onChange={(v) => patch('amountReceived', { show: v })} />
            <Toggle label={t('showChange')} value={cfg.amountReceived.showChange} disabled={!cfg.amountReceived.show} onChange={(v) => patch('amountReceived', { showChange: v })} />
            <Toggle label={t('showPaymentMethod')} value={cfg.paymentMethod.show} onChange={(v) => patch('paymentMethod', { show: v })} />
          </Card>

          <Card title={t('sectionNote')}>
            <Toggle label={t('showNote')} value={cfg.note.show} onChange={(v) => patch('note', { show: v })} />
            <Input label={t('label')} value={cfg.note.label} onChangeText={(v) => patch('note', { label: v })} />
          </Card>

          <Card title={t('sectionFooter')}>
            <Input label={t('footerLines')} hint={t('oneLinePerRow')} value={linesToText(cfg.footer.lines)} onChangeText={(v) => patch('footer', { lines: textToLines(v) })} multiline />
          </Card>

          <Card title={t('sectionOther')}>
            <Toggle label={t('testWatermark')} value={cfg.testWatermark} onChange={(v) => setCfg((c) => ({ ...c, testWatermark: v }))} />
            <Toggle label={t('cutPaper')} value={cfg.cut} onChange={(v) => setCfg((c) => ({ ...c, cut: v }))} />
            <Input label={t('feedLines')} value={String(cfg.feedLines)} onChangeText={(v) => setCfg((c) => ({ ...c, feedLines: Math.min(10, Number(v) || 0) }))} digitsOnly />
          </Card>
        </View>

        <View style={{ flex: 1, minWidth: 300 }}>
          <Card title={t('preview')}>
            <ReceiptPreview order={sample.order} items={sample.items} template={previewTemplate} ctx={{ settings, cashierName: 'Cashier' }} />
          </Card>
        </View>
      </View>
    </Screen>
  );
}

import { all, get, nowIso, run, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import type { ReceiptTemplate, ReceiptTemplateConfig } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

export const DEFAULT_TEMPLATE_CONFIG: ReceiptTemplateConfig = {
  paperWidthMm: 58,
  style: { font: 'A', boldHeader: true, boldItems: false, boldTotals: true, boldFooter: false },
  header: { showName: true, showLogo: false, position: 'top', align: 'center', extraLines: [] },
  dateTime: { show: true, position: 'top', format: 'datetime' },
  orderNumber: { show: true, label: 'Order', prefix: '#', format: 'sequence' },
  cashier: { show: false },
  table: { show: true },
  note: { show: true, label: 'Note' },
  items: { columns: { item: true, size: true, qty: true, price: true, subtotal: true }, sizeInline: true },
  total: { show: true, showSubtotal: false, style: 'double', label: 'TOTAL' },
  amountReceived: { show: true, showChange: true },
  paymentMethod: { show: true },
  footer: { lines: ['Thank you'] },
  testWatermark: true,
  feedLines: 3,
  cut: true,
};

type Row = Omit<ReceiptTemplate, 'config' | 'is_active'> & { config: string; is_active: number };

export function normalizeConfig(raw: unknown): ReceiptTemplateConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReceiptTemplateConfig>;
  const d = DEFAULT_TEMPLATE_CONFIG;
  return {
    paperWidthMm: c.paperWidthMm === 80 ? 80 : 58,
    style: { ...d.style, ...(c.style ?? {}) },
    header: { ...d.header, ...(c.header ?? {}) , extraLines: c.header?.extraLines ?? [] },
    dateTime: { ...d.dateTime, ...(c.dateTime ?? {}) },
    orderNumber: { ...d.orderNumber, ...(c.orderNumber ?? {}) },
    cashier: { ...d.cashier, ...(c.cashier ?? {}) },
    table: { ...d.table, ...(c.table ?? {}) },
    note: { ...d.note, ...(c.note ?? {}) },
    items: { columns: { ...d.items.columns, ...(c.items?.columns ?? {}) }, sizeInline: c.items?.sizeInline ?? d.items.sizeInline },
    total: { ...d.total, ...(c.total ?? {}) },
    amountReceived: { ...d.amountReceived, ...(c.amountReceived ?? {}) },
    paymentMethod: { ...d.paymentMethod, ...(c.paymentMethod ?? {}) },
    footer: { lines: c.footer?.lines ?? [] },
    testWatermark: c.testWatermark ?? d.testWatermark,
    feedLines: typeof c.feedLines === 'number' ? c.feedLines : d.feedLines,
    cut: c.cut ?? d.cut,
  };
}

function toTemplate(r: Row): ReceiptTemplate {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(r.config);
  } catch {
    parsed = {};
  }
  return { ...r, is_active: !!r.is_active, config: normalizeConfig(parsed) };
}

export function listTemplates(activeOnly = false): ReceiptTemplate[] {
  const where = activeOnly ? 'deleted_at IS NULL AND is_active = 1' : 'deleted_at IS NULL';
  return all<Row>(`SELECT * FROM receipt_templates WHERE ${where} ORDER BY sort_order, name`).map(toTemplate);
}

export function getTemplate(id: string): ReceiptTemplate | null {
  const r = get<Row>('SELECT * FROM receipt_templates WHERE id = ?', [id]);
  return r ? toTemplate(r) : null;
}

export function saveTemplate(input: { id?: string; name: string; is_active: boolean; config: ReceiptTemplateConfig; sort_order?: number }): ReceiptTemplate {
  const now = nowIso();
  const existing = input.id ? get<Row>('SELECT * FROM receipt_templates WHERE id = ?', [input.id]) : null;
  const row = {
    id: input.id ?? newId(),
    name: input.name.trim(),
    is_active: input.is_active ? 1 : 0,
    sort_order: input.sort_order ?? existing?.sort_order ?? listTemplates().length,
    config: JSON.stringify(input.config),
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    is_dirty: 1,
  };
  upsert('receipt_templates', row);
  requestSync();
  return toTemplate(row);
}

export function deleteTemplate(id: string) {
  const now = nowIso();
  run('UPDATE receipt_templates SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  requestSync();
}

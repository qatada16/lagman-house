import type { MenuItem, MenuItemVariant, Order, OrderItem, ReceiptTemplate, ReceiptTemplateConfig, RestaurantSettings } from '@/lib/types';
import { formatDate, formatDateTime, formatMoney, formatTime, pad, shortId } from '@/lib/format';

// Subset of the printer library's document nodes; structurally compatible with its PrintJob.
export type ReceiptNode =
  | { type: 'text'; content: string; style?: { align?: 'left' | 'center' | 'right'; bold?: boolean; size?: 1 | 2 } }
  | { type: 'line'; style?: 'solid' | 'dashed' }
  | { type: 'columns'; columns: { content: string; width: number; align?: 'left' | 'center' | 'right' }[] }
  | { type: 'table'; headers?: string[]; rows: string[][]; columnWidths: number[]; alignments: ('left' | 'center' | 'right')[] }
  | { type: 'image'; imagePath: string; options?: { align?: 'left' | 'center' | 'right'; widthPx?: number } }
  | { type: 'feed'; lines: number }
  | { type: 'cut' };

export interface ReceiptContext {
  settings: RestaurantSettings;
  cashierName?: string | null;
  logoPath?: string | null;
}

export function charsForPaper(paperWidthMm: number) {
  return paperWidthMm === 80 ? 48 : 32;
}

export function formatOrderNumber(order: Pick<Order, 'id' | 'order_number' | 'created_at'>, cfg: ReceiptTemplateConfig['orderNumber']) {
  const prefix = cfg.prefix ?? '';
  switch (cfg.format) {
    case 'short_id':
      return `${prefix}${shortId(order.id)}`;
    case 'date_sequence': {
      const d = new Date(order.created_at);
      const yymmdd = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      return `${prefix}${yymmdd}-${order.order_number}`;
    }
    default:
      return `${prefix}${order.order_number}`;
  }
}

function dateText(iso: string, format: ReceiptTemplateConfig['dateTime']['format']) {
  if (format === 'date') return formatDate(iso);
  if (format === 'time') return formatTime(iso);
  return formatDateTime(iso);
}

function itemColumns(cfg: ReceiptTemplateConfig['items']) {
  const cols: { key: 'item' | 'size' | 'qty' | 'price' | 'subtotal'; header: string; weight: number; align: 'left' | 'center' | 'right' }[] = [];
  cols.push({ key: 'item', header: 'Item', weight: 0, align: 'left' });
  if (cfg.columns.size && !cfg.sizeInline) cols.push({ key: 'size', header: 'Size', weight: 18, align: 'left' });
  if (cfg.columns.qty) cols.push({ key: 'qty', header: 'Qty', weight: 11, align: 'center' });
  if (cfg.columns.price) cols.push({ key: 'price', header: 'Price', weight: 21, align: 'right' });
  if (cfg.columns.subtotal) cols.push({ key: 'subtotal', header: 'Total', weight: 22, align: 'right' });
  let fixed = cols.reduce((s, c) => s + c.weight, 0);
  if (fixed > 68) {
    const scale = 68 / fixed;
    for (const c of cols) c.weight = Math.floor(c.weight * scale);
    fixed = cols.reduce((s, c) => s + c.weight, 0);
  }
  cols[0].weight = 100 - fixed;
  return cols;
}

export function buildReceiptNodes(order: Order, items: OrderItem[], template: ReceiptTemplate, ctx: ReceiptContext): ReceiptNode[] {
  const c = template.config;
  const cur = ctx.settings.currency_symbol;
  const money = (v: number) => formatMoney(v, cur);
  const nodes: ReceiptNode[] = [];

  const headerNodes = (): ReceiptNode[] => {
    const out: ReceiptNode[] = [];
    if (c.header.showLogo && ctx.logoPath) out.push({ type: 'image', imagePath: ctx.logoPath, options: { align: c.header.align, widthPx: 240 } });
    if (c.header.showName) {
      out.push({ type: 'text', content: ctx.settings.restaurant_name, style: { align: c.header.align, bold: true, size: 2 } });
      if (ctx.settings.restaurant_address) out.push({ type: 'text', content: ctx.settings.restaurant_address, style: { align: c.header.align } });
    }
    for (const line of c.header.extraLines) if (line.trim()) out.push({ type: 'text', content: line, style: { align: c.header.align, bold: true } });
    return out;
  };

  const dateNode = (): ReceiptNode => ({ type: 'text', content: dateText(order.created_at, c.dateTime.format), style: { align: 'left' } });

  if (c.header.position === 'top') nodes.push(...headerNodes());
  if (nodes.length) nodes.push({ type: 'line' });

  if (c.dateTime.show && c.dateTime.position === 'top') nodes.push(dateNode());
  if (c.orderNumber.show) {
    nodes.push({ type: 'text', content: `${c.orderNumber.label}: ${formatOrderNumber(order, c.orderNumber)}`, style: { bold: true } });
  }
  if (c.cashier.show && ctx.cashierName) nodes.push({ type: 'text', content: `Cashier: ${ctx.cashierName}` });
  if (c.table.show && order.table_code) nodes.push({ type: 'text', content: `Table: ${order.table_code}` });
  if (order.is_test && c.testWatermark) nodes.push({ type: 'text', content: '*** TEST ORDER ***', style: { align: 'center', bold: true } });
  nodes.push({ type: 'line' });

  const cols = itemColumns(c.items);
  const rows = items.map((it) => {
    const name = c.items.sizeInline && c.items.columns.size && it.variant_name ? `${it.item_name} (${it.variant_name})` : it.item_name;
    return cols.map((col) => {
      switch (col.key) {
        case 'item':
          return name;
        case 'size':
          return it.variant_name ?? '';
        case 'qty':
          return String(it.quantity);
        case 'price':
          return money(it.unit_price);
        case 'subtotal':
          return money(it.line_total);
      }
    });
  });
  nodes.push({
    type: 'table',
    headers: cols.map((x) => x.header),
    rows,
    columnWidths: cols.map((x) => x.weight),
    alignments: cols.map((x) => x.align),
  });
  nodes.push({ type: 'line' });

  if (c.total.show) {
    if (c.total.showSubtotal) nodes.push({ type: 'columns', columns: [{ content: 'Subtotal', width: 50 }, { content: money(order.subtotal), width: 50, align: 'right' }] });
    if (c.total.style === 'double') {
      nodes.push({ type: 'text', content: `${c.total.label}: ${money(order.total)}`, style: { align: 'right', bold: true, size: 2 } });
    } else {
      nodes.push({
        type: 'columns',
        columns: [{ content: c.total.label, width: 50 }, { content: money(order.total), width: 50, align: 'right' }],
      });
    }
  }
  if (c.amountReceived.show && order.amount_received != null) {
    nodes.push({ type: 'columns', columns: [{ content: 'Received', width: 50 }, { content: money(order.amount_received), width: 50, align: 'right' }] });
    if (c.amountReceived.showChange) {
      const change = Math.max(0, order.amount_received - order.total);
      nodes.push({ type: 'columns', columns: [{ content: 'Change', width: 50 }, { content: money(change), width: 50, align: 'right' }] });
    }
  }
  if (c.paymentMethod.show && order.payment_method) {
    nodes.push({ type: 'text', content: `Payment: ${order.payment_method === 'cash' ? 'Cash' : 'Online'}` });
  }
  if (c.note.show && order.note) {
    nodes.push({ type: 'line', style: 'dashed' });
    nodes.push({ type: 'text', content: `${c.note.label}: ${order.note}`, style: { bold: true } });
  }

  const tail: ReceiptNode[] = [];
  if (c.dateTime.show && c.dateTime.position === 'bottom') tail.push(dateNode());
  for (const line of c.footer.lines) if (line.trim()) tail.push({ type: 'text', content: line, style: { align: 'center' } });
  if (c.header.position === 'bottom') tail.push(...headerNodes());
  if (tail.length) {
    nodes.push({ type: 'line' });
    nodes.push(...tail);
  }
  nodes.push({ type: 'feed', lines: Math.max(0, Math.min(10, c.feedLines)) });
  if (c.cut) nodes.push({ type: 'cut' });
  return nodes;
}

// Plain-text rendering for on-screen previews. Mirrors the printer layout approximately.
export function receiptToText(nodes: ReceiptNode[], width: number): string {
  const lines: string[] = [];
  const fit = (s: string, w: number, align: 'left' | 'center' | 'right' = 'left') => {
    const t = s.length > w ? s.slice(0, Math.max(0, w - 1)) + '~' : s;
    const gap = w - t.length;
    if (align === 'right') return ' '.repeat(gap) + t;
    if (align === 'center') {
      const l = Math.floor(gap / 2);
      return ' '.repeat(l) + t + ' '.repeat(gap - l);
    }
    return t + ' '.repeat(gap);
  };
  const wrap = (s: string, w: number) => {
    const out: string[] = [];
    for (const raw of s.split('\n')) {
      let line = raw;
      while (line.length > w) {
        let cut = line.lastIndexOf(' ', w);
        if (cut <= 0) cut = w;
        out.push(line.slice(0, cut));
        line = line.slice(cut).trimStart();
      }
      out.push(line);
    }
    return out;
  };
  for (const n of nodes) {
    switch (n.type) {
      case 'text': {
        const w = n.style?.size === 2 ? Math.floor(width / 2) : width;
        for (const l of wrap(n.content, w)) {
          const t = fit(l, w, n.style?.align ?? 'left');
          lines.push(n.style?.size === 2 ? t.split('').join(' ') : t);
        }
        break;
      }
      case 'line':
        lines.push((n.style === 'dashed' ? '- ' : '-').repeat(n.style === 'dashed' ? Math.floor(width / 2) : width));
        break;
      case 'columns': {
        const total = n.columns.reduce((s, c) => s + c.width, 0) || 100;
        lines.push(n.columns.map((c) => fit(c.content, Math.floor((width * c.width) / total), c.align)).join(''));
        break;
      }
      case 'table': {
        const total = n.columnWidths.reduce((s, w) => s + w, 0) || 100;
        const widths = n.columnWidths.map((w) => Math.max(3, Math.floor((width * w) / total)));
        const row = (cells: string[]) => cells.map((c, i) => fit(c, widths[i], n.alignments[i])).join('');
        if (n.headers) {
          lines.push(row(n.headers));
          lines.push('-'.repeat(width));
        }
        for (const r of n.rows) {
          const first = r[0] ?? '';
          if (first.length > widths[0]) {
            const parts = wrap(first, widths[0]);
            lines.push(row([parts[0], ...r.slice(1)]));
            for (const p of parts.slice(1)) lines.push(fit(p, widths[0]));
          } else lines.push(row(r));
        }
        break;
      }
      case 'image':
        lines.push(fit('[ LOGO ]', width, 'center'));
        break;
      case 'feed':
        for (let i = 0; i < n.lines; i++) lines.push('');
        break;
      case 'cut':
        lines.push(fit('- - - cut - - -', width, 'center'));
        break;
    }
  }
  return lines.join('\n');
}

export function makeSampleOrder(item: MenuItem | null, variant: MenuItemVariant | null, cashierId: string | null): { order: Order; items: OrderItem[] } {
  const now = new Date().toISOString();
  const price = variant ? variant.price : item?.base_price ?? 250;
  const name = item?.name ?? 'Sample item';
  const order: Order = {
    id: '00000000-0000-4000-8000-000000000000',
    order_number: 'T-1',
    cashier_id: cashierId,
    status: 'completed',
    source: 'pos',
    customer_order_id: null,
    table_code: 'T1',
    subtotal: price * 2,
    total: price * 2,
    amount_received: price * 2 + 50,
    payment_method: 'cash',
    note: 'Sample note for template preview',
    is_test: true,
    stock_deducted: false,
    device_id: null,
    created_at: now,
    completed_at: now,
    updated_at: now,
  };
  const items: OrderItem[] = [
    {
      id: 'sample-item',
      order_id: order.id,
      menu_item_id: item?.id ?? null,
      variant_id: variant?.id ?? null,
      item_name: name,
      variant_name: variant?.name ?? null,
      unit_price: price,
      quantity: 2,
      line_total: price * 2,
      created_at: now,
      updated_at: now,
    },
  ];
  return { order, items };
}

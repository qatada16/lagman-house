import type { MenuItem, MenuItemVariant, Order, OrderItem, ReceiptTemplate, ReceiptTemplateConfig, RestaurantSettings } from '@/lib/types';
import { formatDate, formatDateTime, formatMoney, formatTime, pad, shortId } from '@/lib/format';

type Align = 'left' | 'center' | 'right';
type Font = 'A' | 'B';

// Subset of the printer library's document nodes; structurally compatible with its PrintJob.
export type ReceiptNode =
  | { type: 'text'; content: string; style?: { align?: Align; bold?: boolean; size?: 1 | 2; font?: Font } }
  | { type: 'line'; style?: 'solid' | 'dashed' }
  | { type: 'columns'; columns: { content: string; width: number; align?: Align }[]; style?: { bold?: boolean; font?: Font } }
  | { type: 'table'; headers?: string[]; rows: string[][]; columnWidths: number[]; alignments: Align[]; headerStyle?: { bold?: boolean; font?: Font }; cellStyle?: { bold?: boolean; font?: Font } }
  | { type: 'image'; imagePath: string; options?: { align?: Align; widthPx?: number } }
  | { type: 'feed'; lines: number }
  | { type: 'cut' };

export interface ReceiptContext {
  settings: RestaurantSettings;
  cashierName?: string | null;
  logoPath?: string | null;
}

// Characters per line for common ESC/POS printers.
export function charsForPaper(paperWidthMm: number, font: Font = 'A') {
  if (font === 'B') return paperWidthMm === 80 ? 64 : 42;
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
  const cols: { key: 'item' | 'size' | 'qty' | 'price' | 'subtotal'; header: string; weight: number; align: Align }[] = [];
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
  const st = c.style;
  const font = st.font;
  const cur = ctx.settings.currency_symbol;
  const money = (v: number) => formatMoney(v, cur);
  const nodes: ReceiptNode[] = [];
  const text = (content: string, style: { align?: Align; bold?: boolean; size?: 1 | 2 } = {}): ReceiptNode => ({ type: 'text', content, style: { font, ...style } });
  const cols2 = (left: string, right: string, bold = false): ReceiptNode => ({
    type: 'columns',
    columns: [{ content: left, width: 50 }, { content: right, width: 50, align: 'right' }],
    style: { bold, font },
  });

  const headerNodes = (): ReceiptNode[] => {
    const out: ReceiptNode[] = [];
    if (c.header.showLogo && ctx.logoPath) out.push({ type: 'image', imagePath: ctx.logoPath, options: { align: c.header.align, widthPx: 240 } });
    if (c.header.showName) {
      out.push(text(ctx.settings.restaurant_name, { align: c.header.align, bold: st.boldHeader, size: 2 }));
      if (ctx.settings.restaurant_address) out.push(text(ctx.settings.restaurant_address, { align: c.header.align }));
    }
    for (const line of c.header.extraLines) if (line.trim()) out.push(text(line, { align: c.header.align, bold: st.boldHeader }));
    return out;
  };

  const dateNode = () => text(dateText(order.created_at, c.dateTime.format));

  if (c.header.position === 'top') nodes.push(...headerNodes());
  if (nodes.length) nodes.push({ type: 'line' });

  if (c.dateTime.show && c.dateTime.position === 'top') nodes.push(dateNode());
  if (c.orderNumber.show) nodes.push(text(`${c.orderNumber.label}: ${formatOrderNumber(order, c.orderNumber)}`, { bold: true }));
  if (c.cashier.show && ctx.cashierName) nodes.push(text(`Cashier: ${ctx.cashierName}`));
  if (c.table.show && order.table_code) nodes.push(text(`Table: ${order.table_code}`));
  if (order.is_test && c.testWatermark) nodes.push(text('*** TEST ORDER ***', { align: 'center', bold: true }));
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
    headerStyle: { bold: true, font },
    cellStyle: { bold: st.boldItems, font },
  });
  nodes.push({ type: 'line' });

  if (c.total.show) {
    if (c.total.showSubtotal) nodes.push(cols2('Subtotal', money(order.subtotal)));
    if (c.total.style === 'double') nodes.push(text(`${c.total.label}: ${money(order.total)}`, { align: 'right', bold: st.boldTotals, size: 2 }));
    else nodes.push(cols2(c.total.label, money(order.total), c.total.style === 'bold' || st.boldTotals));
  }
  if (c.amountReceived.show && order.amount_received != null) {
    nodes.push(cols2('Received', money(order.amount_received), st.boldTotals));
    if (c.amountReceived.showChange) nodes.push(cols2('Change', money(Math.max(0, order.amount_received - order.total)), st.boldTotals));
  }
  if (c.paymentMethod.show && order.payment_method) nodes.push(text(`Payment: ${order.payment_method === 'cash' ? 'Cash' : 'Online'}`));
  if (c.note.show && order.note) {
    nodes.push({ type: 'line', style: 'dashed' });
    nodes.push(text(`${c.note.label}: ${order.note}`, { bold: true }));
  }

  const tail: ReceiptNode[] = [];
  if (c.dateTime.show && c.dateTime.position === 'bottom') tail.push(dateNode());
  for (const line of c.footer.lines) if (line.trim()) tail.push(text(line, { align: 'center', bold: st.boldFooter }));
  if (c.header.position === 'bottom') tail.push(...headerNodes());
  if (tail.length) {
    nodes.push({ type: 'line' });
    nodes.push(...tail);
  }
  nodes.push({ type: 'feed', lines: Math.max(0, Math.min(10, c.feedLines)) });
  if (c.cut) nodes.push({ type: 'cut' });
  return nodes;
}

export interface PreviewLine {
  text: string;
  bold?: boolean;
  size?: 1 | 2;
  kind?: 'text' | 'rule' | 'image' | 'cut';
}

// Line-by-line rendering for on-screen previews, mirroring the printer layout.
export function receiptToLines(nodes: ReceiptNode[], width: number): PreviewLine[] {
  const out: PreviewLine[] = [];
  const fit = (s: string, w: number, align: Align = 'left') => {
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
    const res: string[] = [];
    for (const raw of s.split('\n')) {
      let line = raw;
      while (line.length > w) {
        let cut = line.lastIndexOf(' ', w);
        if (cut <= 0) cut = w;
        res.push(line.slice(0, cut));
        line = line.slice(cut).trimStart();
      }
      res.push(line);
    }
    return res;
  };
  for (const n of nodes) {
    switch (n.type) {
      case 'text': {
        const size = n.style?.size === 2 ? 2 : 1;
        const w = size === 2 ? Math.floor(width / 2) : width;
        for (const l of wrap(n.content, w)) out.push({ text: fit(l, w, n.style?.align ?? 'left'), bold: n.style?.bold, size });
        break;
      }
      case 'line':
        out.push({ text: (n.style === 'dashed' ? '- ' : '-').repeat(n.style === 'dashed' ? Math.floor(width / 2) : width), kind: 'rule' });
        break;
      case 'columns': {
        const total = n.columns.reduce((s, c) => s + c.width, 0) || 100;
        out.push({ text: n.columns.map((c) => fit(c.content, Math.floor((width * c.width) / total), c.align)).join(''), bold: n.style?.bold });
        break;
      }
      case 'table': {
        const total = n.columnWidths.reduce((s, w) => s + w, 0) || 100;
        const widths = n.columnWidths.map((w) => Math.max(3, Math.floor((width * w) / total)));
        const row = (cells: string[]) => cells.map((c, i) => fit(c, widths[i], n.alignments[i])).join('');
        if (n.headers) {
          out.push({ text: row(n.headers), bold: n.headerStyle?.bold });
          out.push({ text: '-'.repeat(width), kind: 'rule' });
        }
        for (const r of n.rows) {
          const first = r[0] ?? '';
          if (first.length > widths[0]) {
            const parts = wrap(first, widths[0]);
            out.push({ text: row([parts[0], ...r.slice(1)]), bold: n.cellStyle?.bold });
            for (const p of parts.slice(1)) out.push({ text: fit(p, widths[0]), bold: n.cellStyle?.bold });
          } else out.push({ text: row(r), bold: n.cellStyle?.bold });
        }
        break;
      }
      case 'image':
        out.push({ text: fit('[ LOGO ]', width, 'center'), kind: 'image' });
        break;
      case 'feed':
        for (let i = 0; i < n.lines; i++) out.push({ text: '' });
        break;
      case 'cut':
        out.push({ text: fit('- - - cut - - -', width, 'center'), kind: 'cut' });
        break;
    }
  }
  return out;
}

export function makeSampleOrder(item: MenuItem | null, variant: MenuItemVariant | null, cashierId: string | null): { order: Order; items: OrderItem[] } {
  const now = new Date().toISOString();
  const price = variant ? variant.price : item?.base_price ?? 250;
  const name = item?.name ?? 'Sample item';
  const order: Order = {
    id: '00000000-0000-4000-8000-000000000000',
    order_number: 'T-1',
    cashier_id: cashierId,
    admin_id: null,
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
      admin_id: null,
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

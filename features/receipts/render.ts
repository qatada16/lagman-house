import type { MenuItem, MenuItemVariant, Order, OrderItem, ReceiptTemplate, ReceiptTemplateConfig, ReceiptTextSize, RestaurantSettings } from '@/lib/types';
import { formatDate, formatDateTime, formatTime, pad, shortId } from '@/lib/format';

type Align = 'left' | 'center' | 'right';

// Nodes handed to the printer library. Text is sent as raw ESC/POS bytes so the
// printed layout is exactly the one computed here (and shown in the preview).
export type ReceiptNode =
  | { type: 'raw'; data: number[] }
  | { type: 'image'; imagePath: string; options?: { align?: Align; widthPx?: number } }
  | { type: 'feed'; lines: number }
  | { type: 'cut' };

export interface ReceiptContext {
  settings: RestaurantSettings;
  cashierName?: string | null;
  logoPath?: string | null;
}

export interface ReceiptLine {
  kind: 'text' | 'rule' | 'logo';
  text: string;
  bold?: boolean;
  big?: boolean;
  align?: Align;
}

export interface ReceiptLayout {
  width: number;
  textSize: ReceiptTextSize;
  lines: ReceiptLine[];
  feedLines: number;
  cut: boolean;
}

export function defaultCharsPerLine(paperWidthMm: number, textSize: ReceiptTextSize) {
  if (textSize === 'large') return paperWidthMm === 80 ? 48 : 32;
  return paperWidthMm === 80 ? 64 : 42;
}

export function charsPerLine(cfg: ReceiptTemplateConfig) {
  return cfg.style.charsPerLine ?? defaultCharsPerLine(cfg.paperWidthMm, cfg.style.textSize);
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

export function num(v: number) {
  const r = Math.round(v * 100) / 100;
  return r.toLocaleString('en-US', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function toAscii(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

function fit(s: string, w: number, align: Align = 'left') {
  const t = s.length > w ? s.slice(0, w) : s;
  const gap = w - t.length;
  if (align === 'right') return ' '.repeat(gap) + t;
  if (align === 'center') {
    const l = Math.floor(gap / 2);
    return ' '.repeat(l) + t + ' '.repeat(gap - l);
  }
  return t + ' '.repeat(gap);
}

function wrapChars(s: string, w: number): string[] {
  if (w <= 0) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += w) out.push(s.slice(i, i + w));
  return out.length ? out : [''];
}

export function wrapWords(s: string, w: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (word.length > w) {
        if (line) out.push(line);
        const chunks = wrapChars(word, w);
        line = chunks.pop() ?? '';
        out.push(...chunks);
        continue;
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= w) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

interface Col {
  key: 'item' | 'size' | 'qty' | 'price' | 'subtotal';
  header: string;
  width: number;
  align: Align;
  numeric: boolean;
}

const MIN_ITEM = 8;

function tableColumns(cfg: ReceiptTemplateConfig['items'], width: number, cells: Record<Col['key'], string[]>): Col[] {
  const cols: Col[] = [{ key: 'item', header: 'Item', width: 0, align: 'left', numeric: false }];
  if (cfg.columns.size && !cfg.sizeInline) cols.push({ key: 'size', header: 'Size', width: 0, align: 'left', numeric: false });
  if (cfg.columns.qty) cols.push({ key: 'qty', header: 'Qty', width: 0, align: 'center', numeric: true });
  if (cfg.columns.price) cols.push({ key: 'price', header: 'Price', width: 0, align: 'right', numeric: true });
  if (cfg.columns.subtotal) cols.push({ key: 'subtotal', header: 'Total', width: 0, align: 'right', numeric: true });

  for (const c of cols) {
    if (c.key === 'item') continue;
    const longest = Math.max(0, ...cells[c.key].map((v) => v.length));
    c.width = c.key === 'size' ? Math.min(Math.max(c.header.length, longest), 8) : Math.max(c.header.length, longest);
  }
  const gaps = cols.length - 1;
  const others = () => cols.reduce((s, c) => s + (c.key === 'item' ? 0 : c.width), 0);
  // Shrink the widest non-item column until the item column has room; overflow then wraps in place.
  while (width - gaps - others() < MIN_ITEM) {
    const widest = cols.filter((c) => c.key !== 'item').sort((a, b) => b.width - a.width)[0];
    if (!widest || widest.width <= 3) break;
    widest.width -= 1;
  }
  cols[0].width = Math.max(1, width - gaps - others());
  return cols;
}

export function layoutReceipt(order: Order, items: OrderItem[], template: ReceiptTemplate, ctx: ReceiptContext): ReceiptLayout {
  const c = template.config;
  const st = c.style;
  const W = charsPerLine(c);
  const half = Math.max(8, Math.floor(W / 2));
  const cur = ctx.settings.currency_symbol;
  const lines: ReceiptLine[] = [];
  const rule = () => lines.push({ kind: 'rule', text: '-'.repeat(W) });
  const text = (s: string, opts: { align?: Align; bold?: boolean; big?: boolean } = {}) => {
    const w = opts.big ? half : W;
    for (const l of wrapWords(toAscii(s), w)) lines.push({ kind: 'text', text: fit(l, w, opts.align ?? 'left').trimEnd(), bold: opts.bold, big: opts.big, align: opts.align });
  };
  const pair = (label: string, value: string, opts: { bold?: boolean; big?: boolean } = {}) => {
    const w = opts.big ? half : W;
    const l = toAscii(label);
    const v = toAscii(value);
    if (l.length + 1 + v.length <= w) {
      lines.push({ kind: 'text', text: l + fit(v, w - l.length, 'right'), bold: opts.bold, big: opts.big });
      return;
    }
    for (const part of wrapWords(l, w)) lines.push({ kind: 'text', text: part, bold: opts.bold, big: opts.big });
    for (const part of wrapChars(v, w)) lines.push({ kind: 'text', text: fit(part, w, 'right'), bold: opts.bold, big: opts.big });
  };

  const header = () => {
    if (c.header.showLogo && ctx.logoPath) lines.push({ kind: 'logo', text: '', align: c.header.align });
    if (c.header.showName) {
      text(ctx.settings.restaurant_name, { align: c.header.align, bold: st.boldHeader, big: true });
      if (ctx.settings.restaurant_address) text(ctx.settings.restaurant_address, { align: c.header.align });
    }
    for (const l of c.header.extraLines) if (l.trim()) text(l, { align: c.header.align, bold: st.boldHeader });
  };

  if (c.header.position === 'top') {
    header();
    if (lines.length) rule();
  }

  if (c.dateTime.show && c.dateTime.position === 'top') text(dateText(order.created_at, c.dateTime.format));
  if (c.orderNumber.show) text(`${c.orderNumber.label}: ${formatOrderNumber(order, c.orderNumber)}`, { bold: true });
  if (c.cashier.show && ctx.cashierName) text(`Cashier: ${ctx.cashierName}`);
  if (c.table.show && order.table_code) text(`Table: ${order.table_code}`);
  if (order.is_test && c.testWatermark) text('*** TEST ORDER ***', { align: 'center', bold: true });
  rule();

  const cells: Record<Col['key'], string[]> = {
    item: items.map((it) => (c.items.sizeInline && c.items.columns.size && it.variant_name ? `${it.item_name} (${it.variant_name})` : it.item_name)),
    size: items.map((it) => it.variant_name ?? ''),
    qty: items.map((it) => `${c.items.qtyPrefix ? 'x' : ''}${it.quantity}`),
    price: items.map((it) => num(it.unit_price)),
    subtotal: items.map((it) => num(it.line_total)),
  };
  for (const k of Object.keys(cells) as Col['key'][]) cells[k] = cells[k].map(toAscii);
  const cols = tableColumns(c.items, W, cells);

  const renderRow = (values: string[], bold: boolean) => {
    const wrapped = cols.map((col, i) => (col.numeric ? wrapChars(values[i], col.width) : wrapWords(values[i], col.width)));
    const height = Math.max(...wrapped.map((w) => w.length));
    for (let r = 0; r < height; r++) {
      const line = cols.map((col, i) => fit(wrapped[i][r] ?? '', col.width, col.align)).join(' ');
      lines.push({ kind: 'text', text: line.trimEnd(), bold });
    }
  };

  renderRow(cols.map((col) => col.header), true);
  rule();
  items.forEach((_, idx) => renderRow(cols.map((col) => cells[col.key][idx]), st.boldItems));
  rule();

  if (c.total.show) {
    if (c.total.showSubtotal) pair('Subtotal', num(order.subtotal));
    pair(c.total.label, `${cur} ${num(order.total)}`, { bold: st.boldTotals || c.total.style !== 'plain', big: c.total.style === 'double' });
  }
  if (c.amountReceived.show && order.amount_received != null) {
    pair('Received', num(order.amount_received));
    if (c.amountReceived.showChange) pair('Change', num(Math.max(0, order.amount_received - order.total)));
  }
  if (c.paymentMethod.show && order.payment_method) pair('Payment', order.payment_method === 'cash' ? 'Cash' : 'Online');
  if (c.note.show && order.note) {
    rule();
    text(`${c.note.label}: ${order.note}`, { bold: true });
  }

  const tailStart = lines.length;
  if (c.dateTime.show && c.dateTime.position === 'bottom') text(dateText(order.created_at, c.dateTime.format));
  for (const l of c.footer.lines) if (l.trim()) text(l, { align: 'center', bold: st.boldFooter });
  if (c.header.position === 'bottom') header();
  if (lines.length > tailStart) lines.splice(tailStart, 0, { kind: 'rule', text: '-'.repeat(W) });

  return { width: W, textSize: st.textSize, lines, feedLines: Math.max(0, Math.min(10, c.feedLines)), cut: c.cut };
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function prelude(size: ReceiptTextSize): number[] {
  const font = size === 'large' ? 0 : 1;
  const spacing = size === 'large' ? 32 : size === 'medium' ? 44 : 26;
  return [ESC, 0x61, 0, ESC, 0x4d, font, ESC, 0x33, spacing];
}

function sizeByte(size: ReceiptTextSize, big?: boolean) {
  if (big) return 0x11;
  return size === 'medium' ? 0x01 : 0x00;
}

export function layoutToNodes(layout: ReceiptLayout, logoPath?: string | null): ReceiptNode[] {
  const nodes: ReceiptNode[] = [];
  let buf: number[] = prelude(layout.textSize);
  const flush = () => {
    if (buf.length) nodes.push({ type: 'raw', data: buf });
    buf = [];
  };
  for (const line of layout.lines) {
    if (line.kind === 'logo') {
      if (!logoPath) continue;
      flush();
      nodes.push({ type: 'image', imagePath: logoPath, options: { align: line.align ?? 'center', widthPx: 240 } });
      buf = prelude(layout.textSize);
      continue;
    }
    buf.push(ESC, 0x45, line.bold ? 1 : 0, GS, 0x21, sizeByte(layout.textSize, line.big));
    for (const ch of line.text) buf.push(ch.charCodeAt(0));
    buf.push(LF);
  }
  buf.push(ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x4d, 0, ESC, 0x32);
  flush();
  if (layout.feedLines) nodes.push({ type: 'feed', lines: layout.feedLines });
  if (layout.cut) nodes.push({ type: 'cut' });
  return nodes;
}

export function buildReceiptNodes(order: Order, items: OrderItem[], template: ReceiptTemplate, ctx: ReceiptContext): ReceiptNode[] {
  return layoutToNodes(layoutReceipt(order, items, template, ctx), ctx.logoPath);
}

export function testSlipLayout(restaurantName: string, paperWidthMm: 58 | 80, textSize: ReceiptTextSize, width: number | null): ReceiptLayout {
  const W = width ?? defaultCharsPerLine(paperWidthMm, textSize);
  const ruler = Array.from({ length: W }, (_, i) => String((i + 1) % 10)).join('');
  const lines: ReceiptLine[] = [
    { kind: 'text', text: fit(toAscii(restaurantName).slice(0, Math.floor(W / 2)), Math.floor(W / 2), 'center').trimEnd(), big: true, bold: true },
    { kind: 'text', text: fit('Printer test', W, 'center').trimEnd() },
    { kind: 'rule', text: '-'.repeat(W) },
    { kind: 'text', text: ruler },
    { kind: 'text', text: `${W} characters per line` },
    { kind: 'text', text: 'Left' + fit('Right', W - 4, 'right') },
    { kind: 'text', text: 'Bold line', bold: true },
    { kind: 'rule', text: '-'.repeat(W) },
    { kind: 'text', text: fit(formatDateTime(new Date().toISOString()), W, 'center').trimEnd() },
  ];
  return { width: W, textSize, lines, feedLines: 3, cut: true };
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
    subtotal: price * 2 + 1450,
    total: price * 2 + 1450,
    amount_received: price * 2 + 1500,
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
    {
      id: 'sample-item-2',
      order_id: order.id,
      admin_id: null,
      menu_item_id: null,
      variant_id: null,
      item_name: 'Special Lagman with hand pulled noodles and beef',
      variant_name: null,
      unit_price: 1450,
      quantity: 1,
      line_total: 1450,
      created_at: now,
      updated_at: now,
    },
  ];
  return { order, items };
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.LAGMAN_CONFIG;
const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
const params = new URLSearchParams(location.search);
const tableCode = (params.get('t') || '').toUpperCase();

const STR = {
  en: {
    items: 'items', review: 'Review order', yourOrder: 'Your order', name: 'Your name (optional)', note: 'Note for the kitchen (optional)',
    total: 'Total', send: 'Send to cashier', disclaimer: 'A cashier will confirm your order and take payment at the counter.',
    sent: 'Order sent', sentBody: 'Please wait for the cashier to confirm your order.', again: 'Start a new order', empty: 'The menu is not available right now.',
    add: 'Add', all: 'All', table: 'Table', loading: 'Loading menu', failed: 'Could not load the menu. Check your connection.', sending: 'Sending',
    pending: 'Waiting for a cashier', claimed: 'A cashier is preparing your order', completed: 'Your order is confirmed', cancelled: 'This order was cancelled',
    unknownTable: 'Unknown table code', currency: 'Rs',
  },
  
  ur: {
    items: 'آئٹمز', review: 'آرڈر کا جائزہ', yourOrder: 'آپ کا آرڈر', name: 'آپ کا نام (اختیاری)', note: 'کچن کے لیے نوٹ (اختیاری)',
    total: 'کل', send: 'کیشیئر کو بھیجیں', disclaimer: 'کیشیئر آپ کے آرڈر کی تصدیق کرے گا اور کاؤنٹر پر ادائیگی لے گا۔',
    sent: 'آرڈر بھیج دیا گیا', sentBody: 'براہ کرم کیشیئر کی تصدیق کا انتظار کریں۔', again: 'نیا آرڈر شروع کریں', empty: 'مینو ابھی دستیاب نہیں۔',
    add: 'شامل کریں', all: 'سب', table: 'ٹیبل', loading: 'مینو لوڈ ہو رہا ہے', failed: 'مینو لوڈ نہیں ہو سکا۔ کنکشن چیک کریں۔', sending: 'بھیجا جا رہا ہے',
    pending: 'کیشیئر کا انتظار', claimed: 'کیشیئر آپ کا آرڈر تیار کر رہا ہے', completed: 'آپ کے آرڈر کی تصدیق ہو گئی', cancelled: 'یہ آرڈر منسوخ ہو گیا',
    unknownTable: 'نامعلوم ٹیبل کوڈ', currency: 'Rs',
  },
};

let lang = localStorage.getItem('lh.lang') === 'ur' ? 'ur' : 'en';
let categories = [];
let items = [];
let variants = [];
let settings = { restaurant_name: 'Lagman House', currency_symbol: 'Rs' };
let activeCategory = 'all';
const cart = new Map();

const $ = (id) => document.getElementById(id);
const t = (k) => STR[lang][k] || STR.en[k] || k;
const money = (v) => `${settings.currency_symbol} ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const name = (row) => (lang === 'ur' && row.name_ur ? row.name_ur : row.name);

function applyLang() {
  document.body.classList.toggle('rtl', lang === 'ur');
  document.documentElement.lang = lang;
  $('langBtn').textContent = lang === 'ur' ? 'English' : 'اردو';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $('tableLabel').textContent = tableCode ? `${t('table')} ${tableCode}` : '';
  renderCategories();
  renderMenu();
  renderCart();
}

function showStatus(text, error = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', error);
  el.classList.toggle('hidden', !text);
}

async function load() {
  showStatus(t('loading'));
  try {
    const [cat, mi, va, st, tbl] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).is('deleted_at', null).order('sort_order'),
      supabase.from('menu_items').select('*').eq('is_active', true).is('deleted_at', null).order('sort_order'),
      supabase.from('menu_item_variants').select('*').is('deleted_at', null).order('sort_order'),
      supabase.from('settings').select('*'),
      tableCode ? supabase.from('qr_tables').select('*').eq('code', tableCode).is('deleted_at', null).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (cat.error || mi.error || va.error) throw cat.error || mi.error || va.error;
    categories = cat.data || [];
    items = mi.data || [];
    variants = va.data || [];
    for (const row of st.data || []) if (typeof row.value === 'string') settings[row.key] = row.value;
    $('restaurantName').textContent = settings.restaurant_name;
    document.title = `${settings.restaurant_name} Menu`;
    showStatus(tableCode && !tbl.data ? `${t('unknownTable')}: ${tableCode}` : '', !!(tableCode && !tbl.data));
    $('empty').classList.toggle('hidden', items.length > 0);
    renderCategories();
    renderMenu();
  } catch (e) {
    console.error(e);
    showStatus(t('failed'), true);
  }
}

function renderCategories() {
  const nav = $('categories');
  nav.innerHTML = '';
  const used = new Set(items.map((i) => i.category_id));
  const list = [{ id: 'all', name: t('all'), name_ur: t('all') }, ...categories.filter((c) => used.has(c.id))];
  for (const c of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name(c);
    b.className = c.id === activeCategory ? 'active' : '';
    b.onclick = () => {
      activeCategory = c.id;
      renderCategories();
      renderMenu();
    };
    nav.appendChild(b);
  }
}

function renderMenu() {
  const grid = $('menu');
  grid.innerHTML = '';
  const visible = items.filter((i) => activeCategory === 'all' || i.category_id === activeCategory);
  for (const item of visible) {
    const vs = variants.filter((v) => v.menu_item_id === item.id);
    const card = document.createElement('div');
    card.className = 'card';
    const media = item.image_url ? `<img src="${item.image_url}" alt="" loading="lazy" />` : `<div class="ph">${(item.name[0] || '').toUpperCase()}</div>`;
    const priceText = item.has_variants ? (vs.length ? `${money(Math.min(...vs.map((v) => v.price)))}+` : '') : money(item.base_price);
    const select = item.has_variants && vs.length ? `<select>${vs.map((v) => `<option value="${v.id}">${v.name} - ${money(v.price)}</option>`).join('')}</select>` : '';
    card.innerHTML = `${media}<div class="body"><div class="name">${name(item)}</div>${item.description ? `<div class="desc">${item.description}</div>` : ''}<div class="price">${priceText}</div><div class="row">${select}<button class="add primary" type="button">${t('add')}</button></div></div>`;
    card.querySelector('.add').onclick = () => {
      const sel = card.querySelector('select');
      const variant = sel ? vs.find((v) => v.id === sel.value) : null;
      if (item.has_variants && !variant) return;
      addToCart(item, variant);
    };
    grid.appendChild(card);
  }
}

function addToCart(item, variant) {
  const key = `${item.id}:${variant ? variant.id : ''}`;
  const existing = cart.get(key);
  if (existing) existing.quantity += 1;
  else cart.set(key, { menu_item_id: item.id, variant_id: variant ? variant.id : null, name: item.name, variant_name: variant ? variant.name : null, unit_price: variant ? variant.price : item.base_price, quantity: 1 });
  renderCart();
}

function cartTotal() {
  let total = 0;
  for (const l of cart.values()) total += l.unit_price * l.quantity;
  return total;
}

function renderCart() {
  let count = 0;
  for (const l of cart.values()) count += l.quantity;
  $('cartBar').classList.toggle('hidden', count === 0);
  $('cartCount').textContent = String(count);
  $('cartTotal').textContent = money(cartTotal());
  $('sheetTotal').textContent = money(cartTotal());
  const lines = $('cartLines');
  lines.innerHTML = '';
  for (const [key, l] of cart) {
    const row = document.createElement('div');
    row.className = 'line';
    row.innerHTML = `<div class="info"><div>${l.name}${l.variant_name ? ` (${l.variant_name})` : ''}</div><div class="sub">${money(l.unit_price)} x ${l.quantity}</div></div><div class="qty"><button type="button" data-d="-1">-</button><span>${l.quantity}</span><button type="button" data-d="1">+</button></div>`;
    row.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      l.quantity += Number(b.dataset.d);
      if (l.quantity <= 0) cart.delete(key);
      renderCart();
      if (cart.size === 0) $('sheet').classList.add('hidden');
    }));
    lines.appendChild(row);
  }
}

async function submit() {
  if (cart.size === 0) return;
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = t('sending');
  const payload = {
    table_code: tableCode || null,
    customer_name: $('customerName').value.trim() || null,
    note: $('note').value.trim() || null,
    items: [...cart.values()],
    status: 'pending',
  };
  const { data, error } = await supabase.from('customer_orders').insert(payload).select('id').single();
  btn.disabled = false;
  btn.textContent = t('send');
  if (error) {
    showStatus(error.message, true);
    $('sheet').classList.add('hidden');
    return;
  }
  cart.clear();
  renderCart();
  $('sheet').classList.add('hidden');
  $('done').classList.remove('hidden');
  watchOrder(data.id);
}

let channel = null;
function watchOrder(id) {
  $('doneStatus').textContent = t('pending');
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`co:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${id}` }, (p) => {
      $('doneStatus').textContent = t(p.new.status) || p.new.status;
    })
    .subscribe();
}

$('langBtn').onclick = () => {
  lang = lang === 'ur' ? 'en' : 'ur';
  localStorage.setItem('lh.lang', lang);
  applyLang();
};
$('reviewBtn').onclick = () => $('sheet').classList.remove('hidden');
$('closeSheet').onclick = () => $('sheet').classList.add('hidden');
$('sheet').onclick = (e) => { if (e.target === $('sheet')) $('sheet').classList.add('hidden'); };
$('submitBtn').onclick = submit;
$('againBtn').onclick = () => {
  $('done').classList.add('hidden');
  if (channel) supabase.removeChannel(channel);
};

applyLang();
load();

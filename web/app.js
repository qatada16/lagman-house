import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.LAGMAN_CONFIG;
const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
const menuToken = new URLSearchParams(location.search).get('m') || null;

const STR = {
  en: {
    items: 'items', review: 'Review order', yourOrder: 'Your order', name: 'Your name (optional)', note: 'Note for the kitchen (optional)',
    total: 'Total', send: 'Send to cashier', disclaimer: 'A cashier will confirm your order and take payment at the counter.',
    sent: 'Order sent', sentBody: 'Please wait for the cashier to confirm your order.', again: 'Start a new order', empty: 'The menu is not available right now.',
    add: 'Add', all: 'All', loading: 'Loading menu', failed: 'Could not load the menu. Check your connection.', sending: 'Sending',
    pending: 'Waiting for a cashier', claimed: 'A cashier is preparing your order', completed: 'Your order is confirmed', cancelled: 'This order was cancelled',
    tableField: 'Table number (optional)', readOnly: 'Browsing only. Scan the QR code at your table to place an order.',
    notFound: 'This menu link is not valid.', currency: 'Rs',
  },
  ur: {
    items: 'آئٹمز', review: 'آرڈر کا جائزہ', yourOrder: 'آپ کا آرڈر', name: 'آپ کا نام (اختیاری)', note: 'کچن کے لیے نوٹ (اختیاری)',
    total: 'کل', send: 'کیشیئر کو بھیجیں', disclaimer: 'کیشیئر آپ کے آرڈر کی تصدیق کرے گا اور کاؤنٹر پر ادائیگی لے گا۔',
    sent: 'آرڈر بھیج دیا گیا', sentBody: 'براہ کرم کیشیئر کی تصدیق کا انتظار کریں۔', again: 'نیا آرڈر شروع کریں', empty: 'مینو ابھی دستیاب نہیں۔',
    add: 'شامل کریں', all: 'سب', loading: 'مینو لوڈ ہو رہا ہے', failed: 'مینو لوڈ نہیں ہو سکا۔ کنکشن چیک کریں۔', sending: 'بھیجا جا رہا ہے',
    pending: 'کیشیئر کا انتظار', claimed: 'کیشیئر آپ کا آرڈر تیار کر رہا ہے', completed: 'آپ کے آرڈر کی تصدیق ہو گئی', cancelled: 'یہ آرڈر منسوخ ہو گیا',
    tableField: 'ٹیبل نمبر (اختیاری)', readOnly: 'صرف دیکھنے کے لیے۔ آرڈر کے لیے اپنے ٹیبل پر موجود کیو آر کوڈ اسکین کریں۔',
    notFound: 'یہ مینو لنک درست نہیں۔', currency: 'Rs',
  },
};

let lang = localStorage.getItem('lh.lang') === 'ur' ? 'ur' : 'en';
let categories = [];
let items = [];
let variants = [];
let canOrder = false;
let settings = { restaurant_name: 'Lagman House', restaurant_name_ur: '', currency_symbol: 'Rs' };
let activeCategory = 'all';
const cart = new Map();

const $ = (id) => document.getElementById(id);
const t = (k) => STR[lang][k] || STR.en[k] || k;
const money = (v) => `${settings.currency_symbol} ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const name = (row) => (lang === 'ur' && row.name_ur ? row.name_ur : row.name);
const restaurantName = () => (lang === 'ur' && settings.restaurant_name_ur ? settings.restaurant_name_ur : settings.restaurant_name);

function applyLang() {
  document.body.classList.toggle('rtl', lang === 'ur');
  document.documentElement.lang = lang;
  $('langBtn').textContent = lang === 'ur' ? 'English' : 'اردو';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $('restaurantName').textContent = restaurantName();
  document.title = `${restaurantName()} Menu`;
  if (!canOrder && items.length) showStatus(t('readOnly'));
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
    const { data, error } = await supabase.rpc('public_menu', { p_token: menuToken });
    if (error) throw error;
    if (!data || !data.found) {
      showStatus(t('notFound'), true);
      $('empty').classList.remove('hidden');
      return;
    }
    canOrder = !!data.can_order;
    categories = data.categories || [];
    items = data.items || [];
    variants = data.variants || [];
    for (const [k, v] of Object.entries(data.settings || {})) if (typeof v === 'string') settings[k] = v;
    $('restaurantName').textContent = restaurantName();
    document.title = `${restaurantName()} Menu`;
    showStatus(canOrder ? '' : t('readOnly'));
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
    const addBtn = canOrder ? `<button class="add primary" type="button">${t('add')}</button>` : '';
    card.innerHTML = `${media}<div class="body"><div class="name">${name(item)}</div>${item.description ? `<div class="desc">${item.description}</div>` : ''}<div class="price">${priceText}</div><div class="row">${select}${addBtn}</div></div>`;
    const btn = card.querySelector('.add');
    if (btn) {
      btn.onclick = () => {
        const sel = card.querySelector('select');
        const variant = sel ? vs.find((v) => v.id === sel.value) : null;
        if (item.has_variants && !variant) return;
        addToCart(item, variant);
      };
    }
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
  $('cartBar').classList.toggle('hidden', count === 0 || !canOrder);
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
  if (cart.size === 0 || !canOrder || !menuToken) return;
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = t('sending');
  const { data, error } = await supabase.rpc('place_customer_order', {
    p_token: menuToken,
    p_items: [...cart.values()].map((l) => ({ menu_item_id: l.menu_item_id, variant_id: l.variant_id, quantity: l.quantity })),
    p_table: $('tableInput').value.trim() || null,
    p_name: $('customerName').value.trim() || null,
    p_note: $('note').value.trim() || null,
  });
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
  watchOrder(data);
}

let pollTimer = null;
function watchOrder(id) {
  $('doneStatus').textContent = t('pending');
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const { data } = await supabase.rpc('customer_order_status', { p_order_id: id });
    if (!data) return;
    $('doneStatus').textContent = t(data) || data;
    if (data === 'completed' || data === 'cancelled') clearInterval(pollTimer);
  }, 5000);
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
  if (pollTimer) clearInterval(pollTimer);
};

applyLang();
load();

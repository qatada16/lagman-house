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
    notFound: 'This menu link is not valid.', currency: 'Rs', deals: 'Deals', chooseOptions: 'Choose options', addDeal: 'Add deal', youSave: 'You save',
    size: 'Size', quantity: 'Quantity', addToCart: 'Add to cart', orderNo: 'Your order number', showStaff: 'Show this number at the counter if asked.',
    waitAccept: 'Waiting for the restaurant to accept your order', respondWithin: 'Time left for the restaurant to respond',
    acceptedTitle: 'Order accepted', acceptedBody: 'The restaurant accepted your order and is preparing it.',
    confirmedTitle: 'Order confirmed', confirmedBody: 'Here is your confirmed order.', loadingReceipt: 'Loading your receipt',
    cancelledTitle: 'Order cancelled', cancelledBody: 'The restaurant cancelled this order.', reason: 'Reason',
    expiredTitle: 'Not accepted in time', expiredBody: 'The restaurant could not accept your order in time. Please ask a staff member.',
    receipt: 'Receipt', subtotal: 'Subtotal', discounts: 'Discounts', coupon: 'Coupon', time: 'Time', orderRef: 'Order',
    paidCash: 'Cash', paidOnline: 'Online', payment: 'Payment', notifyOn: 'We will notify you here when the restaurant responds.', backToMenu: 'Back to menu',
  },
  ur: {
    items: 'آئٹمز', review: 'آرڈر کا جائزہ', yourOrder: 'آپ کا آرڈر', name: 'آپ کا نام (اختیاری)', note: 'کچن کے لیے نوٹ (اختیاری)',
    total: 'کل', send: 'کیشیئر کو بھیجیں', disclaimer: 'کیشیئر آپ کے آرڈر کی تصدیق کرے گا اور کاؤنٹر پر ادائیگی لے گا۔',
    sent: 'آرڈر بھیج دیا گیا', sentBody: 'براہ کرم کیشیئر کی تصدیق کا انتظار کریں۔', again: 'نیا آرڈر شروع کریں', empty: 'مینو ابھی دستیاب نہیں۔',
    add: 'شامل کریں', all: 'سب', loading: 'مینو لوڈ ہو رہا ہے', failed: 'مینو لوڈ نہیں ہو سکا۔ کنکشن چیک کریں۔', sending: 'بھیجا جا رہا ہے',
    pending: 'کیشیئر کا انتظار', claimed: 'کیشیئر آپ کا آرڈر تیار کر رہا ہے', completed: 'آپ کے آرڈر کی تصدیق ہو گئی', cancelled: 'یہ آرڈر منسوخ ہو گیا',
    tableField: 'ٹیبل نمبر (اختیاری)', readOnly: 'صرف دیکھنے کے لیے۔ آرڈر کے لیے اپنے ٹیبل پر موجود کیو آر کوڈ اسکین کریں۔',
    notFound: 'یہ مینو لنک درست نہیں۔', currency: 'Rs', deals: 'ڈیلز', chooseOptions: 'آپشنز منتخب کریں', addDeal: 'ڈیل شامل کریں', youSave: 'آپ کی بچت',
    size: 'سائز', quantity: 'تعداد', addToCart: 'کارٹ میں شامل کریں', orderNo: 'آپ کا آرڈر نمبر', showStaff: 'پوچھنے پر یہ نمبر کاؤنٹر پر دکھائیں۔',
    waitAccept: 'ریسٹورنٹ کی جانب سے آرڈر قبول ہونے کا انتظار', respondWithin: 'ریسٹورنٹ کے جواب کے لیے باقی وقت',
    acceptedTitle: 'آرڈر قبول ہو گیا', acceptedBody: 'ریسٹورنٹ نے آپ کا آرڈر قبول کر لیا ہے اور تیار کر رہا ہے۔',
    confirmedTitle: 'آرڈر کی تصدیق ہو گئی', confirmedBody: 'یہ آپ کا تصدیق شدہ آرڈر ہے۔', loadingReceipt: 'آپ کی رسید لوڈ ہو رہی ہے',
    cancelledTitle: 'آرڈر منسوخ', cancelledBody: 'ریسٹورنٹ نے یہ آرڈر منسوخ کر دیا۔', reason: 'وجہ',
    expiredTitle: 'وقت پر قبول نہیں ہوا', expiredBody: 'ریسٹورنٹ وقت پر آپ کا آرڈر قبول نہیں کر سکا۔ براہ کرم عملے سے رابطہ کریں۔',
    receipt: 'رسید', subtotal: 'ذیلی کل', discounts: 'رعایت', coupon: 'کوپن', time: 'وقت', orderRef: 'آرڈر',
    paidCash: 'نقد', paidOnline: 'آن لائن', payment: 'ادائیگی', notifyOn: 'ریسٹورنٹ کے جواب پر ہم آپ کو یہیں مطلع کریں گے۔', backToMenu: 'مینو پر واپس',
  },
};

let lang = localStorage.getItem('lh.lang') === 'ur' ? 'ur' : 'en';
let categories = [];
let items = [];
let variants = [];
let deals = [];
let canOrder = false;
let settings = { restaurant_name: 'Lagman House', restaurant_name_ur: '', currency_symbol: 'Rs' };
let activeCategory = 'all';
const cart = new Map();

const SESSION_KEY = 'lh.webOrder';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const t = (k) => STR[lang][k] || STR.en[k] || k;
const money = (v) => `${esc(settings.currency_symbol)} ${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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
    deals = data.deals || [];
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
  const list = [{ id: 'all', name: t('all'), name_ur: t('all') }, ...(deals.length ? [{ id: '__deals__', name: t('deals'), name_ur: t('deals') }] : []), ...categories.filter((c) => used.has(c.id))];
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

function priceHtml(price, discounted) {
  if (discounted != null && Number(discounted) < Number(price)) return `<s class="was">${money(price)}</s> <span class="now">${money(discounted)}</span>`;
  return money(price);
}

function renderDealCard(deal) {
  const card = document.createElement('div');
  card.className = 'card deal';
  const media = deal.image_url ? `<img src="${esc(deal.image_url)}" alt="" loading="lazy" />` : `<div class="ph">${(deal.name[0] || '').toUpperCase()}</div>`;
  const addBtn = canOrder ? `<button class="add primary" type="button">${t('chooseOptions')}</button>` : '';
  card.innerHTML = `${media}<div class="body"><div class="tag">${t('deals')}</div><div class="name">${esc(name(deal))}</div>${deal.description ? `<div class="desc">${esc(deal.description)}</div>` : ''}<div class="price">${money(deal.price)}</div><div class="actions">${addBtn}</div></div>`;
  card.onclick = () => {
    if (canOrder) openDealPicker(deal);
  };
  return card;
}

function renderMenu() {
  const grid = $('menu');
  grid.innerHTML = '';
  if (activeCategory === 'all' || activeCategory === '__deals__') for (const deal of deals) grid.appendChild(renderDealCard(deal));
  if (activeCategory === '__deals__') return;
  const visible = items.filter((i) => activeCategory === 'all' || i.category_id === activeCategory);
  for (const item of visible) {
    const vs = variants.filter((v) => v.menu_item_id === item.id);
    const card = document.createElement('div');
    card.className = 'card';
    const media = item.image_url ? `<img src="${esc(item.image_url)}" alt="" loading="lazy" />` : `<div class="ph">${(item.name[0] || '').toUpperCase()}</div>`;
    const cheapest = vs.length ? vs.slice().sort((a, b) => Number(a.discounted_price ?? a.price) - Number(b.discounted_price ?? b.price))[0] : null;
    const priceText = item.has_variants ? (cheapest ? `${priceHtml(cheapest.price, cheapest.discounted_price)}+` : '') : priceHtml(item.base_price, item.discounted_price);
    const select = item.has_variants && vs.length ? `<select aria-label="${t('size')}">${vs.map((v) => `<option value="${v.id}">${esc(v.name)} - ${money(v.discounted_price ?? v.price)}</option>`).join('')}</select>` : '';
    const addBtn = canOrder ? `<button class="add primary" type="button">${t('add')}</button>` : '';
    card.innerHTML = `${media}<div class="body"><div class="name">${esc(name(item))}</div>${item.description ? `<div class="desc clamp">${esc(item.description)}</div>` : ''}<div class="price">${priceText}</div><div class="actions">${select}${addBtn}</div></div>`;
    const sel = card.querySelector('select');
    if (sel) sel.onclick = (e) => e.stopPropagation();
    const btn = card.querySelector('.add');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        const variant = sel ? vs.find((v) => v.id === sel.value) : null;
        if (item.has_variants && !variant) return;
        addToCart(item, variant);
      };
    }
    card.onclick = () => openItem(item);
    grid.appendChild(card);
  }
}

function addToCart(item, variant, qty = 1) {
  const key = `${item.id}:${variant ? variant.id : ''}`;
  const existing = cart.get(key);
  if (existing) existing.quantity += qty;
  else {
    const original = Number(variant ? variant.price : item.base_price);
    const unit = Number(variant ? (variant.discounted_price ?? variant.price) : (item.discounted_price ?? item.base_price));
    cart.set(key, { menu_item_id: item.id, variant_id: variant ? variant.id : null, name: item.name, variant_name: variant ? variant.name : null, unit_price: unit, original_unit_price: original, quantity: qty });
  }
  renderCart();
  flashCartBar();
}

function flashCartBar() {
  const bar = $('cartBar');
  bar.classList.remove('pulse');
  void bar.offsetWidth;
  bar.classList.add('pulse');
}

function openItem(item) {
  const vs = variants.filter((v) => v.menu_item_id === item.id);
  let variant = item.has_variants ? vs[0] || null : null;
  let qty = 1;
  const body = $('itemBody');
  const unitOf = () => Number(variant ? (variant.discounted_price ?? variant.price) : (item.discounted_price ?? item.base_price));
  const render = () => {
    const media = item.image_url ? `<img class="hero" src="${esc(item.image_url)}" alt="" />` : '';
    const price = variant ? priceHtml(variant.price, variant.discounted_price) : priceHtml(item.base_price, item.discounted_price);
    const sizes = item.has_variants && vs.length
      ? `<div class="field"><span>${t('size')}</span></div><div class="chips sizes">${vs.map((v) => `<button type="button" data-v="${v.id}" class="${variant && variant.id === v.id ? 'active' : ''}">${esc(v.name)} &middot; ${money(v.discounted_price ?? v.price)}</button>`).join('')}</div>`
      : '';
    body.innerHTML = `${media}<h2>${esc(name(item))}</h2>${item.description ? `<p class="muted">${esc(item.description)}</p>` : ''}<div class="price big">${price}</div>${sizes}${canOrder ? `<div class="field"><span>${t('quantity')}</span></div><div class="qty big"><button type="button" data-q="-1">-</button><span>${qty}</span><button type="button" data-q="1">+</button></div>` : ''}`;
    body.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
      variant = vs.find((v) => v.id === b.dataset.v) || variant;
      render();
    }));
    body.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
      qty = Math.max(1, Math.min(50, qty + Number(b.dataset.q)));
      render();
    }));
    const add = $('itemAdd');
    add.classList.toggle('hidden', !canOrder);
    add.textContent = `${t('addToCart')} - ${money(unitOf() * qty)}`;
    add.onclick = () => {
      if (item.has_variants && !variant) return;
      addToCart(item, variant, qty);
      $('itemSheet').classList.add('hidden');
    };
  };
  render();
  $('itemSheet').classList.remove('hidden');
}

function openDealPicker(deal) {
  const sheet = $('dealSheet');
  const body = $('dealBody');
  body.innerHTML = '';
  $('dealTitle').textContent = name(deal);
  const selection = {};
  for (const slot of deal.slots || []) {
    const def = slot.options[Math.min(slot.default_index || 0, slot.options.length - 1)];
    const defItem = items.find((i) => i.id === def?.menu_item_id);
    selection[slot.id] = def ? { menu_item_id: def.menu_item_id, variant_id: def.variant_id || (defItem?.has_variants ? variants.find((v) => v.menu_item_id === defItem.id)?.id || null : null) } : null;
    const wrap = document.createElement('div');
    wrap.className = 'slot';
    wrap.innerHTML = `<div class="field"><span>${slot.name}</span></div><div class="chips opts"></div><div class="chips sizes"></div>`;
    const opts = wrap.querySelector('.opts');
    const sizes = wrap.querySelector('.sizes');
    const seen = new Set();
    const renderSizes = () => {
      sizes.innerHTML = '';
      const sel = selection[slot.id];
      const item = sel ? items.find((i) => i.id === sel.menu_item_id) : null;
      if (!item || !item.has_variants) return;
      const fixed = slot.options.find((o) => o.menu_item_id === item.id && o.variant_id)?.variant_id;
      for (const v of variants.filter((v) => v.menu_item_id === item.id)) {
        if (fixed && v.id !== fixed) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = v.name;
        b.className = sel.variant_id === v.id ? 'active' : '';
        b.onclick = () => { selection[slot.id] = { menu_item_id: item.id, variant_id: v.id }; renderSizes(); };
        sizes.appendChild(b);
      }
    };
    for (const o of slot.options) {
      if (seen.has(o.menu_item_id)) continue;
      seen.add(o.menu_item_id);
      const item = items.find((i) => i.id === o.menu_item_id);
      if (!item) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name(item);
      b.className = selection[slot.id]?.menu_item_id === item.id ? 'active' : '';
      b.onclick = () => {
        selection[slot.id] = { menu_item_id: item.id, variant_id: o.variant_id || (item.has_variants ? variants.find((v) => v.menu_item_id === item.id)?.id || null : null) };
        opts.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        renderSizes();
      };
      opts.appendChild(b);
    }
    renderSizes();
    body.appendChild(wrap);
  }
  $('dealAdd').textContent = `${t('addDeal')} - ${money(deal.price)}`;
  $('dealAdd').onclick = () => {
    const components = (deal.slots || []).map((slot) => {
      const sel = selection[slot.id];
      const item = items.find((i) => i.id === sel?.menu_item_id);
      const v = sel?.variant_id ? variants.find((x) => x.id === sel.variant_id) : null;
      return { slot_id: slot.id, menu_item_id: sel?.menu_item_id, variant_id: sel?.variant_id || null, name: item ? item.name : '', variant_name: v ? v.name : null };
    });
    if (components.some((c) => !c.menu_item_id)) return;
    const key = `deal:${deal.id}:${components.map((c) => `${c.slot_id}=${c.menu_item_id}:${c.variant_id || ''}`).join('|')}`;
    const existing = cart.get(key);
    if (existing) existing.quantity += 1;
    else cart.set(key, { deal_id: deal.id, name: deal.name, components, unit_price: Number(deal.price), original_unit_price: Number(deal.price), quantity: 1 });
    sheet.classList.add('hidden');
    renderCart();
  };
  sheet.classList.remove('hidden');
}

function cartTotal() {
  let total = 0;
  for (const l of cart.values()) total += l.unit_price * l.quantity;
  return total;
}

function cartSavings() {
  let s = 0;
  for (const l of cart.values()) s += Math.max(0, (l.original_unit_price ?? l.unit_price) - l.unit_price) * l.quantity;
  return s;
}

function renderCart() {
  let count = 0;
  for (const l of cart.values()) count += l.quantity;
  $('cartBar').classList.toggle('hidden', count === 0 || !canOrder);
  $('cartCount').textContent = String(count);
  $('cartTotal').textContent = money(cartTotal());
  $('sheetTotal').textContent = money(cartTotal());
  const sv = cartSavings();
  $('sheetSavings').textContent = sv > 0 ? `${t('youSave')} ${money(sv)}` : '';
  const lines = $('cartLines');
  lines.innerHTML = '';
  for (const [key, l] of cart) {
    const row = document.createElement('div');
    row.className = 'line';
    const comps = (l.components || []).map((c) => `${c.name}${c.variant_name ? ` (${c.variant_name})` : ''}`).join(', ');
    row.innerHTML = `<div class="info"><div>${esc(l.name)}${l.variant_name ? ` (${esc(l.variant_name)})` : ''}</div>${comps ? `<div class="sub">${esc(comps)}</div>` : ''}<div class="sub">${priceHtml(l.original_unit_price, l.unit_price)} x ${l.quantity}</div></div><div class="qty"><button type="button" data-d="-1">-</button><span>${l.quantity}</span><button type="button" data-d="1">+</button></div>`;
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
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => undefined);
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = t('sending');
  const { data, error } = await supabase.rpc('place_customer_order', {
    p_token: menuToken,
    p_items: [...cart.values()].map((l) => (l.deal_id ? { deal_id: l.deal_id, quantity: l.quantity, selections: l.components.map((c) => ({ slot_id: c.slot_id, menu_item_id: c.menu_item_id, variant_id: c.variant_id })) } : { menu_item_id: l.menu_item_id, variant_id: l.variant_id, quantity: l.quantity })),
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
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: data, m: menuToken, at: Date.now() }));
  } catch {
    showStatus('', false);
  }
  startTracking(data);
}

let pollTimer = null;
let tickTimer = null;
let tracked = null;
let lastStatus = null;
let clockOffset = 0;
let swReg = null;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then((r) => (swReg = r)).catch(() => undefined);

function notify(title, body) {
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const options = { body, tag: tracked ? tracked.id : 'order', data: { url: location.href } };
  if (swReg) swReg.showNotification(title, options).catch(() => undefined);
  else {
    try {
      new Notification(title, options);
    } catch {
      return;
    }
  }
}

let lastPollAt = 0;
let zeroPolled = false;

function startTracking(id, placedAt = Date.now()) {
  tracked = { id, info: null, placedAt };
  zeroPolled = false;
  lastStatus = null;
  $('tracker').classList.remove('hidden');
  $('trackTitle').textContent = t('waitAccept');
  $('trackBody').textContent = t('notifyOn');
  $('ticketNo').textContent = '';
  $('trackTimer').textContent = '';
  $('trackReceipt').classList.add('hidden');
  if (pollTimer) clearInterval(pollTimer);
  if (tickTimer) clearInterval(tickTimer);
  pollOrder();
  pollTimer = setInterval(pollOrder, 3000);
  tickTimer = setInterval(renderTimer, 1000);
}

function stopTracking() {
  if (pollTimer) clearInterval(pollTimer);
  if (tickTimer) clearInterval(tickTimer);
  pollTimer = null;
  tickTimer = null;
}

async function pollOrder(force = false) {
  if (!tracked) return;
  if (!force && document.hidden && Date.now() - lastPollAt < 20000) return;
  if (Date.now() - tracked.placedAt > 4 * 3600 * 1000) {
    stopTracking();
    return;
  }
  lastPollAt = Date.now();
  const { data, error } = await supabase.rpc('customer_order_info', { p_order_id: tracked.id });
  if (error) return;
  if (!data) {
    localStorage.removeItem(SESSION_KEY);
    stopTracking();
    $('tracker').classList.add('hidden');
    return;
  }
  tracked.info = data;
  if (data.server_now) clockOffset = new Date(data.server_now).getTime() - Date.now();
  if (data.currency) settings.currency_symbol = data.currency;
  renderTracker();
  const final = data.status === 'cancelled' || data.status === 'expired' || (data.status === 'completed' && data.order);
  if (final) stopTracking();
}

function renderTimer() {
  const info = tracked && tracked.info;
  if (!info || info.status !== 'pending' || !info.expires_at) {
    $('trackTimer').textContent = '';
    return;
  }
  const left = Math.max(0, Math.floor((new Date(info.expires_at).getTime() - (Date.now() + clockOffset)) / 1000));
  $('trackTimer').innerHTML = `<span class="muted small">${t('respondWithin')}</span><strong>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</strong>`;
  if (left === 0 && !zeroPolled) {
    zeroPolled = true;
    setTimeout(() => pollOrder(true), 1500);
  }
}

function renderTracker() {
  const info = tracked.info;
  $('ticketNo').textContent = info.ticket_no ? `#${info.ticket_no}` : '';
  document.title = info.ticket_no ? `#${info.ticket_no} - ${restaurantName()}` : `${restaurantName()} Menu`;
  const map = {
    pending: [t('waitAccept'), t('notifyOn')],
    claimed: [t('acceptedTitle'), t('acceptedBody')],
    completed: [t('confirmedTitle'), info.order ? t('confirmedBody') : t('loadingReceipt')],
    cancelled: [t('cancelledTitle'), t('cancelledBody')],
    expired: [t('expiredTitle'), t('expiredBody')],
  };
  const voided = info.status === 'completed' && info.order && info.order.status === 'void';
  const [title, body] = voided ? map.cancelled : map[info.status] || map.pending;
  $('tracker').dataset.status = info.status;
  $('trackTitle').textContent = title;
  $('trackBody').textContent = body;
  $('trackReason').textContent = info.status === 'cancelled' && info.cancel_reason ? `${t('reason')}: ${info.cancel_reason}` : '';
  const active = info.status === 'pending' || info.status === 'claimed';
  $('againBtn').textContent = active ? t('backToMenu') : t('again');
  $('trackPill').textContent = `${info.ticket_no ? `#${info.ticket_no} ` : ''}${title}`;
  $('trackPill').classList.toggle('hidden', !$('tracker').classList.contains('hidden'));
  renderTimer();
  if (lastStatus && lastStatus !== info.status) notify(`${info.ticket_no ? `#${info.ticket_no} ` : ''}${title}`, body);
  lastStatus = info.status;
  renderReceipt(info);
}

function renderReceipt(info) {
  const el = $('trackReceipt');
  const o = info.order;
  if (info.status !== 'completed' || !o || o.status === 'void') {
    el.classList.add('hidden');
    return;
  }
  const parents = o.items.filter((i) => !i.parent_id);
  const kids = (id) => o.items.filter((i) => i.parent_id === id);
  const line = (label, value, cls = '') => `<div class="rline ${cls}"><span>${label}</span><span>${value}</span></div>`;
  const rows = parents.map((p) => {
    const was = p.original_unit_price != null && Number(p.original_unit_price) > Number(p.unit_price) ? `<s class="was">${money(p.original_unit_price * p.quantity)}</s> ` : '';
    const sub = kids(p.id).map((c) => `<div class="sub">${esc(c.name)}${c.variant_name ? ` (${esc(c.variant_name)})` : ''}</div>`).join('');
    return `<div class="ritem"><div class="rline"><span>${p.quantity} x ${esc(p.name)}${p.variant_name ? ` (${esc(p.variant_name)})` : ''}</span><span>${was}${money(p.line_total)}</span></div>${sub}</div>`;
  }).join('');
  const when = new Date(o.completed_at);
  el.innerHTML = `<h3>${t('receipt')}</h3>
    ${line(t('orderRef'), esc(o.order_number))}
    ${line(t('time'), `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)}
    <div class="rsep"></div>${rows}<div class="rsep"></div>
    ${Number(o.coupon_discount) > 0 ? line(t('subtotal'), money(o.subtotal)) : ''}
    ${Number(o.coupon_discount) > 0 ? line(`${t('coupon')} ${esc(o.coupon_code || '')}`, `-${money(o.coupon_discount)}`, 'good') : ''}
    ${line(t('total'), money(o.total), 'total')}
    ${Number(o.savings_total) > 0 ? line(t('youSave'), money(o.savings_total), 'good') : ''}
    ${o.payment_method ? line(t('payment'), o.payment_method === 'cash' ? t('paidCash') : t('paidOnline')) : ''}`;
  el.classList.remove('hidden');
}

function resumeTracking() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!saved || !saved.id) return;
    if (Date.now() - saved.at > 24 * 3600 * 1000 || (saved.m && saved.m !== menuToken)) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    startTracking(saved.id, saved.at);
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tracked && pollTimer) pollOrder(true);
});

$('langBtn').onclick = () => {
  lang = lang === 'ur' ? 'en' : 'ur';
  localStorage.setItem('lh.lang', lang);
  applyLang();
};
$('reviewBtn').onclick = () => $('sheet').classList.remove('hidden');
$('closeSheet').onclick = () => $('sheet').classList.add('hidden');
$('closeDeal').onclick = () => $('dealSheet').classList.add('hidden');
$('dealSheet').onclick = (e) => { if (e.target === $('dealSheet')) $('dealSheet').classList.add('hidden'); };
$('sheet').onclick = (e) => { if (e.target === $('sheet')) $('sheet').classList.add('hidden'); };
$('submitBtn').onclick = submit;
$('trackPill').onclick = () => {
  $('tracker').classList.remove('hidden');
  $('trackPill').classList.add('hidden');
};
$('againBtn').onclick = () => {
  const info = tracked && tracked.info;
  if (info && (info.status === 'pending' || info.status === 'claimed')) {
    $('tracker').classList.add('hidden');
    $('trackPill').classList.remove('hidden');
    return;
  }
  $('trackPill').classList.add('hidden');
  stopTracking();
  tracked = null;
  localStorage.removeItem(SESSION_KEY);
  $('tracker').classList.add('hidden');
  document.title = `${restaurantName()} Menu`;
};
$('closeItem').onclick = () => $('itemSheet').classList.add('hidden');
$('itemSheet').onclick = (e) => { if (e.target === $('itemSheet')) $('itemSheet').classList.add('hidden'); };

applyLang();
load();
resumeTracking();

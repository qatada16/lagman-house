export type Role = 'admin' | 'cashier';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type Language = 'en' | 'ur';
export type PaymentMethod = 'cash' | 'online';

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_confirmed: boolean;
  photo_url: string | null;
  role: Role;
  status: AccountStatus;
  push_token: string | null;
  language: Language;
  admin_id: string | null;
  menu_token: string | null;
  menu_is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminSummary {
  id: string;
  name: string;
  photo_url: string | null;
}

export interface Category {
  id: string;
  admin_id: string;
  name: string;
  name_ur: string | null;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  admin_id: string;
  category_id: string | null;
  name: string;
  name_ur: string | null;
  description: string | null;
  image_url: string | null;
  base_price: number;
  has_variants: boolean;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItemVariant {
  id: string;
  admin_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItem {
  id: string;
  admin_id: string;
  name: string;
  unit: string;
  quantity: number;
  low_threshold: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockLink {
  id: string;
  admin_id: string;
  menu_item_id: string;
  variant_id: string | null;
  stock_item_id: string;
  quantity_per_unit: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReceiptAlign = 'left' | 'center' | 'right';
export type ReceiptPosition = 'top' | 'bottom';

export type ReceiptTextSize = 'large' | 'medium' | 'small';

export interface ReceiptStyle {
  textSize: ReceiptTextSize;
  charsPerLine: number | null;
  boldHeader: boolean;
  boldItems: boolean;
  boldTotals: boolean;
  boldFooter: boolean;
}

export interface ReceiptTemplateConfig {
  paperWidthMm: 58 | 80;
  style: ReceiptStyle;
  header: {
    showName: boolean;
    showLogo: boolean;
    position: ReceiptPosition;
    align: ReceiptAlign;
    extraLines: string[];
  };
  dateTime: { show: boolean; position: ReceiptPosition; format: 'datetime' | 'date' | 'time' };
  orderNumber: { show: boolean; label: string; prefix: string; format: 'sequence' | 'short_id' | 'date_sequence' };
  cashier: { show: boolean };
  table: { show: boolean };
  note: { show: boolean; label: string };
  items: {
    columns: { item: boolean; size: boolean; qty: boolean; price: boolean; subtotal: boolean };
    sizeInline: boolean;
    qtyPrefix: boolean;
  };
  total: { show: boolean; showSubtotal: boolean; style: 'plain' | 'bold' | 'double'; label: string };
  amountReceived: { show: boolean; showChange: boolean };
  paymentMethod: { show: boolean };
  savings: { show: boolean; label: string; showCoupon: boolean };
  footer: { lines: string[] };
  testWatermark: boolean;
  feedLines: number;
  cut: boolean;
}

export interface ReceiptTemplate {
  id: string;
  admin_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  config: ReceiptTemplateConfig;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  cashier_id: string | null;
  admin_id: string | null;
  status: 'completed' | 'void';
  source: 'pos' | 'qr';
  customer_order_id: string | null;
  table_code: string | null;
  subtotal: number;
  total: number;
  amount_received: number | null;
  payment_method: PaymentMethod | null;
  note: string | null;
  item_discount_total: number;
  coupon_id: string | null;
  coupon_code: string | null;
  coupon_discount: number;
  savings_total: number;
  is_test: boolean;
  stock_deducted: boolean;
  device_id: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  admin_id: string | null;
  menu_item_id: string | null;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  parent_item_id: string | null;
  deal_id: string | null;
  original_unit_price: number | null;
  discount_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderItem {
  menu_item_id?: string;
  variant_id?: string | null;
  deal_id?: string;
  components?: { slot_id: string; menu_item_id: string; variant_id: string | null; name: string; variant_name: string | null }[];
  name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  original_unit_price?: number;
}

export interface CustomerOrder {
  id: string;
  admin_id: string;
  table_code: string | null;
  customer_name: string | null;
  items: CustomerOrderItem[];
  note: string | null;
  status: 'pending' | 'claimed' | 'completed' | 'cancelled';
  claimed_by: string | null;
  claimed_at: string | null;
  completed_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartComponent {
  slot_id: string;
  slot_name: string;
  menu_item_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
}

export interface CartLine {
  key: string;
  menu_item_id: string | null;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  unit_price: number;
  original_unit_price: number;
  discount_id: string | null;
  quantity: number;
  deal_id: string | null;
  components: CartComponent[];
}

export type PromoKind = 'fixed' | 'percent';

export interface DealOption {
  menu_item_id: string;
  variant_id: string | null;
}

export interface DealSlot {
  id: string;
  admin_id: string;
  deal_id: string;
  name: string;
  sort_order: number;
  options: DealOption[];
  default_index: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  admin_id: string;
  name: string;
  name_ur: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Discount {
  id: string;
  admin_id: string;
  name: string;
  kind: PromoKind;
  value: number;
  item_ids: string[];
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  admin_id: string;
  code: string;
  name: string | null;
  kind: PromoKind;
  value: number;
  min_order: number;
  max_discount: number | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppRelease {
  id: string;
  version: string;
  build_number: number;
  build_id: string | null;
  apk_url: string;
  notes: string | null;
  mandatory: boolean;
  released_at: string;
  expires_at: string | null;
}

export interface RestaurantSettings {
  restaurant_name: string;
  restaurant_name_ur: string;
  restaurant_address: string;
  currency_symbol: string;
  logo_url: string;
}

export type ExpenseSource = 'manual' | 'stock';

export interface Expense {
  id: string;
  admin_id: string;
  title: string;
  amount: number;
  category: string;
  occurred_at: string;
  note: string | null;
  source: ExpenseSource;
  stock_purchase_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockPurchase {
  id: string;
  admin_id: string;
  stock_item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier: string | null;
  note: string | null;
  purchased_at: string;
  expense_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

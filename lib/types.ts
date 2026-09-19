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
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
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
  menu_item_id: string;
  variant_id: string | null;
  stock_item_id: string;
  quantity_per_unit: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrTable {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReceiptAlign = 'left' | 'center' | 'right';
export type ReceiptPosition = 'top' | 'bottom';

export interface ReceiptTemplateConfig {
  paperWidthMm: 58 | 80;
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
  };
  total: { show: boolean; showSubtotal: boolean; style: 'plain' | 'bold' | 'double'; label: string };
  amountReceived: { show: boolean; showChange: boolean };
  paymentMethod: { show: boolean };
  footer: { lines: string[] };
  testWatermark: boolean;
  feedLines: number;
  cut: boolean;
}

export interface ReceiptTemplate {
  id: string;
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
  status: 'completed' | 'void';
  source: 'pos' | 'qr';
  customer_order_id: string | null;
  table_code: string | null;
  subtotal: number;
  total: number;
  amount_received: number | null;
  payment_method: PaymentMethod | null;
  note: string | null;
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
  menu_item_id: string | null;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderItem {
  menu_item_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
}

export interface CustomerOrder {
  id: string;
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

export interface CartLine {
  key: string;
  menu_item_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
}

export interface RestaurantSettings {
  restaurant_name: string;
  restaurant_address: string;
  currency_symbol: string;
  logo_url: string;
}

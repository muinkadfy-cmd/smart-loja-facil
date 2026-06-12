export type PageKey =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'sales'
  | 'cash'
  | 'credits'
  | 'orders'
  | 'receipts'
  | 'reports'
  | 'backup'
  | 'settings'
  | 'audit'
  | 'diagnostics'
  | 'coupons';

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao' | 'crediario';

export interface Settings {
  store_name: string;
  owner_name: string;
  phone: string;
  whatsapp: string;
  address: string;
  receipt_message: string;
  logo_url?: string;
  low_stock_limit: number;
  slow_mode: boolean;
  admin_password_enabled: boolean;
  receipt_width_mm: number;
  updated_at: string;
}

export interface AppStatus {
  db_path: string;
  sqlite_ok: boolean;
  offline_ready: boolean;
  version: string;
  settings: Settings;
  dashboard: DashboardData;
}

export type ProductInsightKind = 'top_seller' | 'rising' | 'low_stock_hot' | 'dormant' | 'high_margin';
export type ProductInsightTone = 'success' | 'warning' | 'danger' | 'info' | 'profit';

export interface ProductInsight {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  kind: ProductInsightKind;
  tone: ProductInsightTone;
  title: string;
  detail: string;
  action_label: string;
  sold_7d: number;
  sold_previous_7d: number;
  sold_30d: number;
  revenue_30d: number;
  profit_30d: number;
  stock: number;
  low_stock_limit: number;
  last_sold_at: string | null;
  priority: number;
}

export interface DashboardData {
  today_sales_total: number;
  today_sales_count: number;
  customers_total: number;
  products_total?: number;
  orders_open: number;
  credits_open_total: number;
  credits_active_customers: number;
  credit_overdue_installments: number;
  low_stock_count: number;
  zero_stock_count: number;
  payment_today: PaymentSummary[];
  recent_sales: SaleSummary[];
  product_insights?: ProductInsight[];
}

export type DashboardSalesPeriod = 'today' | '7d' | '30d' | 'month';

export interface DashboardSalesPoint {
  label: string;
  total: number;
}

export interface PaymentSummary { method: PaymentMethod; total: number; count: number; }

export interface Customer {
  id: string; name: string; phone: string; whatsapp: string; address: string; credit_limit: number; status: 'ativo' | 'inativo'; notes: string; created_at: string; updated_at: string;
}

export interface Product {
  id: string; name: string; category: string; cost_price: number; price: number; promo_price: number | null; stock: number; unit: string; size: string; color: string; internal_code: string; barcode: string; image_data: string; status: 'ativo' | 'inativo'; created_at: string; updated_at: string;
}

export interface SaleSummary {
  id: string; number: number; customer_name: string; payment_method: PaymentMethod; subtotal?: number; discount?: number; total: number; status: string; created_at: string; thumbnail_url?: string; first_product_name?: string; item_count?: number;
}

export interface SaleItemSummary {
  product_name: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface CreditSummary {
  id: string; customer_name: string; customer_phone: string; customer_whatsapp: string; sale_id: string; sale_number: number; total: number; balance: number; status: string; created_at: string; installments: CreditInstallment[]; sale_items?: SaleItemSummary[];
}

export interface CreditInstallment {
  id: string; number: number; amount: number; paid_amount: number; due_date: string; paid_at: string | null; status: string; payment_method?: PaymentMethod | string | null;
}

export interface OrderSummary {
  id: string; number: number; customer_name: string; total: number; status: 'aberto' | 'separado' | 'entregue' | 'cancelado'; created_at: string;
}

export interface ReceiptSummary {
  id: string; sale_id: string; sale_number: number; customer_name: string; customer_whatsapp: string; receipt_type: string; total: number; status: string; created_at: string; content: string;
}

export interface BackupInfo {
  id: string; file_name: string; file_path: string; size_bytes: number; integrity_ok: boolean; created_at: string;
}

export interface AuditEvent {
  id: string; entity: string; entity_id: string; action: string; details: string; created_at: string;
}

export type ReportKind = 'vendas' | 'caixa' | 'crediario' | 'estoque_baixo';

export interface ReportMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'green' | 'purple' | 'pink' | 'orange';
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface ReportData {
  report: ReportKind;
  title: string;
  description: string;
  empty_message: string;
  generated_at: string;
  total_rows: number;
  summary: ReportMetric[];
  columns: ReportColumn[];
  rows: Record<string, string>[];
}


export interface CashMovement {
  id: string;
  type: 'entrada' | 'saida' | string;
  method: PaymentMethod | string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface CashClosing {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: 'aberto' | 'fechado' | string;
  notes: string;
}

export interface CashSummary {
  open_cash: CashClosing | null;
  today_in: number;
  today_out: number;
  expected_total: number;
  movements: CashMovement[];
}

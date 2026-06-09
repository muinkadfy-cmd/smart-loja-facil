import { getPublicWebEnv } from './env';
import { getSupabaseClient } from './supabaseClient';
import {
  PRODUCT_PHOTO_BUCKET,
  PRODUCT_PHOTO_MAX_BYTES,
  buildProductPhotoStoragePath,
  isInlineProductImageData,
  productPhotoDataUrlToBlob,
} from './productPhotoStorage';
import { normalizeCreditPaymentMethod, remainingInstallmentAmount, totalCreditOpenAmount } from './creditPaymentGuard';
import type {
  AppStatus,
  AuditEvent,
  BackupInfo,
  CashMovement,
  CashSummary,
  Customer,
  CreditInstallment,
  CreditSummary,
  DashboardData,
  DashboardSalesPeriod,
  DashboardSalesPoint,
  PaymentMethod,
  PaymentSummary,
  Product,
  ProductInsight,
  OrderSummary,
  ReceiptSummary,
  ReportData,
  ReportKind,
  SaleSummary,
  SaleItemSummary,
  Settings,
} from '../types';

export type WebStoreRole = 'owner' | 'admin' | 'operator' | 'viewer';

interface WebStoreRow {
  id: string;
  name: string;
  owner_id: string;
  phone: string;
  whatsapp: string;
  address: string;
  logo_url: string;
  receipt_message: string;
  low_stock_limit: number;
  status: string;
  updated_at: string;
}

export interface WebStoreContext {
  userId: string;
  email: string;
  role: WebStoreRole;
  store: WebStoreRow;
}

const ACTIVE_STORE_KEY = 'smart-loja:web-active-store-id';
const WEB_SYNC_STATUS_KEY = 'smart-loja:web-sync-status';
export const WEB_APP_VERSION = 'pwa-supabase-v192-cupom-centralizado-seguro';
export const WEB_CACHE_VERSION = 'smart-loja-pwa-supabase-v192-cupom-centralizado-seguro';


export interface WebTrainingModeState {
  enabled: boolean;
  scenario: string;
  responsible: string;
  note: string;
  startedAt: string;
  updatedAt: string;
}

export const WEB_TRAINING_MODE_KEY = 'smart-loja:training-mode-safe-v139';
const LEGACY_WEB_TRAINING_MODE_KEYS = ['smart-loja:training-mode-safe-v136', 'smart-loja:training-mode-safe-v134', 'smart-loja:training-mode-safe-v133', 'smart-loja:training-mode-safe-v132', 'smart-loja:training-mode-safe-v131'];

function emptyWebTrainingMode(): WebTrainingModeState {
  return { enabled: false, scenario: '', responsible: '', note: '', startedAt: '', updatedAt: '' };
}

function normalizeWebTrainingMode(value: unknown): WebTrainingModeState {
  const source = value && typeof value === 'object' ? value as Partial<WebTrainingModeState> : {};
  return {
    enabled: Boolean(source.enabled),
    scenario: typeof source.scenario === 'string' ? source.scenario.slice(0, 140) : '',
    responsible: typeof source.responsible === 'string' ? source.responsible.slice(0, 80) : '',
    note: typeof source.note === 'string' ? source.note.slice(0, 1000) : '',
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

export function readWebTrainingMode(): WebTrainingModeState {
  if (!canUseBrowserStorage()) return emptyWebTrainingMode();
  try {
    const current = normalizeWebTrainingMode(JSON.parse(window.localStorage.getItem(WEB_TRAINING_MODE_KEY) || '{}'));
    if (current.enabled || current.updatedAt || current.startedAt || current.scenario || current.responsible || current.note) return current;
    for (const key of LEGACY_WEB_TRAINING_MODE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeWebTrainingMode(JSON.parse(raw));
      if (legacy.enabled || legacy.updatedAt || legacy.startedAt || legacy.scenario || legacy.responsible || legacy.note) {
        window.localStorage.setItem(WEB_TRAINING_MODE_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyWebTrainingMode();
  }
  return emptyWebTrainingMode();
}

export function saveWebTrainingMode(input: Partial<WebTrainingModeState>): WebTrainingModeState {
  const previous = readWebTrainingMode();
  const now = new Date().toISOString();
  const next = normalizeWebTrainingMode({
    ...previous,
    ...input,
    startedAt: input.enabled && !previous.startedAt ? now : (input.startedAt ?? previous.startedAt),
    updatedAt: now,
  });
  if (!next.enabled) next.startedAt = '';
  if (canUseBrowserStorage()) {
    window.localStorage.setItem(WEB_TRAINING_MODE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('smart-loja:web-training-mode-change', { detail: next }));
  }
  return next;
}

export function setWebTrainingModeEnabled(enabled: boolean, patch: Partial<WebTrainingModeState> = {}): WebTrainingModeState {
  return saveWebTrainingMode({ ...patch, enabled });
}

export function assertWebTrainingModeAllowsWrite(action: string): void {
  const training = readWebTrainingMode();
  if (!training.enabled) return;
  throw new Error(`Modo treinamento seguro ativo: ${action} não foi gravado na loja real. Desative o modo treinamento para fazer alteração real.`);
}

export interface WebDemoModeState {
  enabled: boolean;
  scenario: string;
  storeName: string;
  responsible: string;
  note: string;
  startedAt: string;
  updatedAt: string;
}

export const WEB_DEMO_MODE_KEY = 'smart-loja:demo-mode-safe-v139';
const LEGACY_WEB_DEMO_MODE_KEYS = ['smart-loja:demo-mode-safe-v136', 'smart-loja:demo-mode-safe-v134', 'smart-loja:demo-mode-safe-v133', 'smart-loja:demo-mode-safe-v132'];

function emptyWebDemoMode(): WebDemoModeState {
  return { enabled: false, scenario: '', storeName: '', responsible: '', note: '', startedAt: '', updatedAt: '' };
}

function normalizeWebDemoMode(value: unknown): WebDemoModeState {
  const source = value && typeof value === 'object' ? value as Partial<WebDemoModeState> : {};
  return {
    enabled: Boolean(source.enabled),
    scenario: typeof source.scenario === 'string' ? source.scenario.slice(0, 140) : '',
    storeName: typeof source.storeName === 'string' ? source.storeName.slice(0, 100) : '',
    responsible: typeof source.responsible === 'string' ? source.responsible.slice(0, 80) : '',
    note: typeof source.note === 'string' ? source.note.slice(0, 1000) : '',
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

export function readWebDemoMode(): WebDemoModeState {
  if (!canUseBrowserStorage()) return emptyWebDemoMode();
  try {
    const current = normalizeWebDemoMode(JSON.parse(window.localStorage.getItem(WEB_DEMO_MODE_KEY) || '{}'));
    if (current.enabled || current.updatedAt || current.startedAt || current.scenario || current.storeName || current.responsible || current.note) return current;
    for (const key of LEGACY_WEB_DEMO_MODE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeWebDemoMode(JSON.parse(raw));
      if (legacy.enabled || legacy.updatedAt || legacy.startedAt || legacy.scenario || legacy.storeName || legacy.responsible || legacy.note) {
        window.localStorage.setItem(WEB_DEMO_MODE_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyWebDemoMode();
  }
  return emptyWebDemoMode();
}

export function saveWebDemoMode(input: Partial<WebDemoModeState>): WebDemoModeState {
  const previous = readWebDemoMode();
  const now = new Date().toISOString();
  const next = normalizeWebDemoMode({
    ...previous,
    ...input,
    startedAt: input.enabled && !previous.startedAt ? now : (input.startedAt ?? previous.startedAt),
    updatedAt: now,
  });
  if (!next.enabled) next.startedAt = '';
  if (canUseBrowserStorage()) {
    window.localStorage.setItem(WEB_DEMO_MODE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('smart-loja:web-demo-mode-change', { detail: next }));
  }
  return next;
}

export function setWebDemoModeEnabled(enabled: boolean, patch: Partial<WebDemoModeState> = {}): WebDemoModeState {
  const next = saveWebDemoMode({ ...patch, enabled });
  if (enabled) {
    setWebTrainingModeEnabled(true, {
      scenario: patch.scenario || next.scenario || 'Demonstração com dados fictícios separados',
      responsible: patch.responsible || next.responsible || '',
      note: patch.note || next.note || 'Ambiente demo ativo: leituras usam dados fictícios e gravações reais ficam bloqueadas.',
    });
  }
  return next;
}

export function isWebDemoModeActive(): boolean {
  return readWebDemoMode().enabled;
}

export function assertWebDemoModeAllowsWrite(action: string): void {
  const demo = readWebDemoMode();
  if (!demo.enabled) return;
  throw new Error(`Ambiente demo ativo: ${action} não foi gravado. Os dados exibidos são fictícios e separados da loja real.`);
}

const DEMO_NOW = '2026-06-03T12:00:00.000Z';
const DEMO_YESTERDAY = '2026-06-02T15:40:00.000Z';
const DEMO_OLDER = '2026-06-01T09:15:00.000Z';

function demoClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function demoStoreName(): string {
  const demo = readWebDemoMode();
  return demo.storeName.trim() || 'Loja Demonstração Fácil';
}

function demoSettings(): Settings {
  return {
    store_name: demoStoreName(),
    owner_name: 'Cliente Demonstração',
    phone: '(43) 99999-0000',
    whatsapp: '5543999990000',
    address: 'Rua Exemplo, 123 — Centro',
    receipt_message: 'Obrigado pela preferência. Este comprovante é uma amostra do ambiente demo.',
    logo_url: '',
    low_stock_limit: 3,
    slow_mode: false,
    admin_password_enabled: false,
    receipt_width_mm: 80,
    updated_at: DEMO_NOW,
  };
}

const DEMO_CUSTOMERS: Customer[] = [
  { id: 'demo-customer-1', name: 'Ana Cliente Demo', phone: '(43) 98888-1001', whatsapp: '5543988881001', address: 'Centro', credit_limit: 450, status: 'ativo', notes: 'Cliente fictício para treinamento.', created_at: DEMO_OLDER, updated_at: DEMO_NOW },
  { id: 'demo-customer-2', name: 'Bruno Atacado Demo', phone: '(43) 98888-1002', whatsapp: '5543988881002', address: 'Jardim Europa', credit_limit: 800, status: 'ativo', notes: 'Compra roupas e presentes.', created_at: DEMO_OLDER, updated_at: DEMO_YESTERDAY },
  { id: 'demo-customer-3', name: 'Carla Presente Demo', phone: '(43) 98888-1003', whatsapp: '5543988881003', address: 'Vila Oliveira', credit_limit: 250, status: 'ativo', notes: 'Prefere WhatsApp.', created_at: DEMO_YESTERDAY, updated_at: DEMO_NOW },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'demo-product-1', name: 'Vestido floral demo', category: 'Roupas femininas', cost_price: 62.5, price: 119.9, promo_price: 99.9, stock: 8, unit: 'un', size: 'M', color: 'Rosa', internal_code: 'DEMO-001', barcode: '789000000001', image_data: '', status: 'ativo', created_at: DEMO_OLDER, updated_at: DEMO_NOW },
  { id: 'demo-product-2', name: 'Camiseta masculina demo', category: 'Roupas masculinas', cost_price: 31.9, price: 59.9, promo_price: null, stock: 12, unit: 'un', size: 'G', color: 'Preta', internal_code: 'DEMO-002', barcode: '789000000002', image_data: '', status: 'ativo', created_at: DEMO_OLDER, updated_at: DEMO_YESTERDAY },
  { id: 'demo-product-3', name: 'Kit presente demo', category: 'Presentes', cost_price: 44.5, price: 79.9, promo_price: 69.9, stock: 2, unit: 'un', size: 'Único', color: 'Sortido', internal_code: 'DEMO-003', barcode: '789000000003', image_data: '', status: 'ativo', created_at: DEMO_YESTERDAY, updated_at: DEMO_NOW },
  { id: 'demo-product-4', name: 'Lingerie básica demo', category: 'Lingeries', cost_price: 19.9, price: 39.9, promo_price: null, stock: 5, unit: 'un', size: 'P/M/G', color: 'Variada', internal_code: 'DEMO-004', barcode: '789000000004', image_data: '', status: 'ativo', created_at: DEMO_YESTERDAY, updated_at: DEMO_NOW },
];

const DEMO_SALES: SaleSummary[] = [
  { id: 'demo-sale-1', number: 101, customer_name: 'Ana Cliente Demo', payment_method: 'pix', total: 169.8, status: 'finalizada', created_at: DEMO_NOW },
  { id: 'demo-sale-2', number: 100, customer_name: 'Consumidor', payment_method: 'dinheiro', total: 59.9, status: 'finalizada', created_at: DEMO_YESTERDAY },
  { id: 'demo-sale-3', number: 99, customer_name: 'Bruno Atacado Demo', payment_method: 'crediario', total: 239.7, status: 'finalizada', created_at: DEMO_OLDER },
];

const DEMO_ORDERS: OrderSummary[] = [
  { id: 'demo-order-1', number: 44, customer_name: 'Carla Presente Demo', total: 149.8, status: 'aberto', created_at: DEMO_NOW },
  { id: 'demo-order-2', number: 43, customer_name: 'Ana Cliente Demo', total: 99.9, status: 'separado', created_at: DEMO_YESTERDAY },
  { id: 'demo-order-3', number: 42, customer_name: 'Bruno Atacado Demo', total: 239.7, status: 'entregue', created_at: DEMO_OLDER },
];

const DEMO_RECEIPTS: ReceiptSummary[] = [
  { id: 'demo-receipt-1', sale_id: 'demo-sale-1', sale_number: 101, customer_name: 'Ana Cliente Demo', customer_whatsapp: '5543988881001', receipt_type: '80mm', total: 169.8, status: 'emitido', created_at: DEMO_NOW, content: '<h1>Loja Demonstração Fácil</h1><p>Comprovante demo #0101</p><p>Total R$ 169,80</p><small>Dados fictícios. Não é venda real.</small>' },
  { id: 'demo-receipt-2', sale_id: 'demo-sale-2', sale_number: 100, customer_name: 'Consumidor', customer_whatsapp: '', receipt_type: 'A4', total: 59.9, status: 'emitido', created_at: DEMO_YESTERDAY, content: '<h1>Comprovante demo A4</h1><p>Total R$ 59,90</p><small>Dados fictícios para treinamento.</small>' },
];

const DEMO_CREDITS: CreditSummary[] = [
  {
    id: 'demo-credit-1', customer_name: 'Bruno Atacado Demo', customer_phone: '(43) 98888-1002', customer_whatsapp: '5543988881002', sale_id: 'demo-sale-3', sale_number: 99, total: 239.7, balance: 159.8, status: 'aberto', created_at: DEMO_OLDER,
    installments: [
      { id: 'demo-installment-1', number: 1, amount: 79.9, paid_amount: 79.9, due_date: '2026-06-05', paid_at: DEMO_YESTERDAY, status: 'pago', payment_method: 'pix' },
      { id: 'demo-installment-2', number: 2, amount: 79.9, paid_amount: 0, due_date: '2026-07-05', paid_at: null, status: 'aberto', payment_method: null },
      { id: 'demo-installment-3', number: 3, amount: 79.9, paid_amount: 0, due_date: '2026-08-05', paid_at: null, status: 'aberto', payment_method: null },
    ],
  },
];

const DEMO_CASH: CashSummary = {
  open_cash: { id: 'demo-cash-open', opened_at: DEMO_NOW, closed_at: null, opening_amount: 100, closing_amount: null, status: 'aberto', notes: 'Caixa fictício do ambiente demo.' },
  today_in: 309.7,
  today_out: 25,
  expected_total: 384.7,
  movements: [
    { id: 'demo-cash-mov-1', type: 'entrada', method: 'pix', amount: 169.8, reason: 'Venda demo #0101', created_at: DEMO_NOW },
    { id: 'demo-cash-mov-2', type: 'entrada', method: 'dinheiro', amount: 139.9, reason: 'Recebimento demo', created_at: DEMO_YESTERDAY },
    { id: 'demo-cash-mov-3', type: 'saida', method: 'dinheiro', amount: 25, reason: 'Despesa fictícia', created_at: DEMO_YESTERDAY },
  ],
};

const DEMO_BACKUPS: BackupInfo[] = [
  { id: 'demo-backup-1', file_name: 'backup-demo-smart-loja.json', file_path: 'demo://backup-smart-loja.json', size_bytes: 18432, integrity_ok: true, created_at: DEMO_NOW },
];

export function webDemoSettings(): Settings { return demoSettings(); }
export function webDemoCustomers(): Customer[] { return demoClone(DEMO_CUSTOMERS); }
export function webDemoProducts(): Product[] { return demoClone(DEMO_PRODUCTS); }
export function webDemoSales(): SaleSummary[] { return demoClone(DEMO_SALES); }
export function webDemoOrders(): OrderSummary[] { return demoClone(DEMO_ORDERS); }
export function webDemoReceipts(): ReceiptSummary[] { return demoClone(DEMO_RECEIPTS); }
export function webDemoCredits(): CreditSummary[] { return demoClone(DEMO_CREDITS); }
export function webDemoCashSummary(): CashSummary { return demoClone(DEMO_CASH); }
export function webDemoBackups(): BackupInfo[] { return demoClone(DEMO_BACKUPS); }

export function webDemoDashboard(): DashboardData {
  const payment_today: PaymentSummary[] = [
    { method: 'pix', total: 169.8, count: 1 },
    { method: 'dinheiro', total: 59.9, count: 1 },
    { method: 'crediario', total: 239.7, count: 1 },
  ];
  return {
    today_sales_total: 309.7,
    today_sales_count: 2,
    customers_total: DEMO_CUSTOMERS.length,
    products_total: DEMO_PRODUCTS.length,
    orders_open: DEMO_ORDERS.filter((order) => order.status === 'aberto' || order.status === 'separado').length,
    credits_open_total: 159.8,
    credits_active_customers: 1,
    low_stock_count: DEMO_PRODUCTS.filter((product) => product.stock <= 3).length,
    payment_today,
    recent_sales: demoClone(DEMO_SALES),
    product_insights: [
      {
        id: 'demo-insight-hot-kit',
        product_id: 'demo-product-3',
        product_name: 'Kit presente demo',
        category: 'Presentes',
        kind: 'low_stock_hot',
        tone: 'danger',
        title: 'Produto campeão com estoque baixo',
        detail: 'Vendeu 9 unidades nos últimos 7 dias e restam só 2. Repor evita perder venda.',
        action_label: 'Repor estoque',
        sold_7d: 9,
        sold_previous_7d: 4,
        sold_30d: 22,
        revenue_30d: 1537.8,
        profit_30d: 558.8,
        stock: 2,
        low_stock_limit: 3,
        last_sold_at: DEMO_NOW,
        priority: 98,
      },
      {
        id: 'demo-insight-top-vestido',
        product_id: 'demo-product-1',
        product_name: 'Vestido floral demo',
        category: 'Roupas femininas',
        kind: 'top_seller',
        tone: 'success',
        title: 'Produto em destaque',
        detail: 'É um dos produtos mais vendidos dos últimos 30 dias. Vale deixar em evidência no PDV.',
        action_label: 'Ver produto',
        sold_7d: 6,
        sold_previous_7d: 5,
        sold_30d: 18,
        revenue_30d: 1798.2,
        profit_30d: 673.2,
        stock: 8,
        low_stock_limit: 3,
        last_sold_at: DEMO_YESTERDAY,
        priority: 78,
      },
    ],
  };
}

export function webDemoAppStatus(): AppStatus {
  return {
    db_path: 'ambiente-demo-dados-ficticios',
    sqlite_ok: true,
    offline_ready: true,
    version: WEB_APP_VERSION,
    settings: webDemoSettings(),
    dashboard: webDemoDashboard(),
  };
}

export function webDemoDashboardSalesSeries(period: string): DashboardSalesPoint[] {
  const labels = period === 'today' ? ['08h', '10h', '12h', '14h', '16h'] : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return labels.map((label, index) => ({ label, total: [0, 59.9, 169.8, 239.7, 309.7, 389.6, 459.5][index] ?? 0 }));
}

export function webDemoReportData(report: string, from: string, to: string): ReportData {
  const generated = new Date().toISOString();
  if (report === 'caixa') {
    return {
      report: 'caixa', title: 'Caixa demo', description: `Período ${from} até ${to} com dados fictícios.`, empty_message: 'Sem caixa demo no período.', generated_at: generated, total_rows: DEMO_CASH.movements.length,
      summary: [
        { label: 'Entradas', value: 'R$ 309,70', detail: 'fictício', tone: 'green' },
        { label: 'Saídas', value: 'R$ 25,00', detail: 'fictício', tone: 'orange' },
      ],
      columns: [{ key: 'data', label: 'Data' }, { key: 'tipo', label: 'Tipo' }, { key: 'valor', label: 'Valor', align: 'right' }],
      rows: DEMO_CASH.movements.map((movement) => ({ data: movement.created_at.slice(0, 10), tipo: `${movement.type} · ${movement.reason}`, valor: `R$ ${movement.amount.toFixed(2).replace('.', ',')}` })),
    };
  }
  if (report === 'crediario') {
    return {
      report: 'crediario', title: 'Crediário demo', description: `Período ${from} até ${to} com dados fictícios.`, empty_message: 'Sem crediário demo no período.', generated_at: generated, total_rows: DEMO_CREDITS.length,
      summary: [{ label: 'Em aberto', value: 'R$ 159,80', detail: 'fictício', tone: 'orange' }],
      columns: [{ key: 'cliente', label: 'Cliente' }, { key: 'saldo', label: 'Saldo', align: 'right' }],
      rows: DEMO_CREDITS.map((credit) => ({ cliente: credit.customer_name, saldo: `R$ ${credit.balance.toFixed(2).replace('.', ',')}` })),
    };
  }
  if (report === 'estoque_baixo') {
    const low = DEMO_PRODUCTS.filter((product) => product.stock <= 3);
    return {
      report: 'estoque_baixo', title: 'Estoque baixo demo', description: 'Produtos fictícios abaixo do limite.', empty_message: 'Sem estoque baixo demo.', generated_at: generated, total_rows: low.length,
      summary: [{ label: 'Itens baixos', value: String(low.length), detail: 'fictício', tone: 'orange' }],
      columns: [{ key: 'produto', label: 'Produto' }, { key: 'estoque', label: 'Estoque', align: 'right' }],
      rows: low.map((product) => ({ produto: product.name, estoque: String(product.stock) })),
    };
  }
  return {
    report: 'vendas', title: 'Vendas demo', description: `Período ${from} até ${to} com dados fictícios.`, empty_message: 'Sem vendas demo no período.', generated_at: generated, total_rows: DEMO_SALES.length,
    summary: [
      { label: 'Total vendido', value: 'R$ 469,40', detail: 'fictício', tone: 'green' },
      { label: 'Vendas', value: String(DEMO_SALES.length), detail: 'fictício', tone: 'blue' },
    ],
    columns: [{ key: 'numero', label: 'Venda' }, { key: 'cliente', label: 'Cliente' }, { key: 'valor', label: 'Valor', align: 'right' }],
    rows: DEMO_SALES.map((sale) => ({ numero: `#${sale.number}`, cliente: sale.customer_name || 'Consumidor', valor: `R$ ${sale.total.toFixed(2).replace('.', ',')}` })),
  };
}

export function webDemoReportsCsv(report: string, from: string, to: string): string {
  const data = webDemoReportData(report, from, to);
  const header = data.columns.map((column) => column.label).join(';');
  const rows = data.rows.map((row) => data.columns.map((column) => String(row[column.key] ?? '')).join(';'));
  return [data.title, data.description, header, ...rows].join('\n');
}

export function webDemoAudit(): AuditEvent[] {
  return [
    { id: 'demo-audit-1', entity: 'demo', entity_id: 'demo', action: 'ambiente_demo', details: 'Dados fictícios carregados sem acessar a loja real.', created_at: DEMO_NOW },
    { id: 'demo-audit-2', entity: 'treinamento', entity_id: 'demo', action: 'bloqueio_gravacao', details: 'Gravações reais bloqueadas no ambiente demo.', created_at: DEMO_YESTERDAY },
  ];
}

export type WebSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error';

export interface WebSyncSnapshot {
  status: WebSyncStatus;
  module: string;
  detail: string;
  at: string;
}

export interface WebRealtimeEvent {
  table: string;
  eventType: string;
  storeId: string;
  at: string;
}

export const WEB_REALTIME_TABLES = [
  'stores',
  'store_members',
  'customers',
  'products',
  'sales',
  'sale_items',
  'cash_sessions',
  'cash_movements',
  'credits',
  'credit_installments',
  'payments',
  'orders',
  'order_items',
  'receipts',
  'stock_movements',
  'backups_log',
  'sync_outbox',
] as const;

const WEB_REALTIME_STORE_TABLES = WEB_REALTIME_TABLES.filter((table) => table !== 'stores') as Array<Exclude<typeof WEB_REALTIME_TABLES[number], 'stores'>>;

const WEB_REALTIME_LABELS: Record<typeof WEB_REALTIME_TABLES[number], string> = {
  stores: 'configuração da loja',
  store_members: 'permissões de usuários',
  customers: 'clientes',
  products: 'produtos/estoque',
  sales: 'vendas',
  sale_items: 'itens de venda',
  cash_sessions: 'caixa',
  cash_movements: 'movimentos do caixa',
  credits: 'crediário',
  credit_installments: 'parcelas',
  payments: 'pagamentos',
  orders: 'pedidos',
  order_items: 'itens de pedido',
  receipts: 'comprovantes',
  stock_movements: 'histórico de estoque',
  backups_log: 'histórico de backup',
  sync_outbox: 'fila de sincronização',
};

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeRole(value: unknown): WebStoreRole {
  if (value === 'owner' || value === 'admin' || value === 'operator' || value === 'viewer') return value;
  return 'viewer';
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readWebSyncSnapshot(): WebSyncSnapshot {
  if (!canUseBrowserStorage()) {
    return { status: 'idle', module: 'Web', detail: 'Sem armazenamento local disponível para diagnóstico.', at: '' };
  }

  try {
    const raw = window.localStorage.getItem(WEB_SYNC_STATUS_KEY);
    if (!raw) return { status: 'idle', module: 'Web', detail: 'Nenhuma tentativa de sincronização registrada neste aparelho.', at: '' };
    const parsed = JSON.parse(raw) as Partial<WebSyncSnapshot>;
    const status: WebSyncStatus = parsed.status === 'syncing' || parsed.status === 'synced' || parsed.status === 'pending' || parsed.status === 'error'
      ? parsed.status
      : 'idle';
    return {
      status,
      module: typeof parsed.module === 'string' ? parsed.module : 'Web',
      detail: typeof parsed.detail === 'string' ? parsed.detail : 'Sem detalhe registrado.',
      at: typeof parsed.at === 'string' ? parsed.at : '',
    };
  } catch {
    return { status: 'idle', module: 'Web', detail: 'Registro local de sincronização inválido.', at: '' };
  }
}

export function recordWebSyncSnapshot(status: WebSyncStatus, module: string, detail: string): void {
  if (!canUseBrowserStorage()) return;
  const snapshot: WebSyncSnapshot = {
    status,
    module,
    detail,
    at: new Date().toISOString(),
  };
  window.localStorage.setItem(WEB_SYNC_STATUS_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent('smart-loja:web-sync-status', { detail: snapshot }));
}


// Mantido em v126 para preservar pendências locais já criadas antes do Lote 129.
const WEB_OUTBOX_KEY = 'smart-loja:web-outbox-v126';
const LEGACY_WEB_OUTBOX_KEYS = ['smart-loja:web-outbox-v125', 'smart-loja:web-outbox-v124', 'smart-loja:web-outbox-v123', 'smart-loja:web-outbox-v107', 'smart-loja:web-outbox-v106', 'smart-loja:web-outbox-v105', 'smart-loja:web-outbox-v104', 'smart-loja:web-outbox-v103-scroll3', 'smart-loja:web-outbox-v103-scroll2', 'smart-loja:web-outbox-v100', 'smart-loja:web-outbox-v99', 'smart-loja:web-outbox-v98', 'smart-loja:web-outbox-v97', 'smart-loja:web-outbox-v96', 'smart-loja:web-outbox-v95', 'smart-loja:web-outbox-v94', 'smart-loja:web-outbox-v93', 'smart-loja:web-outbox-v92', 'smart-loja:web-outbox-v91', 'smart-loja:web-outbox-v90', 'smart-loja:web-outbox-v89', 'smart-loja:web-outbox-v88', 'smart-loja:web-outbox-v87', 'smart-loja:web-outbox-v86', 'smart-loja:web-outbox-v85', 'smart-loja:web-outbox-v84', 'smart-loja:web-outbox-v83', 'smart-loja:web-outbox-v82', 'smart-loja:web-outbox-v81', 'smart-loja:web-outbox-v80', 'smart-loja:web-outbox-v79', 'smart-loja:web-outbox-v78', 'smart-loja:web-outbox-v77', 'smart-loja:web-outbox-v76',
  'smart-loja:web-outbox-v75', 'smart-loja:web-outbox-v74', 'smart-loja:web-outbox-v73'];

export type WebOutboxAction =
  | 'saveCustomer'
  | 'inactivateCustomer'
  | 'saveProduct'
  | 'inactivateProduct'
  | 'adjustStock'
  | 'createSale'
  | 'cancelSale'
  | 'openCash'
  | 'closeCash'
  | 'addCashMovement'
  | 'receiveInstallment'
  | 'createOrder'
  | 'setOrderStatus'
  | 'cancelOrder'
  | 'saveSettings';

export interface WebOutboxItem {
  id: string;
  module: string;
  action: WebOutboxAction;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string;
}

export interface WebOutboxStats {
  total: number;
  pending: number;
  error: number;
  lastCreatedAt: string;
  lastError: string;
}

function dispatchWebOutboxChange(items: WebOutboxItem[]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('smart-loja:web-outbox-change', { detail: getWebOutboxStats(items) }));
}

function parseWebOutboxItems(raw: string | null): WebOutboxItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const source = row && typeof row === 'object' ? row as Partial<WebOutboxItem> : {};
        const action = source.action;
        if (
          action !== 'saveCustomer' &&
          action !== 'inactivateCustomer' &&
          action !== 'saveProduct' &&
          action !== 'inactivateProduct' &&
          action !== 'adjustStock' &&
          action !== 'createSale' &&
          action !== 'cancelSale' &&
          action !== 'openCash' &&
          action !== 'closeCash' &&
          action !== 'addCashMovement' &&
          action !== 'receiveInstallment' &&
          action !== 'createOrder' &&
          action !== 'setOrderStatus' &&
          action !== 'cancelOrder' &&
          action !== 'saveSettings'
        ) return null;
        return {
          id: typeof source.id === 'string' && source.id ? source.id : crypto.randomUUID(),
          module: typeof source.module === 'string' && source.module ? source.module : 'Web',
          action,
          payload: source.payload && typeof source.payload === 'object' && !Array.isArray(source.payload) ? source.payload as Record<string, unknown> : {},
          createdAt: typeof source.createdAt === 'string' ? source.createdAt : new Date().toISOString(),
          updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
          attempts: typeof source.attempts === 'number' && Number.isFinite(source.attempts) ? source.attempts : 0,
          lastError: typeof source.lastError === 'string' ? source.lastError : '',
        } satisfies WebOutboxItem;
      })
      .filter((item): item is WebOutboxItem => Boolean(item));
  } catch {
    return [];
  }
}

function readRawWebOutbox(): WebOutboxItem[] {
  if (!canUseBrowserStorage()) return [];
  const current = parseWebOutboxItems(window.localStorage.getItem(WEB_OUTBOX_KEY));
  const legacy = LEGACY_WEB_OUTBOX_KEYS.flatMap((key) => parseWebOutboxItems(window.localStorage.getItem(key)));
  const merged = [...current, ...legacy];
  const byId = new Map<string, WebOutboxItem>();
  for (const item of merged) byId.set(item.id, item);
  const next = Array.from(byId.values());
  if (legacy.length > 0) writeRawWebOutbox(next);
  return next;
}

function writeRawWebOutbox(items: WebOutboxItem[]): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(WEB_OUTBOX_KEY, JSON.stringify(items.slice(0, 100)));
  for (const legacyKey of LEGACY_WEB_OUTBOX_KEYS) window.localStorage.removeItem(legacyKey);
  dispatchWebOutboxChange(items);
}

export function readWebOutbox(): WebOutboxItem[] {
  return readRawWebOutbox().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getWebOutboxStats(items = readRawWebOutbox()): WebOutboxStats {
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    total: items.length,
    pending: items.filter((item) => !item.lastError).length,
    error: items.filter((item) => item.lastError).length,
    lastCreatedAt: sorted[0]?.createdAt ?? '',
    lastError: sorted.find((item) => item.lastError)?.lastError ?? '',
  };
}

function requestIdFromPayload(payload: Record<string, unknown>): string {
  const direct = stringValue(payload.request_id) || stringValue(payload.client_request_id) || stringValue(payload.requestId);
  if (direct) return direct;
  const nestedKeys = ['payload', 'customer', 'product', 'settings'] as const;
  for (const key of nestedKeys) {
    const nested = payload[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedId = stringValue(nestedRecord.request_id) || stringValue(nestedRecord.client_request_id) || stringValue(nestedRecord.requestId) || stringValue(nestedRecord.id);
      if (nestedId) return nestedId;
    }
  }
  return '';
}

function webOutboxFingerprint(action: WebOutboxAction, payload: Record<string, unknown>): string {
  const requestId = requestIdFromPayload(payload);
  if (requestId) return `${action}:${requestId}`;
  const stableId = stringValue(payload.customerId) || stringValue(payload.productId) || stringValue(payload.saleId) || stringValue(payload.orderId) || stringValue(payload.creditId) || stringValue(payload.installmentId);
  if (stableId) return `${action}:${stableId}`;
  return '';
}

export function enqueueWebOutbox(module: string, action: WebOutboxAction, payload: Record<string, unknown>, error: unknown): WebOutboxItem {
  const now = new Date().toISOString();
  const items = readRawWebOutbox();
  const fingerprint = webOutboxFingerprint(action, payload);
  const existingIndex = fingerprint
    ? items.findIndex((item) => item.action === action && webOutboxFingerprint(item.action, item.payload) === fingerprint)
    : -1;
  const item: WebOutboxItem = existingIndex >= 0
    ? {
        ...items[existingIndex],
        module,
        payload,
        updatedAt: now,
        lastError: humanizeWebError(error),
      }
    : {
        id: crypto.randomUUID(),
        module,
        action,
        payload,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        lastError: humanizeWebError(error),
      };
  const next = existingIndex >= 0
    ? items.map((current, index) => (index === existingIndex ? item : current))
    : [...items, item].slice(-100);
  writeRawWebOutbox(next);
  recordWebSyncSnapshot('pending', module, existingIndex >= 0
    ? 'A alteração pendente foi atualizada neste aparelho sem criar duplicidade.'
    : 'A alteração ficou pendente neste aparelho e será reenviada quando a internet voltar.');
  return item;
}

export function shouldQueueWebError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('modo treinamento seguro ativo') || lower.includes('ambiente demo ativo')) return false;
  return lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('internet') || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export function humanizeWebError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('modo treinamento seguro ativo') || lower.includes('ambiente demo ativo')) return raw;
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) return 'Não foi possível entrar. Confira e-mail e senha e tente novamente.';
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy') || lower.includes('permission denied')) return 'Não foi possível salvar: a permissão da nuvem precisa ser conferida. Entre como dono/administrador ou chame o suporte.';
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('login') || lower.includes('auth')) return 'Login pendente ou expirado. Saia da conta, entre novamente e tente outra vez.';
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline')) return 'Não foi possível sincronizar. Confira a internet deste aparelho e toque em Tentar novamente.';
  if (lower.includes('supabase') && lower.includes('config')) return 'Nuvem não configurada. Chame o suporte para ativar login e sincronização.';
  if (lower.includes('bucket') || lower.includes('storage')) return 'O armazenamento de fotos precisa ser conferido. O produto pode salvar sem foto até o suporte ajustar isso.';
  if (lower.includes('duplicate') || lower.includes('already exists')) return 'Este registro parece já existir. Atualize a tela e confira antes de salvar novamente.';
  if (!raw.trim()) return 'Não foi possível concluir agora. Tente novamente.';
  return raw.replace(/Supabase\/RLS|Supabase|RLS|RPC|JWT|bucket product-photos|product-photos|service worker|localStorage|app_state/gi, (token) => {
    if (/bucket product-photos|product-photos|bucket/i.test(token)) return 'armazenamento de fotos';
    if (/localStorage|app_state/i.test(token)) return 'dados salvos no aparelho';
    if (/service worker/i.test(token)) return 'atualização do app';
    if (/JWT|RPC|RLS|Supabase\/RLS|Supabase/i.test(token)) return 'nuvem';
    return 'sincronização';
  }).slice(0, 220);
}


export interface WebRoleCapabilities {
  canRead: boolean;
  canOperate: boolean;
  canManageStore: boolean;
  canManageMembers: boolean;
  writeLabel: string;
}

export function webRoleLabel(role: WebStoreRole | 'sem login'): string {
  if (role === 'owner') return 'Dono';
  if (role === 'admin') return 'Administrador';
  if (role === 'operator') return 'Operador';
  if (role === 'viewer') return 'Leitor';
  return 'Sem login';
}

export function getWebRoleCapabilities(role: WebStoreRole | 'sem login'): WebRoleCapabilities {
  if (role === 'owner') {
    return { canRead: true, canOperate: true, canManageStore: true, canManageMembers: true, writeLabel: 'Acesso total da loja' };
  }
  if (role === 'admin') {
    return { canRead: true, canOperate: true, canManageStore: true, canManageMembers: false, writeLabel: 'Administra a loja, mas não controla o dono' };
  }
  if (role === 'operator') {
    return { canRead: true, canOperate: true, canManageStore: false, canManageMembers: false, writeLabel: 'Opera cadastros e vendas liberadas' };
  }
  if (role === 'viewer') {
    return { canRead: true, canOperate: false, canManageStore: false, canManageMembers: false, writeLabel: 'Somente leitura' };
  }
  return { canRead: false, canOperate: false, canManageStore: false, canManageMembers: false, writeLabel: 'Entre para liberar permissões' };
}

function requireWebRole(context: WebStoreContext, allowedRoles: WebStoreRole[], action: string): void {
  if (allowedRoles.includes(context.role)) return;
  const currentRole = webRoleLabel(context.role).toLowerCase();
  const allowed = allowedRoles.map((role) => webRoleLabel(role).toLowerCase()).join(', ');
  throw new Error(`Seu papel atual (${currentRole}) não permite ${action}. Permitido para: ${allowed}.`);
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  if (value === 'dinheiro' || value === 'pix' || value === 'cartao' || value === 'crediario') return value;
  return 'dinheiro';
}

function toIso(value: unknown): string {
  const text = stringValue(value);
  if (text) return text;
  return new Date().toISOString();
}

function mapStatusFromCloud(value: unknown): 'ativo' | 'inativo' {
  return value === 'inactive' || value === 'blocked' ? 'inativo' : 'ativo';
}

function mapStatusToCloud(value: unknown): 'active' | 'inactive' {
  return value === 'inativo' || value === 'inactive' ? 'inactive' : 'active';
}

function mapStore(row: Record<string, unknown>): WebStoreRow {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name, 'Jaque Confecções e Presentes'),
    owner_id: stringValue(row.owner_id),
    phone: stringValue(row.phone),
    whatsapp: stringValue(row.whatsapp),
    address: stringValue(row.address),
    logo_url: stringValue(row.logo_url),
    receipt_message: stringValue(row.receipt_message, 'Obrigado pela preferência!'),
    low_stock_limit: numberValue(row.low_stock_limit, 3),
    status: stringValue(row.status, 'active'),
    updated_at: toIso(row.updated_at),
  };
}

function mapSettings(store: WebStoreRow, email = ''): Settings {
  return {
    store_name: store.name,
    owner_name: email || 'Administrador',
    phone: store.phone,
    whatsapp: store.whatsapp,
    address: store.address,
    receipt_message: store.receipt_message,
    logo_url: store.logo_url,
    low_stock_limit: store.low_stock_limit,
    slow_mode: false,
    admin_password_enabled: false,
    receipt_width_mm: 80,
    updated_at: store.updated_at,
  };
}

function emptyDashboard(): DashboardData {
  return {
    today_sales_total: 0,
    today_sales_count: 0,
    customers_total: 0,
    orders_open: 0,
    credits_open_total: 0,
    credits_active_customers: 0,
    low_stock_count: 0,
    payment_today: [],
    recent_sales: [],
    product_insights: [],
  };
}

function guestSettings(): Settings {
  const now = new Date().toISOString();
  return {
    store_name: 'Jaque Confecções e Presentes',
    owner_name: 'Aguardando login',
    phone: '',
    whatsapp: '',
    address: '',
    receipt_message: 'Entre na nuvem para sincronizar no celular.',
    low_stock_limit: 3,
    slow_mode: false,
    admin_password_enabled: false,
    receipt_width_mm: 80,
    updated_at: now,
  };
}

function missingSupabaseError(): Error {
  const env = getPublicWebEnv();
  if (env.hasUnsafeServiceRoleKey) {
    return new Error(`Configuração insegura detectada: ${env.securityWarnings.join(' ')}`);
  }
  const missing = env.missing.join(' e ') || 'variáveis públicas';
  return new Error(`A conexão da nuvem precisa de configuração pública no deploy. Chame o suporte para ativar login e sincronização com segurança.`);
}

async function getClient() {
  const client = getSupabaseClient();
  if (!client) throw missingSupabaseError();
  return client;
}

async function getSignedUser() {
  const client = await getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(`Não foi possível ler a sessão web: ${error.message}`);
  const user = data.session?.user;
  if (!user) throw new Error('Entre no modo web para usar dados sincronizados no celular.');
  return { client, user, email: user.email ?? 'usuário sem e-mail' };
}

function normalizeJoinedStore(value: unknown): WebStoreRow | null {
  const source = Array.isArray(value) ? value[0] : value;
  if (!source || typeof source !== 'object') return null;
  const store = mapStore(source as Record<string, unknown>);
  return store.id ? store : null;
}

async function loadMembershipStores(userId: string): Promise<Array<{ role: WebStoreRole; store: WebStoreRow }>> {
  const client = await getClient();
  const { data, error } = await client
    .from('store_members')
    .select('store_id, role, stores(id, name, owner_id, phone, whatsapp, address, logo_url, receipt_message, low_stock_limit, status, updated_at)')
    .eq('user_id', userId);

  if (error) return [];

  return (data ?? [])
    .map((row: Record<string, unknown>) => {
      const store = normalizeJoinedStore(row.stores);
      if (!store) return null;
      return { role: normalizeRole(row.role), store };
    })
    .filter((item): item is { role: WebStoreRole; store: WebStoreRow } => Boolean(item));
}

async function createFirstStore(userId: string, email: string): Promise<WebStoreContext> {
  const client = await getClient();
  const selectFields = 'id, name, owner_id, phone, whatsapp, address, logo_url, receipt_message, low_stock_limit, status, updated_at';

  const rpcResult = await client.rpc('create_owned_store', { store_name: 'Jaque Confecções e Presentes' });
  if (!rpcResult.error) {
    const source = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (source && typeof source === 'object') {
      const store = mapStore(source as Record<string, unknown>);
      if (store.id) {
        window.localStorage.setItem(ACTIVE_STORE_KEY, store.id);
        recordWebSyncSnapshot('synced', 'Primeira loja', 'Loja web criada com segurança e vinculada ao seu login.');
        return { userId, email, role: 'owner', store };
      }
    }
  }

  const { data, error } = await client
    .from('stores')
    .insert({
      name: 'Jaque Confecções e Presentes',
      owner_id: userId,
      receipt_message: 'Obrigado pela preferência!',
      low_stock_limit: 3,
      status: 'active',
    })
    .select(selectFields)
    .single();

  if (error) {
    const rpcDetail = rpcResult.error ? ` RPC create_owned_store: ${rpcResult.error.message}.` : '';
    const hint = error.message.toLowerCase().includes('row-level security')
      ? ' Aplique a migration supabase/migrations/202606030126_commercial_validation_rpc_grants.sql para liberar criação inicial via RPC segura e manter RLS ativa.'
      : '';
    throw new Error(`Não foi possível criar a loja web inicial: ${error.message}.${rpcDetail}${hint}`);
  }

  const store = mapStore(data as Record<string, unknown>);
  window.localStorage.setItem(ACTIVE_STORE_KEY, store.id);
  recordWebSyncSnapshot('synced', 'Primeira loja', 'Loja web criada e vinculada ao seu login.');

  return { userId, email, role: 'owner', store };
}

export async function getWebStoreContext(options: { createIfMissing?: boolean } = {}): Promise<WebStoreContext> {
  const { user, email } = await getSignedUser();
  const memberships = await loadMembershipStores(user.id);

  if (memberships.length === 0) {
    if (options.createIfMissing === false) throw new Error('Nenhuma loja web vinculada a este usuário.');
    return createFirstStore(user.id, email);
  }

  const preferredStoreId = window.localStorage.getItem(ACTIVE_STORE_KEY);
  const active = memberships.find((item) => item.store.id === preferredStoreId) ?? memberships[0];
  window.localStorage.setItem(ACTIVE_STORE_KEY, active.store.id);

  return {
    userId: user.id,
    email,
    role: active.role,
    store: active.store,
  };
}

type SupabaseQueryBuilder = {
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  lte: (column: string, value: unknown) => SupabaseQueryBuilder;
  then: Promise<{ count: number | null }>["then"];
};

async function safeCount(table: string, storeId: string, build: (query: SupabaseQueryBuilder) => SupabaseQueryBuilder): Promise<number> {
  const client = await getClient();
  const baseQuery = client.from(table).select('id', { count: 'exact', head: true }).eq('store_id', storeId) as unknown as SupabaseQueryBuilder;
  const { count } = await build(baseQuery);
  return count ?? 0;
}

async function countRows(table: string, storeId: string, options: { status?: string; lowStockLimit?: number } = {}): Promise<number> {
  try {
    return await safeCount(table, storeId, (query) => {
      let next = query;
      if (options.status) next = next.eq('status', options.status);
      if (typeof options.lowStockLimit === 'number') next = next.lte('stock', options.lowStockLimit).eq('status', 'active');
      return next;
    });
  } catch {
    return 0;
  }
}

function todayStartIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function periodStart(period: DashboardSalesPeriod): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'today') return start;
  if (period === '7d') start.setDate(start.getDate() - 6);
  if (period === '30d') start.setDate(start.getDate() - 29);
  if (period === 'month') start.setDate(1);
  return start;
}

function seriesLabels(period: DashboardSalesPeriod): DashboardSalesPoint[] {
  if (period === 'today') {
    return Array.from({ length: 8 }, (_, index) => ({ label: `${String(index * 3).padStart(2, '0')}h`, total: 0 }));
  }
  const start = periodStart(period);
  const days = period === '7d' ? 7 : Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total: 0 };
  });
}


function daysAgoIso(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

interface ProductInsightStats {
  productId: string;
  productName: string;
  sold7d: number;
  soldPrevious7d: number;
  sold30d: number;
  revenue30d: number;
  profit30d: number;
  lastSoldAt: string | null;
}

function makeProductInsightId(kind: ProductInsight['kind'], productId: string): string {
  return `product-${kind}-${productId || 'sem-id'}`;
}

function productInsightPriority(kind: ProductInsight['kind'], stats: ProductInsightStats, stock: number, lowStockLimit: number): number {
  if (kind === 'low_stock_hot') return 100 + stats.sold7d + Math.max(0, lowStockLimit - stock);
  if (kind === 'rising') return 82 + stats.sold7d;
  if (kind === 'top_seller') return 70 + stats.sold30d;
  if (kind === 'high_margin') return 58 + Math.min(25, Math.round(stats.profit30d / 20));
  return 28 + Math.max(0, lowStockLimit - stock);
}

function buildProductInsight(params: {
  kind: ProductInsight['kind'];
  product: Record<string, unknown>;
  stats: ProductInsightStats;
  lowStockLimit: number;
}): ProductInsight {
  const productId = stringValue(params.product.id) || params.stats.productId;
  const productName = stringValue(params.product.name, params.stats.productName || 'Produto');
  const category = stringValue(params.product.category);
  const stock = Math.max(0, Math.round(numberValue(params.product.stock)));
  const lowStockLimit = Math.max(0, Math.round(params.lowStockLimit || 0));
  const kind = params.kind;
  const priority = productInsightPriority(kind, params.stats, stock, lowStockLimit);

  if (kind === 'low_stock_hot') {
    return {
      id: makeProductInsightId(kind, productId), product_id: productId, product_name: productName, category,
      kind, tone: 'danger', title: 'Produto campeão com estoque baixo',
      detail: `Vendeu ${params.stats.sold7d} un. nos últimos 7 dias e restam ${stock}. Repor evita perder venda.`,
      action_label: 'Repor estoque', sold_7d: params.stats.sold7d, sold_previous_7d: params.stats.soldPrevious7d,
      sold_30d: params.stats.sold30d, revenue_30d: params.stats.revenue30d, profit_30d: params.stats.profit30d,
      stock, low_stock_limit: lowStockLimit, last_sold_at: params.stats.lastSoldAt, priority,
    };
  }
  if (kind === 'rising') {
    const diff = Math.max(0, params.stats.sold7d - params.stats.soldPrevious7d);
    return {
      id: makeProductInsightId(kind, productId), product_id: productId, product_name: productName, category,
      kind, tone: 'warning', title: 'Produto subindo nas vendas',
      detail: `Vendeu ${diff} un. a mais que na semana anterior. Vale destacar na vitrine e conferir estoque.`,
      action_label: 'Ver tendência', sold_7d: params.stats.sold7d, sold_previous_7d: params.stats.soldPrevious7d,
      sold_30d: params.stats.sold30d, revenue_30d: params.stats.revenue30d, profit_30d: params.stats.profit30d,
      stock, low_stock_limit: lowStockLimit, last_sold_at: params.stats.lastSoldAt, priority,
    };
  }
  if (kind === 'high_margin') {
    return {
      id: makeProductInsightId(kind, productId), product_id: productId, product_name: productName, category,
      kind, tone: 'profit', title: 'Produto com bom lucro',
      detail: `Gerou lucro estimado de R$ ${params.stats.profit30d.toFixed(2).replace('.', ',')} nos últimos 30 dias.`,
      action_label: 'Destacar no PDV', sold_7d: params.stats.sold7d, sold_previous_7d: params.stats.soldPrevious7d,
      sold_30d: params.stats.sold30d, revenue_30d: params.stats.revenue30d, profit_30d: params.stats.profit30d,
      stock, low_stock_limit: lowStockLimit, last_sold_at: params.stats.lastSoldAt, priority,
    };
  }
  if (kind === 'dormant') {
    return {
      id: makeProductInsightId(kind, productId), product_id: productId, product_name: productName, category,
      kind, tone: 'info', title: 'Produto parado em estoque',
      detail: stock > 0 ? `Tem ${stock} un. em estoque e não vendeu nos últimos 30 dias. Pode virar promoção.` : 'Sem movimento recente.',
      action_label: 'Criar ação', sold_7d: params.stats.sold7d, sold_previous_7d: params.stats.soldPrevious7d,
      sold_30d: params.stats.sold30d, revenue_30d: params.stats.revenue30d, profit_30d: params.stats.profit30d,
      stock, low_stock_limit: lowStockLimit, last_sold_at: params.stats.lastSoldAt, priority,
    };
  }
  return {
    id: makeProductInsightId(kind, productId), product_id: productId, product_name: productName, category,
    kind, tone: 'success', title: 'Produto em destaque',
    detail: `Vendeu ${params.stats.sold30d} un. nos últimos 30 dias. Vale deixar fácil no PDV e repor antes de acabar.`,
    action_label: 'Ver produto', sold_7d: params.stats.sold7d, sold_previous_7d: params.stats.soldPrevious7d,
    sold_30d: params.stats.sold30d, revenue_30d: params.stats.revenue30d, profit_30d: params.stats.profit30d,
    stock, low_stock_limit: lowStockLimit, last_sold_at: params.stats.lastSoldAt, priority,
  };
}

async function webProductInsights(storeId: string, lowStockLimit: number): Promise<ProductInsight[]> {
  const client = await getClient();
  const now = new Date();
  const start30 = daysAgoIso(29);
  const start7 = daysAgoIso(6);
  const startPrevious7 = daysAgoIso(13);

  const { data: sales } = await client
    .from('sales')
    .select('id, created_at, status')
    .eq('store_id', storeId)
    .gte('created_at', startPrevious7)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(600);

  const saleRows = (sales ?? []) as Record<string, unknown>[];
  const saleDateById = new Map<string, string>();
  for (const row of saleRows) {
    const id = stringValue(row.id);
    if (id) saleDateById.set(id, toIso(row.created_at));
  }
  const saleIds = Array.from(saleDateById.keys());

  const { data: products } = await client
    .from('products')
    .select('id, name, category, stock, cost_price, price, status, updated_at')
    .eq('store_id', storeId)
    .neq('status', 'inactive')
    .order('updated_at', { ascending: false })
    .limit(500);

  const productRows = ((products ?? []) as Record<string, unknown>[]).filter((row) => {
    const status = stringValue(row.status).toLowerCase();
    return status !== 'inativo' && status !== 'inactive';
  });
  const productsById = new Map<string, Record<string, unknown>>();
  for (const product of productRows) {
    const id = stringValue(product.id);
    if (id) productsById.set(id, product);
  }

  const statsByProduct = new Map<string, ProductInsightStats>();
  if (saleIds.length > 0) {
    const { data: items } = await client
      .from('sale_items')
      .select('sale_id, product_id, product_name, qty, unit_price, total, created_at')
      .eq('store_id', storeId)
      .in('sale_id', saleIds)
      .order('created_at', { ascending: false })
      .limit(1200);

    for (const item of (items ?? []) as Record<string, unknown>[]) {
      const saleId = stringValue(item.sale_id);
      const productId = stringValue(item.product_id);
      if (!productId) continue;
      const saleDateIso = saleDateById.get(saleId) || toIso(item.created_at);
      const saleDate = new Date(saleDateIso);
      if (Number.isNaN(saleDate.getTime())) continue;
      const qty = Math.max(0, numberValue(item.qty));
      const total = numberValue(item.total, qty * numberValue(item.unit_price));
      const product = productsById.get(productId);
      const costPrice = product ? Math.max(0, numberValue(product.cost_price)) : 0;
      const current = statsByProduct.get(productId) ?? {
        productId,
        productName: stringValue(item.product_name, product ? stringValue(product.name, 'Produto') : 'Produto'),
        sold7d: 0,
        soldPrevious7d: 0,
        sold30d: 0,
        revenue30d: 0,
        profit30d: 0,
        lastSoldAt: null,
      };
      if (saleDate >= new Date(start30)) {
        current.sold30d += qty;
        current.revenue30d += total;
        current.profit30d += Math.max(0, total - (costPrice * qty));
      }
      if (saleDate >= new Date(start7)) current.sold7d += qty;
      if (saleDate >= new Date(startPrevious7) && saleDate < new Date(start7)) current.soldPrevious7d += qty;
      if (!current.lastSoldAt || saleDate > new Date(current.lastSoldAt)) current.lastSoldAt = saleDate.toISOString();
      statsByProduct.set(productId, current);
    }
  }

  const insights = new Map<string, ProductInsight>();
  const sortedStats = Array.from(statsByProduct.values()).sort((a, b) => b.sold30d - a.sold30d || b.revenue30d - a.revenue30d);
  for (const stats of sortedStats) {
    const product = productsById.get(stats.productId) ?? { id: stats.productId, name: stats.productName, stock: 0, category: '' };
    const stock = Math.max(0, Math.round(numberValue(product.stock)));
    if (stats.sold7d > 0 && stock <= lowStockLimit) {
      const insight = buildProductInsight({ kind: 'low_stock_hot', product, stats, lowStockLimit });
      insights.set(insight.id, insight);
      continue;
    }
    if (stats.sold7d >= 2 && stats.sold7d > stats.soldPrevious7d && stats.sold7d >= Math.max(2, stats.soldPrevious7d * 1.5)) {
      const insight = buildProductInsight({ kind: 'rising', product, stats, lowStockLimit });
      insights.set(insight.id, insight);
      continue;
    }
    if (stats.sold30d >= 2) {
      const insight = buildProductInsight({ kind: 'top_seller', product, stats, lowStockLimit });
      insights.set(insight.id, insight);
    }
    if (stats.profit30d >= 60 && stats.sold30d >= 2) {
      const insight = buildProductInsight({ kind: 'high_margin', product, stats, lowStockLimit });
      insights.set(insight.id, insight);
    }
  }

  const hasDormantInsight = Array.from(insights.values()).some((item) => item.kind === 'dormant');
  if (!hasDormantInsight) {
    const dormantCutoff = now.getTime() - (30 * 86400000);
    const dormant = productRows
      .map((product) => {
        const id = stringValue(product.id);
        const stats = statsByProduct.get(id) ?? { productId: id, productName: stringValue(product.name, 'Produto'), sold7d: 0, soldPrevious7d: 0, sold30d: 0, revenue30d: 0, profit30d: 0, lastSoldAt: null };
        return { product, stats, stock: Math.max(0, Math.round(numberValue(product.stock))) };
      })
      .filter((item) => item.stock > 0 && (!item.stats.lastSoldAt || new Date(item.stats.lastSoldAt).getTime() < dormantCutoff))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 1);
    for (const item of dormant) {
      const insight = buildProductInsight({ kind: 'dormant', product: item.product, stats: item.stats, lowStockLimit });
      insights.set(insight.id, insight);
    }
  }

  return Array.from(insights.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

export async function webDashboard(): Promise<DashboardData> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const dashboard = emptyDashboard();

  dashboard.customers_total = await countRows('customers', context.store.id, { status: 'active' });
  dashboard.products_total = await countRows('products', context.store.id, { status: 'active' });
  dashboard.low_stock_count = await countRows('products', context.store.id, { lowStockLimit: context.store.low_stock_limit });
  dashboard.orders_open = await countRows('orders', context.store.id, { status: 'open' });
  try {
    dashboard.product_insights = await webProductInsights(context.store.id, context.store.low_stock_limit);
  } catch {
    dashboard.product_insights = [];
  }

  try {
    const { data: credits } = await client
      .from('credits')
      .select('customer_id, balance')
      .eq('store_id', context.store.id)
      .eq('status', 'open');
    const customerIds = new Set<string>();
    for (const row of credits ?? []) {
      dashboard.credits_open_total += numberValue((row as Record<string, unknown>).balance);
      const customerId = stringValue((row as Record<string, unknown>).customer_id);
      if (customerId) customerIds.add(customerId);
    }
    dashboard.credits_active_customers = customerIds.size;
  } catch {
    dashboard.credits_open_total = 0;
  }

  try {
    const { data: sales } = await client
      .from('sales')
      .select('id, number, customer_name, payment_method, subtotal, discount, total, status, created_at')
      .eq('store_id', context.store.id)
      .gte('created_at', todayStartIso())
      .neq('status', 'canceled')
      .order('created_at', { ascending: false })
      .limit(80);

    const paymentMap = new Map<PaymentMethod, PaymentSummary>();
    for (const row of sales ?? []) {
      const sale = row as Record<string, unknown>;
      const total = numberValue(sale.total);
      const method = normalizePaymentMethod(sale.payment_method);
      dashboard.today_sales_total += total;
      dashboard.today_sales_count += 1;
      const current = paymentMap.get(method) ?? { method, total: 0, count: 0 };
      current.total += total;
      current.count += 1;
      paymentMap.set(method, current);
    }
    dashboard.payment_today = Array.from(paymentMap.values());
    dashboard.recent_sales = await enrichSaleSummariesWithProducts(context.store.id, (sales ?? []).slice(0, 8).map((row: Record<string, unknown>) => ({
      id: stringValue(row.id),
      number: numberValue(row.number),
      customer_name: stringValue(row.customer_name, 'Balcão'),
      payment_method: normalizePaymentMethod(row.payment_method),
      total: numberValue(row.total),
      status: saleStatusFromCloud(row.status),
      created_at: toIso(row.created_at),
    })));
  } catch {
    dashboard.payment_today = [];
    dashboard.recent_sales = [];
  }

  return dashboard;
}

export async function webDashboardSalesSeries(period: DashboardSalesPeriod | string): Promise<DashboardSalesPoint[]> {
  const safePeriod: DashboardSalesPeriod = period === 'today' || period === '7d' || period === '30d' || period === 'month' ? period : '7d';
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const model = seriesLabels(safePeriod);

  try {
    const { data } = await client
      .from('sales')
      .select('total, created_at, status')
      .eq('store_id', context.store.id)
      .gte('created_at', periodStart(safePeriod).toISOString())
      .neq('status', 'canceled');

    for (const row of data ?? []) {
      const sale = row as Record<string, unknown>;
      const date = new Date(toIso(sale.created_at));
      if (Number.isNaN(date.getTime())) continue;
      const label = safePeriod === 'today'
        ? `${String(Math.floor(date.getHours() / 3) * 3).padStart(2, '0')}h`
        : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const point = model.find((item) => item.label === label);
      if (point) point.total += numberValue(sale.total);
    }
  } catch {
    return model;
  }

  return model;
}

function getRealtimeStoreId(payload: unknown, fallbackStoreId: string): string {
  const source = payload && typeof payload === 'object' ? payload as { new?: unknown; old?: unknown } : {};
  const row = source.new && typeof source.new === 'object' ? source.new as Record<string, unknown> : source.old && typeof source.old === 'object' ? source.old as Record<string, unknown> : {};
  return stringValue(row.store_id) || stringValue(row.id) || fallbackStoreId;
}

function getRealtimeEventType(payload: unknown): string {
  const source = payload && typeof payload === 'object' ? payload as { eventType?: unknown } : {};
  return stringValue(source.eventType, 'UPDATE');
}

export async function subscribeWebStoreChanges(onChange: (event: WebRealtimeEvent) => void): Promise<() => void> {
  const context = await getWebStoreContext({ createIfMissing: false });
  const client = await getClient();
  const channel = client.channel(`smart-loja-store-${context.store.id}`);
  let closed = false;
  let lastNotificationAt = 0;

  const notify = (table: typeof WEB_REALTIME_TABLES[number], payload: unknown) => {
    if (closed) return;
    const storeId = getRealtimeStoreId(payload, context.store.id);
    if (storeId !== context.store.id) return;
    const now = Date.now();
    const eventType = getRealtimeEventType(payload);
    if (now - lastNotificationAt > 1200) {
      recordWebSyncSnapshot('synced', 'Atualização automática', `Mudança em ${WEB_REALTIME_LABELS[table]} recebida da nuvem. Atualizando esta tela.`);
      lastNotificationAt = now;
    }
    onChange({ table, eventType, storeId, at: new Date().toISOString() });
  };

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'stores', filter: `id=eq.${context.store.id}` }, (payload: unknown) => notify('stores', payload));
  for (const table of WEB_REALTIME_STORE_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `store_id=eq.${context.store.id}` }, (payload: unknown) => notify(table, payload));
  }

  channel.subscribe((status) => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      recordWebSyncSnapshot('synced', 'Atualização automática', `Escuta multiaparelhos ativa para ${WEB_REALTIME_TABLES.length} áreas da loja.`);
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      recordWebSyncSnapshot('pending', 'Atualização automática', 'Não consegui manter atualização ao vivo agora. O botão atualizar e o foco da janela continuam seguros.');
    }
  });

  return () => {
    closed = true;
    void client.removeChannel(channel);
  };
}

export async function webAppStatus(): Promise<AppStatus> {
  const env = getPublicWebEnv();
  if (!env.isConfigured) {
    const settings = guestSettings();
    return { db_path: 'Nuvem não configurada', sqlite_ok: false, offline_ready: false, version: WEB_APP_VERSION, settings, dashboard: emptyDashboard() };
  }

  try {
    const context = await getWebStoreContext({ createIfMissing: true });
    const settings = mapSettings(context.store, context.email);
    const dashboard = await webDashboard();
    return {
      db_path: `Nuvem · ${context.store.name}`,
      sqlite_ok: true,
      offline_ready: true,
      version: WEB_APP_VERSION,
      settings,
      dashboard,
    };
  } catch {
    const settings = guestSettings();
    return { db_path: 'Aguardando login na nuvem', sqlite_ok: false, offline_ready: false, version: WEB_APP_VERSION, settings, dashboard: emptyDashboard() };
  }
}

export async function webSettings(): Promise<Settings> {
  const context = await getWebStoreContext({ createIfMissing: true });
  return mapSettings(context.store, context.email);
}

export async function webSaveSettings(settings: Settings): Promise<Settings> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'alterar configurações da loja');
  assertWebTrainingModeAllowsWrite('alterar configurações da loja real');
  const client = await getClient();
  const { data, error } = await client
    .from('stores')
    .update({
      name: settings.store_name.trim() || 'Jaque Confecções e Presentes',
      phone: settings.phone.trim(),
      whatsapp: settings.whatsapp.trim(),
      address: settings.address.trim(),
      receipt_message: settings.receipt_message.trim() || 'Obrigado pela preferência!',
      low_stock_limit: Math.max(0, Math.round(settings.low_stock_limit || 0)),
    })
    .eq('id', context.store.id)
    .select('id, name, owner_id, phone, whatsapp, address, logo_url, receipt_message, low_stock_limit, status, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível salvar as configurações no Supabase: ${error.message}`);
  return mapSettings(mapStore(data as Record<string, unknown>), context.email);
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    phone: stringValue(row.phone),
    whatsapp: stringValue(row.whatsapp),
    address: stringValue(row.address),
    credit_limit: numberValue(row.credit_limit),
    status: mapStatusFromCloud(row.status),
    notes: stringValue(row.notes),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export async function webCustomers(): Promise<Customer[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data, error } = await client
    .from('customers')
    .select('id, name, phone, whatsapp, address, credit_limit, status, notes, created_at, updated_at, deleted_at')
    .eq('store_id', context.store.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error(`Não foi possível carregar clientes do Supabase: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapCustomer(row));
}

export async function webSaveCustomer(customer: Partial<Customer>): Promise<Customer> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'salvar clientes');
  assertWebTrainingModeAllowsWrite('salvar cliente real');
  const client = await getClient();
  const name = String(customer.name ?? '').trim();
  if (!name) throw new Error('Informe o nome do cliente antes de salvar.');

  const source = customer as Record<string, unknown>;
  const requestId = stringValue(source.client_request_id) || stringValue(source.request_id) || customer.id || clientRequestId('web-customer');
  const payload = {
    store_id: context.store.id,
    name,
    phone: String(customer.phone ?? '').trim(),
    whatsapp: String(customer.whatsapp ?? '').trim(),
    address: String(customer.address ?? '').trim(),
    credit_limit: numberValue(customer.credit_limit),
    status: mapStatusToCloud(customer.status),
    notes: String(customer.notes ?? '').trim(),
    client_request_id: requestId,
  };

  if (!customer.id) {
    const { data: existing } = await client
      .from('customers')
      .select('id, name, phone, whatsapp, address, credit_limit, status, notes, created_at, updated_at')
      .eq('store_id', context.store.id)
      .eq('client_request_id', requestId)
      .maybeSingle();
    if (existing) return mapCustomer(existing as Record<string, unknown>);
  }

  const request = customer.id
    ? client.from('customers').update(payload).eq('id', customer.id).eq('store_id', context.store.id)
    : client.from('customers').insert(payload);

  const { data, error } = await request
    .select('id, name, phone, whatsapp, address, credit_limit, status, notes, created_at, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível salvar o cliente no Supabase: ${error.message}`);
  return mapCustomer(data as Record<string, unknown>);
}

export async function webInactivateCustomer(customerId: string): Promise<Customer> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'inativar clientes');
  assertWebTrainingModeAllowsWrite('inativar cliente real');
  const client = await getClient();
  const { data, error } = await client
    .from('customers')
    .update({ status: 'inactive' })
    .eq('id', customerId)
    .eq('store_id', context.store.id)
    .select('id, name, phone, whatsapp, address, credit_limit, status, notes, created_at, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível inativar o cliente no Supabase: ${error.message}`);
  return mapCustomer(data as Record<string, unknown>);
}


async function uploadProductPhotoForWeb(params: {
  client: Awaited<ReturnType<typeof getClient>>;
  storeId: string;
  productId: string;
  productName: string;
  requestId: string;
  imageData: string;
}): Promise<string> {
  const photo = productPhotoDataUrlToBlob(params.imageData);
  if (photo.bytes > PRODUCT_PHOTO_MAX_BYTES) {
    throw new Error('A foto preparada ficou grande demais para subir na nuvem. Tente cortar a imagem ou escolher outra foto.');
  }

  const path = buildProductPhotoStoragePath({
    storeId: params.storeId,
    productId: params.productId,
    productName: params.productName,
    extension: photo.extension,
    requestId: params.requestId,
  });

  const { error } = await params.client.storage
    .from(PRODUCT_PHOTO_BUCKET)
    .upload(path, photo.blob, {
      cacheControl: '31536000',
      contentType: photo.mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Não foi possível enviar a foto para o Storage: ${error.message}`);
  }

  const { data } = params.client.storage.from(PRODUCT_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl || path;
}


const PRODUCT_SELECT_BASE = 'id, name, category, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at';
const PRODUCT_SELECT_WITH_COST = 'id, name, category, cost_price, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at';
let productCostPriceColumnAvailable: boolean | null = null;

function isMissingProductCostPriceColumn(error: unknown): boolean {
  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = [record?.code, record?.message, record?.details, record?.hint].filter(Boolean).join(' ').toLowerCase();
  return text.includes('cost_price') && (text.includes('column') || text.includes('schema cache') || text.includes('does not exist') || text.includes('could not find'));
}

function productSelectFields(): string {
  return productCostPriceColumnAvailable === false ? PRODUCT_SELECT_BASE : PRODUCT_SELECT_WITH_COST;
}

function withoutProductCostPrice<T extends Record<string, unknown>>(payload: T): Omit<T, 'cost_price'> {
  const { cost_price: _ignored, ...rest } = payload;
  return rest;
}


function normalizeProductCodePart(value: unknown, fallback: string): string {
  const text = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 4);
  return text || fallback;
}

function makeAutomaticProductSku(source: Record<string, unknown>, seed = Date.now()): string {
  const name = normalizeProductCodePart(source.name, 'PROD');
  const category = normalizeProductCodePart(source.category, 'LOJA');
  const suffix = Math.abs(seed).toString(36).toUpperCase().slice(-5).padStart(5, '0');
  return `${category}-${name}-${suffix}`;
}

function ean13Checksum(first12: string): string {
  const sum = first12.split('').reduce((total, digit, index) => {
    const value = Number(digit) || 0;
    return total + value * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

function makeAutomaticProductBarcode(seed = Date.now()): string {
  const raw = `${Math.abs(seed)}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`.replace(/\D/g, '');
  const first12 = (`20${raw}`).slice(0, 12).padEnd(12, '0');
  return `${first12}${ean13Checksum(first12)}`;
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    category: stringValue(row.category),
    cost_price: numberValue(row.cost_price),
    price: numberValue(row.price),
    promo_price: row.promo_price === null || row.promo_price === undefined ? null : numberValue(row.promo_price),
    stock: numberValue(row.stock),
    unit: stringValue(row.unit, 'un'),
    size: stringValue(row.size),
    color: stringValue(row.color),
    internal_code: stringValue(row.internal_code),
    barcode: stringValue(row.barcode),
    image_data: stringValue(row.image_url),
    status: mapStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export async function webProducts(): Promise<Product[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const productsTable = client.from('products') as any;
  let query = productsTable
    .select(`${productSelectFields()}, deleted_at`)
    .eq('store_id', context.store.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  let { data, error } = await query;
  if (error && isMissingProductCostPriceColumn(error)) {
    productCostPriceColumnAvailable = false;
    const fallback = await productsTable
      .select(`${PRODUCT_SELECT_BASE}, deleted_at`)
      .eq('store_id', context.store.id)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  } else if (!error && productCostPriceColumnAvailable !== false) {
    productCostPriceColumnAvailable = true;
  }

  if (error) throw new Error(`Não foi possível carregar produtos do Supabase: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapProduct(row));
}

export async function webSaveProduct(product: Partial<Product>): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'salvar produtos');
  assertWebTrainingModeAllowsWrite('salvar produto ou foto real');
  const client = await getClient();
  const productsTable = client.from('products') as any;
  const name = String(product.name ?? '').trim();
  if (!name) throw new Error('Informe o nome do produto antes de salvar.');

  const source = product as Record<string, unknown>;
  const requestId = stringValue(source.client_request_id) || stringValue(source.request_id) || product.id || clientRequestId('web-product');
  const imageSource = String(product.image_data ?? '').trim();
  const inlinePhoto = isInlineProductImageData(imageSource) ? imageSource : '';
  const payload = {
    store_id: context.store.id,
    name,
    category: String(product.category ?? '').trim(),
    cost_price: numberValue((product as Record<string, unknown>).cost_price),
    price: numberValue(product.price),
    promo_price: product.promo_price === null || product.promo_price === undefined ? null : numberValue(product.promo_price),
    stock: numberValue(product.stock),
    unit: String(product.unit ?? 'un').trim() || 'un',
    size: String(product.size ?? '').trim(),
    color: String(product.color ?? '').trim(),
    internal_code: String(product.internal_code ?? '').trim() || makeAutomaticProductSku(source),
    barcode: String(product.barcode ?? '').trim() || makeAutomaticProductBarcode(),
    status: mapStatusToCloud(product.status),
    client_request_id: requestId,
  };
  const payloadWithImage = inlinePhoto
    ? product.id
      ? payload
      : { ...payload, image_url: '' }
    : { ...payload, image_url: imageSource };

  if (!product.id) {
    let existingQuery = await productsTable
      .select(productSelectFields())
      .eq('store_id', context.store.id)
      .eq('client_request_id', requestId)
      .maybeSingle();
    if (existingQuery.error && isMissingProductCostPriceColumn(existingQuery.error)) {
      productCostPriceColumnAvailable = false;
      existingQuery = await productsTable
        .select(PRODUCT_SELECT_BASE)
        .eq('store_id', context.store.id)
        .eq('client_request_id', requestId)
        .maybeSingle();
    }
    if (existingQuery.data) return mapProduct(existingQuery.data as Record<string, unknown>);
  }

  const savePayload = productCostPriceColumnAvailable === false ? withoutProductCostPrice(payloadWithImage) : payloadWithImage;
  let request = product.id
    ? productsTable.update(savePayload).eq('id', product.id).eq('store_id', context.store.id)
    : productsTable.insert(savePayload);

  let { data, error } = await request
    .select(productSelectFields())
    .single();

  if (error && isMissingProductCostPriceColumn(error)) {
    productCostPriceColumnAvailable = false;
    const fallbackPayload = withoutProductCostPrice(payloadWithImage);
    request = product.id
      ? productsTable.update(fallbackPayload).eq('id', product.id).eq('store_id', context.store.id)
      : productsTable.insert(fallbackPayload);
    const fallback = await request
      .select(PRODUCT_SELECT_BASE)
      .single();
    data = fallback.data;
    error = fallback.error;
  } else if (!error && productCostPriceColumnAvailable !== false) {
    productCostPriceColumnAvailable = true;
  }

  if (error) throw new Error(`Não foi possível salvar o produto no Supabase: ${error.message}`);

  let saved = mapProduct(data as Record<string, unknown>);
  if (!inlinePhoto) return saved;

  try {
    const imageUrl = await uploadProductPhotoForWeb({
      client,
      storeId: context.store.id,
      productId: saved.id,
      productName: saved.name,
      requestId,
      imageData: inlinePhoto,
    });
    const { data: updated, error: updateError } = await productsTable
      .update({ image_url: imageUrl })
      .eq('id', saved.id)
      .eq('store_id', context.store.id)
      .select(productSelectFields())
      .single();
    if (updateError) throw new Error(`Foto enviada, mas não consegui vincular ao produto: ${updateError.message}`);
    saved = mapProduct(updated as Record<string, unknown>);
    recordWebSyncSnapshot('synced', 'Produtos', 'Foto do produto enviada para a nuvem e vinculada ao cadastro.');
    return saved;
  } catch (photoError) {
    const detail = photoError instanceof Error ? photoError.message : String(photoError);
    recordWebSyncSnapshot('pending', 'Fotos de produtos', `Produto salvo. A foto não foi guardada porque o armazenamento de fotos não confirmou envio. Tente salvar a foto novamente. Detalhe: ${detail}`);
    return saved;
  }
}

export async function webInactivateProduct(productId: string): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'inativar produtos');
  assertWebTrainingModeAllowsWrite('inativar produto real');
  const client = await getClient();
  const productsTable = client.from('products') as any;
  const { data, error } = await productsTable
    .update({ status: 'inactive' })
    .eq('id', productId)
    .eq('store_id', context.store.id)
    .select(productSelectFields())
    .single();

  if (error) throw new Error(`Não foi possível inativar o produto no Supabase: ${error.message}`);
  return mapProduct(data as Record<string, unknown>);
}

export async function webAdjustStock(productId: string, delta: number, reason: string): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'ajustar estoque');
  assertWebTrainingModeAllowsWrite('ajustar estoque real');
  const client = await getClient();
  const productsTable = client.from('products') as any;
  if (!reason.trim()) throw new Error('Informe o motivo do ajuste de estoque.');

  const { data: current, error: loadError } = await client
    .from('products')
    .select('stock')
    .eq('id', productId)
    .eq('store_id', context.store.id)
    .single();

  if (loadError) throw new Error(`Não foi possível ler o estoque atual: ${loadError.message}`);
  const beforeStock = numberValue((current as Record<string, unknown>).stock);
  const afterStock = beforeStock + delta;
  if (afterStock < 0) throw new Error('O ajuste não pode deixar o estoque negativo no Supabase.');

  const { data, error } = await productsTable
    .update({ stock: afterStock })
    .eq('id', productId)
    .eq('store_id', context.store.id)
    .select(productSelectFields())
    .single();

  if (error) throw new Error(`Não foi possível ajustar o estoque no Supabase: ${error.message}`);

  await client.from('stock_movements').insert({
    store_id: context.store.id,
    product_id: productId,
    type: delta >= 0 ? 'entrada_manual' : 'saida_manual',
    qty: Math.abs(delta),
    before_stock: beforeStock,
    after_stock: afterStock,
    reason: reason.trim(),
    created_by: context.userId,
  });

  return mapProduct(data as Record<string, unknown>);
}


function mapOrderStatusFromCloud(value: unknown): OrderSummary['status'] {
  if (value === 'accepted') return 'separado';
  if (value === 'delivered') return 'entregue';
  if (value === 'canceled') return 'cancelado';
  return 'aberto';
}

function mapOrderStatusToCloud(value: string): 'open' | 'accepted' | 'delivered' | 'canceled' {
  if (value === 'separado' || value === 'accepted') return 'accepted';
  if (value === 'entregue' || value === 'delivered') return 'delivered';
  if (value === 'cancelado' || value === 'canceled') return 'canceled';
  return 'open';
}

function mapOrder(row: Record<string, unknown>): OrderSummary {
  return {
    id: stringValue(row.id),
    number: numberValue(row.number),
    customer_name: stringValue(row.customer_name, 'Balcão'),
    total: numberValue(row.total),
    status: mapOrderStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
  };
}

function receiptStatusFromCloud(value: unknown): string {
  if (value === 'canceled') return 'cancelada';
  if (value === 'generated') return 'finalizada';
  return stringValue(value, 'finalizada');
}

function mapReceipt(row: Record<string, unknown>, salesById: Map<string, { customerName: string; customerId: string }>, whatsappByCustomerId: Map<string, string>): ReceiptSummary {
  const saleId = stringValue(row.sale_id);
  const sale = salesById.get(saleId);
  return {
    id: stringValue(row.id),
    sale_id: saleId,
    sale_number: numberValue(row.sale_number),
    customer_name: sale?.customerName || 'Balcão',
    customer_whatsapp: sale?.customerId ? (whatsappByCustomerId.get(sale.customerId) ?? '') : '',
    receipt_type: stringValue(row.receipt_type, '80mm'),
    total: numberValue(row.total),
    status: receiptStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
    content: stringValue(row.content_html),
  };
}

function reportMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function reportDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function reportDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('pt-BR');
}

function dateRange(from: string, to: string): { fromIso: string; toIso: string } {
  const safeFrom = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : new Date().toISOString().slice(0, 10);
  const safeTo = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : safeFrom;
  const fromDate = new Date(`${safeFrom}T00:00:00`);
  const toDate = new Date(`${safeTo}T00:00:00`);
  toDate.setDate(toDate.getDate() + 1);
  return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() };
}

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openGeneratedHtmlDocument(fileName: string, html: string): 'opened' | 'downloaded' {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const cleanup = () => window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) {
    cleanup();
    window.setTimeout(() => { try { popup.focus(); } catch { /* sem ação */ } }, 80);
    return 'opened';
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  cleanup();
  return 'downloaded';
}

function csvEscape(value: string): string {
  if (!/[;"\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}


const WEB_BACKUP_HISTORY_KEY = 'smart-loja:web-backup-history-v1';
const WEB_BACKUP_FETCH_PAGE_SIZE = 1000;
const WEB_BACKUP_INLINE_PHOTO_LIMIT = 25;
const WEB_BACKUP_INLINE_PHOTO_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const WEB_BACKUP_WARN_SIZE_BYTES = 50 * 1024 * 1024;

const WEB_BACKUP_TABLES = [
  'customers',
  'products',
  'sales',
  'sale_items',
  'cash_sessions',
  'credits',
  'credit_installments',
  'payments',
  'cash_movements',
  'orders',
  'order_items',
  'receipts',
  'stock_movements',
  'audit_log',
] as const;

type WebBackupTableName = typeof WEB_BACKUP_TABLES[number];

const WEB_BACKUP_ORDER_COLUMNS: Record<WebBackupTableName, string> = {
  customers: 'created_at',
  products: 'created_at',
  sales: 'created_at',
  sale_items: 'created_at',
  cash_sessions: 'opened_at',
  credits: 'created_at',
  credit_installments: 'created_at',
  payments: 'created_at',
  cash_movements: 'created_at',
  orders: 'created_at',
  order_items: 'created_at',
  receipts: 'created_at',
  stock_movements: 'created_at',
  audit_log: 'created_at',
};
type JsonRecord = Record<string, unknown>;

type WebBackupPhotoSummary = {
  total_products: number;
  missing_photo: number;
  inline_embedded_in_json: number;
  storage_or_public_url: number;
  storage_path: number;
  external_url: number;
  manifest_only?: number;
  skipped_inline_files?: number;
  max_inline_files?: number;
  max_inline_total_bytes?: number;
  backed_up_files?: number;
  backup_failed?: number;
  note: string;
};

type WebBackupProductPhotoFile = {
  product_id: string;
  product_name: string;
  source: string;
  data_url: string;
  mime_type: string;
  size_bytes: number;
  backed_up_at: string;
};

type WebBackupSnapshot = {
  kind: 'smart-loja-facil-web-backup';
  version: 1;
  app_version: string;
  created_at: string;
  store: JsonRecord;
  user: { id: string; email: string; role: WebStoreRole };
  counts: Record<string, number>;
  tables: Record<string, JsonRecord[]>;
  product_photo_summary?: WebBackupPhotoSummary;
  product_photo_files?: WebBackupProductPhotoFile[];
  warnings?: string[];
};

function summarizeProductPhotosForBackup(products: JsonRecord[]): WebBackupPhotoSummary {
  const summary: WebBackupPhotoSummary = {
    total_products: products.length,
    missing_photo: 0,
    inline_embedded_in_json: 0,
    storage_or_public_url: 0,
    storage_path: 0,
    external_url: 0,
    manifest_only: 0,
    skipped_inline_files: 0,
    max_inline_files: WEB_BACKUP_INLINE_PHOTO_LIMIT,
    max_inline_total_bytes: WEB_BACKUP_INLINE_PHOTO_MAX_TOTAL_BYTES,
    note: 'O backup web salva os dados e preserva as fotos por link/caminho do Storage. Para migrar de projeto, copie tambem o bucket product-photos; fotos antigas em modo compatibilidade so entram no JSON quando forem pequenas e poucas.',
  };

  for (const product of products) {
    const value = stringValue(product.image_url).trim();
    if (!value) {
      summary.missing_photo += 1;
    } else if (isInlineProductImageData(value)) {
      summary.inline_embedded_in_json += 1;
    } else if (value.startsWith('stores/')) {
      summary.storage_path += 1;
      summary.storage_or_public_url += 1;
      summary.manifest_only = (summary.manifest_only ?? 0) + 1;
    } else if (/^https?:\/\//i.test(value)) {
      summary.external_url += 1;
      summary.storage_or_public_url += 1;
      summary.manifest_only = (summary.manifest_only ?? 0) + 1;
    }
  }

  return summary;
}

async function buildProductPhotoBackupFiles(products: JsonRecord[]): Promise<WebBackupProductPhotoFile[]> {
  const files: WebBackupProductPhotoFile[] = [];
  const backedUpAt = new Date().toISOString();
  let totalBytes = 0;

  for (const product of products) {
    const productId = stringValue(product.id);
    const productName = stringValue(product.name, 'Produto');
    const source = stringValue(product.image_url).trim();
    if (!productId || !source) continue;

    try {
      if (isInlineProductImageData(source)) {
        const parsed = productPhotoDataUrlToBlob(source);
        const canEmbedLegacyPhoto =
          parsed.bytes <= PRODUCT_PHOTO_MAX_BYTES
          && files.length < WEB_BACKUP_INLINE_PHOTO_LIMIT
          && totalBytes + parsed.bytes <= WEB_BACKUP_INLINE_PHOTO_MAX_TOTAL_BYTES;
        if (canEmbedLegacyPhoto) {
          files.push({ product_id: productId, product_name: productName, source: 'inline', data_url: source, mime_type: parsed.mimeType, size_bytes: parsed.bytes, backed_up_at: backedUpAt });
          totalBytes += parsed.bytes;
        }
      }
    } catch {
      // Foto antiga em modo compatibilidade não deve travar o backup principal.
    }
  }

  return files;
}

async function restoreProductPhotoFiles(files: WebBackupProductPhotoFile[] | undefined, context: WebStoreContext): Promise<{ restored: number; failed: number }> {
  if (!Array.isArray(files) || files.length === 0) return { restored: 0, failed: 0 };
  const client = await getClient();
  let restored = 0;
  let failed = 0;

  for (const file of files) {
    const productId = stringValue(file.product_id);
    const dataUrl = stringValue(file.data_url);
    if (!productId || !isInlineProductImageData(dataUrl)) {
      failed += 1;
      continue;
    }

    try {
      const imageUrl = await uploadProductPhotoForWeb({
        client,
        storeId: context.store.id,
        productId,
        productName: stringValue(file.product_name, 'Produto restaurado'),
        requestId: `restore-${Date.now()}`,
        imageData: dataUrl,
      });
      const { error } = await client
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', productId)
        .eq('store_id', context.store.id);
      if (error) throw error;
      restored += 1;
    } catch {
      failed += 1;
    }
  }

  return { restored, failed };
}

function readWebBackupHistory(): BackupInfo[] {
  try {
    const raw = window.localStorage.getItem(WEB_BACKUP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const source = row && typeof row === 'object' ? row as JsonRecord : {};
        return {
          id: stringValue(source.id),
          file_name: stringValue(source.file_name),
          file_path: stringValue(source.file_path),
          size_bytes: numberValue(source.size_bytes),
          integrity_ok: Boolean(source.integrity_ok),
          created_at: toIso(source.created_at),
        };
      })
      .filter((row) => row.id && row.file_name)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

function saveWebBackupHistory(history: BackupInfo[]): void {
  window.localStorage.setItem(WEB_BACKUP_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function safeFileStamp(value: string): string {
  return value.replace(/[^0-9a-zA-Z_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'backup';
}

function getSnapshotTables(snapshot: WebBackupSnapshot): Partial<Record<WebBackupTableName, JsonRecord[]>> {
  const tables: Partial<Record<WebBackupTableName, JsonRecord[]>> = {};
  for (const table of WEB_BACKUP_TABLES) {
    const rows = snapshot.tables[table];
    tables[table] = Array.isArray(rows) ? rows : [];
  }
  return tables;
}

function normalizeSnapshotRow(row: JsonRecord, storeId: string): JsonRecord {
  const copy: JsonRecord = { ...row, store_id: storeId };
  return copy;
}

async function fetchStoreRows(table: WebBackupTableName, storeId: string): Promise<JsonRecord[]> {
  const client = await getClient();
  const orderColumn = WEB_BACKUP_ORDER_COLUMNS[table] ?? 'created_at';
  const rows: JsonRecord[] = [];
  let offset = 0;
  let useOrderedQuery = true;

  while (true) {
    const from = offset;
    const to = offset + WEB_BACKUP_FETCH_PAGE_SIZE - 1;
    let request = client
      .from(table)
      .select('*')
      .eq('store_id', storeId);
    if (useOrderedQuery) request = request.order(orderColumn, { ascending: true });
    const page = await request.range(from, to);

    if (page.error && useOrderedQuery) {
      // Algumas tabelas antigas não têm created_at. Exemplo real: cash_sessions usa opened_at.
      // Se um projeto estiver com schema antigo/diferente, o backup não deve parar por causa da ordenação.
      useOrderedQuery = false;
      rows.length = 0;
      offset = 0;
      continue;
    }

    if (page.error) {
      throw new Error(`Não foi possível incluir ${table} no backup web: ${page.error.message}`);
    }

    const data = (page.data ?? []) as JsonRecord[];
    rows.push(...data);
    if (data.length < WEB_BACKUP_FETCH_PAGE_SIZE) break;
    offset += WEB_BACKUP_FETCH_PAGE_SIZE;
  }

  return rows;
}

async function upsertRows(table: WebBackupTableName, rows: JsonRecord[], storeId: string): Promise<number> {
  if (rows.length === 0) return 0;
  const client = await getClient();
  const normalized = rows.map((row) => normalizeSnapshotRow(row, storeId));
  const chunkSize = 100;
  let imported = 0;
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Falha ao restaurar ${table}: ${error.message}`);
    imported += chunk.length;
  }
  return imported;
}

export async function webBackups(): Promise<BackupInfo[]> {
  const localHistory = readWebBackupHistory();
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data, error } = await client
    .from('backups_log')
    .select('id, file_name, file_path, size_bytes, integrity_ok, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    return localHistory;
  }

  const cloudHistory = (data ?? []).map((row: Record<string, unknown>) => ({
    id: stringValue(row.id),
    file_name: stringValue(row.file_name),
    file_path: stringValue(row.file_path),
    size_bytes: numberValue(row.size_bytes),
    integrity_ok: Boolean(row.integrity_ok),
    created_at: toIso(row.created_at),
  })).filter((row) => row.id && row.file_name);

  const merged = new Map<string, BackupInfo>();
  for (const row of [...cloudHistory, ...localHistory]) {
    merged.set(row.id || row.file_name, row);
  }
  return Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function webCreateBackup(): Promise<BackupInfo> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'gerar backup web da loja');
  assertWebTrainingModeAllowsWrite('registrar backup real');
  const client = await getClient();
  const { data: storeData, error: storeError } = await client
    .from('stores')
    .select('id, name, owner_id, phone, whatsapp, address, logo_url, receipt_message, low_stock_limit, status, created_at, updated_at')
    .eq('id', context.store.id)
    .single();
  if (storeError) throw new Error(`Não foi possível incluir a loja no backup web: ${storeError.message}`);

  const tables: Record<string, JsonRecord[]> = {};
  const counts: Record<string, number> = {};
  for (const table of WEB_BACKUP_TABLES) {
    const rows = await fetchStoreRows(table, context.store.id);
    tables[table] = rows;
    counts[table] = rows.length;
  }
  const productPhotoSummary = summarizeProductPhotosForBackup(tables.products ?? []);
  const productPhotoFiles = await buildProductPhotoBackupFiles(tables.products ?? []);
  productPhotoSummary.backed_up_files = productPhotoFiles.length;
  productPhotoSummary.skipped_inline_files = Math.max(0, productPhotoSummary.inline_embedded_in_json - productPhotoFiles.length);
  productPhotoSummary.backup_failed = productPhotoSummary.skipped_inline_files;

  const createdAt = new Date().toISOString();
  const snapshot: WebBackupSnapshot = {
    kind: 'smart-loja-facil-web-backup',
    version: 1,
    app_version: WEB_APP_VERSION,
    created_at: createdAt,
    store: storeData as JsonRecord,
    user: { id: context.userId, email: context.email, role: context.role },
    counts,
    tables,
    product_photo_summary: productPhotoSummary,
    product_photo_files: productPhotoFiles,
  };
  let content = JSON.stringify(snapshot);
  const backupWarnings: string[] = [];
  if (new Blob([content]).size > WEB_BACKUP_WARN_SIZE_BYTES) {
    backupWarnings.push('Backup grande para celular. Guarde fora do aparelho e teste a importacao em ambiente seguro antes de depender dele.');
  }
  if ((productPhotoSummary.manifest_only ?? 0) > 0) {
    backupWarnings.push('Fotos de produtos ficam preservadas por link/caminho. Para migrar de projeto, copie tambem o armazenamento de fotos da nuvem.');
  }
  if ((productPhotoSummary.skipped_inline_files ?? 0) > 0) {
    backupWarnings.push('Algumas fotos antigas em modo compatibilidade nao entraram no JSON por limite de seguranca.');
  }
  if (backupWarnings.length > 0) {
    snapshot.warnings = backupWarnings;
    content = JSON.stringify(snapshot);
  }
  const fileName = `backup-smart-loja-web-${safeFileStamp(context.store.name)}-${createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  downloadTextFile(fileName, content, 'application/json;charset=utf-8');
  const info: BackupInfo = {
    id: `web-${createdAt}-${context.store.id}`,
    file_name: fileName,
    file_path: 'download:' + fileName,
    size_bytes: new Blob([content]).size,
    integrity_ok: true,
    created_at: createdAt,
  };
  const history = [info, ...readWebBackupHistory().filter((row) => row.file_name !== fileName)];
  saveWebBackupHistory(history);
  const { data: backupLog, error: backupLogError } = await client
    .from('backups_log')
    .insert({
      store_id: context.store.id,
      user_id: context.userId,
      file_name: fileName,
      file_path: info.file_path,
      size_bytes: info.size_bytes,
      integrity_ok: true,
      source: 'web_json',
      metadata: {
        app_version: WEB_APP_VERSION,
        cache_version: WEB_CACHE_VERSION,
        counts,
        warnings: backupWarnings,
        product_photo_summary: productPhotoSummary,
        product_photo_files_count: productPhotoFiles.length,
        storage_note: productPhotoSummary.note,
        local_history_id: info.id,
      },
    })
    .select('id, file_name, file_path, size_bytes, integrity_ok, created_at')
    .single();
  if (backupLogError) {
    throw new Error(`Backup baixado, mas o log Supabase não foi gravado. Aplique a migration de auditoria/sync. Detalhe: ${backupLogError.message}`);
  }
  await insertAudit(context.store.id, context.userId, 'stores', context.store.id, 'web_backup_exported', { file_name: fileName, counts });
  return backupLog ? {
    id: stringValue((backupLog as Record<string, unknown>).id, info.id),
    file_name: stringValue((backupLog as Record<string, unknown>).file_name, info.file_name),
    file_path: stringValue((backupLog as Record<string, unknown>).file_path, info.file_path),
    size_bytes: numberValue((backupLog as Record<string, unknown>).size_bytes, info.size_bytes),
    integrity_ok: Boolean((backupLog as Record<string, unknown>).integrity_ok),
    created_at: toIso((backupLog as Record<string, unknown>).created_at),
  } : info;
}

export async function webRestoreBackupContent(fileContent: string, confirmation: string): Promise<AppStatus> {
  if (confirmation !== 'RESTAURAR') throw new Error('Confirmação inválida. Digite RESTAURAR para importar o backup web.');
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'restaurar backup web da loja');
  assertWebTrainingModeAllowsWrite('restaurar backup na loja real');

  let snapshot: WebBackupSnapshot;
  try {
    snapshot = JSON.parse(fileContent) as WebBackupSnapshot;
  } catch {
    throw new Error('Arquivo inválido. Selecione um backup JSON exportado pelo Jaque Confecções e Presentes.');
  }

  if (snapshot.kind !== 'smart-loja-facil-web-backup' || snapshot.version !== 1 || !snapshot.tables || !snapshot.store) {
    throw new Error('Backup web não reconhecido ou incompatível com esta versão.');
  }

  const snapshotStoreId = stringValue(snapshot.store.id);
  if (snapshotStoreId && snapshotStoreId !== context.store.id) {
    const allowed = window.confirm('Este backup foi criado em outra loja web. Importar assim mesmo para a loja atual? A importação não apaga dados existentes.');
    if (!allowed) throw new Error('Importação cancelada para evitar misturar lojas diferentes.');
  }

  await webCreateBackup();

  const client = await getClient();
  const storePatch = snapshot.store;
  const { error: storeError } = await client
    .from('stores')
    .update({
      name: stringValue(storePatch.name, context.store.name),
      phone: stringValue(storePatch.phone),
      whatsapp: stringValue(storePatch.whatsapp),
      address: stringValue(storePatch.address),
      logo_url: stringValue(storePatch.logo_url),
      receipt_message: stringValue(storePatch.receipt_message, context.store.receipt_message),
      low_stock_limit: numberValue(storePatch.low_stock_limit, context.store.low_stock_limit),
      status: stringValue(storePatch.status, context.store.status),
    })
    .eq('id', context.store.id);
  if (storeError) throw new Error(`Não foi possível restaurar configurações da loja: ${storeError.message}`);

  const importOrder: WebBackupTableName[] = [
    'customers',
    'products',
    'sales',
    'sale_items',
    'cash_sessions',
    'credits',
    'credit_installments',
    'payments',
    'cash_movements',
    'orders',
    'order_items',
    'receipts',
    'stock_movements',
  ];
  const snapshotTables = getSnapshotTables(snapshot);
  const imported: Record<string, number> = {};
  for (const table of importOrder) {
    imported[table] = await upsertRows(table, snapshotTables[table] ?? [], context.store.id);
  }
  const restoredPhotos = await restoreProductPhotoFiles(snapshot.product_photo_files, context);

  await insertAudit(context.store.id, context.userId, 'stores', context.store.id, 'web_backup_imported', {
    source_created_at: snapshot.created_at,
    source_app_version: snapshot.app_version,
    imported,
    restored_product_photos: restoredPhotos,
  });
  return webAppStatus();
}

type WebOrderPayloadItem = { product_id: string; qty: number };
type WebOrderPayload = { request_id: string; customer_id: string | null; items: WebOrderPayloadItem[] };

function parseOrderPayload(payload: unknown): WebOrderPayload {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const requestId = stringValue(source.request_id) || `web-order-${Date.now()}-${crypto.randomUUID()}`;
  const customerId = stringValue(source.customer_id) || null;
  const items = Array.isArray(source.items) ? source.items : [];
  const normalizedItems = items
    .map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { product_id: stringValue(row.product_id), qty: Math.max(0, numberValue(row.qty)) };
    })
    .filter((item) => item.product_id && item.qty > 0);
  if (normalizedItems.length === 0) throw new Error('Adicione pelo menos um item válido ao pedido.');
  return { request_id: requestId, customer_id: customerId, items: normalizedItems };
}

async function insertAudit(storeId: string, userId: string, entity: string, entityId: string | null, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    const client = await getClient();
    await client.from('audit_log').insert({ store_id: storeId, user_id: userId, entity, entity_id: entityId, action, details });
  } catch {
    // Auditoria não pode travar a operação principal no PWA quando a tabela/policy ainda não existir.
  }
}

async function assertOrderStockAvailable(orderId: string, storeId: string): Promise<void> {
  const client = await getClient();
  const { data: items, error } = await client
    .from('order_items')
    .select('product_id, product_name, qty')
    .eq('order_id', orderId)
    .eq('store_id', storeId);
  if (error) throw new Error(`Não foi possível validar os itens do pedido: ${error.message}`);
  for (const item of items ?? []) {
    const row = item as Record<string, unknown>;
    const productId = stringValue(row.product_id);
    const qty = numberValue(row.qty);
    if (!productId) throw new Error(`O item ${stringValue(row.product_name, 'sem produto')} não tem produto vinculado para baixa.`);
    const { data: product, error: productError } = await client
      .from('products')
      .select('name, stock, status')
      .eq('id', productId)
      .eq('store_id', storeId)
      .single();
    if (productError) throw new Error(`Não foi possível validar estoque do item ${stringValue(row.product_name)}: ${productError.message}`);
    const productRow = product as Record<string, unknown>;
    if (productRow.status !== 'active') throw new Error(`Produto ${stringValue(productRow.name)} está inativo.`);
    if (numberValue(productRow.stock) < qty) throw new Error(`Estoque insuficiente para ${stringValue(productRow.name)}. Disponível: ${numberValue(productRow.stock)}.`);
  }
}

async function fallbackCompleteOrder(orderId: string, context: WebStoreContext): Promise<OrderSummary> {
  const client = await getClient();
  const { data: orderData, error: orderError } = await client
    .from('orders')
    .select('id, number, customer_name, total, status, created_at')
    .eq('id', orderId)
    .eq('store_id', context.store.id)
    .single();
  if (orderError) throw new Error(`Não foi possível localizar o pedido: ${orderError.message}`);
  const order = orderData as Record<string, unknown>;
  const currentStatus = mapOrderStatusFromCloud(order.status);
  if (currentStatus === 'cancelado') throw new Error('Pedido cancelado não pode ser entregue.');
  if (currentStatus === 'entregue') return mapOrder(order);
  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('product_id, product_name, qty')
    .eq('order_id', orderId)
    .eq('store_id', context.store.id);
  if (itemsError) throw new Error(`Não foi possível carregar itens do pedido: ${itemsError.message}`);
  for (const item of items ?? []) {
    const row = item as Record<string, unknown>;
    const productId = stringValue(row.product_id);
    const qty = numberValue(row.qty);
    if (!productId) throw new Error(`O item ${stringValue(row.product_name)} não tem produto vinculado para baixa.`);
    const { data: productData, error: productError } = await client
      .from('products')
      .select('name, stock, status')
      .eq('id', productId)
      .eq('store_id', context.store.id)
      .single();
    if (productError) throw new Error(`Não foi possível validar estoque de ${stringValue(row.product_name)}: ${productError.message}`);
    const product = productData as Record<string, unknown>;
    const beforeStock = numberValue(product.stock);
    const afterStock = beforeStock - qty;
    if (product.status !== 'active') throw new Error(`Produto ${stringValue(product.name)} está inativo.`);
    if (afterStock < 0) throw new Error(`Estoque insuficiente para ${stringValue(product.name)}. Disponível: ${beforeStock}.`);
    const { error: updateError } = await client
      .from('products')
      .update({ stock: afterStock })
      .eq('id', productId)
      .eq('store_id', context.store.id);
    if (updateError) throw new Error(`Não foi possível baixar estoque de ${stringValue(product.name)}: ${updateError.message}`);
    await client.from('stock_movements').insert({
      store_id: context.store.id,
      product_id: productId,
      type: 'saida_pedido_web',
      qty,
      before_stock: beforeStock,
      after_stock: afterStock,
      reason: `Entrega do pedido #${numberValue(order.number)}`,
      reference_id: orderId,
      created_by: context.userId,
    });
  }
  const { data: updated, error: updateOrderError } = await client
    .from('orders')
    .update({ status: 'delivered' })
    .eq('id', orderId)
    .eq('store_id', context.store.id)
    .select('id, number, customer_name, total, status, created_at')
    .single();
  if (updateOrderError) throw new Error(`Pedido baixou estoque, mas não marcou como entregue: ${updateOrderError.message}`);
  await insertAudit(context.store.id, context.userId, 'orders', orderId, 'delivered', { source: 'web-fallback' });
  return mapOrder(updated as Record<string, unknown>);
}


function saleStatusFromCloud(value: unknown): string {
  if (value === 'finalized') return 'finalizada';
  if (value === 'canceled') return 'cancelada';
  if (value === 'draft') return 'rascunho';
  return stringValue(value, 'finalizada');
}

function saleStatusToCloud(value: string): 'finalized' | 'canceled' | 'draft' {
  if (value === 'cancelada' || value === 'canceled') return 'canceled';
  if (value === 'rascunho' || value === 'draft') return 'draft';
  return 'finalized';
}

function mapSale(row: Record<string, unknown>): SaleSummary {
  return {
    id: stringValue(row.id),
    number: numberValue(row.number),
    customer_name: stringValue(row.customer_name, 'Balcão'),
    payment_method: normalizePaymentMethod(row.payment_method),
    subtotal: row.subtotal === undefined ? undefined : numberValue(row.subtotal),
    discount: row.discount === undefined ? undefined : numberValue(row.discount),
    total: numberValue(row.total),
    status: saleStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
    thumbnail_url: stringValue(row.thumbnail_url) || undefined,
    first_product_name: stringValue(row.first_product_name) || undefined,
    item_count: row.item_count === undefined ? undefined : numberValue(row.item_count),
  };
}

function mapSaleItem(row: Record<string, unknown>): SaleItemSummary {
  return {
    product_name: stringValue(row.product_name, 'Produto'),
    qty: numberValue(row.qty),
    unit_price: numberValue(row.unit_price),
    total: numberValue(row.total),
  };
}

async function enrichSaleSummariesWithProducts(storeId: string, sales: SaleSummary[]): Promise<SaleSummary[]> {
  if (sales.length === 0) return sales;
  const client = await getClient();
  const saleIds = sales.map((sale) => sale.id).filter(Boolean);
  const { data: items } = await client
    .from('sale_items')
    .select('sale_id, product_id, product_name, qty, created_at')
    .eq('store_id', storeId)
    .in('sale_id', saleIds)
    .order('created_at', { ascending: true });
  const rows = (items ?? []) as Record<string, unknown>[];
  const productIds = Array.from(new Set(rows.map((row) => stringValue(row.product_id)).filter(Boolean)));
  const productImages = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products } = await client
      .from('products')
      .select('id, image_url')
      .eq('store_id', storeId)
      .in('id', productIds);
    for (const product of products ?? []) {
      const row = product as Record<string, unknown>;
      productImages.set(stringValue(row.id), stringValue(row.image_url));
    }
  }
  const itemsBySale = new Map<string, Record<string, unknown>[]>();
  for (const item of rows) {
    const saleId = stringValue(item.sale_id);
    const list = itemsBySale.get(saleId) ?? [];
    list.push(item);
    itemsBySale.set(saleId, list);
  }
  return sales.map((sale) => {
    const saleItems = itemsBySale.get(sale.id) ?? [];
    const firstItem = saleItems[0];
    const firstProductId = firstItem ? stringValue(firstItem.product_id) : '';
    return {
      ...sale,
      thumbnail_url: productImages.get(firstProductId) || sale.thumbnail_url,
      first_product_name: firstItem ? stringValue(firstItem.product_name) : sale.first_product_name,
      item_count: saleItems.length || sale.item_count,
    };
  });
}

type WebSalePayloadItem = { product_id: string; qty: number; unit_price: number };
type WebSalePayload = {
  request_id: string;
  customer_id: string | null;
  payment_method: PaymentMethod;
  discount: number;
  installment_count: number;
  first_due_date: string | null;
  items: WebSalePayloadItem[];
};

function clientRequestId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now()}-${random}`;
}

function parseSalePayload(payload: unknown): WebSalePayload {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const method = normalizePaymentMethod(source.payment_method);
  const items = Array.isArray(source.items) ? source.items : [];
  const normalizedItems = items
    .map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        product_id: stringValue(row.product_id),
        qty: Math.max(0, numberValue(row.qty)),
        unit_price: Math.max(0, numberValue(row.unit_price)),
      };
    })
    .filter((item) => item.product_id && item.qty > 0);
  if (normalizedItems.length === 0) throw new Error('Adicione pelo menos um item válido à venda.');
  if (method === 'crediario' && !stringValue(source.customer_id)) throw new Error('Selecione um cliente cadastrado para vender no crediário.');
  return {
    request_id: stringValue(source.request_id) || clientRequestId('web-sale'),
    customer_id: stringValue(source.customer_id) || null,
    payment_method: method,
    discount: Math.max(0, numberValue(source.discount)),
    installment_count: Math.min(24, Math.max(1, Math.round(numberValue(source.installment_count, 1)))),
    first_due_date: stringValue(source.first_due_date) || null,
    items: normalizedItems,
  };
}

export async function webSales(): Promise<SaleSummary[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data, error } = await client
    .from('sales')
    .select('id, number, customer_name, payment_method, subtotal, discount, total, status, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw new Error(`Não foi possível carregar vendas do Supabase: ${error.message}`);
  return enrichSaleSummariesWithProducts(context.store.id, (data ?? []).map((row: Record<string, unknown>) => mapSale(row)));
}

export async function webCreateSale(payload: unknown): Promise<SaleSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'finalizar vendas');
  assertWebTrainingModeAllowsWrite('finalizar venda real');
  const client = await getClient();
  const salePayload = parseSalePayload(payload);
  const rpcPayload = { ...salePayload, store_id: context.store.id };
  const { data, error } = await client.rpc('web_create_sale', { sale_payload: rpcPayload });
  if (error) throw new Error(`Não foi possível finalizar a venda no Supabase. Aplique a migration do Mega Lote 53 se ainda não aplicou. Detalhe: ${error.message}`);
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') throw new Error('Venda finalizada, mas o Supabase não retornou os dados da venda.');
  return mapSale(source as Record<string, unknown>);
}

export async function webCancelSale(saleId: string, reason: string): Promise<SaleSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'cancelar vendas');
  assertWebTrainingModeAllowsWrite('cancelar venda real');
  const client = await getClient();
  const cleanReason = reason.trim() || 'Cancelamento manual web';
  const { data, error } = await client.rpc('web_cancel_sale', { target_sale_id: saleId, cancel_reason_text: cleanReason });
  if (error) throw new Error(`Não foi possível cancelar a venda no Supabase: ${error.message}`);
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') throw new Error('Venda cancelada, mas o Supabase não retornou os dados atualizados.');
  return mapSale(source as Record<string, unknown>);
}

function cashStatusFromCloud(value: unknown): string {
  if (value === 'open') return 'aberto';
  if (value === 'closed') return 'fechado';
  return stringValue(value, 'fechado');
}

function mapCashMovement(row: Record<string, unknown>): CashMovement {
  return {
    id: stringValue(row.id),
    type: stringValue(row.type, 'entrada'),
    method: stringValue(row.method, 'dinheiro'),
    amount: numberValue(row.amount),
    reason: stringValue(row.reason),
    created_at: toIso(row.created_at),
  };
}

function mapCashClosing(row: Record<string, unknown>) {
  return {
    id: stringValue(row.id),
    opened_at: toIso(row.opened_at),
    closed_at: stringValue(row.closed_at) || null,
    opening_amount: numberValue(row.opening_amount),
    closing_amount: row.closing_amount === null || row.closing_amount === undefined ? null : numberValue(row.closing_amount),
    status: cashStatusFromCloud(row.status),
    notes: stringValue(row.notes),
  };
}

async function currentCashSessionId(storeId: string): Promise<string | null> {
  const client = await getClient();
  const { data } = await client
    .from('cash_sessions')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? stringValue((data as Record<string, unknown>).id) : null;
}

export async function webCashSummary(): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const { data: openCash } = await client
    .from('cash_sessions')
    .select('id, opened_at, closed_at, opening_amount, closing_amount, status, notes')
    .eq('store_id', context.store.id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: movements, error } = await client
    .from('cash_movements')
    .select('id, type, method, amount, reason, created_at')
    .eq('store_id', context.store.id)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .order('created_at', { ascending: false })
    .limit(160);
  if (error) throw new Error(`Não foi possível carregar caixa do Supabase: ${error.message}`);
  const mappedMovements = (movements ?? []).map((row: Record<string, unknown>) => mapCashMovement(row));
  const todayIn = mappedMovements.filter((row) => row.type === 'entrada').reduce((sum, row) => sum + row.amount, 0);
  const todayOut = mappedMovements.filter((row) => row.type === 'saida').reduce((sum, row) => sum + row.amount, 0);
  const cash = openCash ? mapCashClosing(openCash as Record<string, unknown>) : null;
  const opening = cash?.opening_amount ?? 0;
  return { open_cash: cash, today_in: todayIn, today_out: todayOut, expected_total: opening + todayIn - todayOut, movements: mappedMovements };
}

export async function webOpenCash(openingAmount: number, notes: string): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'abrir caixa');
  assertWebTrainingModeAllowsWrite('abrir caixa real');
  const client = await getClient();
  if (openingAmount < 0) throw new Error('O valor inicial não pode ser negativo.');
  const alreadyOpen = await currentCashSessionId(context.store.id);
  if (alreadyOpen) throw new Error('Já existe um caixa aberto para esta loja.');
  const { error } = await client.from('cash_sessions').insert({ store_id: context.store.id, opened_by: context.userId, opening_amount: openingAmount, notes: notes.trim(), status: 'open' });
  if (error) throw new Error(`Não foi possível abrir caixa no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'cash', null, 'open', { opening_amount: openingAmount });
  return webCashSummary();
}

export async function webCloseCash(closingAmount: number, notes: string): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'fechar caixa');
  assertWebTrainingModeAllowsWrite('fechar caixa real');
  const client = await getClient();
  if (closingAmount < 0) throw new Error('O valor contado não pode ser negativo.');
  const sessionId = await currentCashSessionId(context.store.id);
  if (!sessionId) throw new Error('Nenhum caixa aberto para fechar.');
  const { error } = await client
    .from('cash_sessions')
    .update({ closed_by: context.userId, closed_at: new Date().toISOString(), closing_amount: closingAmount, notes: notes.trim(), status: 'closed' })
    .eq('id', sessionId)
    .eq('store_id', context.store.id)
    .eq('status', 'open');
  if (error) throw new Error(`Não foi possível fechar caixa no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'cash', sessionId, 'close', { closing_amount: closingAmount });
  return webCashSummary();
}

export async function webAddCashMovement(movementType: string, method: string, amount: number, reason: string, requestId = clientRequestId('cash')): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'lançar movimento de caixa');
  assertWebTrainingModeAllowsWrite('lançar movimento de caixa real');
  const client = await getClient();
  const cleanType = movementType === 'entrada' ? 'entrada' : 'saida';
  const cleanReason = reason.trim();
  if (amount <= 0) throw new Error('Informe um valor maior que zero para o movimento.');
  if (!cleanReason) throw new Error('Informe o motivo do movimento manual.');
  const sessionId = await currentCashSessionId(context.store.id);
  const { error } = await client.from('cash_movements').insert({
    store_id: context.store.id,
    cash_session_id: sessionId,
    client_request_id: requestId,
    type: cleanType,
    method: method.trim() || 'dinheiro',
    amount,
    reason: cleanReason,
    created_by: context.userId,
  });
  if (error) throw new Error(`Não foi possível lançar movimento no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'cash', null, 'manual_movement', { type: cleanType, amount, method, reason: cleanReason });
  return webCashSummary();
}

function creditStatusFromCloud(value: unknown): string {
  if (value === 'paid') return 'quitado';
  if (value === 'canceled') return 'cancelado';
  return 'aberto';
}

function installmentStatusFromCloud(value: unknown): string {
  if (value === 'paid') return 'pago';
  if (value === 'partial') return 'parcial';
  if (value === 'canceled') return 'cancelada';
  return 'aberto';
}

function mapInstallment(row: Record<string, unknown>): CreditInstallment {
  return {
    id: stringValue(row.id),
    number: numberValue(row.number),
    amount: numberValue(row.amount),
    paid_amount: numberValue(row.paid_amount),
    due_date: stringValue(row.due_date),
    paid_at: stringValue(row.paid_at) || null,
    status: installmentStatusFromCloud(row.status),
    payment_method: stringValue(row.payment_method) || null,
  };
}

function mapCredit(row: Record<string, unknown>, installments: CreditInstallment[], salesById: Map<string, number>, customersById: Map<string, { phone: string; whatsapp: string }>, saleItemsBySaleId: Map<string, SaleItemSummary[]>): CreditSummary {
  const customerId = stringValue(row.customer_id);
  const contact = customersById.get(customerId);
  const saleId = stringValue(row.sale_id);
  return {
    id: stringValue(row.id),
    customer_name: stringValue(row.customer_name, 'Cliente'),
    customer_phone: contact?.phone ?? '',
    customer_whatsapp: contact?.whatsapp ?? '',
    sale_id: saleId,
    sale_number: salesById.get(saleId) ?? 0,
    total: numberValue(row.total),
    balance: numberValue(row.balance),
    status: creditStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
    installments,
    sale_items: saleItemsBySaleId.get(saleId) ?? [],
  };
}

export async function webCredits(): Promise<CreditSummary[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data: creditRows, error } = await client
    .from('credits')
    .select('id, customer_id, customer_name, sale_id, total, balance, status, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(160);
  if (error) throw new Error(`Não foi possível carregar crediário do Supabase: ${error.message}`);
  const credits = creditRows ?? [];
  const creditIds = credits.map((row: Record<string, unknown>) => stringValue(row.id)).filter(Boolean);
  const saleIds = Array.from(new Set(credits.map((row: Record<string, unknown>) => stringValue(row.sale_id)).filter(Boolean)));
  const customerIds = Array.from(new Set(credits.map((row: Record<string, unknown>) => stringValue(row.customer_id)).filter(Boolean)));
  const installmentsByCreditId = new Map<string, CreditInstallment[]>();
  const salesById = new Map<string, number>();
  const customersById = new Map<string, { phone: string; whatsapp: string }>();
  const saleItemsBySaleId = new Map<string, SaleItemSummary[]>();
  if (creditIds.length > 0) {
    const { data: installmentRows } = await client.from('credit_installments').select('id, credit_id, number, amount, paid_amount, due_date, paid_at, status, payment_method').eq('store_id', context.store.id).in('credit_id', creditIds).order('number', { ascending: true });
    for (const installment of installmentRows ?? []) {
      const row = installment as Record<string, unknown>;
      const creditId = stringValue(row.credit_id);
      const list = installmentsByCreditId.get(creditId) ?? [];
      list.push(mapInstallment(row));
      installmentsByCreditId.set(creditId, list);
    }
  }
  if (saleIds.length > 0) {
    const { data: sales } = await client.from('sales').select('id, number').eq('store_id', context.store.id).in('id', saleIds);
    for (const sale of sales ?? []) {
      const row = sale as Record<string, unknown>;
      salesById.set(stringValue(row.id), numberValue(row.number));
    }
  }
  if (saleIds.length > 0) {
    const { data: saleItems } = await client
      .from('sale_items')
      .select('sale_id, product_name, qty, unit_price, total, created_at')
      .eq('store_id', context.store.id)
      .in('sale_id', saleIds)
      .order('created_at', { ascending: true });
    for (const item of saleItems ?? []) {
      const row = item as Record<string, unknown>;
      const saleId = stringValue(row.sale_id);
      const list = saleItemsBySaleId.get(saleId) ?? [];
      list.push(mapSaleItem(row));
      saleItemsBySaleId.set(saleId, list);
    }
  }
  if (customerIds.length > 0) {
    const { data: customers } = await client.from('customers').select('id, phone, whatsapp').eq('store_id', context.store.id).in('id', customerIds);
    for (const customer of customers ?? []) {
      const row = customer as Record<string, unknown>;
      customersById.set(stringValue(row.id), { phone: stringValue(row.phone), whatsapp: stringValue(row.whatsapp) });
    }
  }
  return credits.map((row: Record<string, unknown>) => mapCredit(row, installmentsByCreditId.get(stringValue(row.id)) ?? [], salesById, customersById, saleItemsBySaleId));
}

export async function webReceiveInstallment(payload: unknown): Promise<CreditSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'receber crediário');
  assertWebTrainingModeAllowsWrite('receber crediário real');
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const creditId = stringValue(source.credit_id);
  const installmentId = stringValue(source.installment_id);
  const amount = Math.max(0, numberValue(source.amount));
  const method = normalizeCreditPaymentMethod(stringValue(source.method));
  const requestId = stringValue(source.request_id) || clientRequestId('pay');
  const redistribute = Boolean(source.settle_with_redistribution);
  if (!creditId || !installmentId) throw new Error('Parcela inválida para recebimento.');
  if (amount <= 0) throw new Error('Informe um valor maior que R$ 0,00.');
  if (!method) throw new Error('Escolha como o cliente pagou: dinheiro, PIX, cartão ou outro.');
  const creditsBefore = await webCredits();
  const creditBefore = creditsBefore.find((item) => item.id === creditId);
  const installmentBefore = creditBefore?.installments.find((item) => item.id === installmentId);
  if (!creditBefore || !installmentBefore) throw new Error('Parcela inválida para recebimento.');
  if (installmentBefore.status === 'pago') throw new Error('Essa parcela já está paga. Escolha outra parcela em aberto.');
  const installmentOpen = remainingInstallmentAmount(installmentBefore);
  const creditOpen = totalCreditOpenAmount(creditBefore);
  if (amount > creditOpen + 0.009) {
    throw new Error('Esse valor parece maior que o saldo em aberto. Confira antes de receber.');
  }
  if (amount > installmentOpen + 0.009 && !redistribute) {
    throw new Error('Esse valor parece maior que a parcela. Para abater próximas parcelas, marque a opção de redistribuir antes de confirmar.');
  }
  const client = await getClient();
  const { error } = await client.rpc('web_receive_credit_payment', {
    target_credit_id: creditId,
    target_installment_id: installmentId,
    payment_amount: amount,
    payment_method_text: method,
    payment_request_id: requestId,
    redistribute_remaining: redistribute,
  });
  if (error) throw new Error(`Não foi possível receber crediário no Supabase. Aplique a migration do Mega Lote 53 se ainda não aplicou. Detalhe: ${error.message}`);
  const credits = await webCredits();
  const credit = credits.find((item) => item.id === creditId);
  if (!credit) throw new Error('Recebimento gravado, mas o crediário não foi encontrado na atualização.');
  return credit;
}

export async function webOrders(): Promise<OrderSummary[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data, error } = await client
    .from('orders')
    .select('id, number, customer_name, total, status, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Não foi possível carregar pedidos do Supabase: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapOrder(row));
}

export async function webCreateOrder(payload: unknown): Promise<OrderSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'criar pedidos');
  assertWebTrainingModeAllowsWrite('criar pedido real');
  const client = await getClient();
  const orderPayload = parseOrderPayload(payload);
  const existing = await client
    .from('orders')
    .select('id, number, customer_name, total, status, created_at')
    .eq('store_id', context.store.id)
    .eq('client_request_id', orderPayload.request_id)
    .maybeSingle();
  if (existing.data) return mapOrder(existing.data as Record<string, unknown>);
  const productIds = Array.from(new Set(orderPayload.items.map((item) => item.product_id)));
  const { data: productRows, error: productsError } = await client
    .from('products')
    .select('id, name, price, promo_price, stock, status')
    .eq('store_id', context.store.id)
    .in('id', productIds);
  if (productsError) throw new Error(`Não foi possível validar produtos do pedido: ${productsError.message}`);
  const productsById = new Map((productRows ?? []).map((product: Record<string, unknown>) => [stringValue(product.id), product]));
  const orderItems = orderPayload.items.map((item) => {
    const product = productsById.get(item.product_id);
    if (!product) throw new Error('Um dos produtos do pedido não existe mais no Supabase.');
    if (product.status !== 'active') throw new Error(`Produto ${stringValue(product.name)} está inativo.`);
    if (numberValue(product.stock) < item.qty) throw new Error(`Estoque insuficiente para ${stringValue(product.name)}. Disponível: ${numberValue(product.stock)}.`);
    const unitPrice = product.promo_price === null || product.promo_price === undefined ? numberValue(product.price) : numberValue(product.promo_price);
    return { product_id: item.product_id, product_name: stringValue(product.name), qty: item.qty, unit_price: unitPrice, total: item.qty * unitPrice };
  });
  let customerName = 'Balcão';
  if (orderPayload.customer_id) {
    const { data: customer, error: customerError } = await client
      .from('customers')
      .select('name')
      .eq('id', orderPayload.customer_id)
      .eq('store_id', context.store.id)
      .maybeSingle();
    if (customerError) throw new Error(`Não foi possível validar o cliente do pedido: ${customerError.message}`);
    customerName = customer ? stringValue((customer as Record<string, unknown>).name, 'Balcão') : 'Balcão';
  }
  const total = orderItems.reduce((sum, item) => sum + item.total, 0);
  const { data: insertedOrder, error: orderError } = await client
    .from('orders')
    .insert({ store_id: context.store.id, client_request_id: orderPayload.request_id, customer_id: orderPayload.customer_id, customer_name: customerName, total, status: 'open', created_by: context.userId })
    .select('id, number, customer_name, total, status, created_at')
    .single();
  if (orderError) throw new Error(`Não foi possível criar o pedido no Supabase: ${orderError.message}`);
  const order = insertedOrder as Record<string, unknown>;
  const { error: itemsError } = await client.from('order_items').insert(orderItems.map((item) => ({ store_id: context.store.id, order_id: stringValue(order.id), product_id: item.product_id, product_name: item.product_name, qty: item.qty, unit_price: item.unit_price, total: item.total })));
  if (itemsError) throw new Error(`Pedido criado, mas os itens não foram salvos: ${itemsError.message}`);
  await insertAudit(context.store.id, context.userId, 'orders', stringValue(order.id), 'created', { total, items: orderItems.length });
  return mapOrder(order);
}

export async function webSetOrderStatus(orderId: string, status: string): Promise<OrderSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'alterar status de pedidos');
  assertWebTrainingModeAllowsWrite('alterar pedido real');
  const client = await getClient();
  const nextStatus = mapOrderStatusToCloud(status);
  if (nextStatus === 'delivered') {
    const rpcResult = await client.rpc('web_complete_order', { target_order_id: orderId });
    if (!rpcResult.error && rpcResult.data) {
      const source = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
      await insertAudit(context.store.id, context.userId, 'orders', orderId, 'delivered', { source: 'rpc' });
      return mapOrder(source as Record<string, unknown>);
    }
    return fallbackCompleteOrder(orderId, context);
  }
  if (nextStatus === 'accepted') await assertOrderStockAvailable(orderId, context.store.id);
  const { data, error } = await client
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('store_id', context.store.id)
    .neq('status', 'delivered')
    .neq('status', 'canceled')
    .select('id, number, customer_name, total, status, created_at')
    .single();
  if (error) throw new Error(`Não foi possível atualizar o pedido no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'orders', orderId, `status_${nextStatus}`, {});
  return mapOrder(data as Record<string, unknown>);
}

export async function webCancelOrder(orderId: string, reason: string): Promise<OrderSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'cancelar pedidos');
  assertWebTrainingModeAllowsWrite('cancelar pedido real');
  const client = await getClient();
  const { data, error } = await client
    .from('orders')
    .update({ status: 'canceled' })
    .eq('id', orderId)
    .eq('store_id', context.store.id)
    .neq('status', 'delivered')
    .neq('status', 'canceled')
    .select('id, number, customer_name, total, status, created_at')
    .single();
  if (error) throw new Error(`Não foi possível cancelar o pedido no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'orders', orderId, 'canceled', { reason });
  return mapOrder(data as Record<string, unknown>);
}

export async function webReceipts(): Promise<ReceiptSummary[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data: receipts, error } = await client
    .from('receipts')
    .select('id, sale_id, sale_number, receipt_type, total, content_html, status, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Não foi possível carregar comprovantes do Supabase: ${error.message}`);
  const saleIds = Array.from(new Set((receipts ?? []).map((row: Record<string, unknown>) => stringValue(row.sale_id)).filter(Boolean)));
  const salesById = new Map<string, { customerName: string; customerId: string }>();
  const whatsappByCustomerId = new Map<string, string>();
  if (saleIds.length > 0) {
    const { data: sales } = await client.from('sales').select('id, customer_name, customer_id').eq('store_id', context.store.id).in('id', saleIds);
    for (const sale of sales ?? []) {
      const row = sale as Record<string, unknown>;
      salesById.set(stringValue(row.id), { customerName: stringValue(row.customer_name, 'Balcão'), customerId: stringValue(row.customer_id) });
    }
    const customerIds = Array.from(new Set(Array.from(salesById.values()).map((item) => item.customerId).filter(Boolean)));
    if (customerIds.length > 0) {
      const { data: customers } = await client.from('customers').select('id, whatsapp').eq('store_id', context.store.id).in('id', customerIds);
      for (const customer of customers ?? []) {
        const row = customer as Record<string, unknown>;
        whatsappByCustomerId.set(stringValue(row.id), stringValue(row.whatsapp));
      }
    }
  }
  return (receipts ?? []).map((row: Record<string, unknown>) => mapReceipt(row, salesById, whatsappByCustomerId));
}

function formatAuditDetails(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function webAudit(): Promise<AuditEvent[]> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const { data, error } = await client
    .from('audit_log')
    .select('id, entity, entity_id, action, details, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(`Não foi possível carregar auditoria do Supabase: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: stringValue(row.id),
    entity: stringValue(row.entity),
    entity_id: stringValue(row.entity_id),
    action: stringValue(row.action),
    details: formatAuditDetails(row.details),
    created_at: toIso(row.created_at),
  }));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

type ReceiptPrintFormat = '58mm' | '80mm' | 'a4';

function normalizeReceiptPrintFormat(value: string): ReceiptPrintFormat {
  if (value === '58mm' || value === 'a4') return value;
  return '80mm';
}

function splitPrintableHtmlDocument(html: string): { styles: string; body: string } {
  const styleBlocks = Array.from(html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)).map((match) => match[0]).join('\n');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return {
    styles: styleBlocks,
    body: bodyMatch ? bodyMatch[1] : html,
  };
}

export function webExportHtmlPdf(html: string, fileStem: string, printFormat = '80mm'): Promise<string> {
  const title = escapeHtml(fileStem);
  const format = normalizeReceiptPrintFormat(printFormat);
  const printedAt = new Date().toLocaleString('pt-BR');
  const formatLabel = format === 'a4' ? 'A4' : format;
  const pageRule = format === '58mm' ? '@page{size:58mm auto;margin:3mm}' : format === 'a4' ? '@page{size:A4;margin:10mm}' : '@page{size:80mm auto;margin:4mm}';
  const embedded = splitPrintableHtmlDocument(html);
  const printable = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${embedded.styles}<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef2f8;color:#111827;font-family:Inter,Arial,sans-serif}.print-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;background:#0b1020;color:#f8fafc;box-shadow:0 14px 34px rgba(15,23,42,.18)}.print-toolbar strong{font-size:14px}.print-toolbar small{display:block;color:#aeb8cf;margin-top:2px}.print-toolbar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.print-toolbar button{border:0;border-radius:999px;padding:10px 14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);cursor:pointer}.print-toolbar button.secondary{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);color:#dbeafe}.print-format{border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:9px 12px;color:#dbeafe;background:rgba(255,255,255,.07);font-weight:800}.print-shell{width:min(920px,100%);max-width:100%;margin:22px auto;padding:18px;overflow-x:hidden}.receipt-paper{max-width:100%;background:#fff;border:1px solid #d9e2f2;border-radius:18px;box-shadow:0 22px 58px rgba(15,23,42,.16);padding:18px;overflow:visible}.receipt-paper.format-58mm{width:58mm;padding:3mm;border-radius:10px}.receipt-paper.format-80mm{width:80mm;padding:4mm;border-radius:12px}.receipt-paper.format-a4{width:100%;max-width:210mm;min-height:auto;padding:clamp(12px,3vw,12mm)}.receipt-paper section{margin-inline:auto}.slf-receipt{width:100%;max-width:100%;font-family:Inter,Arial,sans-serif;color:#111827}.slf-receipt *{box-sizing:border-box}.slf-receipt-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #dbe3ef;padding-bottom:10px;margin-bottom:10px}.slf-receipt-brand{display:flex;gap:9px;align-items:center}.slf-receipt-logo{width:34px;height:34px;border-radius:10px;object-fit:contain;background:#172554;padding:5px}.slf-receipt-title{font-size:16px;font-weight:900;line-height:1.05}.slf-receipt-sub{font-size:10px;color:#64748b;margin-top:2px}.slf-receipt-badge{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;white-space:nowrap}.slf-receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.slf-receipt-info{border:1px solid #e2e8f0;border-radius:10px;padding:7px;background:#f8fafc}.slf-receipt-info span{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.slf-receipt-info strong{display:block;color:#0f172a;font-size:12px;margin-top:3px}.slf-receipt-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}.slf-receipt-table th{background:#f1f5f9;color:#334155;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.03em;padding:6px;border:1px solid #e2e8f0}.slf-receipt-table td{padding:6px;border:1px solid #e2e8f0;vertical-align:top}.slf-receipt-table .num{text-align:right;white-space:nowrap}.slf-receipt-total{display:grid;gap:5px;margin-top:10px}.slf-receipt-total-row{display:flex;justify-content:space-between;gap:12px;font-size:12px}.slf-receipt-total-row.final{border-radius:12px;background:#0f172a;color:#fff;padding:10px 12px;font-size:16px;font-weight:900}.slf-receipt-note{margin-top:10px;border:1px dashed #cbd5e1;border-radius:12px;padding:8px;color:#334155;font-size:10px;line-height:1.45}.slf-receipt-footer{margin-top:10px;text-align:center;color:#64748b;font-size:9px}.format-58mm .slf-receipt-head{display:block;text-align:center}.format-58mm .slf-receipt-brand{justify-content:center}.format-58mm .slf-receipt-badge{display:inline-flex;margin-top:6px}.format-58mm .slf-receipt-grid{grid-template-columns:1fr}.format-58mm .slf-receipt-table{font-size:9px}.format-58mm .slf-receipt-table th,.format-58mm .slf-receipt-table td{padding:4px}.format-58mm .slf-receipt-total-row.final{font-size:14px}.print-footer{margin:14px auto 0;width:min(920px,100%);padding:0 18px 18px;color:#64748b;font-size:12px;text-align:center}@media (max-width:640px){.print-toolbar{position:relative;display:grid;grid-template-columns:1fr;align-items:start;padding:12px}.print-toolbar strong{font-size:13px}.print-toolbar-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;width:100%}.print-toolbar button{padding:10px 12px}.print-toolbar button:last-child{grid-column:1/-1}.print-format{display:inline-flex;align-items:center;justify-content:center}.print-shell{width:100%;margin:8px auto;padding:10px}.receipt-paper{border-radius:16px;padding:10px}.receipt-paper.format-a4{width:100%;max-width:100%;padding:10px}.print-footer{padding:0 12px 18px}}${pageRule}@media print{body{background:#fff}.no-print,.print-toolbar,.print-footer{display:none!important}.print-shell{width:100%;margin:0;padding:0}.receipt-paper{border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;overflow:visible!important}.receipt-paper.format-58mm{width:58mm}.receipt-paper.format-80mm{width:80mm}.receipt-paper.format-a4{width:100%;min-height:auto;padding:0!important}}</style></head><body><div class="print-toolbar no-print"><div><strong>Prévia A4 / PDF</strong><small>Gerado em ${printedAt}</small></div><div class="print-toolbar-actions"><span class="print-format">${formatLabel}</span><button type="button" class="secondary" onclick="navigator.clipboard&&navigator.clipboard.writeText((document.querySelector('.receipt-paper')||document.body).innerText||'')">Copiar texto</button><button type="button" onclick="window.print()">Imprimir ou salvar PDF</button></div></div><main class="print-shell"><div class="receipt-paper format-${format}">${embedded.body}</div></main><div class="print-footer no-print">No iPhone, use esta tela para conferir, tirar print, compartilhar ou tocar em Imprimir ou salvar PDF. No Android/PC, o botão acima abre a impressão.</div><script>setTimeout(function(){window.focus();var isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);if(!isMobile){window.print();}},350);<\/script></body></html>`;
  const result = openGeneratedHtmlDocument(`${fileStem}-${format}.html`, printable);
  if (result === 'opened') {
    return Promise.resolve(`Prévia ${formatLabel} aberta. Use Imprimir ou salvar PDF para gerar o arquivo PDF.`);
  }
  return Promise.resolve(`O navegador bloqueou a nova aba; baixei ${fileStem}-${format}.html para abrir e salvar como PDF.`);
}

function buildReportSkeleton(report: ReportKind, from: string, to: string): ReportData {
  const generatedAt = new Date().toISOString();
  const periodText = from === to ? reportDate(from) : `${reportDate(from)} até ${reportDate(to)}`;
  if (report === 'caixa') return { report, title: 'Caixa por período', description: `Movimentos de caixa entre ${periodText}.`, empty_message: 'Nenhum movimento de caixa encontrado no período.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'data', label: 'Data' }, { key: 'tipo', label: 'Tipo' }, { key: 'forma', label: 'Forma' }, { key: 'motivo', label: 'Motivo' }, { key: 'valor', label: 'Valor', align: 'right' }], rows: [] };
  if (report === 'crediario') return { report, title: 'Crediário em aberto', description: `Clientes com saldo pendente criados entre ${periodText}.`, empty_message: 'Nenhum crediário em aberto encontrado.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'cliente', label: 'Cliente' }, { key: 'venda', label: 'Venda' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'saldo', label: 'Saldo', align: 'right' }, { key: 'data', label: 'Data' }], rows: [] };
  if (report === 'estoque_baixo') return { report, title: 'Estoque baixo atual', description: 'Produtos ativos abaixo do limite configurado. Este relatório não depende do período.', empty_message: 'Nenhum produto abaixo do limite.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'produto', label: 'Produto' }, { key: 'categoria', label: 'Categoria' }, { key: 'estoque', label: 'Estoque', align: 'right' }, { key: 'preco', label: 'Preço', align: 'right' }, { key: 'status', label: 'Status' }], rows: [] };
  return { report, title: 'Vendas por período', description: `Vendas registradas entre ${periodText}.`, empty_message: 'Nenhuma venda encontrada no período.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'data', label: 'Data' }, { key: 'venda', label: 'Venda' }, { key: 'cliente', label: 'Cliente' }, { key: 'forma', label: 'Forma' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total', align: 'right' }], rows: [] };
}

export async function webReportData(reportValue: string, from: string, to: string): Promise<ReportData> {
  const report: ReportKind = reportValue === 'caixa' || reportValue === 'crediario' || reportValue === 'estoque_baixo' ? reportValue : 'vendas';
  if (from > to) throw new Error('A data inicial não pode ser maior que a data final.');
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const model = buildReportSkeleton(report, from, to);
  const range = dateRange(from, to);
  if (report === 'vendas') {
    const { data, error } = await client.from('sales').select('number, customer_name, payment_method, total, status, created_at').eq('store_id', context.store.id).gte('created_at', range.fromIso).lt('created_at', range.toIso).order('created_at', { ascending: false });
    if (error) throw new Error(`Não foi possível gerar relatório de vendas: ${error.message}`);
    const rows = (data ?? []).map((sale: Record<string, unknown>) => ({ data: reportDateTime(toIso(sale.created_at)), venda: `#${numberValue(sale.number)}`, cliente: stringValue(sale.customer_name, 'Balcão'), forma: stringValue(sale.payment_method, '-'), status: stringValue(sale.status, '-'), total: reportMoney(numberValue(sale.total)) }));
    const validSales = (data ?? []).filter((sale: Record<string, unknown>) => String(sale.status) !== 'canceled');
    const total = validSales.reduce((sum, sale: Record<string, unknown>) => sum + numberValue(sale.total), 0);
    model.rows = rows; model.total_rows = rows.length; model.summary = [{ label: 'Total vendido', value: reportMoney(total), detail: 'Soma sem vendas canceladas.', tone: 'green' }, { label: 'Vendas', value: String(validSales.length), detail: 'Quantidade finalizada no período.', tone: 'blue' }, { label: 'Ticket médio', value: reportMoney(validSales.length ? total / validSales.length : 0), detail: 'Média por venda válida.', tone: 'purple' }];
    return model;
  }
  if (report === 'caixa') {
    const { data, error } = await client.from('cash_movements').select('type, method, amount, reason, created_at').eq('store_id', context.store.id).gte('created_at', range.fromIso).lt('created_at', range.toIso).order('created_at', { ascending: false });
    if (error) throw new Error(`Não foi possível gerar relatório de caixa: ${error.message}`);
    const rows = (data ?? []).map((movement: Record<string, unknown>) => ({ data: reportDateTime(toIso(movement.created_at)), tipo: stringValue(movement.type, '-'), forma: stringValue(movement.method, '-'), motivo: stringValue(movement.reason, '-'), valor: reportMoney(numberValue(movement.amount)) }));
    const entrada = (data ?? []).filter((row: Record<string, unknown>) => row.type === 'entrada').reduce((sum, row: Record<string, unknown>) => sum + numberValue(row.amount), 0);
    const saida = (data ?? []).filter((row: Record<string, unknown>) => row.type === 'saida').reduce((sum, row: Record<string, unknown>) => sum + numberValue(row.amount), 0);
    model.rows = rows; model.total_rows = rows.length; model.summary = [{ label: 'Entradas', value: reportMoney(entrada), detail: 'Total de entradas no período.', tone: 'green' }, { label: 'Saídas', value: reportMoney(saida), detail: 'Total de saídas no período.', tone: 'orange' }, { label: 'Saldo', value: reportMoney(entrada - saida), detail: 'Resultado simples do período.', tone: 'blue' }];
    return model;
  }
  if (report === 'crediario') {
    const { data, error } = await client.from('credits').select('customer_name, sale_id, total, balance, status, created_at').eq('store_id', context.store.id).eq('status', 'open').gte('created_at', range.fromIso).lt('created_at', range.toIso).order('created_at', { ascending: false });
    if (error) throw new Error(`Não foi possível gerar relatório de crediário: ${error.message}`);
    const rows = (data ?? []).map((credit: Record<string, unknown>) => ({ cliente: stringValue(credit.customer_name, 'Cliente'), venda: stringValue(credit.sale_id).slice(0, 8) || '-', total: reportMoney(numberValue(credit.total)), saldo: reportMoney(numberValue(credit.balance)), data: reportDateTime(toIso(credit.created_at)) }));
    const balance = (data ?? []).reduce((sum, credit: Record<string, unknown>) => sum + numberValue(credit.balance), 0);
    const customers = new Set((data ?? []).map((credit: Record<string, unknown>) => stringValue(credit.customer_name)).filter(Boolean));
    model.rows = rows; model.total_rows = rows.length; model.summary = [{ label: 'Saldo em aberto', value: reportMoney(balance), detail: 'Valor pendente a receber.', tone: 'pink' }, { label: 'Clientes', value: String(customers.size), detail: 'Clientes com pendência.', tone: 'blue' }, { label: 'Registros', value: String(rows.length), detail: 'Crediários abertos.', tone: 'purple' }];
    return model;
  }
  const { data, error } = await client.from('products').select('name, category, stock, price, status').eq('store_id', context.store.id).eq('status', 'active').lte('stock', context.store.low_stock_limit).order('stock', { ascending: true });
  if (error) throw new Error(`Não foi possível gerar relatório de estoque baixo: ${error.message}`);
  const rows = (data ?? []).map((product: Record<string, unknown>) => ({ produto: stringValue(product.name, 'Produto'), categoria: stringValue(product.category, '-'), estoque: numberValue(product.stock).toLocaleString('pt-BR'), preco: reportMoney(numberValue(product.price)), status: 'Ativo' }));
  const zeroStock = (data ?? []).filter((product: Record<string, unknown>) => numberValue(product.stock) <= 0).length;
  model.rows = rows; model.total_rows = rows.length; model.summary = [{ label: 'Abaixo do limite', value: String(rows.length), detail: `Limite atual: ${context.store.low_stock_limit}.`, tone: 'orange' }, { label: 'Zerados', value: String(zeroStock), detail: 'Produtos sem estoque.', tone: 'pink' }, { label: 'Ação', value: rows.length ? 'Repor' : 'OK', detail: rows.length ? 'Revise compras e entrada de estoque.' : 'Estoque saudável.', tone: rows.length ? 'orange' : 'green' }];
  return model;
}

export async function webReportsCsv(report: string, from: string, to: string): Promise<string> {
  const data = await webReportData(report, from, to);
  const header = data.columns.map((column) => csvEscape(column.label)).join(';');
  const lines = data.rows.map((row) => data.columns.map((column) => csvEscape(row[column.key] ?? '')).join(';'));
  const csv = ['\ufeff' + header, ...lines].join('\n');
  const fileName = `relatorio-${data.report}-${from}-a-${to}.csv`;
  downloadTextFile(fileName, csv, 'text/csv;charset=utf-8');
  return `download:${fileName}`;
}



async function runWebOutboxItem(item: WebOutboxItem): Promise<void> {
  if (item.action === 'saveCustomer') {
    await webSaveCustomer(item.payload.customer as Partial<Customer>);
    return;
  }
  if (item.action === 'inactivateCustomer') {
    await webInactivateCustomer(String(item.payload.customerId ?? ''));
    return;
  }
  if (item.action === 'saveProduct') {
    await webSaveProduct(item.payload.product as Partial<Product>);
    return;
  }
  if (item.action === 'inactivateProduct') {
    await webInactivateProduct(String(item.payload.productId ?? ''));
    return;
  }
  if (item.action === 'adjustStock') {
    await webAdjustStock(String(item.payload.productId ?? ''), numberValue(item.payload.delta), String(item.payload.reason ?? 'Ajuste pendente reenviado'));
    return;
  }
  if (item.action === 'createSale') {
    await webCreateSale(item.payload.payload);
    return;
  }
  if (item.action === 'cancelSale') {
    await webCancelSale(String(item.payload.saleId ?? ''), String(item.payload.reason ?? 'Cancelamento pendente reenviado'));
    return;
  }
  if (item.action === 'openCash') {
    await webOpenCash(numberValue(item.payload.openingAmount), String(item.payload.notes ?? ''));
    return;
  }
  if (item.action === 'closeCash') {
    await webCloseCash(numberValue(item.payload.closingAmount), String(item.payload.notes ?? ''));
    return;
  }
  if (item.action === 'addCashMovement') {
    await webAddCashMovement(String(item.payload.movementType ?? 'entrada'), String(item.payload.method ?? 'dinheiro'), numberValue(item.payload.amount), String(item.payload.reason ?? 'Movimento pendente reenviado'), String(item.payload.requestId || clientRequestId('cash')));
    return;
  }
  if (item.action === 'receiveInstallment') {
    await webReceiveInstallment(item.payload.payload);
    return;
  }
  if (item.action === 'createOrder') {
    await webCreateOrder(item.payload.payload);
    return;
  }
  if (item.action === 'setOrderStatus') {
    await webSetOrderStatus(String(item.payload.orderId ?? ''), String(item.payload.status ?? 'open'));
    return;
  }
  if (item.action === 'cancelOrder') {
    await webCancelOrder(String(item.payload.orderId ?? ''), String(item.payload.reason ?? 'Cancelamento pendente reenviado'));
    return;
  }
  if (item.action === 'saveSettings') {
    await webSaveSettings(item.payload.settings as Settings);
    return;
  }
  throw new Error('Ação pendente não reconhecida.');
}

export async function flushWebOutbox(): Promise<WebOutboxStats> {
  assertWebTrainingModeAllowsWrite('reenviar pendências reais para a nuvem');
  const queue = readWebOutbox();
  if (queue.length === 0) {
    recordWebSyncSnapshot('synced', 'Sincronização', 'Nenhuma alteração pendente neste aparelho.');
    return getWebOutboxStats([]);
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    recordWebSyncSnapshot('pending', 'Sincronização', 'Ainda sem internet. As alterações continuam guardadas neste aparelho.');
    return getWebOutboxStats(queue);
  }

  recordWebSyncSnapshot('syncing', 'Sincronização', `Enviando ${queue.length} alteração(ões) pendente(s) para a nuvem...`);
  const remaining: WebOutboxItem[] = [];
  let sent = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    try {
      await runWebOutboxItem(item);
      sent += 1;
    } catch (error) {
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: humanizeWebError(error),
      });
      if (shouldQueueWebError(error)) {
        remaining.push(...queue.slice(index + 1));
        break;
      }
    }
  }

  writeRawWebOutbox(remaining);
  if (remaining.length === 0) {
    recordWebSyncSnapshot('synced', 'Sincronização', `${sent} alteração(ões) pendente(s) enviada(s) para a nuvem.`);
  } else {
    recordWebSyncSnapshot('pending', 'Sincronização', `${sent} enviada(s). ${remaining.length} ainda pendente(s) neste aparelho.`);
  }
  return getWebOutboxStats(remaining);
}


export type WebCommercialCheckLevel = 'ok' | 'warn' | 'danger';

export interface WebCommercialCheckItem {
  id: string;
  area: string;
  title: string;
  detail: string;
  level: WebCommercialCheckLevel;
  evidence: string;
}

export interface WebCommercialValidationReport {
  createdAt: string;
  appVersion: string;
  cacheVersion: string;
  storeName: string;
  email: string;
  roleLabel: string;
  score: number;
  readyLabel: 'quase' | 'nao' | 'piloto';
  checks: WebCommercialCheckItem[];
  counts: Record<string, number>;
  cacheKeys: string[];
  outbox: WebOutboxStats;
}

type CommercialCountResult = { count: number | null; error: { message: string } | null };
type CommercialCountQuery = {
  eq: (column: string, value: unknown) => CommercialCountQuery;
  then: Promise<CommercialCountResult>['then'];
};

function commercialLevelScore(level: WebCommercialCheckLevel): number {
  if (level === 'ok') return 1;
  if (level === 'warn') return 0.55;
  return 0;
}

function commercialReadyLabel(score: number, dangerCount: number): WebCommercialValidationReport['readyLabel'] {
  if (dangerCount > 0) return 'nao';
  if (score >= 8.8) return 'piloto';
  return 'quase';
}

async function countCommercialRows(table: string, storeId: string, filterColumn = 'store_id'): Promise<{ count: number; error: string }> {
  try {
    const client = await getClient();
    let query = client.from(table).select('id', { count: 'exact', head: true }) as unknown as CommercialCountQuery;
    if (filterColumn) query = query.eq(filterColumn, storeId);
    const { count, error } = await query;
    return { count: count ?? 0, error: error?.message ?? '' };
  } catch (error) {
    return { count: 0, error: humanizeWebError(error) };
  }
}

async function readCommercialCacheKeys(): Promise<string[]> {
  try {
    if (typeof caches === 'undefined') return [];
    return await caches.keys();
  } catch {
    return [];
  }
}

async function hasCommercialServiceWorker(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration);
  } catch {
    return false;
  }
}

function pushCommercialCheck(checks: WebCommercialCheckItem[], item: WebCommercialCheckItem): void {
  checks.push(item);
}

function readGuidedCommercialProgress(): { done: number; total: number; percent: number } {
  const total = 11;
  if (typeof window === 'undefined' || !window.localStorage) return { done: 0, total, percent: 0 };
  try {
    const keys = ['smart-loja:guided-commercial-test-v139', 'smart-loja:guided-commercial-test-v138', 'smart-loja:guided-commercial-test-v137', 'smart-loja:guided-commercial-test-v136', 'smart-loja:guided-commercial-test-v134', 'smart-loja:guided-commercial-test-v133', 'smart-loja:guided-commercial-test-v131', 'smart-loja:guided-commercial-test-v130', 'smart-loja:guided-commercial-test-v129', 'smart-loja:guided-commercial-test-v128', 'smart-loja:guided-commercial-test-v127', 'smart-loja:guided-commercial-test-v126'];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown } | unknown[];
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { doneIds?: unknown }).doneIds) ? (parsed as { doneIds: unknown[] }).doneIds : [];
      const done = new Set(rows.filter((id): id is string => typeof id === 'string')).size;
      return { done, total, percent: Math.round((done / total) * 100) };
    }
  } catch {
    return { done: 0, total, percent: 0 };
  }
  return { done: 0, total, percent: 0 };
}


function readAssistedCommercialProgress(): { passed: number; failed: number; blocked: number; total: number; percent: number; criticalProblems: number } {
  const total = 12;
  const criticalIds = new Set([
    'deploy-cache-v139-real',
    'owner-auto-test-no-danger',
    'device-a-create-core-records',
    'device-b-sees-core-records',
    'cash-real-open-move-close',
    'order-real-cycle',
    'credit-real-payment',
    'roles-real-blocks',
    'offline-real-retry-no-duplicate',
    'final-sell-decision',
  ]);
  const keys = ['smart-loja:assisted-commercial-run-v139', 'smart-loja:assisted-commercial-run-v138', 'smart-loja:assisted-commercial-run-v137', 'smart-loja:assisted-commercial-run-v136', 'smart-loja:assisted-commercial-run-v134', 'smart-loja:assisted-commercial-run-v133', 'smart-loja:assisted-commercial-run-v131', 'smart-loja:assisted-commercial-run-v130', 'smart-loja:assisted-commercial-run-v129', 'smart-loja:assisted-commercial-run-v128', 'smart-loja:assisted-commercial-run-v127'];
  if (typeof window === 'undefined' || !window.localStorage) return { passed: 0, failed: 0, blocked: 0, total, percent: 0, criticalProblems: 0 };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { results?: Record<string, unknown> };
      const results = parsed && typeof parsed === 'object' && parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let criticalProblems = 0;
      for (const [id, result] of Object.entries(results)) {
        const normalizedId = id === 'deploy-cache-v128-real' || id === 'deploy-cache-v129-real' || id === 'deploy-cache-v130-real' || id === 'deploy-cache-v131-real' || id === 'deploy-cache-v133-real' || id === 'deploy-cache-v134-real' || id === 'deploy-cache-v136-real' || id === 'deploy-cache-v137-real' || id === 'deploy-cache-v138-real' ? 'deploy-cache-v139-real' : id;
        if (result === 'passed') passed += 1;
        if (result === 'failed') failed += 1;
        if (result === 'blocked') blocked += 1;
        if (criticalIds.has(normalizedId) && (result === 'failed' || result === 'blocked')) criticalProblems += 1;
      }
      return { passed, failed, blocked, total, percent: Math.round((passed / total) * 100), criticalProblems };
    }
  } catch {
    return { passed: 0, failed: 0, blocked: 0, total, percent: 0, criticalProblems: 0 };
  }
  return { passed: 0, failed: 0, blocked: 0, total, percent: 0, criticalProblems: 0 };
}


function readFinalCommercialAcceptanceStatus(): { signed: boolean; responsible: string; acceptedAt: string; key: string } {
  const keys = ['smart-loja:final-commercial-acceptance-v139', 'smart-loja:final-commercial-acceptance-v138', 'smart-loja:final-commercial-acceptance-v137', 'smart-loja:final-commercial-acceptance-v136', 'smart-loja:final-commercial-acceptance-v134', 'smart-loja:final-commercial-acceptance-v133', 'smart-loja:final-commercial-acceptance-v131', 'smart-loja:final-commercial-acceptance-v130', 'smart-loja:final-commercial-acceptance-v129'];
  if (typeof window === 'undefined' || !window.localStorage) return { signed: false, responsible: '', acceptedAt: '', key: keys[0] };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { acceptedAt?: unknown; responsible?: unknown; acceptedBy?: unknown };
      const acceptedAt = typeof parsed.acceptedAt === 'string' ? parsed.acceptedAt : '';
      const responsible = typeof parsed.responsible === 'string' ? parsed.responsible : typeof parsed.acceptedBy === 'string' ? parsed.acceptedBy : '';
      if (acceptedAt) return { signed: true, responsible: responsible.slice(0, 80), acceptedAt, key };
    }
  } catch {
    return { signed: false, responsible: '', acceptedAt: '', key: keys[0] };
  }
  return { signed: false, responsible: '', acceptedAt: '', key: keys[0] };
}


function readCommercialTourProgress(): { done: number; total: number; percent: number; active: boolean } {
  const total = 8;
  const keys = ['smart-loja:commercial-tour-v139', 'smart-loja:commercial-tour-v138', 'smart-loja:commercial-tour-v137', 'smart-loja:commercial-tour-v136', 'smart-loja:commercial-tour-v134', 'smart-loja:commercial-tour-v133'];
  if (!canUseBrowserStorage()) return { done: 0, total, percent: 0, active: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown; currentId?: unknown; presenter?: unknown; audience?: unknown; note?: unknown };
      const rows = Array.isArray(parsed.doneIds) ? parsed.doneIds : [];
      const done = new Set(rows.filter((id): id is string => typeof id === 'string')).size;
      const active = done > 0 || typeof parsed.currentId === 'string' || typeof parsed.presenter === 'string' || typeof parsed.audience === 'string' || typeof parsed.note === 'string';
      return { done, total, percent: Math.round((done / total) * 100), active };
    }
  } catch {
    return { done: 0, total, percent: 0, active: false };
  }
  return { done: 0, total, percent: 0, active: false };
}


function readCommercialProposalProgress(): { done: number; total: number; percent: number; active: boolean; plan: string } {
  const total = 7;
  const keys = ['smart-loja:commercial-proposal-v139', 'smart-loja:commercial-proposal-v138', 'smart-loja:commercial-proposal-v137', 'smart-loja:commercial-proposal-v136', 'smart-loja:commercial-proposal-v135', 'smart-loja:commercial-proposal-v134'];
  if (!canUseBrowserStorage()) return { done: 0, total, percent: 0, active: false, plan: 'não escolhido' };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown; selectedPlanId?: unknown; clientName?: unknown; notes?: unknown; updatedAt?: unknown };
      const rows = Array.isArray(parsed.doneIds) ? parsed.doneIds : [];
      const done = new Set(rows.filter((id): id is string => typeof id === 'string')).size;
      const plan = typeof parsed.selectedPlanId === 'string' ? parsed.selectedPlanId : 'standard';
      const active = done > 0 || typeof parsed.clientName === 'string' || typeof parsed.notes === 'string' || typeof parsed.updatedAt === 'string';
      return { done, total, percent: Math.round((done / total) * 100), active, plan };
    }
  } catch {
    return { done: 0, total, percent: 0, active: false, plan: 'não escolhido' };
  }
  return { done: 0, total, percent: 0, active: false, plan: 'não escolhido' };
}


function readImplementationTermProgress(): { done: number; total: number; percent: number; active: boolean; accepted: boolean } {
  const total = 8;
  const keys = ['smart-loja:implementation-term-v139', 'smart-loja:implementation-term-v138', 'smart-loja:implementation-term-v137', 'smart-loja:implementation-term-v136', 'smart-loja:implementation-term-v135'];
  if (!canUseBrowserStorage()) return { done: 0, total, percent: 0, active: false, accepted: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown; clientName?: unknown; responsibleName?: unknown; notes?: unknown; acceptedAt?: unknown; updatedAt?: unknown };
      const rows = Array.isArray(parsed.doneIds) ? parsed.doneIds : [];
      const done = new Set(rows.filter((id): id is string => typeof id === 'string')).size;
      const accepted = typeof parsed.acceptedAt === 'string' && parsed.acceptedAt.length > 0;
      const active = accepted || done > 0 || typeof parsed.clientName === 'string' || typeof parsed.responsibleName === 'string' || typeof parsed.notes === 'string' || typeof parsed.updatedAt === 'string';
      return { done, total, percent: Math.round((done / total) * 100), active, accepted };
    }
  } catch {
    return { done: 0, total, percent: 0, active: false, accepted: false };
  }
  return { done: 0, total, percent: 0, active: false, accepted: false };
}


function readPostSaleSupportProgress(): { total: number; open: number; solved: number; criticalOpen: number; percent: number; active: boolean } {
  const totalChecklist = 6;
  const keys = ['smart-loja:post-sale-support-v139', 'smart-loja:post-sale-support-v138', 'smart-loja:post-sale-support-v137', 'smart-loja:post-sale-support-v136'];
  if (!canUseBrowserStorage()) return { total: 0, open: 0, solved: 0, criticalOpen: 0, percent: 0, active: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown; tickets?: unknown; clientName?: unknown; supportOwner?: unknown; updatedAt?: unknown };
      const done = Array.isArray(parsed.doneIds) ? new Set(parsed.doneIds.filter((id): id is string => typeof id === 'string')).size : 0;
      const tickets = Array.isArray(parsed.tickets) ? parsed.tickets : [];
      let solved = 0;
      let open = 0;
      let criticalOpen = 0;
      for (const item of tickets) {
        const ticket = item && typeof item === 'object' ? item as { status?: unknown; priority?: unknown } : {};
        const status = typeof ticket.status === 'string' ? ticket.status : 'open';
        const priority = ticket.priority === 'P0' || ticket.priority === 'P1' || ticket.priority === 'P2' ? ticket.priority : 'P1';
        if (status === 'solved') solved += 1;
        else {
          open += 1;
          if (priority === 'P0' || priority === 'P1') criticalOpen += 1;
        }
      }
      const active = done > 0 || tickets.length > 0 || typeof parsed.clientName === 'string' || typeof parsed.supportOwner === 'string' || typeof parsed.updatedAt === 'string';
      const percent = Math.min(100, Math.round(((done + solved) / (totalChecklist + (tickets.length || 1))) * 100));
      return { total: tickets.length, open, solved, criticalOpen, percent, active };
    }
  } catch {
    return { total: 0, open: 0, solved: 0, criticalOpen: 0, percent: 0, active: false };
  }
  return { total: 0, open: 0, solved: 0, criticalOpen: 0, percent: 0, active: false };
}


function readClientFeedbackProgress(): { done: number; total: number; percent: number; active: boolean; score: number; openP0P1: number; improvements: number } {
  const total = 6;
  const keys = ['smart-loja:client-feedback-nps-v139', 'smart-loja:client-feedback-nps-v138', 'smart-loja:client-feedback-nps-v137'];
  if (!canUseBrowserStorage()) return { done: 0, total, percent: 0, active: false, score: 0, openP0P1: 0, improvements: 0 };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { doneIds?: unknown; npsScore?: unknown; improvements?: unknown; clientName?: unknown; mainPain?: unknown; suggestedImprovement?: unknown; updatedAt?: unknown };
      const rows = Array.isArray(parsed.doneIds) ? parsed.doneIds : [];
      const done = new Set(rows.filter((id): id is string => typeof id === 'string')).size;
      const scoreRaw = typeof parsed.npsScore === 'number' ? parsed.npsScore : Number(parsed.npsScore ?? 0);
      const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(10, Math.round(scoreRaw))) : 0;
      const improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
      let openP0P1 = 0;
      for (const row of improvements) {
        const item = row && typeof row === 'object' ? row as { priority?: unknown; status?: unknown } : {};
        if ((item.priority === 'P0' || item.priority === 'P1') && item.status !== 'done') openP0P1 += 1;
      }
      const active = done > 0 || score > 0 || improvements.length > 0 || typeof parsed.clientName === 'string' || typeof parsed.mainPain === 'string' || typeof parsed.suggestedImprovement === 'string' || typeof parsed.updatedAt === 'string';
      return { done, total, percent: Math.round((done / total) * 100), active, score, openP0P1, improvements: improvements.length };
    }
  } catch {
    return { done: 0, total, percent: 0, active: false, score: 0, openP0P1: 0, improvements: 0 };
  }
  return { done: 0, total, percent: 0, active: false, score: 0, openP0P1: 0, improvements: 0 };
}

function readFinalRegressionAuditProgress(): { passed: number; failed: number; blocked: number; pending: number; total: number; percent: number; criticalOpen: number; approved: boolean } {
  const total = 12;
  const criticalIds = new Set([
    'regression-login-session',
    'regression-products-customers',
    'regression-sale-stock-receipt',
    'regression-cash-flow',
    'regression-permissions-roles',
    'regression-sync-offline',
    'regression-dashboard-mobile',
    'regression-orders-cycle',
    'regression-credit-payment',
    'regression-receipts-print',
    'regression-backup-restore-safe',
    'regression-pwa-cache-deploy',
  ]);
  const keys = ['smart-loja:regression-audit-v140', 'smart-loja:regression-audit-v139'];
  if (!canUseBrowserStorage()) return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { results?: Record<string, unknown>; approvedAt?: unknown };
      const results = parsed && typeof parsed === 'object' && parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let criticalOpen = 0;
      for (const [id, result] of Object.entries(results)) {
        if (result === 'passed') passed += 1;
        if (result === 'failed') failed += 1;
        if (result === 'blocked') blocked += 1;
        if (criticalIds.has(id) && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
      }
      const pending = Math.max(0, total - passed - failed - blocked);
      const approved = typeof parsed.approvedAt === 'string' && parsed.approvedAt.length > 0;
      return { passed, failed, blocked, pending, total, percent: Math.round((passed / total) * 100), criticalOpen, approved };
    }
  } catch {
    return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false };
  }
  return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false };
}


function readDayOneImplantationProgress(): { passed: number; failed: number; blocked: number; pending: number; total: number; percent: number; criticalOpen: number; approved: boolean; active: boolean } {
  const total = 12;
  const criticalIds = new Set([
    'day1-supabase-role',
    'day1-test-customer-product',
    'day1-test-sale-receipt',
    'day1-cash-real-control',
    'day1-second-device-sync',
    'day1-role-permissions',
    'day1-first-real-sale',
    'day1-schedule-internet',
    'day1-pwa-installed-cache',
    'day1-printer-confirmed',
    'day1-backup-before-real',
    'day1-client-acceptance',
  ]);
  const keys = ['smart-loja:day-one-implantation-v141'];
  if (!canUseBrowserStorage()) return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { results?: Record<string, unknown>; acceptedAt?: unknown; clientName?: unknown; implantor?: unknown; updatedAt?: unknown };
      const results = parsed && typeof parsed === 'object' && parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let criticalOpen = 0;
      for (const [id, result] of Object.entries(results)) {
        if (result === 'passed') passed += 1;
        if (result === 'failed') failed += 1;
        if (result === 'blocked') blocked += 1;
        if (criticalIds.has(id) && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
      }
      const pending = Math.max(0, total - passed - failed - blocked);
      const approved = typeof parsed.acceptedAt === 'string' && parsed.acceptedAt.length > 0;
      const active = approved || passed > 0 || failed > 0 || blocked > 0 || typeof parsed.clientName === 'string' || typeof parsed.implantor === 'string' || typeof parsed.updatedAt === 'string';
      return { passed, failed, blocked, pending, total, percent: Math.round((passed / total) * 100), criticalOpen, approved, active };
    }
  } catch {
    return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  }
  return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
}


function readDayTwoFollowUpProgress(): { passed: number; failed: number; blocked: number; pending: number; total: number; percent: number; criticalOpen: number; approved: boolean; active: boolean } {
  const total = 12;
  const criticalIds = new Set([
    'day2-first-real-sale-after-day1',
    'day2-cash-open-close-review',
    'day2-second-device-sync',
    'day2-permissions-users-review',
    'day2-open-issues-prioritized',
    'day2-client-opened-store',
    'day2-printer-adjustment',
    'day2-order-credit-real-doubt',
    'day2-stock-products-review',
    'day2-backup-support-path',
    'day2-client-confidence',
  ]);
  const keys = ['smart-loja:day-two-follow-up-v142'];
  if (!canUseBrowserStorage()) return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { results?: Record<string, unknown>; approvedAt?: unknown; clientName?: unknown; supportOwner?: unknown; updatedAt?: unknown };
      const results = parsed && typeof parsed === 'object' && parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let criticalOpen = 0;
      for (const [id, result] of Object.entries(results)) {
        if (result === 'passed') passed += 1;
        if (result === 'failed') failed += 1;
        if (result === 'blocked') blocked += 1;
        if (criticalIds.has(id) && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
      }
      const pending = Math.max(0, total - passed - failed - blocked);
      const approved = typeof parsed.approvedAt === 'string' && parsed.approvedAt.length > 0;
      const active = approved || passed > 0 || failed > 0 || blocked > 0 || typeof parsed.clientName === 'string' || typeof parsed.supportOwner === 'string' || typeof parsed.updatedAt === 'string';
      return { passed, failed, blocked, pending, total, percent: Math.round((passed / total) * 100), criticalOpen, approved, active };
    }
  } catch {
    return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  }
  return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
}


function readFirstClientCloseoutProgress(): { passed: number; failed: number; blocked: number; pending: number; total: number; percent: number; criticalOpen: number; approved: boolean; active: boolean } {
  const total = 10;
  const criticalIds = new Set([
    'closeout-day1-day2-accepted',
    'closeout-operation-stable',
    'closeout-support-feedback-clean',
    'closeout-risk-register-zero',
    'closeout-proof-package-complete',
    'closeout-client-reference-permission',
    'closeout-replication-package-ready',
    'closeout-pricing-terms-final',
    'closeout-next-client-checklist',
  ]);
  const keys = ['smart-loja:first-client-closeout-v144', 'smart-loja:first-client-closeout-v143'];
  if (!canUseBrowserStorage()) return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { results?: Record<string, unknown>; approvedAt?: unknown; clientName?: unknown; closeOwner?: unknown; updatedAt?: unknown };
      const results = parsed && typeof parsed === 'object' && parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let criticalOpen = 0;
      for (const [id, result] of Object.entries(results)) {
        if (result === 'passed') passed += 1;
        if (result === 'failed') failed += 1;
        if (result === 'blocked') blocked += 1;
        if (criticalIds.has(id) && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
      }
      const pending = Math.max(0, total - passed - failed - blocked);
      const approved = typeof parsed.approvedAt === 'string' && parsed.approvedAt.length > 0;
      const active = approved || passed > 0 || failed > 0 || blocked > 0 || typeof parsed.clientName === 'string' || typeof parsed.closeOwner === 'string' || typeof parsed.updatedAt === 'string';
      return { passed, failed, blocked, pending, total, percent: Math.round((passed / total) * 100), criticalOpen, approved, active };
    }
  } catch {
    return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
  }
  return { passed: 0, failed: 0, blocked: 0, pending: total, total, percent: 0, criticalOpen: 0, approved: false, active: false };
}


function readExecutiveHealthProgress(): { active: boolean; approved: boolean; scoreHint: number; blockers: number; warnings: number } {
  const keys = ['smart-loja:executive-health-v139', 'smart-loja:executive-health-v138'];
  if (!canUseBrowserStorage()) return { active: false, approved: false, scoreHint: 0, blockers: 0, warnings: 0 };
  try {
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { sponsor?: unknown; clientName?: unknown; notes?: unknown; approvedAt?: unknown; updatedAt?: unknown };
      const approved = typeof parsed.approvedAt === 'string' && parsed.approvedAt.length > 0;
      const active = approved || typeof parsed.sponsor === 'string' || typeof parsed.clientName === 'string' || typeof parsed.notes === 'string' || typeof parsed.updatedAt === 'string';
      return { active, approved, scoreHint: approved ? 100 : active ? 75 : 0, blockers: 0, warnings: approved ? 0 : 1 };
    }
  } catch {
    return { active: false, approved: false, scoreHint: 0, blockers: 0, warnings: 0 };
  }
  return { active: false, approved: false, scoreHint: 0, blockers: 0, warnings: 0 };
}


export async function webCommercialValidation(): Promise<WebCommercialValidationReport> {
  const createdAt = new Date().toISOString();
  const env = getPublicWebEnv();
  const outbox = getWebOutboxStats();
  const snapshot = readWebSyncSnapshot();
  const cacheKeys = await readCommercialCacheKeys();
  const serviceWorkerReady = await hasCommercialServiceWorker();
  const checks: WebCommercialCheckItem[] = [];
  const counts: Record<string, number> = {};
  let context: WebStoreContext | null = null;

  pushCommercialCheck(checks, {
    id: 'env-public-only', area: 'Segurança', title: 'Variáveis públicas seguras',
    detail: env.hasUnsafeServiceRoleKey ? 'Existe chave privada configurada no frontend. Remova antes de publicar.' : env.isConfigured ? 'Supabase público configurado sem service_role no PWA.' : `Falta configurar: ${env.missing.join(', ') || 'variáveis do Supabase'}.`,
    level: env.hasUnsafeServiceRoleKey ? 'danger' : env.isConfigured ? 'ok' : 'warn',
    evidence: env.hasUnsafeServiceRoleKey ? env.securityWarnings.join(' ') : `Chave usada: ${env.supabaseAnonKeyName || 'não configurada'}`,
  });

  pushCommercialCheck(checks, {
    id: 'network', area: 'Conexão', title: 'Internet do aparelho',
    detail: typeof navigator !== 'undefined' && navigator.onLine === false ? 'Aparelho offline. As alterações podem ficar pendentes.' : 'Aparelho online no momento do teste.',
    level: typeof navigator !== 'undefined' && navigator.onLine === false ? 'warn' : 'ok',
    evidence: typeof navigator !== 'undefined' ? `navigator.onLine=${String(navigator.onLine)}` : 'Sem navegador disponível.',
  });

  try {
    context = await getWebStoreContext({ createIfMissing: false });
    const capabilities = getWebRoleCapabilities(context.role);
    pushCommercialCheck(checks, {
      id: 'session-role', area: 'Permissões', title: 'Login e papel da loja',
      detail: `${webRoleLabel(context.role)} logado em ${context.store.name}.`,
      level: capabilities.canRead ? 'ok' : 'danger',
      evidence: `email=${context.email}; role=${context.role}; store=${context.store.id}`,
    });
    pushCommercialCheck(checks, {
      id: 'role-write-scope', area: 'Permissões', title: 'Limite de ação por papel',
      detail: capabilities.writeLabel,
      level: context.role === 'viewer' && capabilities.canOperate ? 'danger' : 'ok',
      evidence: `operate=${capabilities.canOperate}; manageStore=${capabilities.canManageStore}; manageMembers=${capabilities.canManageMembers}`,
    });
  } catch (error) {
    pushCommercialCheck(checks, {
      id: 'session-role', area: 'Permissões', title: 'Login e papel da loja',
      detail: 'Não foi possível confirmar loja/papel neste aparelho.',
      level: 'danger',
      evidence: humanizeWebError(error),
    });
  }

  if (context) {
    const tables: Array<{ table: string; label: string; required?: boolean; filter?: string }> = [
      { table: 'stores', label: 'loja/configuração', required: true, filter: 'id' },
      { table: 'store_members', label: 'membros/permissões', required: true },
      { table: 'customers', label: 'clientes', required: true },
      { table: 'products', label: 'produtos', required: true },
      { table: 'sales', label: 'vendas', required: true },
      { table: 'cash_sessions', label: 'caixa', required: true },
      { table: 'cash_movements', label: 'movimentos de caixa', required: true },
      { table: 'credits', label: 'crediário', required: true },
      { table: 'orders', label: 'pedidos', required: true },
      { table: 'receipts', label: 'comprovantes', required: true },
      { table: 'backups_log', label: 'histórico de backup', required: false },
      { table: 'audit_log', label: 'logs/auditoria', required: false },
    ];
    for (const item of tables) {
      const result = await countCommercialRows(item.table, context.store.id, item.filter ?? 'store_id');
      counts[item.table] = result.count;
      pushCommercialCheck(checks, {
        id: `read-${item.table}`, area: 'Permissões da nuvem', title: `Leitura de ${item.label}`,
        detail: result.error ? `Não leu ${item.label}. Verifique a estrutura e as permissões da nuvem.` : `${result.count} registro(s) visíveis para esta loja.`,
        level: result.error ? (item.required ? 'danger' : 'warn') : 'ok',
        evidence: result.error || `select head count em ${item.table}`,
      });
    }

    try {
      const client = await getClient();
      const { data: bucket, error: bucketError } = await client.storage.getBucket(PRODUCT_PHOTO_BUCKET);
      pushCommercialCheck(checks, {
        id: 'storage-product-photos-bucket-v146', area: 'Backup/Fotos', title: 'Armazenamento de fotos de produtos',
        detail: bucketError
          ? 'O armazenamento de fotos não confirmou leitura. Fotos podem ficar em modo compatibilidade até o suporte ajustar a nuvem.'
          : `Armazenamento de fotos encontrado${bucket?.public ? ' e liberado para leitura de imagens' : ', mas revise se a leitura está correta'}.`,
        level: bucketError ? 'warn' : 'ok',
        evidence: bucketError ? bucketError.message : `bucket=${bucket?.name || PRODUCT_PHOTO_BUCKET}; public=${String(bucket?.public)}`,
      });

      const { data: photoRows, error: photoError } = await client
        .from('products')
        .select('image_url')
        .eq('store_id', context.store.id)
        .is('deleted_at', null);
      const photoSummary = summarizeProductPhotosForBackup((photoRows ?? []) as JsonRecord[]);
      pushCommercialCheck(checks, {
        id: 'backup-product-photo-summary-v146', area: 'Backup/Fotos', title: 'Fotos dentro do backup web',
        detail: photoError
          ? 'Não foi possível calcular resumo das fotos para o backup.'
          : `${photoSummary.storage_or_public_url} foto(s) em link/Storage, ${photoSummary.inline_embedded_in_json} foto(s) embutida(s) no JSON e ${photoSummary.missing_photo} produto(s) sem foto.`,
        level: photoError ? 'warn' : photoSummary.inline_embedded_in_json ? 'warn' : 'ok',
        evidence: photoError ? photoError.message : photoSummary.note,
      });
    } catch (storageError) {
      pushCommercialCheck(checks, {
        id: 'storage-product-photos-bucket-v146', area: 'Backup/Fotos', title: 'Armazenamento de fotos de produtos',
        detail: 'Não foi possível auditar Storage de fotos neste aparelho.',
        level: 'warn',
        evidence: humanizeWebError(storageError),
      });
    }
  }

  pushCommercialCheck(checks, {
    id: 'outbox', area: 'Sincronização', title: 'Fila de pendências',
    detail: outbox.total ? `${outbox.total} alteração(ões) ainda estão guardadas neste aparelho.` : 'Nenhuma pendência local no momento.',
    level: outbox.error ? 'danger' : outbox.total ? 'warn' : 'ok',
    evidence: `pending=${outbox.pending}; error=${outbox.error}; last=${outbox.lastError || snapshot.detail}`,
  });

  const trainingMode = readWebTrainingMode();
  const demoMode = readWebDemoMode();
  pushCommercialCheck(checks, {
    id: 'training-mode-safe-v139', area: 'Treinamento', title: 'Modo treinamento seguro',
    detail: trainingMode.enabled ? 'Treinamento ativo: gravações reais estão bloqueadas para demonstração segura.' : 'Treinamento desativado: operação real liberada conforme papel do usuário.',
    level: trainingMode.enabled ? 'warn' : 'ok',
    evidence: trainingMode.enabled ? `responsavel=${trainingMode.responsible || 'não informado'}; cenario=${trainingMode.scenario || 'não informado'}` : 'smart-loja:training-mode-safe-v139 desligado',
  });

  pushCommercialCheck(checks, {
    id: 'demo-mode-separated-v139', area: 'Treinamento', title: 'Ambiente demo separado',
    detail: demoMode.enabled ? 'Demo ativa: telas usam dados fictícios separados da loja real. Desative antes da venda verdadeira.' : 'Demo desativada: telas usam dados reais conforme login e permissão.',
    level: demoMode.enabled ? 'warn' : 'ok',
    evidence: demoMode.enabled ? `lojaDemo=${demoMode.storeName || 'Loja Demonstração Fácil'}; responsavel=${demoMode.responsible || 'não informado'}` : 'smart-loja:demo-mode-safe-v139 desligado',
  });


  const tourProgress = readCommercialTourProgress();
  pushCommercialCheck(checks, {
    id: 'commercial-tour-v139', area: 'Treinamento', title: 'Tour de apresentação comercial',
    detail: tourProgress.done >= tourProgress.total
      ? 'Tour comercial concluído neste aparelho com roteiro de apresentação marcado.'
      : tourProgress.active
        ? `Tour comercial em andamento: ${tourProgress.done}/${tourProgress.total} etapa(s).`
        : 'Tour comercial ainda não iniciado. Use antes de apresentar para cliente novo.',
    level: tourProgress.done >= tourProgress.total ? 'ok' : tourProgress.active ? 'warn' : 'warn',
    evidence: `progresso=${tourProgress.percent}%; chave=smart-loja:commercial-tour-v139`,
  });


  const proposalProgress = readCommercialProposalProgress();
  pushCommercialCheck(checks, {
    id: 'commercial-proposal-v139', area: 'Venda comercial', title: 'Proposta comercial / planos',
    detail: proposalProgress.done >= proposalProgress.total
      ? 'Proposta comercial marcada como pronta neste aparelho.'
      : proposalProgress.active
        ? `Proposta em andamento: ${proposalProgress.done}/${proposalProgress.total} item(ns).`
        : 'Proposta comercial ainda não montada. Use depois do tour para fechar preço, implantação e próximo passo.',
    level: proposalProgress.done >= proposalProgress.total ? 'ok' : proposalProgress.active ? 'warn' : 'warn',
    evidence: `plano=${proposalProgress.plan}; progresso=${proposalProgress.percent}%; chave=smart-loja:commercial-proposal-v139`,
  });

  const implementationTermProgress = readImplementationTermProgress();
  pushCommercialCheck(checks, {
    id: 'implementation-term-v139', area: 'Venda comercial', title: 'Termo de implantação e aceite do cliente',
    detail: implementationTermProgress.accepted
      ? 'Termo simples de implantação foi aceito neste aparelho. Guarde o texto copiado junto da proposta e prints do teste real.'
      : implementationTermProgress.percent >= 100
        ? 'Checklist do termo está completo; falta registrar aceite do responsável.'
        : 'Termo ainda pendente. Antes de implantar, combine escopo, suporte, responsabilidades, impressão, backup e limites honestos.',
    level: implementationTermProgress.accepted ? 'ok' : implementationTermProgress.percent >= 75 ? 'warn' : 'warn',
    evidence: `progresso=${implementationTermProgress.percent}%; aceito=${implementationTermProgress.accepted ? 'sim' : 'não'}; chave=smart-loja:implementation-term-v139`,
  });

  const postSaleProgress = readPostSaleSupportProgress();
  pushCommercialCheck(checks, {
    id: 'post-sale-support-v139', area: 'Pós-venda', title: 'Suporte e SLA do primeiro cliente',
    detail: postSaleProgress.criticalOpen
      ? `${postSaleProgress.criticalOpen} chamado(s) P0/P1 ainda aberto(s). Não considerar cliente estável até registrar responsável, prazo e evidência.`
      : postSaleProgress.active
        ? `Pós-venda em andamento: ${postSaleProgress.solved}/${postSaleProgress.total} chamado(s) resolvido(s), progresso ${postSaleProgress.percent}%.`
        : 'Pós-venda ainda não configurado. Combine canal, revisão do primeiro dia, prioridade, prazo e evidência antes de deixar cliente sozinho.',
    level: postSaleProgress.criticalOpen ? 'danger' : postSaleProgress.active ? 'warn' : 'warn',
    evidence: `abertos=${postSaleProgress.open}; resolvidos=${postSaleProgress.solved}; criticosAbertos=${postSaleProgress.criticalOpen}; chave=smart-loja:post-sale-support-v139`,
  });


  const clientFeedbackProgress = readClientFeedbackProgress();
  pushCommercialCheck(checks, {
    id: 'client-feedback-nps-v139', area: 'Pós-venda', title: 'Feedback do cliente / NPS e melhorias',
    detail: clientFeedbackProgress.openP0P1
      ? `${clientFeedbackProgress.openP0P1} melhoria(s) P0/P1 ainda aberta(s). Priorize antes de chamar o cliente de estabilizado.`
      : clientFeedbackProgress.active
        ? `Feedback em andamento: NPS ${clientFeedbackProgress.score}/10, ${clientFeedbackProgress.improvements} melhoria(s), progresso ${clientFeedbackProgress.percent}%.`
        : 'Feedback/NPS ainda não coletado. Use depois do primeiro dia para transformar dores do cliente em melhorias priorizadas.',
    level: clientFeedbackProgress.openP0P1 ? 'warn' : clientFeedbackProgress.active ? 'ok' : 'warn',
    evidence: `nps=${clientFeedbackProgress.score}; melhorias=${clientFeedbackProgress.improvements}; p0p1Abertas=${clientFeedbackProgress.openP0P1}; chave=smart-loja:client-feedback-nps-v139`,
  });

  const executiveHealthProgress = readExecutiveHealthProgress();
  pushCommercialCheck(checks, {
    id: 'executive-health-v139', area: 'Venda comercial', title: 'Painel executivo de saúde comercial',
    detail: executiveHealthProgress.approved
      ? 'Painel executivo aprovado neste aparelho para escala controlada com evidência.'
      : executiveHealthProgress.active
        ? 'Painel executivo em andamento. Revise bloqueios, avisos e responsável antes de escalar.'
        : 'Painel executivo ainda não iniciado. Use para juntar proposta, termo, pós-venda, feedback, riscos e decisão de escala.',
    level: executiveHealthProgress.approved ? 'ok' : 'warn',
    evidence: `aprovado=${executiveHealthProgress.approved ? 'sim' : 'não'}; chave=smart-loja:executive-health-v139`,
  });


  const regressionAuditProgress = readFinalRegressionAuditProgress();
  pushCommercialCheck(checks, {
    id: 'final-regression-audit-v140', area: 'Teste real', title: 'Auditoria final de regressão / pré-venda real',
    detail: regressionAuditProgress.criticalOpen
      ? `${regressionAuditProgress.criticalOpen} regressão(ões) P0/P1 com Falhou/Bloqueado. Não liberar cliente real.`
      : regressionAuditProgress.approved
        ? 'Auditoria final aprovada neste aparelho com checklist de regressão registrado.'
        : regressionAuditProgress.passed >= regressionAuditProgress.total
          ? 'Checklist final completo; falta ou confira aprovação registrada.'
          : `Auditoria final em andamento: ${regressionAuditProgress.passed}/${regressionAuditProgress.total} item(ns) passaram.`,
    level: regressionAuditProgress.criticalOpen ? 'danger' : regressionAuditProgress.approved ? 'ok' : 'warn',
    evidence: `passou=${regressionAuditProgress.passed}; falhou=${regressionAuditProgress.failed}; bloqueado=${regressionAuditProgress.blocked}; pendente=${regressionAuditProgress.pending}; aprovado=${regressionAuditProgress.approved ? 'sim' : 'não'}; chave=smart-loja:regression-audit-v140`,
  });

  const dayOneProgress = readDayOneImplantationProgress();
  pushCommercialCheck(checks, {
    id: 'day-one-implantation-v141', area: 'Teste real', title: 'Implantação real Dia 1',
    detail: dayOneProgress.criticalOpen
      ? `${dayOneProgress.criticalOpen} item(ns) crítico(s) do Dia 1 com Falhou/Bloqueado. Não deixe o cliente operar sozinho.`
      : dayOneProgress.approved
        ? 'Checklist de implantação Dia 1 aceito neste aparelho com evidência.'
        : dayOneProgress.active
          ? `Implantação Dia 1 em andamento: ${dayOneProgress.passed}/${dayOneProgress.total} item(ns) passaram.`
          : 'Checklist Dia 1 ainda não iniciado. Use na instalação real para conferir internet, PWA, impressora, backup, venda teste e aceite do cliente.',
    level: dayOneProgress.criticalOpen ? 'danger' : dayOneProgress.approved ? 'ok' : 'warn',
    evidence: `passou=${dayOneProgress.passed}; falhou=${dayOneProgress.failed}; bloqueado=${dayOneProgress.blocked}; pendente=${dayOneProgress.pending}; aceito=${dayOneProgress.approved ? 'sim' : 'não'}; chave=smart-loja:day-one-implantation-v141`,
  });

  const dayTwoProgress = readDayTwoFollowUpProgress();
  pushCommercialCheck(checks, {
    id: 'day-two-follow-up-v142', area: 'Teste real', title: 'Correção pós-implantação real Dia 2',
    detail: dayTwoProgress.criticalOpen
      ? `${dayTwoProgress.criticalOpen} item(ns) P0/P1 do Dia 2 com Falhou/Bloqueado. Não considerar cliente estabilizado.`
      : dayTwoProgress.approved
        ? 'Acompanhamento Dia 2 aprovado neste aparelho com plano de correção/evidência.'
        : dayTwoProgress.active
          ? `Dia 2 em acompanhamento: ${dayTwoProgress.passed}/${dayTwoProgress.total} item(ns) passaram.`
          : 'Dia 2 ainda não iniciado. Use depois da primeira operação real para revisar venda, caixa, sync, impressão, dúvidas e suporte.',
    level: dayTwoProgress.criticalOpen ? 'danger' : dayTwoProgress.approved ? 'ok' : 'warn',
    evidence: `passou=${dayTwoProgress.passed}; falhou=${dayTwoProgress.failed}; bloqueado=${dayTwoProgress.blocked}; pendente=${dayTwoProgress.pending}; aprovado=${dayTwoProgress.approved ? 'sim' : 'não'}; chave=smart-loja:day-two-follow-up-v142`,
  });

  const firstClientCloseoutProgress = readFirstClientCloseoutProgress();
  pushCommercialCheck(checks, {
    id: 'first-client-closeout-v144', area: 'Teste real', title: 'Encerramento do primeiro cliente / pronto para replicar',
    detail: firstClientCloseoutProgress.criticalOpen
      ? `${firstClientCloseoutProgress.criticalOpen} item(ns) P0/P1 do encerramento com Falhou/Bloqueado. Não replicar ainda.`
      : firstClientCloseoutProgress.approved
        ? 'Primeiro cliente encerrado neste aparelho com evidência e processo pronto para replicar.'
        : firstClientCloseoutProgress.active
          ? `Encerramento em andamento: ${firstClientCloseoutProgress.passed}/${firstClientCloseoutProgress.total} item(ns) passaram.`
          : 'Encerramento do primeiro cliente ainda não iniciado. Use para transformar a implantação em processo repetível para novos clientes.',
    level: firstClientCloseoutProgress.criticalOpen ? 'danger' : firstClientCloseoutProgress.approved ? 'ok' : 'warn',
    evidence: `passou=${firstClientCloseoutProgress.passed}; falhou=${firstClientCloseoutProgress.failed}; bloqueado=${firstClientCloseoutProgress.blocked}; pendente=${firstClientCloseoutProgress.pending}; aprovado=${firstClientCloseoutProgress.approved ? 'sim' : 'não'}; chave=smart-loja:first-client-closeout-v144`,
  });


  pushCommercialCheck(checks, {
    id: 'service-worker', area: 'PWA/cache', title: 'Instalação PWA/cache',
    detail: serviceWorkerReady ? 'Service worker registrado neste navegador.' : 'Service worker ainda não registrado. Depois do deploy, abra instalado no celular e teste de novo.',
    level: serviceWorkerReady ? 'ok' : 'warn',
    evidence: `cacheAtual=${WEB_CACHE_VERSION}; caches=${cacheKeys.join(', ') || 'nenhum cache listado'}`,
  });

  pushCommercialCheck(checks, {
    id: 'cache-version', area: 'PWA/cache', title: 'Versão do cache',
    detail: cacheKeys.includes(WEB_CACHE_VERSION) ? 'Cache novo v188 encontrado neste aparelho.' : 'Cache novo ainda não apareceu; pode precisar abrir após deploy ou limpar cache antigo.',
    level: cacheKeys.length === 0 || cacheKeys.includes(WEB_CACHE_VERSION) ? 'ok' : 'warn',
    evidence: `esperado=${WEB_CACHE_VERSION}; encontrado=${cacheKeys.join(', ') || 'sem cache'}`,
  });

  const guidedProgress = readGuidedCommercialProgress();
  pushCommercialCheck(checks, {
    id: 'guided-commercial-v139', area: 'Teste real', title: 'Roteiro guiado multiaparelho',
    detail: guidedProgress.done >= guidedProgress.total ? 'Roteiro guiado marcado como concluído neste aparelho.' : `Roteiro guiado ainda incompleto: ${guidedProgress.done}/${guidedProgress.total} passo(s).`,
    level: guidedProgress.done >= guidedProgress.total ? 'ok' : guidedProgress.done >= 6 ? 'warn' : 'warn',
    evidence: `progresso=${guidedProgress.percent}%; chave=smart-loja:guided-commercial-test-v139`,
  });

  const assistedProgress = readAssistedCommercialProgress();
  pushCommercialCheck(checks, {
    id: 'assisted-execution-v139', area: 'Teste real', title: 'Execução real assistida',
    detail: assistedProgress.criticalProblems
      ? `${assistedProgress.criticalProblems} falha(s) ou bloqueio(s) crítico(s) foram registrados. Não vender ainda.`
      : assistedProgress.passed >= assistedProgress.total
        ? 'Execução assistida concluída sem falha crítica registrada neste aparelho.'
        : `Execução assistida em andamento: ${assistedProgress.passed}/${assistedProgress.total} passo(s) passaram.`,
    level: assistedProgress.criticalProblems ? 'danger' : assistedProgress.passed >= assistedProgress.total ? 'ok' : 'warn',
    evidence: `passou=${assistedProgress.passed}; falhou=${assistedProgress.failed}; bloqueado=${assistedProgress.blocked}; chave=smart-loja:assisted-commercial-run-v139`,
  });


  const finalAcceptance = readFinalCommercialAcceptanceStatus();
  pushCommercialCheck(checks, {
    id: 'final-commercial-acceptance-v139', area: 'Teste real', title: 'Aceite final de venda',
    detail: finalAcceptance.signed
      ? `Aceite final registrado por ${finalAcceptance.responsible || 'responsável não informado'} em ${new Date(finalAcceptance.acceptedAt).toLocaleString('pt-BR')}.`
      : 'Aceite final ainda não registrado. Só assine depois de zerar P0/P1, concluir dois aparelhos, permissões, impressão e backup controlado.',
    level: finalAcceptance.signed ? 'ok' : 'warn',
    evidence: finalAcceptance.signed ? `chave=${finalAcceptance.key}; acceptedAt=${finalAcceptance.acceptedAt}` : 'chave=smart-loja:final-commercial-acceptance-v139 sem aceite registrado',
  });

  pushCommercialCheck(checks, {
    id: 'manual-required', area: 'Teste real', title: 'Teste multiaparelho obrigatório',
    detail: 'Ainda precisa testar dono/admin/operador/leitor em celular real e computador antes de vender para cliente final.',
    level: finalAcceptance.signed ? 'ok' : 'warn',
    evidence: finalAcceptance.signed ? 'Aceite final registrado após teste manual.' : 'Este teste automático não consegue entrar em outros usuários sozinho.',
  });

  const score = Number(((checks.reduce((sum, check) => sum + commercialLevelScore(check.level), 0) / Math.max(1, checks.length)) * 10).toFixed(1));
  const dangerCount = checks.filter((check) => check.level === 'danger').length;

  return {
    createdAt,
    appVersion: WEB_APP_VERSION,
    cacheVersion: WEB_CACHE_VERSION,
    storeName: context?.store.name ?? 'sem loja confirmada',
    email: context?.email ?? 'sem login confirmado',
    roleLabel: context ? webRoleLabel(context.role) : 'Sem login',
    score,
    readyLabel: commercialReadyLabel(score, dangerCount),
    checks,
    counts,
    cacheKeys,
    outbox,
  };
}

function sampleReceiptHtml(format: '58mm' | '80mm' | 'a4'): string {
  const now = new Date().toLocaleString('pt-BR');
  const rows = [
    ['Blusa feminina', '1', 'R$ 59,90'],
    ['Presente utilitário', '2', 'R$ 39,80'],
  ];
  return `<section class="slf-receipt"><header class="slf-receipt-head"><div class="slf-receipt-brand"><div class="slf-receipt-logo">SL</div><div><div class="slf-receipt-title">Jaque Confecções e Presentes</div><div class="slf-receipt-sub">Teste seguro de impressão ${format}</div></div></div><span class="slf-receipt-badge">AMOSTRA</span></header><div class="slf-receipt-grid"><div class="slf-receipt-info"><span>Cliente</span><strong>Consumidor final</strong></div><div class="slf-receipt-info"><span>Data</span><strong>${now}</strong></div></div><table class="slf-receipt-table"><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row[0]}</td><td class="num">${row[1]}</td><td class="num">${row[2]}</td></tr>`).join('')}</tbody></table><div class="slf-receipt-total"><div class="slf-receipt-total-row"><span>Subtotal</span><strong>R$ 99,70</strong></div><div class="slf-receipt-total-row final"><span>Total</span><strong>R$ 99,70</strong></div></div><div class="slf-receipt-note">Este é apenas um teste. Não grava venda, não baixa estoque e não altera caixa.</div><footer class="slf-receipt-footer">Jaque Confecções e Presentes · teste de impressão</footer></section>`;
}

export async function webPrintTestReceipt(printFormat: '58mm' | '80mm' | 'a4'): Promise<string> {
  const format = printFormat === '58mm' || printFormat === 'a4' ? printFormat : '80mm';
  return webExportHtmlPdf(sampleReceiptHtml(format), `teste-impressao-smart-loja-${format}`, format);
}


export function openWebUrl(url: string): void {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = url;
}

export function unsupportedWebFileAction(): Promise<never> {
  return Promise.reject(new Error('No modo web, arquivos locais do PC não ficam disponíveis. Use upload/imagem web em lote futuro.'));
}

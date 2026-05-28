import { getPublicWebEnv } from './env';
import { getSupabaseClient } from './supabaseClient';
import type {
  AppStatus,
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
  OrderSummary,
  ReceiptSummary,
  ReportData,
  ReportKind,
  SaleSummary,
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
export const WEB_APP_VERSION = 'pwa-supabase-v54';

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
    name: stringValue(row.name, 'Smart Loja Fácil Web'),
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
  };
}

function guestSettings(): Settings {
  const now = new Date().toISOString();
  return {
    store_name: 'Smart Loja Fácil Web',
    owner_name: 'Aguardando login',
    phone: '',
    whatsapp: '',
    address: '',
    receipt_message: 'Entre com Supabase para sincronizar no celular.',
    low_stock_limit: 3,
    slow_mode: false,
    admin_password_enabled: false,
    receipt_width_mm: 80,
    updated_at: now,
  };
}

function missingSupabaseError(): Error {
  const env = getPublicWebEnv();
  const missing = env.missing.join(' e ') || 'variáveis públicas';
  return new Error(`Modo web precisa de ${missing} no Cloudflare para sincronizar com Supabase.`);
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
  const { data, error } = await client
    .from('stores')
    .insert({
      name: 'Smart Loja Fácil Web',
      owner_id: userId,
      receipt_message: 'Obrigado pela preferência!',
      low_stock_limit: 3,
      status: 'active',
    })
    .select('id, name, owner_id, phone, whatsapp, address, logo_url, receipt_message, low_stock_limit, status, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível criar a loja web inicial: ${error.message}`);

  const store = mapStore(data as Record<string, unknown>);
  window.localStorage.setItem(ACTIVE_STORE_KEY, store.id);

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

export async function webDashboard(): Promise<DashboardData> {
  const context = await getWebStoreContext({ createIfMissing: true });
  const client = await getClient();
  const dashboard = emptyDashboard();

  dashboard.customers_total = await countRows('customers', context.store.id, { status: 'active' });
  dashboard.low_stock_count = await countRows('products', context.store.id, { lowStockLimit: context.store.low_stock_limit });
  dashboard.orders_open = await countRows('orders', context.store.id, { status: 'open' });

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
      .select('id, number, customer_name, payment_method, total, status, created_at')
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
    dashboard.recent_sales = (sales ?? []).slice(0, 8).map((row: Record<string, unknown>) => ({
      id: stringValue(row.id),
      number: numberValue(row.number),
      customer_name: stringValue(row.customer_name, 'Balcao'),
      payment_method: normalizePaymentMethod(row.payment_method),
      total: numberValue(row.total),
      status: stringValue(row.status, 'finalized'),
      created_at: toIso(row.created_at),
    }));
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

export async function webAppStatus(): Promise<AppStatus> {
  const env = getPublicWebEnv();
  if (!env.isConfigured) {
    const settings = guestSettings();
    return { db_path: 'Supabase não configurado', sqlite_ok: false, offline_ready: false, version: WEB_APP_VERSION, settings, dashboard: emptyDashboard() };
  }

  try {
    const context = await getWebStoreContext({ createIfMissing: true });
    const settings = mapSettings(context.store, context.email);
    const dashboard = await webDashboard();
    return {
      db_path: `Supabase · ${context.store.name}`,
      sqlite_ok: true,
      offline_ready: true,
      version: WEB_APP_VERSION,
      settings,
      dashboard,
    };
  } catch {
    const settings = guestSettings();
    return { db_path: 'Aguardando login Supabase', sqlite_ok: false, offline_ready: false, version: WEB_APP_VERSION, settings, dashboard: emptyDashboard() };
  }
}

export async function webSettings(): Promise<Settings> {
  const context = await getWebStoreContext({ createIfMissing: true });
  return mapSettings(context.store, context.email);
}

export async function webSaveSettings(settings: Settings): Promise<Settings> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'alterar configurações da loja');
  const client = await getClient();
  const { data, error } = await client
    .from('stores')
    .update({
      name: settings.store_name.trim() || 'Smart Loja Fácil Web',
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
  const client = await getClient();
  const name = String(customer.name ?? '').trim();
  if (!name) throw new Error('Informe o nome do cliente antes de salvar.');

  const payload = {
    store_id: context.store.id,
    name,
    phone: String(customer.phone ?? '').trim(),
    whatsapp: String(customer.whatsapp ?? '').trim(),
    address: String(customer.address ?? '').trim(),
    credit_limit: numberValue(customer.credit_limit),
    status: mapStatusToCloud(customer.status),
    notes: String(customer.notes ?? '').trim(),
    client_request_id: customer.id || crypto.randomUUID(),
  };

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

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    category: stringValue(row.category),
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
  const { data, error } = await client
    .from('products')
    .select('id, name, category, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at, deleted_at')
    .eq('store_id', context.store.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error(`Não foi possível carregar produtos do Supabase: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapProduct(row));
}

export async function webSaveProduct(product: Partial<Product>): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'salvar produtos');
  const client = await getClient();
  const name = String(product.name ?? '').trim();
  if (!name) throw new Error('Informe o nome do produto antes de salvar.');

  const payload = {
    store_id: context.store.id,
    name,
    category: String(product.category ?? '').trim(),
    price: numberValue(product.price),
    promo_price: product.promo_price === null || product.promo_price === undefined ? null : numberValue(product.promo_price),
    stock: numberValue(product.stock),
    unit: String(product.unit ?? 'un').trim() || 'un',
    size: String(product.size ?? '').trim(),
    color: String(product.color ?? '').trim(),
    internal_code: String(product.internal_code ?? '').trim() || `WEB-${Date.now().toString(36).toUpperCase()}`,
    barcode: String(product.barcode ?? '').trim(),
    image_url: String(product.image_data ?? '').trim(),
    status: mapStatusToCloud(product.status),
    client_request_id: product.id || crypto.randomUUID(),
  };

  const request = product.id
    ? client.from('products').update(payload).eq('id', product.id).eq('store_id', context.store.id)
    : client.from('products').insert(payload);

  const { data, error } = await request
    .select('id, name, category, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível salvar o produto no Supabase: ${error.message}`);
  return mapProduct(data as Record<string, unknown>);
}

export async function webInactivateProduct(productId: string): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'inativar produtos');
  const client = await getClient();
  const { data, error } = await client
    .from('products')
    .update({ status: 'inactive' })
    .eq('id', productId)
    .eq('store_id', context.store.id)
    .select('id, name, category, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at')
    .single();

  if (error) throw new Error(`Não foi possível inativar o produto no Supabase: ${error.message}`);
  return mapProduct(data as Record<string, unknown>);
}

export async function webAdjustStock(productId: string, delta: number, reason: string): Promise<Product> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'ajustar estoque');
  const client = await getClient();
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

  const { data, error } = await client
    .from('products')
    .update({ stock: afterStock })
    .eq('id', productId)
    .eq('store_id', context.store.id)
    .select('id, name, category, price, promo_price, stock, unit, size, color, internal_code, barcode, image_url, status, created_at, updated_at')
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

function csvEscape(value: string): string {
  if (!/[;"\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}


const WEB_BACKUP_HISTORY_KEY = 'smart-loja:web-backup-history-v1';

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
type JsonRecord = Record<string, unknown>;

type WebBackupSnapshot = {
  kind: 'smart-loja-facil-web-backup';
  version: 1;
  app_version: string;
  created_at: string;
  store: JsonRecord;
  user: { id: string; email: string; role: WebStoreRole };
  counts: Record<string, number>;
  tables: Record<string, JsonRecord[]>;
};

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
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível incluir ${table} no backup web: ${error.message}`);
  return (data ?? []) as JsonRecord[];
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
  return readWebBackupHistory();
}

export async function webCreateBackup(): Promise<BackupInfo> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'gerar backup web da loja');
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
  };
  const content = JSON.stringify(snapshot, null, 2);
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
  await insertAudit(context.store.id, context.userId, 'stores', context.store.id, 'web_backup_exported', { file_name: fileName, counts });
  return info;
}

export async function webRestoreBackupContent(fileContent: string, confirmation: string): Promise<AppStatus> {
  if (confirmation !== 'RESTAURAR') throw new Error('Confirmação inválida. Digite RESTAURAR para importar o backup web.');
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin'], 'restaurar backup web da loja');

  let snapshot: WebBackupSnapshot;
  try {
    snapshot = JSON.parse(fileContent) as WebBackupSnapshot;
  } catch {
    throw new Error('Arquivo inválido. Selecione um backup JSON exportado pelo Smart Loja Fácil Web.');
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

  await insertAudit(context.store.id, context.userId, 'stores', context.store.id, 'web_backup_imported', {
    source_created_at: snapshot.created_at,
    source_app_version: snapshot.app_version,
    imported,
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

async function insertAudit(storeId: string, userId: string, entity: string, entityId: string, action: string, details: Record<string, unknown>): Promise<void> {
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
    total: numberValue(row.total),
    status: saleStatusFromCloud(row.status),
    created_at: toIso(row.created_at),
  };
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
    .select('id, number, customer_name, payment_method, total, status, created_at')
    .eq('store_id', context.store.id)
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw new Error(`Não foi possível carregar vendas do Supabase: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapSale(row));
}

export async function webCreateSale(payload: unknown): Promise<SaleSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'finalizar vendas');
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
  const client = await getClient();
  if (openingAmount < 0) throw new Error('O valor inicial não pode ser negativo.');
  const alreadyOpen = await currentCashSessionId(context.store.id);
  if (alreadyOpen) throw new Error('Já existe um caixa aberto para esta loja.');
  const { error } = await client.from('cash_sessions').insert({ store_id: context.store.id, opened_by: context.userId, opening_amount: openingAmount, notes: notes.trim(), status: 'open' });
  if (error) throw new Error(`Não foi possível abrir caixa no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'cash', null as unknown as string, 'open', { opening_amount: openingAmount });
  return webCashSummary();
}

export async function webCloseCash(closingAmount: number, notes: string): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'fechar caixa');
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

export async function webAddCashMovement(movementType: string, method: string, amount: number, reason: string): Promise<CashSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'lançar movimento de caixa');
  const client = await getClient();
  const cleanType = movementType === 'entrada' ? 'entrada' : 'saida';
  const cleanReason = reason.trim();
  if (amount <= 0) throw new Error('Informe um valor maior que zero para o movimento.');
  if (!cleanReason) throw new Error('Informe o motivo do movimento manual.');
  const sessionId = await currentCashSessionId(context.store.id);
  const { error } = await client.from('cash_movements').insert({
    store_id: context.store.id,
    cash_session_id: sessionId,
    client_request_id: clientRequestId('cash'),
    type: cleanType,
    method: method.trim() || 'dinheiro',
    amount,
    reason: cleanReason,
    created_by: context.userId,
  });
  if (error) throw new Error(`Não foi possível lançar movimento no Supabase: ${error.message}`);
  await insertAudit(context.store.id, context.userId, 'cash', null as unknown as string, 'manual_movement', { type: cleanType, amount, method, reason: cleanReason });
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

function mapCredit(row: Record<string, unknown>, installments: CreditInstallment[], salesById: Map<string, number>, customersById: Map<string, { phone: string; whatsapp: string }>): CreditSummary {
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
  if (customerIds.length > 0) {
    const { data: customers } = await client.from('customers').select('id, phone, whatsapp').eq('store_id', context.store.id).in('id', customerIds);
    for (const customer of customers ?? []) {
      const row = customer as Record<string, unknown>;
      customersById.set(stringValue(row.id), { phone: stringValue(row.phone), whatsapp: stringValue(row.whatsapp) });
    }
  }
  return credits.map((row: Record<string, unknown>) => mapCredit(row, installmentsByCreditId.get(stringValue(row.id)) ?? [], salesById, customersById));
}

export async function webReceiveInstallment(payload: unknown): Promise<CreditSummary> {
  const context = await getWebStoreContext({ createIfMissing: true });
  requireWebRole(context, ['owner', 'admin', 'operator'], 'receber crediário');
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const creditId = stringValue(source.credit_id);
  const installmentId = stringValue(source.installment_id);
  const amount = Math.max(0, numberValue(source.amount));
  const method = normalizePaymentMethod(source.method);
  const requestId = stringValue(source.request_id) || clientRequestId('pay');
  const redistribute = Boolean(source.settle_with_redistribution);
  if (!creditId || !installmentId) throw new Error('Parcela inválida para recebimento.');
  if (amount <= 0) throw new Error('Valor inválido para recebimento.');
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function webExportHtmlPdf(html: string, fileStem: string): Promise<string> {
  const title = escapeHtml(fileStem);
  const printedAt = new Date().toLocaleString('pt-BR');
  const printable = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef2f8;color:#111827;font-family:Inter,Arial,sans-serif}.print-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;background:#0b1020;color:#f8fafc;box-shadow:0 14px 34px rgba(15,23,42,.18)}.print-toolbar strong{font-size:14px}.print-toolbar small{display:block;color:#aeb8cf;margin-top:2px}.print-toolbar button{border:0;border-radius:999px;padding:10px 14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);cursor:pointer}.print-shell{width:min(860px,100%);margin:22px auto;padding:18px}.receipt-paper{background:#fff;border:1px solid #d9e2f2;border-radius:18px;box-shadow:0 22px 58px rgba(15,23,42,.16);padding:18px;overflow:auto}.receipt-paper section{margin-inline:auto}.print-footer{margin:14px auto 0;width:min(860px,100%);padding:0 18px 18px;color:#64748b;font-size:12px;text-align:center}@page{margin:8mm}@media print{body{background:#fff}.no-print,.print-toolbar,.print-footer{display:none!important}.print-shell{width:100%;margin:0;padding:0}.receipt-paper{border:0;border-radius:0;box-shadow:none;padding:0;overflow:visible}}</style></head><body><div class="print-toolbar no-print"><div><strong>Prévia do comprovante</strong><small>Gerado em ${printedAt}</small></div><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div><main class="print-shell"><div class="receipt-paper">${html}</div></main><div class="print-footer no-print">Se a impressão não abrir automaticamente, use o botão acima ou Ctrl+P.</div><script>setTimeout(function(){window.focus();window.print();},350);<\/script></body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (popup) {
    popup.document.open();
    popup.document.write(printable);
    popup.document.close();
    return Promise.resolve(`Prévia premium de impressão aberta no navegador para ${fileStem}.`);
  }
  downloadTextFile(`${fileStem}.html`, printable, 'text/html;charset=utf-8');
  return Promise.resolve(`Navegador bloqueou a janela; baixei ${fileStem}.html para impressão.`);
}

function buildReportSkeleton(report: ReportKind, from: string, to: string): ReportData {
  const generatedAt = new Date().toISOString();
  const periodText = from === to ? reportDate(from) : `${reportDate(from)} até ${reportDate(to)}`;
  if (report === 'caixa') return { report, title: 'Caixa por período', description: `Movimentos de caixa entre ${periodText}.`, empty_message: 'Nenhum movimento de caixa encontrado no período.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'data', label: 'Data' }, { key: 'tipo', label: 'Tipo' }, { key: 'forma', label: 'Forma' }, { key: 'motivo', label: 'Motivo' }, { key: 'valor', label: 'Valor', align: 'right' }], rows: [] };
  if (report === 'crediario') return { report, title: 'Crediário em aberto', description: 'Clientes com saldo pendente no Supabase.', empty_message: 'Nenhum crediário em aberto encontrado.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'cliente', label: 'Cliente' }, { key: 'venda', label: 'Venda' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'saldo', label: 'Saldo', align: 'right' }, { key: 'data', label: 'Data' }], rows: [] };
  if (report === 'estoque_baixo') return { report, title: 'Estoque baixo', description: 'Produtos ativos abaixo do limite configurado da loja.', empty_message: 'Nenhum produto abaixo do limite.', generated_at: generatedAt, total_rows: 0, summary: [], columns: [{ key: 'produto', label: 'Produto' }, { key: 'categoria', label: 'Categoria' }, { key: 'estoque', label: 'Estoque', align: 'right' }, { key: 'preco', label: 'Preço', align: 'right' }, { key: 'status', label: 'Status' }], rows: [] };
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
    const validSales = (data ?? []).filter((sale: Record<string, unknown>) => sale.status !== 'canceled');
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
    const { data, error } = await client.from('credits').select('customer_name, sale_id, total, balance, status, created_at').eq('store_id', context.store.id).eq('status', 'open').order('created_at', { ascending: false });
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

export function openWebUrl(url: string): void {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = url;
}

export function unsupportedWebFileAction(): Promise<never> {
  return Promise.reject(new Error('No modo web, arquivos locais do PC não ficam disponíveis. Use upload/imagem web em lote futuro.'));
}

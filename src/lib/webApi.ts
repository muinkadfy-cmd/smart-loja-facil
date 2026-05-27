import { getPublicWebEnv } from './env';
import { getSupabaseClient } from './supabaseClient';
import type {
  AppStatus,
  Customer,
  DashboardData,
  DashboardSalesPeriod,
  DashboardSalesPoint,
  PaymentMethod,
  PaymentSummary,
  Product,
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
export const WEB_APP_VERSION = 'pwa-supabase-v50';

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

export function openWebUrl(url: string): void {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = url;
}

export function unsupportedWebFileAction(): Promise<never> {
  return Promise.reject(new Error('No modo web, arquivos locais do PC não ficam disponíveis. Use upload/imagem web em lote futuro.'));
}

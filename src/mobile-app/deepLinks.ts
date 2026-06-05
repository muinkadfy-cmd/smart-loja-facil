import type { PageKey } from '../types';

export type SmartLojaDeepLinkAction = 'open' | 'receive' | 'receipt' | 'pdf' | 'filter' | string;

export interface SmartLojaDeepLink {
  page: PageKey;
  source: string;
  action: SmartLojaDeepLinkAction;
  creditId: string;
  saleNumber?: number;
  installmentId: string;
  installmentNumber?: number;
  productId: string;
  customerId: string;
  receiptId: string;
  query: string;
  hash: string;
  rawUrl: string;
}

export interface CreditFocusPayload {
  credit_id?: string;
  sale_number?: number;
  installment_id?: string;
  installment_number?: number;
  action?: SmartLojaDeepLinkAction;
  created_at?: number;
}

export interface ReceiptFocusPayload {
  sale_number?: number;
  credit_id?: string;
  installment_id?: string;
  installment_number?: number;
  action?: SmartLojaDeepLinkAction;
  created_at?: number;
}

const CREDIT_FOCUS_KEY = 'smart-loja:credits-focus-v178';
export const RECEIPTS_FOCUS_KEY = 'smart-loja:receipts-focus-sale-v1';
const FOCUS_TTL_MS = 10 * 60 * 1000;

const pageMap: Record<string, PageKey> = {
  dashboard: 'dashboard',
  inicio: 'dashboard',
  home: 'dashboard',
  sales: 'sales',
  vendas: 'sales',
  pdv: 'sales',
  products: 'products',
  produtos: 'products',
  estoque: 'products',
  customers: 'customers',
  clientes: 'customers',
  orders: 'orders',
  pedidos: 'orders',
  cash: 'cash',
  caixa: 'cash',
  credits: 'credits',
  crediario: 'credits',
  creditos: 'credits',
  receipts: 'receipts',
  comprovantes: 'receipts',
  reports: 'reports',
  relatorios: 'reports',
  backup: 'backup',
  settings: 'settings',
  configuracoes: 'settings',
  audit: 'audit',
  logs: 'audit',
  diagnostics: 'diagnostics',
  diagnostico: 'diagnostics',
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numeric(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function pageFrom(value: string): PageKey | null {
  const key = value.trim().toLowerCase();
  return pageMap[key] ?? null;
}

export function readSmartLojaDeepLink(urlLike?: string): SmartLojaDeepLink | null {
  if (typeof window === 'undefined' && !urlLike) return null;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.local';
  let url: URL;
  try {
    url = new URL(urlLike || window.location.href, base);
  } catch {
    return null;
  }
  const params = url.searchParams;
  const source = clean(params.get('source')) || clean(params.get('utm_source'));
  const view = clean(params.get('view')) || clean(params.get('page')) || clean(params.get('rota'));
  const type = clean(params.get('type'));
  if (!source && !view && !type && !params.get('credit') && !params.get('sale') && !params.get('product')) return null;

  const inferredView = view || (type.startsWith('credit_') ? 'credits' : type === 'low_stock' ? 'products' : type.startsWith('sale_') ? 'receipts' : 'dashboard');
  const page = pageFrom(inferredView) ?? 'dashboard';
  const saleNumber = numeric(clean(params.get('sale') || params.get('sale_number') || params.get('nota') || params.get('venda')));
  const installmentNumber = numeric(clean(params.get('installment_number') || params.get('parcela_numero')));
  const installment = clean(params.get('installment') || params.get('installment_id') || params.get('parcela'));

  return {
    page,
    source: source || 'push',
    action: clean(params.get('action')) || clean(params.get('acao')) || (type.includes('overdue') || type.includes('due') ? 'receive' : 'open'),
    creditId: clean(params.get('credit') || params.get('credit_id') || params.get('conta')),
    saleNumber,
    installmentId: installment && !/^\d+$/.test(installment) ? installment : '',
    installmentNumber: installmentNumber ?? (/^\d+$/.test(installment) ? Number(installment) : undefined),
    productId: clean(params.get('product') || params.get('product_id') || params.get('produto')),
    customerId: clean(params.get('customer') || params.get('customer_id') || params.get('cliente')),
    receiptId: clean(params.get('receipt') || params.get('receipt_id') || params.get('comprovante')),
    query: clean(params.get('q') || params.get('query') || params.get('busca')),
    hash: url.hash,
    rawUrl: url.href,
  };
}

function writeFocus<T extends { created_at?: number }>(key: string, payload: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...payload, created_at: Date.now() }));
  } catch {
    // Se o navegador bloquear storage, o app ainda abre na aba correta.
  }
}

function readFocus<T extends { created_at?: number }>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    const createdAt = Number(parsed?.created_at || 0);
    if (!parsed || typeof parsed !== 'object' || (createdAt && Date.now() - createdAt > FOCUS_TTL_MS)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeCreditFocusFromDeepLink(link: SmartLojaDeepLink): void {
  writeFocus<CreditFocusPayload>(CREDIT_FOCUS_KEY, {
    credit_id: link.creditId || undefined,
    sale_number: link.saleNumber,
    installment_id: link.installmentId || undefined,
    installment_number: link.installmentNumber,
    action: link.action,
  });
}

export function readCreditFocusPayload(): CreditFocusPayload | null {
  return readFocus<CreditFocusPayload>(CREDIT_FOCUS_KEY);
}

export function clearCreditFocusPayload(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(CREDIT_FOCUS_KEY);
}

export function storeReceiptFocusFromDeepLink(link: SmartLojaDeepLink): void {
  writeFocus<ReceiptFocusPayload>(RECEIPTS_FOCUS_KEY, {
    credit_id: link.creditId || undefined,
    sale_number: link.saleNumber,
    installment_id: link.installmentId || undefined,
    installment_number: link.installmentNumber,
    action: link.action,
  });
}

export function readReceiptFocusPayload(): ReceiptFocusPayload | null {
  return readFocus<ReceiptFocusPayload>(RECEIPTS_FOCUS_KEY);
}

export function clearReceiptFocusPayload(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(RECEIPTS_FOCUS_KEY);
}

export function cleanDeepLinkUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  ['source', 'view', 'page', 'rota', 'type', 'action', 'acao', 'credit', 'credit_id', 'conta', 'sale', 'sale_number', 'nota', 'venda', 'installment', 'installment_id', 'installment_number', 'parcela', 'parcela_numero', 'product', 'product_id', 'produto', 'customer', 'customer_id', 'cliente', 'receipt', 'receipt_id', 'comprovante', 'q', 'query', 'busca'].forEach((key) => url.searchParams.delete(key));
  const cleanSearch = url.searchParams.toString();
  const next = `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`;
  window.history.replaceState(window.history.state, document.title, next);
}

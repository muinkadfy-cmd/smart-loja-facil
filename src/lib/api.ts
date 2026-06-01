import { invoke } from '@tauri-apps/api/core';
import { playOperationSound } from './sound';
import { createWebModeError, isTauriRuntime } from './runtime';
import {
  openWebUrl,
  enqueueWebOutbox,
  humanizeWebError,
  recordWebSyncSnapshot,
  shouldQueueWebError,
  unsupportedWebFileAction,
  webAdjustStock,
  webAddCashMovement,
  webBackups,
  webAppStatus,
  webAudit,
  webCancelSale,
  webCashSummary,
  webCloseCash,
  webCreateSale,
  webCredits,
  webCustomers,
  webDashboard,
  webDashboardSalesSeries,
  webInactivateCustomer,
  webCancelOrder,
  webCreateOrder,
  webCreateBackup,
  webExportHtmlPdf,
  webInactivateProduct,
  webOrders,
  webProducts,
  webOpenCash,
  webReceipts,
  webReceiveInstallment,
  webReportData,
  webReportsCsv,
  webRestoreBackupContent,
  webSaveCustomer,
  webSaveProduct,
  webSales,
  webSaveSettings,
  webSetOrderStatus,
  webSettings,
  type WebOutboxAction,
} from './webApi';
import type {
  AppStatus,
  AuditEvent,
  BackupInfo,
  CashSummary,
  DashboardSalesPoint,
  CreditSummary,
  Customer,
  DashboardData,
  OrderSummary,
  Product,
  ReceiptSummary,
  ReportData,
  SaleSummary,
  Settings,
} from '../types';

function ensureTauri(): void {
  if (!isTauriRuntime()) throw createWebModeError();
}



function webRequestId(prefix: string): string {
  const cryptoSource = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${cryptoSource}`;
}

function withRequestId(payload: unknown, prefix: string, key = 'request_id'): Record<string, unknown> {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const existing = typeof source[key] === 'string' && source[key] ? source[key] : '';
  return { ...source, [key]: existing || webRequestId(prefix) };
}

function canQueueWebAction(action: WebOutboxAction): boolean {
  return action !== 'openCash' && action !== 'closeCash' && action !== 'adjustStock';
}

const SOUND_COMMANDS = new Set([
  'upsert_customer',
  'inactivate_customer',
  'upsert_product',
  'inactivate_product',
  'adjust_stock',
  'create_sale',
  'cancel_sale',
  'open_cash',
  'close_cash',
  'add_cash_movement',
  'receive_installment',
  'receive_installment_flex',
  'create_order',
  'set_order_status',
  'cancel_order',
  'create_backup',
  'create_backup_to',
  'restore_backup',
  'restore_backup_external',
  'export_html_pdf',
  'open_external_url',
  'reveal_file',
  'save_product_image',
  'save_settings',
]);

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  ensureTauri();
  try {
    const result = await invoke<T>(command, args);
    if (SOUND_COMMANDS.has(command)) playOperationSound('success');
    return result;
  } catch (error) {
    if (SOUND_COMMANDS.has(command)) playOperationSound('error');
    throw error;
  }
}

async function webCall<T>(module: string, task: string, action: () => Promise<T>, pending?: { action: WebOutboxAction; payload: Record<string, unknown> }): Promise<T> {
  recordWebSyncSnapshot('syncing', module, 'Sincronizando com a nuvem...');
  try {
    const result = await action();
    recordWebSyncSnapshot('synced', module, task || 'Sincronizado na nuvem.');
    return result;
  } catch (error) {
    const detail = humanizeWebError(error);
    const pendingByNetwork = shouldQueueWebError(error);
    if (pending && pendingByNetwork && canQueueWebAction(pending.action)) {
      enqueueWebOutbox(module, pending.action, pending.payload, error);
      throw new Error(`Alteração guardada neste aparelho. Quando a internet voltar, abra o Diagnóstico Web ou toque em reenviar pendências para sincronizar. Detalhe: ${detail}`);
    }
    if (pending && pendingByNetwork && !canQueueWebAction(pending.action)) {
      const safeDetail = `Não gravei pendência automática para evitar duplicidade em operação crítica. Confira se apareceu no outro aparelho antes de tentar de novo. Detalhe: ${detail}`;
      recordWebSyncSnapshot('pending', module, safeDetail);
      throw new Error(safeDetail);
    }
    recordWebSyncSnapshot(pendingByNetwork ? 'pending' : 'error', module, detail);
    throw error;
  }
}

export const api = {
  boot: () => (isTauriRuntime() ? call<AppStatus>('boot') : webCall('Sistema', 'Status do app atualizado.', webAppStatus)),
  dashboard: () => (isTauriRuntime() ? call<DashboardData>('get_dashboard') : webCall('Dashboard', 'Dashboard sincronizado na nuvem.', webDashboard)),
  dashboardSalesSeries: (period: string) => (isTauriRuntime() ? call<DashboardSalesPoint[]>('get_dashboard_sales_series', { period }) : webCall('Dashboard', 'Gráfico de vendas sincronizado.', () => webDashboardSalesSeries(period))),
  customers: () => (isTauriRuntime() ? call<Customer[]>('list_customers') : webCall('Clientes', 'Clientes carregados da nuvem.', webCustomers)),
  saveCustomer: (customer: Partial<Customer>) => {
    const customerPayload = withRequestId(customer, 'web-customer', 'client_request_id') as Partial<Customer>;
    return isTauriRuntime() ? call<Customer>('upsert_customer', { customer }) : webCall('Clientes', 'Cliente sincronizado na nuvem.', () => webSaveCustomer(customerPayload), { action: 'saveCustomer', payload: { customer: customerPayload } });
  },
  inactivateCustomer: (customerId: string) => (isTauriRuntime() ? call<Customer>('inactivate_customer', { customerId }) : webCall('Clientes', 'Cliente atualizado na nuvem.', () => webInactivateCustomer(customerId), { action: 'inactivateCustomer', payload: { customerId } })),
  products: () => (isTauriRuntime() ? call<Product[]>('list_products') : webCall('Produtos', 'Produtos carregados da nuvem.', webProducts)),
  saveProduct: (product: Partial<Product>) => {
    const productPayload = withRequestId(product, 'web-product', 'client_request_id') as Partial<Product>;
    return isTauriRuntime() ? call<Product>('upsert_product', { product }) : webCall('Produtos', 'Produto sincronizado na nuvem.', () => webSaveProduct(productPayload), { action: 'saveProduct', payload: { product: productPayload } });
  },
  inactivateProduct: (productId: string) => (isTauriRuntime() ? call<Product>('inactivate_product', { productId }) : webCall('Produtos', 'Produto atualizado na nuvem.', () => webInactivateProduct(productId), { action: 'inactivateProduct', payload: { productId } })),
  adjustStock: (productId: string, delta: number, reason: string) => (isTauriRuntime() ? call<Product>('adjust_stock', { productId, delta, reason }) : webCall('Produtos', 'Estoque sincronizado na nuvem.', () => webAdjustStock(productId, delta, reason), { action: 'adjustStock', payload: { productId, delta, reason } })),
  createSale: (payload: unknown) => {
    const salePayload = withRequestId(payload, 'web-sale');
    return isTauriRuntime() ? call<SaleSummary>('create_sale', { payload }) : webCall('Vendas/PDV', 'Venda sincronizada na nuvem.', () => webCreateSale(salePayload), { action: 'createSale', payload: { payload: salePayload } });
  },
  sales: () => (isTauriRuntime() ? call<SaleSummary[]>('list_sales') : webCall('Vendas/PDV', 'Vendas carregadas da nuvem.', webSales)),
  cancelSale: (saleId: string, reason: string) => (isTauriRuntime() ? call<SaleSummary>('cancel_sale', { saleId, reason }) : webCall('Vendas/PDV', 'Cancelamento sincronizado na nuvem.', () => webCancelSale(saleId, reason), { action: 'cancelSale', payload: { saleId, reason } })),
  cashSummary: () => (isTauriRuntime() ? call<CashSummary>('get_cash_summary') : webCall('Caixa', 'Caixa carregado da nuvem.', webCashSummary)),
  openCash: (openingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('open_cash', { openingAmount, notes }) : webCall('Caixa', 'Abertura de caixa sincronizada.', () => webOpenCash(openingAmount, notes), { action: 'openCash', payload: { openingAmount, notes } })),
  closeCash: (closingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('close_cash', { closingAmount, notes }) : webCall('Caixa', 'Fechamento de caixa sincronizado.', () => webCloseCash(closingAmount, notes), { action: 'closeCash', payload: { closingAmount, notes } })),
  addCashMovement: (movementType: string, method: string, amount: number, reason: string) => {
    const requestId = webRequestId('cash');
    return isTauriRuntime() ? call<CashSummary>('add_cash_movement', { movementType, method, amount, reason }) : webCall('Caixa', 'Movimento de caixa sincronizado.', () => webAddCashMovement(movementType, method, amount, reason, requestId), { action: 'addCashMovement', payload: { movementType, method, amount, reason, requestId } });
  },
  credits: () => (isTauriRuntime() ? call<CreditSummary[]>('list_credits') : webCall('Crediário', 'Crediário carregado da nuvem.', webCredits)),
  receiveInstallment: (payload: unknown) => {
    const paymentPayload = withRequestId(payload, 'pay');
    return isTauriRuntime() ? call<CreditSummary>('receive_installment_flex', { payload }) : webCall('Crediário', 'Recebimento sincronizado na nuvem.', () => webReceiveInstallment(paymentPayload), { action: 'receiveInstallment', payload: { payload: paymentPayload } });
  },
  orders: () => (isTauriRuntime() ? call<OrderSummary[]>('list_orders') : webCall('Pedidos', 'Pedidos carregados da nuvem.', webOrders)),
  createOrder: (payload: unknown) => {
    const orderPayload = withRequestId(payload, 'web-order');
    return isTauriRuntime() ? call<OrderSummary>('create_order', { payload }) : webCall('Pedidos', 'Pedido sincronizado na nuvem.', () => webCreateOrder(orderPayload), { action: 'createOrder', payload: { payload: orderPayload } });
  },
  setOrderStatus: (orderId: string, status: string) => (isTauriRuntime() ? call<OrderSummary>('set_order_status', { orderId, status }) : webCall('Pedidos', 'Status do pedido sincronizado.', () => webSetOrderStatus(orderId, status), { action: 'setOrderStatus', payload: { orderId, status } })),
  cancelOrder: (orderId: string, reason: string) => (isTauriRuntime() ? call<OrderSummary>('cancel_order', { orderId, reason }) : webCall('Pedidos', 'Cancelamento de pedido sincronizado.', () => webCancelOrder(orderId, reason), { action: 'cancelOrder', payload: { orderId, reason } })),
  receipts: () => (isTauriRuntime() ? call<ReceiptSummary[]>('list_receipts') : webCall('Comprovantes', 'Comprovantes carregados da nuvem.', webReceipts)),
  exportHtmlPdf: (html: string, fileStem: string, openAfter = true, destinationDir?: string | null, printFormat = '80mm') => (isTauriRuntime() ? call<string>('export_html_pdf', { html, fileStem, openAfter, destinationDir }) : webCall('Comprovantes', 'Prévia de comprovante aberta.', () => webExportHtmlPdf(html, fileStem, printFormat))),
  openExternalUrl: (url: string) => (isTauriRuntime() ? call<void>('open_external_url', { url }) : webCall('Links', 'Link externo aberto.', () => Promise.resolve(openWebUrl(url)))),
  revealFile: (path: string) => (isTauriRuntime() ? call<void>('reveal_file', { path }) : path.startsWith('download:') ? Promise.resolve() : unsupportedWebFileAction()),
  saveProductImage: (imageData: string, fileStem: string, openAfter = true) => (isTauriRuntime() ? call<string>('save_product_image', { imageData, fileStem, openAfter }) : unsupportedWebFileAction()),
  backups: () => (isTauriRuntime() ? call<BackupInfo[]>('list_backups') : webCall('Backup', 'Backups web listados.', webBackups)),
  createBackup: () => (isTauriRuntime() ? call<BackupInfo>('create_backup') : webCall('Backup', 'Backup web gerado neste aparelho.', webCreateBackup)),
  createBackupTo: (destinationDir: string) => (isTauriRuntime() ? call<BackupInfo>('create_backup_to', { destinationDir }) : webCall('Backup', 'Backup web gerado neste aparelho.', webCreateBackup)),
  restoreBackup: (backupId: string, confirmation: string) => call<AppStatus>('restore_backup', { backupId, confirmation }),
  restoreBackupFromPath: (backupPath: string, confirmation: string) => (isTauriRuntime() ? call<AppStatus>('restore_backup_external', { backupPath, confirmation }) : Promise.reject(createWebModeError())),
  restoreWebBackupContent: (fileContent: string, confirmation: string) => webCall('Backup', 'Restauração web sincronizada.', () => webRestoreBackupContent(fileContent, confirmation)),
  pickBackupFolder: () => (isTauriRuntime() ? call<string | null>('pick_backup_folder') : Promise.resolve(null)),
  pickExportFolder: () => (isTauriRuntime() ? call<string | null>('pick_export_folder') : Promise.resolve(null)),
  pickRestoreBackupFile: () => (isTauriRuntime() ? call<string | null>('pick_restore_backup_file') : Promise.resolve(null)),
  exitApp: () => call<void>('exit_app'),
  reportData: (report: string, from: string, to: string) => (isTauriRuntime() ? call<ReportData>('get_report_data', { report, from, to }) : webCall('Relatórios', 'Relatório carregado da nuvem.', () => webReportData(report, from, to))),
  reportsCsv: (report: string, from: string, to: string) => (isTauriRuntime() ? call<string>('export_report_csv', { report, from, to }) : webCall('Relatórios', 'CSV gerado com dados da nuvem.', () => webReportsCsv(report, from, to))),
  settings: () => (isTauriRuntime() ? call<Settings>('get_settings') : webCall('Configuração da loja', 'Configuração carregada da nuvem.', webSettings)),
  saveSettings: (settings: Settings) => (isTauriRuntime() ? call<Settings>('save_settings', { settings }) : webCall('Configuração da loja', 'Configuração sincronizada na nuvem.', () => webSaveSettings(settings), { action: 'saveSettings', payload: { settings } })),
  audit: () => (isTauriRuntime() ? call<AuditEvent[]>('list_audit') : webCall('Auditoria', 'Auditoria carregada da nuvem.', webAudit)),
};

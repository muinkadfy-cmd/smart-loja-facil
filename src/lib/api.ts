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
  assertWebDemoModeAllowsWrite,
  isWebDemoModeActive,
  webDemoAppStatus,
  webDemoAudit,
  webDemoBackups,
  webDemoCashSummary,
  webDemoCredits,
  webDemoCustomers,
  webDemoDashboard,
  webDemoDashboardSalesSeries,
  webDemoOrders,
  webDemoProducts,
  webDemoReceipts,
  webDemoReportData,
  webDemoReportsCsv,
  webDemoSales,
  webDemoSettings,
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

function webRead<T>(module: string, task: string, realAction: () => Promise<T>, demoAction: () => T): Promise<T> {
  if (isWebDemoModeActive()) {
    return webCall(module, 'Dados fictícios carregados no ambiente demo. Nada foi lido da loja real.', () => Promise.resolve(demoAction()));
  }
  return webCall(module, task, realAction);
}

function guardDemoWrite(action: string): void {
  assertWebDemoModeAllowsWrite(action);
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
  boot: () => (isTauriRuntime() ? call<AppStatus>('boot') : webRead('Sistema', 'Status do app atualizado.', webAppStatus, webDemoAppStatus)),
  dashboard: () => (isTauriRuntime() ? call<DashboardData>('get_dashboard') : webRead('Dashboard', 'Dashboard sincronizado na nuvem.', webDashboard, webDemoDashboard)),
  dashboardSalesSeries: (period: string) => (isTauriRuntime() ? call<DashboardSalesPoint[]>('get_dashboard_sales_series', { period }) : webRead('Dashboard', 'Gráfico de vendas sincronizado.', () => webDashboardSalesSeries(period), () => webDemoDashboardSalesSeries(period))),
  customers: () => (isTauriRuntime() ? call<Customer[]>('list_customers') : webRead('Clientes', 'Clientes carregados da nuvem.', webCustomers, webDemoCustomers)),
  saveCustomer: (customer: Partial<Customer>) => {
    const customerPayload = withRequestId(customer, 'web-customer', 'client_request_id') as Partial<Customer>;
    return isTauriRuntime() ? call<Customer>('upsert_customer', { customer }) : webCall('Clientes', 'Cliente sincronizado na nuvem.', () => { guardDemoWrite('salvar cliente'); return webSaveCustomer(customerPayload); }, { action: 'saveCustomer', payload: { customer: customerPayload } });
  },
  inactivateCustomer: (customerId: string) => (isTauriRuntime() ? call<Customer>('inactivate_customer', { customerId }) : webCall('Clientes', 'Cliente atualizado na nuvem.', () => { guardDemoWrite('inativar cliente'); return webInactivateCustomer(customerId); }, { action: 'inactivateCustomer', payload: { customerId } })),
  products: () => (isTauriRuntime() ? call<Product[]>('list_products') : webRead('Produtos', 'Produtos carregados da nuvem.', webProducts, webDemoProducts)),
  saveProduct: (product: Partial<Product>) => {
    const productPayload = withRequestId(product, 'web-product', 'client_request_id') as Partial<Product>;
    return isTauriRuntime() ? call<Product>('upsert_product', { product }) : webCall('Produtos', 'Produto sincronizado na nuvem.', () => { guardDemoWrite('salvar produto'); return webSaveProduct(productPayload); }, { action: 'saveProduct', payload: { product: productPayload } });
  },
  inactivateProduct: (productId: string) => (isTauriRuntime() ? call<Product>('inactivate_product', { productId }) : webCall('Produtos', 'Produto atualizado na nuvem.', () => { guardDemoWrite('inativar produto'); return webInactivateProduct(productId); }, { action: 'inactivateProduct', payload: { productId } })),
  adjustStock: (productId: string, delta: number, reason: string) => (isTauriRuntime() ? call<Product>('adjust_stock', { productId, delta, reason }) : webCall('Produtos', 'Estoque sincronizado na nuvem.', () => { guardDemoWrite('ajustar estoque'); return webAdjustStock(productId, delta, reason); }, { action: 'adjustStock', payload: { productId, delta, reason } })),
  createSale: (payload: unknown) => {
    const salePayload = withRequestId(payload, 'web-sale');
    return isTauriRuntime() ? call<SaleSummary>('create_sale', { payload }) : webCall('Vendas/PDV', 'Venda sincronizada na nuvem.', () => { guardDemoWrite('finalizar venda'); return webCreateSale(salePayload); }, { action: 'createSale', payload: { payload: salePayload } });
  },
  sales: () => (isTauriRuntime() ? call<SaleSummary[]>('list_sales') : webRead('Vendas/PDV', 'Vendas carregadas da nuvem.', webSales, webDemoSales)),
  cancelSale: (saleId: string, reason: string) => (isTauriRuntime() ? call<SaleSummary>('cancel_sale', { saleId, reason }) : webCall('Vendas/PDV', 'Cancelamento sincronizado na nuvem.', () => { guardDemoWrite('cancelar venda'); return webCancelSale(saleId, reason); }, { action: 'cancelSale', payload: { saleId, reason } })),
  cashSummary: () => (isTauriRuntime() ? call<CashSummary>('get_cash_summary') : webRead('Caixa', 'Caixa carregado da nuvem.', webCashSummary, webDemoCashSummary)),
  openCash: (openingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('open_cash', { openingAmount, notes }) : webCall('Caixa', 'Abertura de caixa sincronizada.', () => { guardDemoWrite('abrir caixa'); return webOpenCash(openingAmount, notes); }, { action: 'openCash', payload: { openingAmount, notes } })),
  closeCash: (closingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('close_cash', { closingAmount, notes }) : webCall('Caixa', 'Fechamento de caixa sincronizado.', () => { guardDemoWrite('fechar caixa'); return webCloseCash(closingAmount, notes); }, { action: 'closeCash', payload: { closingAmount, notes } })),
  addCashMovement: (movementType: string, method: string, amount: number, reason: string) => {
    const requestId = webRequestId('cash');
    return isTauriRuntime() ? call<CashSummary>('add_cash_movement', { movementType, method, amount, reason }) : webCall('Caixa', 'Movimento de caixa sincronizado.', () => { guardDemoWrite('lançar movimento de caixa'); return webAddCashMovement(movementType, method, amount, reason, requestId); }, { action: 'addCashMovement', payload: { movementType, method, amount, reason, requestId } });
  },
  credits: () => (isTauriRuntime() ? call<CreditSummary[]>('list_credits') : webRead('Crediário', 'Crediário carregado da nuvem.', webCredits, webDemoCredits)),
  receiveInstallment: (payload: unknown) => {
    const paymentPayload = withRequestId(payload, 'pay');
    return isTauriRuntime() ? call<CreditSummary>('receive_installment_flex', { payload }) : webCall('Crediário', 'Recebimento sincronizado na nuvem.', () => { guardDemoWrite('receber crediário'); return webReceiveInstallment(paymentPayload); }, { action: 'receiveInstallment', payload: { payload: paymentPayload } });
  },
  orders: () => (isTauriRuntime() ? call<OrderSummary[]>('list_orders') : webRead('Pedidos', 'Pedidos carregados da nuvem.', webOrders, webDemoOrders)),
  createOrder: (payload: unknown) => {
    const orderPayload = withRequestId(payload, 'web-order');
    return isTauriRuntime() ? call<OrderSummary>('create_order', { payload }) : webCall('Pedidos', 'Pedido sincronizado na nuvem.', () => { guardDemoWrite('criar pedido'); return webCreateOrder(orderPayload); }, { action: 'createOrder', payload: { payload: orderPayload } });
  },
  setOrderStatus: (orderId: string, status: string) => (isTauriRuntime() ? call<OrderSummary>('set_order_status', { orderId, status }) : webCall('Pedidos', 'Status do pedido sincronizado.', () => { guardDemoWrite('alterar pedido'); return webSetOrderStatus(orderId, status); }, { action: 'setOrderStatus', payload: { orderId, status } })),
  cancelOrder: (orderId: string, reason: string) => (isTauriRuntime() ? call<OrderSummary>('cancel_order', { orderId, reason }) : webCall('Pedidos', 'Cancelamento de pedido sincronizado.', () => { guardDemoWrite('cancelar pedido'); return webCancelOrder(orderId, reason); }, { action: 'cancelOrder', payload: { orderId, reason } })),
  receipts: () => (isTauriRuntime() ? call<ReceiptSummary[]>('list_receipts') : webRead('Comprovantes', 'Comprovantes carregados da nuvem.', webReceipts, webDemoReceipts)),
  exportHtmlPdf: (html: string, fileStem: string, openAfter = true, destinationDir?: string | null, printFormat = '80mm') => (isTauriRuntime() ? call<string>('export_html_pdf', { html, fileStem, openAfter, destinationDir }) : webCall('Comprovantes', 'Prévia de comprovante aberta.', () => webExportHtmlPdf(html, fileStem, printFormat))),
  openExternalUrl: (url: string) => (isTauriRuntime() ? call<void>('open_external_url', { url }) : webCall('Links', 'Link externo aberto.', () => Promise.resolve(openWebUrl(url)))),
  revealFile: (path: string) => (isTauriRuntime() ? call<void>('reveal_file', { path }) : path.startsWith('download:') ? Promise.resolve() : unsupportedWebFileAction()),
  saveProductImage: (imageData: string, fileStem: string, openAfter = true) => (isTauriRuntime() ? call<string>('save_product_image', { imageData, fileStem, openAfter }) : unsupportedWebFileAction()),
  backups: () => (isTauriRuntime() ? call<BackupInfo[]>('list_backups') : webRead('Backup', 'Backups web listados.', webBackups, webDemoBackups)),
  createBackup: () => (isTauriRuntime() ? call<BackupInfo>('create_backup') : webCall('Backup', 'Backup web gerado neste aparelho.', () => { guardDemoWrite('criar backup'); return webCreateBackup(); })),
  createBackupTo: (destinationDir: string) => (isTauriRuntime() ? call<BackupInfo>('create_backup_to', { destinationDir }) : webCall('Backup', 'Backup web gerado neste aparelho.', () => { guardDemoWrite('criar backup'); return webCreateBackup(); })),
  restoreBackup: (backupId: string, confirmation: string) => call<AppStatus>('restore_backup', { backupId, confirmation }),
  restoreBackupFromPath: (backupPath: string, confirmation: string) => (isTauriRuntime() ? call<AppStatus>('restore_backup_external', { backupPath, confirmation }) : Promise.reject(createWebModeError())),
  restoreWebBackupContent: (fileContent: string, confirmation: string) => webCall('Backup', 'Restauração web sincronizada.', () => { guardDemoWrite('restaurar backup'); return webRestoreBackupContent(fileContent, confirmation); }),
  pickBackupFolder: () => (isTauriRuntime() ? call<string | null>('pick_backup_folder') : Promise.resolve(null)),
  pickExportFolder: () => (isTauriRuntime() ? call<string | null>('pick_export_folder') : Promise.resolve(null)),
  pickRestoreBackupFile: () => (isTauriRuntime() ? call<string | null>('pick_restore_backup_file') : Promise.resolve(null)),
  exitApp: () => call<void>('exit_app'),
  reportData: (report: string, from: string, to: string) => (isTauriRuntime() ? call<ReportData>('get_report_data', { report, from, to }) : webRead('Relatórios', 'Relatório carregado da nuvem.', () => webReportData(report, from, to), () => webDemoReportData(report, from, to))),
  reportsCsv: (report: string, from: string, to: string) => (isTauriRuntime() ? call<string>('export_report_csv', { report, from, to }) : webRead('Relatórios', 'CSV gerado com dados da nuvem.', () => webReportsCsv(report, from, to), () => webDemoReportsCsv(report, from, to))),
  settings: () => (isTauriRuntime() ? call<Settings>('get_settings') : webRead('Configuração da loja', 'Configuração carregada da nuvem.', webSettings, webDemoSettings)),
  saveSettings: (settings: Settings) => (isTauriRuntime() ? call<Settings>('save_settings', { settings }) : webCall('Configuração da loja', 'Configuração sincronizada na nuvem.', () => { guardDemoWrite('salvar configurações'); return webSaveSettings(settings); }, { action: 'saveSettings', payload: { settings } })),
  audit: () => (isTauriRuntime() ? call<AuditEvent[]>('list_audit') : webRead('Auditoria', 'Auditoria carregada da nuvem.', webAudit, webDemoAudit)),
};

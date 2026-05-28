import { invoke } from '@tauri-apps/api/core';
import { playOperationSound } from './sound';
import { createWebModeError, isTauriRuntime } from './runtime';
import {
  openWebUrl,
  unsupportedWebFileAction,
  webAdjustStock,
  webAddCashMovement,
  webAppStatus,
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
  webExportHtmlPdf,
  webInactivateProduct,
  webOrders,
  webProducts,
  webOpenCash,
  webReceipts,
  webReceiveInstallment,
  webReportData,
  webReportsCsv,
  webSaveCustomer,
  webSaveProduct,
  webSales,
  webSaveSettings,
  webSetOrderStatus,
  webSettings,
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

export const api = {
  boot: () => (isTauriRuntime() ? call<AppStatus>('boot') : webAppStatus()),
  dashboard: () => (isTauriRuntime() ? call<DashboardData>('get_dashboard') : webDashboard()),
  dashboardSalesSeries: (period: string) => (isTauriRuntime() ? call<DashboardSalesPoint[]>('get_dashboard_sales_series', { period }) : webDashboardSalesSeries(period)),
  customers: () => (isTauriRuntime() ? call<Customer[]>('list_customers') : webCustomers()),
  saveCustomer: (customer: Partial<Customer>) => (isTauriRuntime() ? call<Customer>('upsert_customer', { customer }) : webSaveCustomer(customer)),
  inactivateCustomer: (customerId: string) => (isTauriRuntime() ? call<Customer>('inactivate_customer', { customerId }) : webInactivateCustomer(customerId)),
  products: () => (isTauriRuntime() ? call<Product[]>('list_products') : webProducts()),
  saveProduct: (product: Partial<Product>) => (isTauriRuntime() ? call<Product>('upsert_product', { product }) : webSaveProduct(product)),
  inactivateProduct: (productId: string) => (isTauriRuntime() ? call<Product>('inactivate_product', { productId }) : webInactivateProduct(productId)),
  adjustStock: (productId: string, delta: number, reason: string) => (isTauriRuntime() ? call<Product>('adjust_stock', { productId, delta, reason }) : webAdjustStock(productId, delta, reason)),
  createSale: (payload: unknown) => (isTauriRuntime() ? call<SaleSummary>('create_sale', { payload }) : webCreateSale(payload)),
  sales: () => (isTauriRuntime() ? call<SaleSummary[]>('list_sales') : webSales()),
  cancelSale: (saleId: string, reason: string) => (isTauriRuntime() ? call<SaleSummary>('cancel_sale', { saleId, reason }) : webCancelSale(saleId, reason)),
  cashSummary: () => (isTauriRuntime() ? call<CashSummary>('get_cash_summary') : webCashSummary()),
  openCash: (openingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('open_cash', { openingAmount, notes }) : webOpenCash(openingAmount, notes)),
  closeCash: (closingAmount: number, notes: string) => (isTauriRuntime() ? call<CashSummary>('close_cash', { closingAmount, notes }) : webCloseCash(closingAmount, notes)),
  addCashMovement: (movementType: string, method: string, amount: number, reason: string) => (isTauriRuntime() ? call<CashSummary>('add_cash_movement', { movementType, method, amount, reason }) : webAddCashMovement(movementType, method, amount, reason)),
  credits: () => (isTauriRuntime() ? call<CreditSummary[]>('list_credits') : webCredits()),
  receiveInstallment: (payload: unknown) => (isTauriRuntime() ? call<CreditSummary>('receive_installment_flex', { payload }) : webReceiveInstallment(payload)),
  orders: () => (isTauriRuntime() ? call<OrderSummary[]>('list_orders') : webOrders()),
  createOrder: (payload: unknown) => (isTauriRuntime() ? call<OrderSummary>('create_order', { payload }) : webCreateOrder(payload)),
  setOrderStatus: (orderId: string, status: string) => (isTauriRuntime() ? call<OrderSummary>('set_order_status', { orderId, status }) : webSetOrderStatus(orderId, status)),
  cancelOrder: (orderId: string, reason: string) => (isTauriRuntime() ? call<OrderSummary>('cancel_order', { orderId, reason }) : webCancelOrder(orderId, reason)),
  receipts: () => (isTauriRuntime() ? call<ReceiptSummary[]>('list_receipts') : webReceipts()),
  exportHtmlPdf: (html: string, fileStem: string, openAfter = true, destinationDir?: string | null) => (isTauriRuntime() ? call<string>('export_html_pdf', { html, fileStem, openAfter, destinationDir }) : webExportHtmlPdf(html, fileStem)),
  openExternalUrl: (url: string) => (isTauriRuntime() ? call<void>('open_external_url', { url }) : Promise.resolve(openWebUrl(url))),
  revealFile: (path: string) => (isTauriRuntime() ? call<void>('reveal_file', { path }) : path.startsWith('download:') ? Promise.resolve() : unsupportedWebFileAction()),
  saveProductImage: (imageData: string, fileStem: string, openAfter = true) => (isTauriRuntime() ? call<string>('save_product_image', { imageData, fileStem, openAfter }) : unsupportedWebFileAction()),
  backups: () => call<BackupInfo[]>('list_backups'),
  createBackup: () => call<BackupInfo>('create_backup'),
  createBackupTo: (destinationDir: string) => call<BackupInfo>('create_backup_to', { destinationDir }),
  restoreBackup: (backupId: string, confirmation: string) => call<AppStatus>('restore_backup', { backupId, confirmation }),
  restoreBackupFromPath: (backupPath: string, confirmation: string) => call<AppStatus>('restore_backup_external', { backupPath, confirmation }),
  pickBackupFolder: () => call<string | null>('pick_backup_folder'),
  pickExportFolder: () => (isTauriRuntime() ? call<string | null>('pick_export_folder') : Promise.resolve(null)),
  pickRestoreBackupFile: () => call<string | null>('pick_restore_backup_file'),
  exitApp: () => call<void>('exit_app'),
  reportData: (report: string, from: string, to: string) => (isTauriRuntime() ? call<ReportData>('get_report_data', { report, from, to }) : webReportData(report, from, to)),
  reportsCsv: (report: string, from: string, to: string) => (isTauriRuntime() ? call<string>('export_report_csv', { report, from, to }) : webReportsCsv(report, from, to)),
  settings: () => (isTauriRuntime() ? call<Settings>('get_settings') : webSettings()),
  saveSettings: (settings: Settings) => (isTauriRuntime() ? call<Settings>('save_settings', { settings }) : webSaveSettings(settings)),
  audit: () => call<AuditEvent[]>('list_audit'),
};

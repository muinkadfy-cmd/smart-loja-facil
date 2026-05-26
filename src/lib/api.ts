import { invoke } from '@tauri-apps/api/core';
import { playOperationSound } from './sound';
import { createWebModeError, isTauriRuntime } from './runtime';
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
  boot: () => call<AppStatus>('boot'),
  dashboard: () => call<DashboardData>('get_dashboard'),
  dashboardSalesSeries: (period: string) => call<DashboardSalesPoint[]>('get_dashboard_sales_series', { period }),
  customers: () => call<Customer[]>('list_customers'),
  saveCustomer: (customer: Partial<Customer>) => call<Customer>('upsert_customer', { customer }),
  inactivateCustomer: (customerId: string) => call<Customer>('inactivate_customer', { customerId }),
  products: () => call<Product[]>('list_products'),
  saveProduct: (product: Partial<Product>) => call<Product>('upsert_product', { product }),
  inactivateProduct: (productId: string) => call<Product>('inactivate_product', { productId }),
  adjustStock: (productId: string, delta: number, reason: string) => call<Product>('adjust_stock', { productId, delta, reason }),
  createSale: (payload: unknown) => call<SaleSummary>('create_sale', { payload }),
  sales: () => call<SaleSummary[]>('list_sales'),
  cancelSale: (saleId: string, reason: string) => call<SaleSummary>('cancel_sale', { saleId, reason }),
  cashSummary: () => call<CashSummary>('get_cash_summary'),
  openCash: (openingAmount: number, notes: string) => call<CashSummary>('open_cash', { openingAmount, notes }),
  closeCash: (closingAmount: number, notes: string) => call<CashSummary>('close_cash', { closingAmount, notes }),
  addCashMovement: (movementType: string, method: string, amount: number, reason: string) => call<CashSummary>('add_cash_movement', { movementType, method, amount, reason }),
  credits: () => call<CreditSummary[]>('list_credits'),
  receiveInstallment: (payload: unknown) => call<CreditSummary>('receive_installment_flex', { payload }),
  orders: () => call<OrderSummary[]>('list_orders'),
  createOrder: (payload: unknown) => call<OrderSummary>('create_order', { payload }),
  setOrderStatus: (orderId: string, status: string) => call<OrderSummary>('set_order_status', { orderId, status }),
  cancelOrder: (orderId: string, reason: string) => call<OrderSummary>('cancel_order', { orderId, reason }),
  receipts: () => call<ReceiptSummary[]>('list_receipts'),
  exportHtmlPdf: (html: string, fileStem: string, openAfter = true, destinationDir?: string | null) => call<string>('export_html_pdf', { html, fileStem, openAfter, destinationDir }),
  openExternalUrl: (url: string) => call<void>('open_external_url', { url }),
  revealFile: (path: string) => call<void>('reveal_file', { path }),
  saveProductImage: (imageData: string, fileStem: string, openAfter = true) => call<string>('save_product_image', { imageData, fileStem, openAfter }),
  backups: () => call<BackupInfo[]>('list_backups'),
  createBackup: () => call<BackupInfo>('create_backup'),
  createBackupTo: (destinationDir: string) => call<BackupInfo>('create_backup_to', { destinationDir }),
  restoreBackup: (backupId: string, confirmation: string) => call<AppStatus>('restore_backup', { backupId, confirmation }),
  restoreBackupFromPath: (backupPath: string, confirmation: string) => call<AppStatus>('restore_backup_external', { backupPath, confirmation }),
  pickBackupFolder: () => call<string | null>('pick_backup_folder'),
  pickExportFolder: () => call<string | null>('pick_export_folder'),
  pickRestoreBackupFile: () => call<string | null>('pick_restore_backup_file'),
  exitApp: () => call<void>('exit_app'),
  reportData: (report: string, from: string, to: string) => call<ReportData>('get_report_data', { report, from, to }),
  reportsCsv: (report: string, from: string, to: string) => call<string>('export_report_csv', { report, from, to }),
  settings: () => call<Settings>('get_settings'),
  saveSettings: (settings: Settings) => call<Settings>('save_settings', { settings }),
  audit: () => call<AuditEvent[]>('list_audit'),
};

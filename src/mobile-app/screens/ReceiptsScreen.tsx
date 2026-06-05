import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { creditPaymentMethodLabel, remainingInstallmentAmount } from '../../lib/creditPaymentGuard';
import type { AppStatus, CreditInstallment, CreditSummary, PageKey, ReceiptSummary, Settings } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';

interface ReceiptsScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type ReceiptPrintFormat = 'a4';
type ReceiptVisualTone = 'paid' | 'partial' | 'pending' | 'overdue' | 'danger' | 'neutral';
type ReceiptFilter = 'todos' | 'vendas' | 'crediario' | 'parcelas' | 'pedidos' | 'caixa' | 'cancelados';
type ReceiptPreviewKind = 'salvo' | 'nota' | 'parcela';
type ReceiptStoreInfo = Pick<Settings, 'store_name' | 'phone' | 'whatsapp' | 'receipt_message'> & { logo_url?: string };

const DEFAULT_RECEIPT_LOGO_URL = '/brand/jaque-receipt-logo.png';

type ReceiptView = ReceiptSummary & {
  source_kind?: ReceiptFilter;
  installment_number?: number;
  installment_total?: number;
  installment_due_date?: string;
  installment_paid_amount?: number;
  installment_remaining?: number;
};

type CreditCustomerGroup = {
  customerKey: string;
  customerName: string;
  contact: string;
  credits: CreditSummary[];
  total: number;
  paid: number;
  balance: number;
  notesCount: number;
  openNotes: number;
  overdueInstallments: number;
  partialInstallments: number;
};

type ReceiptPreview =
  | { kind: 'salvo'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; fileStem: string }
  | { kind: 'nota'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; credit: CreditSummary; fileStem: string }
  | { kind: 'parcela'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; credit: CreditSummary; installment: CreditInstallment; fileStem: string };

const receiptFilters: Array<{ key: ReceiptFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'crediario', label: 'Crediário' },
  { key: 'parcelas', label: 'Parcelas' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'caixa', label: 'Caixa' },
  { key: 'cancelados', label: 'Cancelados' },
];

const RECEIPTS_FOCUS_SALE_KEY = 'smart-loja:receipts-focus-sale-v1';

type ReceiptFocusPayload = { sale_number?: number; credit_id?: string; installment_number?: number; created_at?: number };

function receiptTitle(receipt: ReceiptView): string {
  if (receipt.source_kind === 'parcelas') return `Parcela ${receipt.installment_number || ''}/${receipt.installment_total || ''} · Venda #${String(receipt.sale_number || 0).padStart(4, '0')}`;
  return `Comprovante #${String(receipt.sale_number || 0).padStart(4, '0')}`;
}

function receiptStatusLabel(status: string): string {
  const text = String(status || '').toLowerCase();
  if (/(cancel|cancelad|canceled)/.test(text)) return 'Cancelado';
  if (/(venc|overdue)/.test(text)) return 'Vencido';
  if (/(parcial|partial)/.test(text)) return 'Parcial';
  if (/(pend|open|aberto)/.test(text)) return 'Pendente';
  if (/(pago|paid|quitado)/.test(text)) return 'Pago';
  if (/(emit|gerad|generated|finaliz|finalized)/.test(text)) return 'Emitido';
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Emitido';
}

function receiptTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const label = receiptStatusLabel(status).toLowerCase();
  if (label.includes('cancel') || label.includes('venc')) return 'danger';
  if (label.includes('parcial') || label.includes('pend')) return 'warn';
  if (label.includes('pago')) return 'ok';
  return 'neutral';
}

function receiptCategory(receipt: ReceiptView): ReceiptFilter {
  if (receipt.source_kind) return receipt.source_kind;
  const type = `${receipt.receipt_type || ''} ${receipt.status || ''} ${receipt.content || ''}`.toLowerCase();
  if (/cancel/.test(type)) return 'cancelados';
  if (/parcela|installment/.test(type)) return 'parcelas';
  if (/credi|credit/.test(type)) return 'crediario';
  if (/pedido|order/.test(type)) return 'pedidos';
  if (/caixa|cash/.test(type)) return 'caixa';
  return 'vendas';
}

function safeWhatsapp(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function readReceiptFocusPayload(): ReceiptFocusPayload | null {
  try {
    const raw = window.localStorage.getItem(RECEIPTS_FOCUS_SALE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReceiptFocusPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    const createdAt = Number(parsed.created_at || 0);
    if (createdAt && Date.now() - createdAt > 10 * 60 * 1000) {
      window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateOnly(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('pt-BR');
}

function remainingOf(installment: CreditInstallment): number {
  return remainingInstallmentAmount(installment);
}

function paidOf(installment: CreditInstallment): number {
  return Math.max(0, Number(installment.paid_amount || 0));
}

function isOverdue(installment: CreditInstallment): boolean {
  if (installment.status === 'pago') return false;
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < startOfToday();
}

function installmentStatusLabel(installment: CreditInstallment): string {
  if (installment.status === 'pago' || remainingOf(installment) <= 0.009) return 'Paga';
  if (isOverdue(installment)) return paidOf(installment) > 0 ? 'Parcial vencida' : 'Vencida';
  if (installment.status === 'parcial' || paidOf(installment) > 0) return 'Parcial';
  return 'Pendente';
}

function installmentStatusTone(installment: CreditInstallment): 'ok' | 'warn' | 'danger' | 'neutral' {
  const label = installmentStatusLabel(installment).toLowerCase();
  if (label.includes('paga')) return 'ok';
  if (label.includes('venc')) return 'danger';
  if (label.includes('parcial') || label.includes('pend')) return 'warn';
  return 'neutral';
}

function receiptStatusTone(label: string): ReceiptVisualTone {
  const lower = label.toLowerCase();
  if (lower.includes('paga') || lower.includes('quit')) return 'paid';
  if (lower.includes('venc') || lower.includes('atras')) return 'overdue';
  if (lower.includes('parcial')) return 'partial';
  if (lower.includes('pend') || lower.includes('abert') || lower.includes('open')) return 'pending';
  if (lower.includes('cancel')) return 'danger';
  return 'neutral';
}

function creditPaidTotal(credit: CreditSummary): number {
  return Math.max(0, Number(credit.total || 0) - Number(credit.balance || 0));
}

function creditNoteStatusDetails(credit: CreditSummary): { label: string; tone: ReceiptVisualTone; detail: string; overdueCount: number; partialCount: number; paidCount: number } {
  const installments = credit.installments || [];
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = installments.filter(isOverdue).length;
  const partialCount = installments.filter((installment) => remainingOf(installment) > 0.009 && paidOf(installment) > 0).length;
  if (balance <= 0.009) return { label: 'Paga', tone: 'paid', detail: 'Nota quitada, sem saldo restante.', overdueCount, partialCount, paidCount };
  if (overdueCount > 0) return { label: 'Atrasada', tone: 'overdue', detail: `${formatNumber(overdueCount)} parcela(s) atrasada(s).`, overdueCount, partialCount, paidCount };
  if (partialCount > 0) return { label: 'Parcial', tone: 'partial', detail: `${formatNumber(partialCount)} parcela(s) com pagamento parcial.`, overdueCount, partialCount, paidCount };
  return { label: 'Aberta', tone: 'pending', detail: 'Aguardando pagamento.', overdueCount, partialCount, paidCount };
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'L';
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first ?? 'L'}${second ?? 'J'}`.toUpperCase();
}

function normalizeReceiptStore(settings: Settings | null | undefined): ReceiptStoreInfo {
  const source = settings as (Settings & { logo_url?: string }) | null | undefined;
  const name = source?.store_name?.trim() || 'Minha loja';
  return {
    store_name: name,
    phone: source?.phone?.trim() || '',
    whatsapp: source?.whatsapp?.trim() || '',
    receipt_message: source?.receipt_message?.trim() || 'Obrigado pela preferência.',
    logo_url: source?.logo_url?.trim() || DEFAULT_RECEIPT_LOGO_URL,
  };
}

function buildReceiptBrand(store: ReceiptStoreInfo): string {
  const name = store.store_name || 'Jaque Confecções e Presentes';
  const contact = store.whatsapp || store.phone || '(43) 99607-9372';
  const logoUrl = store.logo_url || DEFAULT_RECEIPT_LOGO_URL;
  return `<div class="slf-paper-brand"><img class="slf-paper-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(name)}"><div class="slf-paper-store">${escapeHtml(name)}</div><div class="slf-paper-contact">☎ ${escapeHtml(contact)}</div></div>`;
}

type PaperReceiptTone = 'paid' | 'partial' | 'pending' | 'overdue' | 'danger' | 'neutral';

type PaperReceiptRow = {
  qtd: string;
  produto: string;
  unit?: number | string;
  total?: number | string;
  tone?: PaperReceiptTone;
};

function formatReceiptCellMoney(value: number | string | undefined): string {
  if (typeof value === 'number') return formatCurrency(value);
  return value ? String(value) : '';
}

function buildPaperRows(rows: PaperReceiptRow[], minRows = 7): string {
  const normalizedRows = rows.length ? rows : [{ qtd: '1', produto: 'Registro sem itens detalhados', total: '' }];
  const filledRows = [...normalizedRows];
  while (filledRows.length < minRows) filledRows.push({ qtd: '', produto: '', unit: '', total: '' });
  return filledRows.map((row, index) => {
    const emptyClass = row.qtd || row.produto || row.unit || row.total ? '' : ' empty';
    const toneClass = row.tone ? ` status-${row.tone}` : '';
    return `<tr class="${emptyClass}"><td data-label="Qtd.">${escapeHtml(row.qtd)}</td><td data-label="Produto" class="${toneClass}">${escapeHtml(row.produto)}</td><td class="num" data-label="R$ un">${escapeHtml(formatReceiptCellMoney(row.unit))}</td><td class="num" data-label="Total">${escapeHtml(formatReceiptCellMoney(row.total))}</td></tr>`;
  }).join('');
}

function receiptToneLabel(tone: PaperReceiptTone): string {
  if (tone === 'paid') return 'PAGO';
  if (tone === 'partial') return 'PARCIAL';
  if (tone === 'overdue' || tone === 'danger') return 'ATRASADO';
  if (tone === 'pending') return 'ABERTO';
  return 'RECIBO';
}

function buildPaymentOptions(method?: string): string {
  const normalized = String(method || '').toLowerCase();
  const isPix = normalized.includes('pix');
  const isCash = normalized.includes('dinheiro');
  const isCredit = normalized.includes('credito') || normalized.includes('crédito') || normalized.includes('cartao') || normalized.includes('cartão');
  const isDebit = normalized.includes('debito') || normalized.includes('débito');
  const item = (label: string, selected: boolean) => `<span class="${selected ? 'selected' : ''}">♥ ${escapeHtml(label)}</span>`;
  return `<div class="slf-paper-payment-options">${item('Pix', isPix)}${item('Dinheiro', isCash)}${item('Crédito', isCredit)}${item('Débito', isDebit)}</div>`;
}

function buildStatusStamp(tone: PaperReceiptTone, label: string, date?: string): string {
  const finalLabel = label || receiptToneLabel(tone);
  if (tone === 'paid') {
    return `<div class="slf-paid-stamp"><strong>${escapeHtml(finalLabel.toUpperCase())}</strong>${date ? `<span>${escapeHtml(date)}</span>` : ''}</div>`;
  }
  return `<div class="slf-status-ribbon ${tone}">${escapeHtml(finalLabel.toUpperCase())}${date ? ` · ${escapeHtml(date)}` : ''}</div>`;
}

function buildPaperReceiptHtml(options: {
  store: ReceiptStoreInfo;
  title: string;
  statusLabel: string;
  tone: PaperReceiptTone;
  customer: string;
  phone?: string;
  address?: string;
  rows: PaperReceiptRow[];
  paymentMethod?: string;
  total: number;
  notes: string;
  stampDate?: string;
}): string {
  const contact = options.phone || '-';
  const address = options.address || '-';
  const statusStamp = buildStatusStamp(options.tone, options.statusLabel, options.stampDate);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title)}</title>${buildReceiptStyles()}</head><body>
    <main class="slf-paper-shell" aria-label="${escapeHtml(options.title)}">
      <section class="slf-paper-receipt tone-${options.tone}">
        <div class="slf-paper-cut"></div>
        <header class="slf-paper-top">
          ${buildReceiptBrand(options.store)}
          <h1>${escapeHtml(options.title)}</h1>
        </header>
        <section class="slf-paper-fields" aria-label="Dados do cliente">
          <div><span>Cliente:</span><strong>${escapeHtml(options.customer || 'Cliente')}</strong></div>
          <div><span>Fone:</span><strong>${escapeHtml(contact)}</strong></div>
          <div><span>Endereço:</span><strong>${escapeHtml(address)}</strong></div>
        </section>
        <div class="slf-paper-table-wrap">
          <table class="slf-paper-table" aria-label="Itens do recibo">
            <thead><tr><th>Qtd.</th><th>Produto</th><th>R$ un</th><th>Total</th></tr></thead>
            <tbody>${buildPaperRows(options.rows)}</tbody>
          </table>
          ${statusStamp}
        </div>
        <section class="slf-paper-pay-total">
          <div class="slf-paper-pay"><strong>Pagamento</strong>${buildPaymentOptions(options.paymentMethod)}</div>
          <div class="slf-paper-total"><span>Total</span><strong>${formatCurrency(options.total)}</strong></div>
        </section>
        <section class="slf-paper-notes"><strong>Anotações</strong><p>${escapeHtml(options.notes)}</p></section>
      </section>
    </main>
  </body></html>`;
}

function buildReceiptStyles(): string {
  return `
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      :root{color-scheme:light;--pink:#e94183;--pink-dark:#b7195e;--pink-soft:#ffe5ef;--rose:#f7a6be;--gold:#f4b13d;--gold-soft:#fff2ce;--ink:#111827;--muted:#596579;--line:#1f2937}
      html,body{margin:0;min-height:100%;background:#f8fafc;color:var(--ink);font-family:Arial,Helvetica,sans-serif;overflow-x:hidden}
      body{padding:clamp(10px,3vw,22px)}
      .slf-paper-shell{width:100%;display:flex;justify-content:center;align-items:flex-start}
      .slf-paper-receipt{position:relative;width:min(100%,430px);background:#fff;border:2px solid #202020;border-radius:3px;padding:16px 14px 14px;box-shadow:0 18px 42px rgba(15,23,42,.16);overflow:hidden}
      .slf-paper-cut{position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--pink),var(--rose),var(--gold))}
      .slf-paper-top{display:grid;gap:4px;justify-items:center;text-align:center;margin-bottom:8px;position:relative;min-height:82px}
      .slf-paper-brand{display:grid;justify-items:center;gap:2px;min-width:0;width:100%}
      .slf-paper-logo{display:block;max-width:188px;width:54%;height:64px;object-fit:contain;object-position:center;filter:drop-shadow(0 3px 5px rgba(185,25,94,.16))}
      .slf-paper-store{font-size:10px;line-height:1.1;font-weight:950;color:var(--pink-dark);letter-spacing:.02em;text-transform:uppercase;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .slf-paper-contact{position:absolute;right:2px;top:26px;font-size:11px;font-weight:900;color:#111827;white-space:nowrap;background:#fff;border-radius:999px;padding:2px 0 2px 6px}
      .slf-paper-top h1{margin:2px 0 0;font-size:14px;letter-spacing:.055em;text-transform:uppercase;color:#111827;font-weight:950;border-top:1px dashed #cbd5e1;padding-top:7px;width:100%}
      .slf-paper-fields{display:grid;gap:3px;margin:5px 0 6px}
      .slf-paper-fields div{min-height:26px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;border:2px solid #2b2b2b;background:#fff}
      .slf-paper-fields span{align-self:stretch;display:inline-flex;align-items:center;margin:2px 5px 2px 3px;border-radius:999px;background:linear-gradient(135deg,#ff9db3,#f06c96);color:#531024;padding:3px 7px;font-size:12px;font-weight:900}
      .slf-paper-fields strong{min-width:0;padding:2px 6px;font-size:14px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1d2a44}
      .slf-paper-table-wrap{position:relative;min-width:0}
      .slf-paper-table{width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #202020;font-size:12px}
      .slf-paper-table th{background:linear-gradient(180deg,#f4879f,#e36687);color:#28121b;border:2px solid #202020;padding:6px 4px;text-align:center;font-size:13px;font-weight:900}
      .slf-paper-table th:nth-child(1){width:42px}.slf-paper-table th:nth-child(3){width:58px}.slf-paper-table th:nth-child(4){width:68px}
      .slf-paper-table td{height:31px;border:2px solid #202020;padding:4px 5px;vertical-align:middle;color:#13213b;background:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .slf-paper-table td:nth-child(1){text-align:center;font-weight:900}.slf-paper-table .num{text-align:right;font-weight:900;white-space:nowrap}.slf-paper-table tr.empty td{color:transparent}
      .status-paid{color:#111!important;font-weight:950}.status-partial{color:#b45309!important;font-weight:950}.status-pending{color:#1d4ed8!important;font-weight:950}.status-overdue,.status-danger{color:#b91c1c!important;font-weight:950}
      .slf-paid-stamp{position:absolute;right:54px;top:46%;transform:rotate(-4deg);display:grid;justify-items:center;gap:1px;min-width:112px;border:4px solid rgba(17,17,17,.92);border-radius:8px;padding:6px 10px;background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 2px rgba(17,17,17,.12);color:#111;text-align:center;z-index:2;mix-blend-mode:multiply}
      .slf-paid-stamp strong{font-size:27px;letter-spacing:.08em;line-height:1;font-weight:950}.slf-paid-stamp span{font-size:11px;font-weight:950;letter-spacing:.02em}.slf-status-ribbon{position:absolute;right:8px;top:8px;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:950;z-index:2;border:1px solid #cbd5e1;background:#f8fafc}.slf-status-ribbon.partial{background:#fff7ed;color:#b45309;border-color:#fed7aa}.slf-status-ribbon.pending{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.slf-status-ribbon.overdue,.slf-status-ribbon.danger{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
      .slf-paper-pay-total{display:grid;grid-template-columns:minmax(0,1fr) 112px;border-left:2px solid #202020;border-right:2px solid #202020;border-bottom:2px solid #202020}
      .slf-paper-pay,.slf-paper-total{min-height:54px;display:grid;align-content:center;border-right:2px solid #202020}.slf-paper-total{border-right:0;text-align:center}.slf-paper-pay>strong,.slf-paper-total>span{display:block;background:linear-gradient(180deg,#f4879f,#e36687);border-bottom:2px solid #202020;padding:5px 6px;text-align:center;color:#28121b;font-size:15px;line-height:1;font-weight:900}.slf-paper-payment-options{display:flex;align-items:center;justify-content:space-around;gap:4px;min-height:29px;padding:4px 5px;font-size:10px;font-weight:850;color:#1f2937;white-space:nowrap}.slf-paper-payment-options span{display:inline-flex;align-items:center;gap:2px;color:#ef7897}.slf-paper-payment-options span.selected{color:#111;font-weight:950;text-decoration:underline;text-decoration-color:var(--pink);text-decoration-thickness:2px}.slf-paper-total strong{display:flex;align-items:center;justify-content:center;min-height:29px;padding:2px 4px;font-size:24px;color:#1d2a44;font-weight:950;letter-spacing:-.04em}
      .slf-paper-notes{border:2px solid #202020;border-top:0;min-height:64px;text-align:center}.slf-paper-notes strong{display:block;padding:5px 6px;font-size:15px;font-weight:500;border-bottom:1px solid #202020}.slf-paper-notes p{margin:0;padding:8px 10px;font-size:13px;line-height:1.35;color:#1d2a44;text-align:left;font-weight:800;white-space:pre-wrap}
      .tone-paid .slf-paper-receipt,.slf-paper-receipt.tone-paid{border-color:#111}.tone-partial .slf-paper-cut{background:linear-gradient(90deg,#f59e0b,#f97316)}.tone-overdue .slf-paper-cut,.tone-danger .slf-paper-cut{background:linear-gradient(90deg,#ef4444,#b91c1c)}.tone-pending .slf-paper-cut{background:linear-gradient(90deg,#2563eb,#93c5fd)}
      @media (max-width:520px){body{padding:0;background:#eef4fb}.slf-paper-receipt{width:100%;max-width:100%;min-height:100dvh;border-left:0;border-right:0;border-radius:0;padding:14px 12px 18px;box-shadow:none}.slf-paper-top{min-height:76px}.slf-paper-logo{height:58px;width:58%;max-width:176px}.slf-paper-contact{top:22px;font-size:10px}.slf-paper-top h1{font-size:13px}.slf-paper-fields span{font-size:11px;padding-inline:6px}.slf-paper-fields strong{font-size:13px}.slf-paper-table{font-size:11px}.slf-paper-table th{font-size:12px;padding:5px 3px}.slf-paper-table th:nth-child(1){width:38px}.slf-paper-table th:nth-child(3){width:54px}.slf-paper-table th:nth-child(4){width:64px}.slf-paper-table td{height:30px;padding:3px 4px}.slf-paid-stamp{right:32px;top:43%;min-width:98px;padding:5px 8px}.slf-paid-stamp strong{font-size:23px}.slf-paper-pay-total{grid-template-columns:minmax(0,1fr) 105px}.slf-paper-payment-options{font-size:9px}.slf-paper-total strong{font-size:22px}.slf-paper-notes p{font-size:12px}}
      @media print{body{padding:0;background:#fff}.slf-paper-shell{display:block}.slf-paper-receipt{width:104mm;max-width:104mm;min-height:144mm;border-radius:0;box-shadow:none;margin:0 auto;page-break-inside:avoid}.slf-paper-logo{height:24mm;max-width:52mm}.slf-paper-top{min-height:30mm}.slf-paper-contact{top:10mm}.slf-paper-table td{height:8.5mm}.slf-paper-notes{min-height:18mm}}
    </style>`;
}

function dueDateHint(installment: CreditInstallment): string {
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return '';
  const days = Math.floor((startOfToday().getTime() - dueDate.getTime()) / 86400000);
  if (days > 0 && installmentStatusLabel(installment).toLowerCase().includes('venc')) return `Vencida há ${formatNumber(days)} dia(s)`;
  return '';
}

function buildInstallmentReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary, installment: CreditInstallment): string {
  const paid = paidOf(installment);
  const status = installmentStatusLabel(installment);
  const tone = receiptStatusTone(status);
  const method = installment.payment_method ? creditPaymentMethodLabel(String(installment.payment_method)) : '';
  const dueHint = dueDateHint(installment);
  const paidDate = installment.paid_at ? dateOnly(String(installment.paid_at).slice(0, 10)) : '';
  const displayTotal = tone === 'paid' || tone === 'partial' ? Math.max(paid, 0) : Number(installment.amount || 0);
  const title = tone === 'paid'
    ? 'COMPROVANTE DE PAGAMENTO'
    : tone === 'partial'
      ? 'COMPROVANTE PARCIAL'
      : tone === 'overdue'
        ? 'AVISO DE PARCELA ATRASADA'
        : 'RECIBO DE CREDIÁRIO';
  const notes = tone === 'paid'
    ? `Parcela ${installment.number}/${credit.installments.length} paga em ${paidDate || 'data não informada'}. Forma: ${method || 'não informada'}. Venda #${String(credit.sale_number || 0).padStart(4, '0')}.`
    : tone === 'partial'
      ? `Parcela ${installment.number}/${credit.installments.length} com pagamento parcial. Valor da parcela: ${formatCurrency(installment.amount)}. Pago até agora: ${formatCurrency(paid)}. Vencimento: ${dateOnly(installment.due_date)}.`
      : tone === 'overdue'
        ? `Parcela ${installment.number}/${credit.installments.length} atrasada. Vencimento: ${dateOnly(installment.due_date)}${dueHint ? ` (${dueHint})` : ''}. Venda #${String(credit.sale_number || 0).padStart(4, '0')}.`
        : `Parcela ${installment.number}/${credit.installments.length} em aberto. Vencimento: ${dateOnly(installment.due_date)}. Venda #${String(credit.sale_number || 0).padStart(4, '0')}.`;
  return buildPaperReceiptHtml({
    store,
    title,
    statusLabel: tone === 'paid' ? 'PAGO' : status,
    tone,
    customer: credit.customer_name || 'Cliente',
    phone: credit.customer_whatsapp || credit.customer_phone || '',
    rows: [{
      qtd: '1',
      produto: `Parcela ${installment.number}/${credit.installments.length} · Nota #${String(credit.sale_number || 0).padStart(4, '0')} · vence ${dateOnly(installment.due_date)}`,
      unit: installment.amount,
      total: displayTotal,
      tone,
    }],
    paymentMethod: method,
    total: displayTotal,
    notes,
    stampDate: tone === 'paid' ? `PAGO EM ${paidDate || new Date().toLocaleDateString('pt-BR')}` : undefined,
  });
}

function savedReceiptHtmlBody(html: string): string {
  const source = html || '<p>Comprovante sem conteúdo salvo.</p>';
  const match = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] || source;
}

function buildSavedReceiptHtml(store: ReceiptStoreInfo, receipt: ReceiptView): string {
  const status = receiptStatusLabel(receipt.status);
  const tone = receiptStatusTone(status);
  const bodyText = htmlToText(receipt.content || '').slice(0, 240);
  const title = receipt.source_kind === 'crediario' || receipt.source_kind === 'parcelas'
    ? 'COMPROVANTE DE CREDIÁRIO'
    : 'COMPROVANTE DE VENDA';
  const notes = [
    `Venda/nota #${String(receipt.sale_number || 0).padStart(4, '0')} · emitido em ${formatDateTime(receipt.created_at)}.`,
    bodyText ? `Detalhes salvos: ${bodyText}` : '',
  ].filter(Boolean).join('\n');
  return buildPaperReceiptHtml({
    store,
    title,
    statusLabel: status,
    tone,
    customer: receipt.customer_name || 'Consumidor',
    phone: receipt.customer_whatsapp || '',
    rows: [{ qtd: '1', produto: `Venda/nota #${String(receipt.sale_number || 0).padStart(4, '0')}`, unit: receipt.total, total: receipt.total, tone }],
    paymentMethod: receipt.receipt_type,
    total: Number(receipt.total || 0),
    notes,
    stampDate: tone === 'paid' ? `PAGO EM ${dateOnly(String(receipt.created_at).slice(0, 10))}` : undefined,
  });
}

function buildCreditGeneralReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary): string {
  const paid = creditPaidTotal(credit);
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  const partialCount = credit.installments.filter((installment) => installmentStatusLabel(installment).includes('Parcial')).length;
  const statusDetails = creditNoteStatusDetails(credit);
  const tone = statusDetails.tone;
  const status = tone === 'paid' ? 'QUITADA' : tone === 'overdue' ? 'ATRASADA' : tone === 'partial' ? 'PARCIAL' : 'ABERTA';
  const rows: PaperReceiptRow[] = credit.installments.map((installment) => {
    const label = installmentStatusLabel(installment);
    const rowTone = receiptStatusTone(label);
    const paidValue = paidOf(installment);
    return {
      qtd: String(installment.number),
      produto: `Parcela ${installment.number}/${credit.installments.length} · ${label} · vence ${dateOnly(installment.due_date)}`,
      unit: installment.amount,
      total: rowTone === 'paid' || rowTone === 'partial' ? Math.max(paidValue, 0) : installment.amount,
      tone: rowTone,
    };
  });
  const notes = [
    `Extrato da nota #${String(credit.sale_number || 0).padStart(4, '0')} emitida em ${formatDateTime(credit.created_at)}.`,
    `Parcelas pagas: ${paidCount}/${credit.installments.length}. Total da nota: ${formatCurrency(credit.total)}. Total pago: ${formatCurrency(paid)}.`,
    balance > 0.009 ? `Acompanhar saldo em aberto no Crediário: ${formatCurrency(balance)}.` : 'Nota quitada, sem saldo em aberto.',
    overdueCount > 0 ? `${formatNumber(overdueCount)} parcela(s) atrasada(s).` : '',
    partialCount > 0 ? `${formatNumber(partialCount)} parcela(s) com pagamento parcial.` : '',
  ].filter(Boolean).join('\n');
  return buildPaperReceiptHtml({
    store,
    title: 'EXTRATO DA NOTA',
    statusLabel: status,
    tone,
    customer: credit.customer_name || 'Cliente',
    phone: credit.customer_whatsapp || credit.customer_phone || '',
    rows,
    paymentMethod: 'crediario',
    total: Number(credit.total || 0),
    notes,
    stampDate: tone === 'paid' ? `QUITADO EM ${new Date().toLocaleDateString('pt-BR')}` : undefined,
  });
}

function installmentShareText(credit: CreditSummary, installment: CreditInstallment): string {
  return [
    `Comprovante da parcela ${installment.number}/${credit.installments.length}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Venda/nota: #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Status: ${installmentStatusLabel(installment)}`,
    `Valor original: ${formatCurrency(installment.amount)}`,
    `Pago: ${formatCurrency(paidOf(installment))}`,
    `Restante: ${formatCurrency(remainingOf(installment))}`,
    `Vencimento: ${dateOnly(installment.due_date)}`,
  ].join('\n');
}

function creditGeneralShareText(credit: CreditSummary): string {
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  return [
    `Extrato do crediário / nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Total: ${formatCurrency(credit.total)}`,
    `Pago: ${formatCurrency(creditPaidTotal(credit))}`,
    `Restante: ${formatCurrency(credit.balance)}`,
    `Parcelas pagas: ${paidCount}/${credit.installments.length}`,
    overdueCount ? `Atenção: ${overdueCount} parcela(s) vencida(s).` : 'Sem parcela vencida no momento.',
  ].join('\n');
}

function buildInstallmentReceiptViews(store: ReceiptStoreInfo, credits: CreditSummary[]): ReceiptView[] {
  return credits.flatMap((credit) => credit.installments.map((installment) => ({
    id: `credit-installment-${installment.id}`,
    sale_id: credit.sale_id,
    sale_number: credit.sale_number,
    customer_name: credit.customer_name,
    customer_whatsapp: credit.customer_whatsapp || credit.customer_phone || '',
    receipt_type: 'parcela-crediario-a4',
    total: Number(installment.amount || 0),
    status: installmentStatusLabel(installment),
    created_at: installment.paid_at || installment.due_date || credit.created_at,
    content: buildInstallmentReceiptHtml(store, credit, installment),
    source_kind: 'parcelas',
    installment_number: installment.number,
    installment_total: credit.installments.length,
    installment_due_date: installment.due_date,
    installment_paid_amount: paidOf(installment),
    installment_remaining: remainingOf(installment),
  } satisfies ReceiptView)));
}

export function ReceiptsScreen({ status, refreshToken, onNavigate }: ReceiptsScreenProps): JSX.Element {
  const [savedReceipts, setSavedReceipts] = useState<ReceiptView[]>([]);
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [selected, setSelected] = useState<ReceiptPreview | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>('todos');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [focusHandled, setFocusHandled] = useState(false);
  const previewPanelRef = useRef<HTMLElement | null>(null);

  const receiptStore = useMemo(() => normalizeReceiptStore(status?.settings), [status?.settings]);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const [rows, creditRows] = await Promise.all([api.receipts(), api.credits().catch(() => [])]);
      const normalizedReceipts = (rows as ReceiptView[]).map((receipt) => ({ ...receipt, source_kind: receipt.source_kind || receiptCategory(receipt) }));
      setSavedReceipts(normalizedReceipts);
      setCredits(creditRows as CreditSummary[]);
      setSelected((current) => current ? current : null);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReceipts();
  }, [refreshToken]);

  useEffect(() => {
    setVisibleCount(30);
  }, [filter, query]);

  const installmentReceiptViews = useMemo(() => buildInstallmentReceiptViews(receiptStore, credits), [credits, receiptStore]);

  const filteredSavedReceipts = useMemo(() => savedReceipts.filter((receipt) => {
    const category = receiptCategory(receipt);
    if (filter === 'crediario' || filter === 'parcelas') return false;
    if (filter !== 'todos' && filter !== category) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [receiptTitle(receipt), receipt.customer_name, receipt.customer_whatsapp, receipt.receipt_type, receipt.status, String(receipt.sale_number)]
      .some((value) => String(value || '').toLowerCase().includes(term));
  }), [filter, query, savedReceipts]);

  const filteredCredits = useMemo(() => {
    if (!['todos', 'crediario', 'parcelas'].includes(filter)) return [];
    const term = query.trim().toLowerCase();
    return credits.filter((credit) => {
      const installmentText = credit.installments.map((item) => `parcela ${item.number} ${installmentStatusLabel(item)} ${dateOnly(item.due_date)}`).join(' ');
      return !term || [
        credit.customer_name,
        credit.customer_phone,
        credit.customer_whatsapp,
        String(credit.sale_number),
        `nota ${credit.sale_number}`,
        `venda ${credit.sale_number}`,
        credit.status,
        installmentText,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [credits, filter, query]);

  const groupedCredits = useMemo<CreditCustomerGroup[]>(() => {
    const groups = new Map<string, CreditCustomerGroup>();
    for (const credit of filteredCredits) {
      const customerName = credit.customer_name?.trim() || 'Cliente sem nome';
      const contact = credit.customer_whatsapp || credit.customer_phone || '';
      const key = `${customerName.toLowerCase()}|${contact}`;
      const current = groups.get(key) ?? {
        customerKey: key,
        customerName,
        contact,
        credits: [],
        total: 0,
        paid: 0,
        balance: 0,
        notesCount: 0,
        openNotes: 0,
        overdueInstallments: 0,
        partialInstallments: 0,
      };
      current.credits.push(credit);
      current.total += Number(credit.total || 0);
      current.paid += creditPaidTotal(credit);
      current.balance += Math.max(0, Number(credit.balance || 0));
      current.notesCount += 1;
      const noteStatus = creditNoteStatusDetails(credit);
      if (credit.status !== 'quitado' && Number(credit.balance || 0) > 0.009) current.openNotes += 1;
      current.overdueInstallments += noteStatus.overdueCount;
      current.partialInstallments += noteStatus.partialCount;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));
  }, [filteredCredits]);

  const totalReceipts = savedReceipts.length + installmentReceiptViews.length + credits.length;
  const totalValue = useMemo(() => savedReceipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0) + credits.reduce((sum, credit) => sum + Number(credit.total || 0), 0), [credits, savedReceipts]);
  const pendingCount = useMemo(() => credits.flatMap((credit) => credit.installments).filter((installment) => remainingOf(installment) > 0.009 && installment.status !== 'pago').length, [credits]);

  function toggleCustomer(customerKey: string): void {
    setExpandedCustomers((current) => ({ ...current, [customerKey]: !current[customerKey] }));
  }

  function toggleCredit(creditId: string): void {
    setExpandedCredits((current) => ({ ...current, [creditId]: !current[creditId] }));
  }

  function savedReceiptPreview(receipt: ReceiptView): ReceiptPreview {
    return {
      kind: 'salvo',
      id: receipt.id,
      title: receiptTitle(receipt),
      customer: receipt.customer_name || 'Consumidor',
      createdAt: receipt.created_at,
      total: Number(receipt.total || 0),
      status: receiptStatusLabel(receipt.status),
      html: buildSavedReceiptHtml(receiptStore, receipt),
      phone: receipt.customer_whatsapp || '',
      fileStem: `comprovante-${receipt.sale_number || receipt.id}`,
    };
  }

  function creditPreview(credit: CreditSummary): ReceiptPreview {
    return {
      kind: 'nota',
      id: `credit-${credit.id}`,
      title: `Extrato da nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
      customer: credit.customer_name || 'Cliente',
      createdAt: credit.created_at,
      total: Number(credit.total || 0),
      status: creditNoteStatusDetails(credit).label,
      html: buildCreditGeneralReceiptHtml(receiptStore, credit),
      phone: credit.customer_whatsapp || credit.customer_phone || '',
      credit,
      fileStem: `comprovante-nota-${credit.sale_number || credit.id}`,
    };
  }

  function installmentPreview(credit: CreditSummary, installment: CreditInstallment): ReceiptPreview {
    return {
      kind: 'parcela',
      id: `credit-${credit.id}-installment-${installment.id}`,
      title: `Parcela ${installment.number}/${credit.installments.length} · Nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
      customer: credit.customer_name || 'Cliente',
      createdAt: installment.paid_at || installment.due_date || credit.created_at,
      total: Number(installment.amount || 0),
      status: installmentStatusLabel(installment),
      html: buildInstallmentReceiptHtml(receiptStore, credit, installment),
      phone: credit.customer_whatsapp || credit.customer_phone || '',
      credit,
      installment,
      fileStem: `comprovante-nota-${credit.sale_number || credit.id}-parcela-${installment.number}`,
    };
  }

  useEffect(() => {
    if (focusHandled || !credits.length) return;
    const focus = readReceiptFocusPayload();
    if (!focus) {
      setFocusHandled(true);
      return;
    }

    const targetCredit = credits.find((credit) => (focus.credit_id && credit.id === focus.credit_id) || (focus.sale_number && Number(credit.sale_number) === Number(focus.sale_number)));
    if (!targetCredit) {
      setFocusHandled(true);
      window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
      setFeedback({ tone: 'info', text: 'Abri a aba Comprovantes, mas não encontrei essa nota. Use a busca pelo cliente ou número da venda.' });
      return;
    }

    setFilter('crediario');
    setQuery(String(targetCredit.sale_number || ''));
    const customerName = targetCredit.customer_name?.trim() || 'Cliente sem nome';
    const contact = targetCredit.customer_whatsapp || targetCredit.customer_phone || '';
    const customerKey = `${customerName.toLowerCase()}|${contact}`;
    setExpandedCustomers((current) => ({ ...current, [customerKey]: true }));
    setExpandedCredits((current) => ({ ...current, [targetCredit.id]: true }));
    const targetInstallment = focus.installment_number
      ? targetCredit.installments.find((item) => Number(item.number) === Number(focus.installment_number))
      : null;
    selectPreview(targetInstallment ? installmentPreview(targetCredit, targetInstallment) : creditPreview(targetCredit));
    setFeedback({ tone: 'success', text: `${targetInstallment ? 'Recibo da parcela' : 'Extrato da nota'} #${String(targetCredit.sale_number || 0).padStart(4, '0')} aberto dentro do app. Confira na prévia e use Salvar PDF quando precisar.` });
    window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
    setFocusHandled(true);
  }, [credits, focusHandled, receiptStore]);

  function scrollToPreviewPanel(): void {
    window.setTimeout(() => previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function selectPreview(preview: ReceiptPreview): void {
    setSelected(preview);
    scrollToPreviewPanel();
  }

  function selectAndOpenPreview(preview: ReceiptPreview): void {
    selectPreview(preview);
    setFeedback({ tone: 'success', text: 'Recibo aberto dentro do app. Confira o layout antes de salvar PDF ou enviar.' });
  }

  useEffect(() => {
    if (selected) scrollToPreviewPanel();
  }, [selected?.id]);

  async function exportPreview(preview: ReceiptPreview, printFormat: ReceiptPrintFormat = 'a4'): Promise<void> {
    setSaving(true);
    try {
      selectPreview(preview);
      const result = await api.exportHtmlPdf(preview.html, preview.fileStem, true, undefined, printFormat);
      setFeedback({ tone: 'success', text: `${result} Use a opção do navegador para salvar como PDF real.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function openFullPreview(preview: ReceiptPreview): void {
    selectPreview(preview);
    setFeedback({ tone: 'success', text: 'Visualização aberta dentro do próprio app. Nada de HTML solto: confira, tire print ou salve em PDF.' });
  }

  async function sharePreview(preview: ReceiptPreview): Promise<void> {
    const baseText = preview.kind === 'nota'
      ? creditGeneralShareText(preview.credit)
      : preview.kind === 'parcela'
        ? installmentShareText(preview.credit, preview.installment)
        : `${preview.title}\nStatus: ${preview.status}\nCliente: ${preview.customer}\nTotal: ${formatCurrency(preview.total)}`;
    const text = `${baseText}\n\n${htmlToText(preview.html).slice(0, 650)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: preview.title, text });
        setFeedback({ tone: 'success', text: 'Comprovante enviado pelo compartilhamento do celular.' });
        return;
      } catch {
        // continua para WhatsApp/cópia quando o usuário cancela ou o navegador bloqueia.
      }
    }
    const phone = safeWhatsapp(preview.phone || '');
    if (phone) {
      await api.openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
      setFeedback({ tone: 'success', text: 'WhatsApp aberto com o comprovante preenchido.' });
      return;
    }
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'info', text: 'Texto do comprovante copiado. Cole no WhatsApp ou em outro app.' });
  }

  const visibleSavedReceipts = filteredSavedReceipts.slice(0, visibleCount);
  const hasAnyVisible = Boolean(visibleSavedReceipts.length || groupedCredits.length);

  return (
    <div className="mapp-screen mapp-receipts-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Comprovantes" value={formatNumber(totalReceipts)} detail="salvos, notas e parcelas" icon="comprovantes" tone="sky" />
        <StatCard label="Valor somado" value={formatCurrency(totalValue)} detail="vendas + notas" icon="dinheiro" tone="green" />
        <StatCard label="Atenção" value={formatNumber(pendingCount)} detail="parcelas pendentes" icon="crediario" tone="orange" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando comprovantes...</div> : null}
      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-success-card">
        <strong>Comprovantes organizados por cliente, nota e parcela</strong>
        <span>Agora esta aba abre o recibo dentro do app. Visualizar não baixa HTML solto; Salvar PDF usa o mesmo layout do recibo.</span>
      </section>

      <section className="mapp-filters-card mapp-receipts-filter-card">
        <label className="mapp-search-field">
          <InlineIcon name="relatorios" size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, nota, venda, parcela ou telefone" />
        </label>
        <div className="mapp-filter-pills" role="tablist" aria-label="Filtrar comprovantes">
          {receiptFilters.map((item) => (
            <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="mapp-form-panel mapp-receipt-preview" ref={previewPanelRef}>
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
            <div>
              <strong>{selected.title}</strong>
              <p>{selected.customer} · {formatDateTime(selected.createdAt)}</p>
            </div>
          </div>
          <div className="mapp-receipt-summary">
            <span>Total <strong>{formatCurrency(selected.total)}</strong></span>
            <span>Tipo <strong>{selected.kind === 'nota' ? 'Nota inteira' : selected.kind === 'parcela' ? 'Parcela' : 'Salvo'}</strong></span>
            <span className={`mapp-receipt-status-chip ${receiptStatusTone(selected.status)}`}>Status <strong>{selected.status}</strong></span>
          </div>
          <iframe
            title={`Prévia segura do ${selected.title}`}
            className="mapp-receipt-frame"
            sandbox="allow-same-origin"
            srcDoc={selected.html || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
          <div className="mapp-button-grid mapp-receipt-button-grid">
            <button type="button" className="mapp-primary-button" onClick={() => openFullPreview(selected)}>Visualizar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportPreview(selected, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'Salvar PDF'}</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void sharePreview(selected)}>Enviar / compartilhar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => setSelected(null)}>Fechar prévia</button>
          </div>
        </section>
      ) : null}

      {groupedCredits.length ? (
        <section className="mapp-credit-customer-list mapp-receipt-credit-list" aria-label="Comprovantes do crediário por cliente">
          {groupedCredits.map((group) => {
            const customerExpanded = expandedCustomers[group.customerKey] ?? true;
            return (
              <section key={group.customerKey} className="mapp-credit-customer-card mapp-receipt-customer-card">
                <button type="button" className="mapp-credit-customer-head mapp-receipt-customer-head" onClick={() => toggleCustomer(group.customerKey)} aria-expanded={customerExpanded}>
                  <div className="mapp-credit-customer-avatar" aria-hidden="true">{customerInitials(group.customerName)}</div>
                  <div>
                    <strong>{group.customerName}</strong>
                    <small>{group.notesCount} nota(s) · {group.openNotes} em aberto · {group.contact || 'sem telefone cadastrado'}</small>
                  </div>
                  <em className={group.balance <= 0.009 ? 'ok' : group.overdueInstallments > 0 ? 'danger' : 'warn'}>{group.balance <= 0.009 ? 'Sem saldo' : group.overdueInstallments > 0 ? `Atrasado · ${formatCurrency(group.balance)}` : `Aberto · ${formatCurrency(group.balance)}`}</em>
                </button>
                {customerExpanded ? (
                  <>
                    <div className="mapp-credit-customer-totals">
                      <span>Total <b>{formatCurrency(group.total)}</b></span>
                      <span>Pago <b>{formatCurrency(group.paid)}</b></span>
                      <span>Restante <b>{formatCurrency(group.balance)}</b></span>
                    </div>
                    {group.overdueInstallments > 0 || group.partialInstallments > 0 ? (
                      <div className={`mapp-receipt-customer-alert ${group.overdueInstallments > 0 ? 'danger' : 'warn'}`}>
                        {group.overdueInstallments > 0 ? `${formatNumber(group.overdueInstallments)} parcela(s) atrasada(s)` : `${formatNumber(group.partialInstallments)} parcela(s) com pagamento parcial`}
                      </div>
                    ) : null}
                    <div className="mapp-credit-list" aria-label={`Notas do cliente ${group.customerName}`}>
                      {group.credits.map((credit) => {
                        const expanded = expandedCredits[credit.id] ?? false;
                        const noteStatus = creditNoteStatusDetails(credit);
                        const paidCount = noteStatus.paidCount;
                        const creditReceipt = creditPreview(credit);
                        return (
                          <article key={credit.id} className={`mapp-credit-card mapp-receipt-note-card ${expanded ? 'expanded' : ''}`}>
                            <button type="button" className="mapp-credit-note-head" onClick={() => toggleCredit(credit.id)} aria-expanded={expanded}>
                              <span><InlineIcon name="comprovantes" size={24} /></span>
                              <div>
                                <strong>Nota/Venda #{String(credit.sale_number).padStart(4, '0')}</strong>
                                <small>{formatDateTime(credit.created_at)} · {paidCount}/{credit.installments.length} parcela(s) pagas</small>
                                <small className={`mapp-note-status-line ${noteStatus.tone}`}>{noteStatus.detail}</small>
                                <small>Toque para {expanded ? 'recolher' : 'abrir'} as parcelas desta nota</small>
                              </div>
                              <em className={noteStatus.tone}>{noteStatus.label}</em>
                            </button>
                            <div className="mapp-credit-totals">
                              <div><span>Total da nota</span><strong>{formatCurrency(credit.total)}</strong></div>
                              <div><span>Pago</span><strong>{formatCurrency(creditPaidTotal(credit))}</strong></div>
                              <div><span>Restante</span><strong>{formatCurrency(credit.balance)}</strong></div>
                              <div><span>Parcelas</span><strong>{paidCount}/{credit.installments.length}</strong></div>
                            </div>
                            <div className="mapp-credit-note-actions" aria-label="Ações do comprovante geral da nota">
                              <button type="button" onClick={() => selectAndOpenPreview(creditReceipt)}>Visualizar</button>
                              <button type="button" onClick={() => void exportPreview(creditReceipt, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                              <button type="button" onClick={() => void sharePreview(creditReceipt)} disabled={saving}>Enviar extrato</button>
                            </div>
                            {expanded ? (
                              <div className="mapp-installment-list">
                                {credit.installments.map((installment) => {
                                  const statusLabel = installmentStatusLabel(installment);
                                  const tone = installmentStatusTone(installment);
                                  const parcelReceipt = installmentPreview(credit, installment);
                                  return (
                                    <div key={installment.id} className={`mapp-installment-row mapp-installment-row-${tone} ${isOverdue(installment) ? 'overdue' : ''}`}>
                                      <div className="mapp-installment-main">
                                        <strong>Parcela {formatNumber(installment.number)}/{formatNumber(credit.installments.length)}</strong>
                                        <small>{statusLabel} · vence {dateOnly(installment.due_date)}</small>
                                        <div className="mapp-installment-values">
                                          <span>Original <b>{formatCurrency(installment.amount)}</b></span>
                                          <span>Pago <b>{formatCurrency(paidOf(installment))}</b></span>
                                          <span>Restante <b>{formatCurrency(remainingOf(installment))}</b></span>
                                        </div>
                                      </div>
                                      <b className={`mapp-installment-status ${tone}`}>{statusLabel}</b>
                                      <div className="mapp-installment-actions mapp-installment-actions-slim">
                                        <button type="button" onClick={() => selectAndOpenPreview(parcelReceipt)}>Visualizar</button>
                                        <button type="button" onClick={() => void exportPreview(parcelReceipt, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                                        <button type="button" onClick={() => void sharePreview(parcelReceipt)} disabled={saving}>Enviar</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            );
          })}
        </section>
      ) : null}

      {visibleSavedReceipts.length ? (
        <section className="mapp-crud-list mapp-receipt-saved-list" aria-label="Comprovantes salvos">
          <div className="mapp-section-title-row">
            <strong>Comprovantes salvos de vendas e caixa</strong>
            <small>{formatNumber(filteredSavedReceipts.length)} registro(s)</small>
          </div>
          {visibleSavedReceipts.map((receipt) => {
            const preview = savedReceiptPreview(receipt);
            return (
              <article key={receipt.id} className="mapp-crud-card mapp-receipt-card">
                <span className="mapp-crud-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
                <div className="mapp-crud-main">
                  <div className="mapp-crud-title-row">
                    <strong>{receiptTitle(receipt)}</strong>
                    <em className={receiptTone(receipt.status)}>{receiptStatusLabel(receipt.status)}</em>
                  </div>
                  <p>{receipt.customer_name || 'Consumidor'} · {receipt.receipt_type} · {formatDateTime(receipt.created_at)}</p>
                  <div className="mapp-crud-meta">
                    <span>{formatCurrency(receipt.total)}</span>
                    {receipt.source_kind === 'parcelas' ? <span>Restante {formatCurrency(receipt.installment_remaining || 0)}</span> : null}
                    <span>{receipt.customer_whatsapp ? 'WhatsApp disponível' : 'sem WhatsApp'}</span>
                  </div>
                </div>
                <div className="mapp-crud-side">
                  <strong>{formatCurrency(receipt.total)}</strong>
                  <div className="mapp-receipt-actions">
                    <button type="button" onClick={() => selectAndOpenPreview(preview)}>Ver</button>
                    <button type="button" onClick={() => void exportPreview(preview, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                    <button type="button" onClick={() => void sharePreview(preview)}>Enviar</button>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredSavedReceipts.length > visibleCount ? (
            <button type="button" className="mapp-secondary-button mapp-load-more" onClick={() => setVisibleCount((count) => count + 30)}>
              Ver mais comprovantes ({filteredSavedReceipts.length - visibleCount} restantes)
            </button>
          ) : null}
        </section>
      ) : null}

      {!hasAnyVisible && !loading ? (
        <EmptyState icon="comprovantes" title="Nenhum comprovante neste filtro" detail="Use a busca por cliente/nota ou gere uma venda/recebimento. Extratos do crediário aparecem aqui por cliente e nota." actionLabel="Ir para vendas" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}

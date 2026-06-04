import { useEffect, useMemo, useState } from 'react';
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
    logo_url: source?.logo_url?.trim() || '',
  };
}

function buildReceiptBrand(store: ReceiptStoreInfo): string {
  const name = store.store_name || 'Minha loja';
  const contact = [store.phone, store.whatsapp && store.whatsapp !== store.phone ? store.whatsapp : ''].filter(Boolean).join(' · ');
  const logo = store.logo_url
    ? `<img class="slf-logo-img" src="${escapeHtml(store.logo_url)}" alt="Logo da loja">`
    : `<span class="slf-logo-initials">${escapeHtml(customerInitials(name))}</span>`;
  return `<div class="slf-brand">${logo}<div><div class="slf-title">${escapeHtml(name)}</div>${contact ? `<div class="slf-contact">${escapeHtml(contact)}</div>` : ''}</div></div>`;
}

function buildReceiptStyles(): string {
  return `
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      :root{color-scheme:light}
      body{margin:0;background:#f4f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;padding:18px;min-height:100vh;overflow-x:hidden}
      .slf-mode-tip{margin:0 auto 12px;max-width:920px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:14px;padding:10px 12px;font-size:12px;font-weight:900;text-align:center;line-height:1.35}
      .slf-receipt{width:100%;max-width:920px;margin:0 auto;background:#fff;border-radius:20px;padding:20px;border:1px solid #dbe3ef;box-shadow:0 18px 44px rgba(15,23,42,.12);overflow:hidden}
      .slf-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start;border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:14px}
      .slf-brand{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;min-width:0}.slf-logo-img,.slf-logo-initials{width:52px;height:52px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-weight:900;object-fit:contain;padding:5px}.slf-title{font-size:20px;font-weight:950;line-height:1.05;color:#0f172a;overflow-wrap:break-word;word-break:normal;hyphens:none}.slf-contact{font-size:11px;color:#64748b;margin-top:3px;overflow-wrap:anywhere}.slf-sub{font-size:12px;color:#64748b;margin-top:4px;line-height:1.35}.slf-badge{justify-self:end;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:950;white-space:normal;text-align:center;line-height:1.15;border:1px solid #e2e8f0;max-width:260px}.slf-badge.paid{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.slf-badge.partial{background:#fffbeb;color:#b45309;border-color:#fde68a}.slf-badge.pending{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.slf-badge.overdue,.slf-badge.danger{background:#fef2f2;color:#b91c1c;border-color:#fecaca}.slf-badge.neutral{background:#f8fafc;color:#334155;border-color:#cbd5e1}
      .slf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:14px 0}.slf-info{border:1px solid #e5e7eb;border-radius:14px;padding:11px;background:#f8fafc;min-width:0}.slf-info span{display:block;font-size:11px;color:#64748b}.slf-info strong{display:block;margin-top:4px;font-size:15px;color:#111827;overflow-wrap:anywhere}.slf-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.slf-kpi{border-radius:14px;background:#0f172a;color:#fff;padding:12px;min-width:0}.slf-kpi span{display:block;font-size:11px;opacity:.78}.slf-kpi strong{display:block;margin-top:5px;font-size:18px;overflow-wrap:anywhere}.slf-kpi.light{background:#f8fafc;color:#0f172a;border:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{border-bottom:1px solid #e5e7eb;padding:9px 6px;text-align:left;vertical-align:top}th{color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.02em}.num{text-align:right;white-space:nowrap}.status-paid{color:#047857;font-weight:950}.status-partial{color:#b45309;font-weight:950}.status-pending{color:#1d4ed8;font-weight:950}.status-overdue,.status-danger{color:#b91c1c;font-weight:950}.slf-note{margin-top:12px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;padding:11px;color:#9a3412;font-size:12px;line-height:1.45}.slf-note.danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}.slf-note.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.slf-total{display:flex;justify-content:space-between;gap:10px;border-radius:14px;background:#111827;color:#fff;padding:12px;margin-top:10px;font-weight:950}.slf-footer{margin-top:14px;color:#64748b;font-size:11px;text-align:center}.slf-print-tip{margin-top:10px;border:1px dashed #cbd5e1;border-radius:12px;padding:9px;color:#475569;font-size:11px;text-align:center}
      @media (max-width:720px){body{padding:0;background:#eef4fb}.slf-mode-tip{border-radius:0;margin:0;padding:10px 12px}.slf-receipt{border-radius:0;padding:14px;border-inline:0;box-shadow:none}.slf-head{grid-template-columns:1fr;gap:10px}.slf-brand{grid-template-columns:44px minmax(0,1fr);align-items:start}.slf-logo-img,.slf-logo-initials{width:44px;height:44px;border-radius:14px}.slf-title{font-size:17px;line-height:1.08}.slf-badge{justify-self:start;max-width:100%;font-size:11px;padding:8px 10px}.slf-grid,.slf-kpis{grid-template-columns:1fr}.slf-kpi strong{font-size:17px}table,thead,tbody,tr,th,td{display:block;width:100%}thead{display:none}tr{border:1px solid #e5e7eb;border-radius:14px;margin:8px 0;padding:6px;background:#fff}td{display:flex;justify-content:space-between;gap:12px;border:0;border-bottom:1px solid #eef2f7;padding:7px 4px;text-align:right;white-space:normal}td:last-child{border-bottom:0}td::before{content:attr(data-label);font-weight:900;color:#64748b;text-align:left;white-space:normal}.num{text-align:right;white-space:normal}}
      @media print{body{background:#fff;padding:0}.slf-mode-tip,.slf-print-tip{display:none!important}.slf-receipt{box-shadow:none;border-radius:0;border:0;max-width:100%;padding:0}.slf-head{grid-template-columns:minmax(0,1fr) auto}.slf-title{font-size:18px}.slf-badge{justify-self:end}table{display:table}thead{display:table-header-group}tbody{display:table-row-group}tr{display:table-row;border:0;margin:0;padding:0}th,td{display:table-cell;width:auto}td::before{content:none}}
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
  const rest = remainingOf(installment);
  const status = installmentStatusLabel(installment);
  const tone = receiptStatusTone(status);
  const paidDate = installment.paid_at ? formatDateTime(installment.paid_at) : 'Ainda não pago';
  const method = installment.payment_method ? creditPaymentMethodLabel(String(installment.payment_method)) : 'Não informado';
  const dueHint = dueDateHint(installment);
  const noteClass = tone === 'paid' ? 'ok' : tone === 'overdue' ? 'danger' : '';
  const noteText = tone === 'paid'
    ? `Parcela quitada. Restante desta parcela: ${formatCurrency(0)}.`
    : tone === 'partial'
      ? `Pagamento parcial recebido. Ainda falta ${formatCurrency(rest)} nesta parcela.`
      : tone === 'overdue'
        ? `Atenção: esta parcela está atrasada. ${dueHint || 'Confira o vencimento e combine o recebimento com o cliente.'}`
        : 'Esta parcela ainda está em aberto. Envie este comprovante para o cliente acompanhar vencimento e saldo.';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parcela ${installment.number}/${credit.installments.length}</title>${buildReceiptStyles()}</head><body>
    <div class="slf-mode-tip">Visualização limpa para iPhone/Android: confira, tire print, compartilhe ou use A4/PDF.</div><main class="slf-receipt">
      <header class="slf-head">
        <div>${buildReceiptBrand(store)}<div class="slf-sub">Comprovante individual da parcela do crediário</div></div>
        <strong class="slf-badge ${tone}">${escapeHtml(status.toUpperCase())}</strong>
      </header>
      <section class="slf-grid">
        <div class="slf-info"><span>Cliente</span><strong>${escapeHtml(credit.customer_name || 'Cliente')}</strong></div>
        <div class="slf-info"><span>Venda / nota</span><strong>#${String(credit.sale_number || 0).padStart(4, '0')}</strong></div>
        <div class="slf-info"><span>Parcela</span><strong>${installment.number}/${credit.installments.length}</strong></div>
        <div class="slf-info"><span>Vencimento</span><strong>${escapeHtml(dateOnly(installment.due_date))}${dueHint ? ` · ${escapeHtml(dueHint)}` : ''}</strong></div>
      </section>
      <section class="slf-kpis">
        <div class="slf-kpi light"><span>Valor original</span><strong>${formatCurrency(installment.amount)}</strong></div>
        <div class="slf-kpi light"><span>Total já pago</span><strong>${formatCurrency(paid)}</strong></div>
        <div class="slf-kpi"><span>Restante</span><strong>${formatCurrency(rest)}</strong></div>
      </section>
      <table aria-label="Resumo da parcela"><tbody>
        <tr><th>Valor original</th><td class="num" data-label="Valor original">${formatCurrency(installment.amount)}</td></tr>
        <tr><th>Pago nesta parcela</th><td class="num" data-label="Pago nesta parcela">${formatCurrency(paid)}</td></tr>
        <tr><th>Restante desta parcela</th><td class="num" data-label="Restante desta parcela">${formatCurrency(rest)}</td></tr>
        <tr><th>Status</th><td class="num status-${tone}" data-label="Status">${escapeHtml(status)}</td></tr>
        <tr><th>Forma do pagamento</th><td class="num" data-label="Forma do pagamento">${escapeHtml(method)}</td></tr>
        <tr><th>Data do pagamento</th><td class="num" data-label="Data do pagamento">${escapeHtml(paidDate)}</td></tr>
      </tbody></table>
      <div class="slf-note ${noteClass}">${escapeHtml(noteText)}</div>
      <div class="slf-footer">${escapeHtml(store.receipt_message || 'Obrigado pela preferência.')} · Gerado pelo Smart Loja Fácil</div>
      <div class="slf-print-tip">No iPhone, abra em tela cheia e tire print ou use Compartilhar. No Android/PC, use Imprimir / salvar PDF.</div>
    </main></body></html>`;
}

function buildCreditGeneralReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary): string {
  const paid = creditPaidTotal(credit);
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const partialCount = credit.installments.filter((installment) => installmentStatusLabel(installment).includes('Parcial')).length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  const nextOpen = [...credit.installments].filter((installment) => remainingOf(installment) > 0.009 && installment.status !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date) || a.number - b.number)[0] ?? null;
  const statusDetails = creditNoteStatusDetails(credit);
  const status = statusDetails.tone === 'paid' ? 'Nota paga' : statusDetails.tone === 'overdue' ? 'Nota atrasada' : statusDetails.tone === 'partial' ? 'Com pagamento parcial' : 'Nota em aberto';
  const tone = statusDetails.tone;
  const noteClass = tone === 'paid' ? 'ok' : tone === 'overdue' ? 'danger' : '';
  const noteText = tone === 'paid'
    ? 'Nota quitada. Todas as parcelas estão pagas.'
    : tone === 'overdue'
      ? `${formatNumber(overdueCount)} parcela(s) atrasada(s). Confira os vencimentos destacados na lista abaixo.`
      : tone === 'partial'
        ? 'Nota com pagamento parcial. O cliente já pagou uma parte, mas ainda existe saldo restante.'
        : 'Nota aberta. Nenhuma parcela vencida no momento, mas ainda existe saldo a receber.';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crediário venda ${credit.sale_number}</title>${buildReceiptStyles()}</head><body>
    <div class="slf-mode-tip">Extrato da nota inteira: cliente, total, parcelas, pago, restante e status.</div><main class="slf-receipt">
      <header class="slf-head">
        <div>${buildReceiptBrand(store)}<div class="slf-sub">Extrato completo do crediário / nota inteira</div></div>
        <strong class="slf-badge ${tone}">${escapeHtml(status.toUpperCase())}</strong>
      </header>
      <section class="slf-grid">
        <div class="slf-info"><span>Cliente</span><strong>${escapeHtml(credit.customer_name || 'Cliente')}</strong></div>
        <div class="slf-info"><span>Venda / nota</span><strong>#${String(credit.sale_number || 0).padStart(4, '0')}</strong></div>
        <div class="slf-info"><span>Quantidade de parcelas</span><strong>${credit.installments.length}</strong></div>
        <div class="slf-info"><span>Próximo vencimento</span><strong>${nextOpen ? `${dateOnly(nextOpen.due_date)} · ${formatCurrency(remainingOf(nextOpen))}` : 'Sem parcelas em aberto'}</strong></div>
      </section>
      <section class="slf-kpis">
        <div class="slf-kpi light"><span>Total da nota</span><strong>${formatCurrency(credit.total)}</strong></div>
        <div class="slf-kpi light"><span>Total pago</span><strong>${formatCurrency(paid)}</strong></div>
        <div class="slf-kpi"><span>Total restante</span><strong>${formatCurrency(balance)}</strong></div>
      </section>
      <table aria-label="Parcelas do crediário">
        <thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Original</th><th class="num">Pago</th><th class="num">Restante</th><th class="num">Status</th></tr></thead>
        <tbody>${credit.installments.map((installment) => {
          const label = installmentStatusLabel(installment);
          const rowTone = receiptStatusTone(label);
          return `<tr><td data-label="Parcela">${installment.number}/${credit.installments.length}</td><td data-label="Vencimento">${escapeHtml(dateOnly(installment.due_date))}</td><td class="num" data-label="Original">${formatCurrency(installment.amount)}</td><td class="num" data-label="Pago">${formatCurrency(paidOf(installment))}</td><td class="num" data-label="Restante">${formatCurrency(remainingOf(installment))}</td><td class="num status-${rowTone}" data-label="Status">${escapeHtml(label)}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="slf-total"><span>Parcelas pagas</span><strong>${paidCount}/${credit.installments.length}</strong></div>
      <div class="slf-note ${noteClass}">${escapeHtml(noteText)} Para enviar só uma parcela, use o botão Enviar dentro da parcela.</div>
      <div class="slf-footer">${escapeHtml(store.receipt_message || 'Obrigado pela preferência.')} · Gerado pelo Smart Loja Fácil</div>
      <div class="slf-print-tip">No iPhone, use Visualizar/print para abrir a tela limpa e tirar print. No Android/PC, use Imprimir / salvar PDF.</div>
    </main></body></html>`;
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
      html: receipt.content || `<section class="slf-receipt"><h1>${escapeHtml(receiptTitle(receipt))}</h1><p>${escapeHtml(receipt.customer_name || 'Consumidor')} - ${formatCurrency(receipt.total)}</p></section>`,
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

  async function exportPreview(preview: ReceiptPreview, printFormat: ReceiptPrintFormat = 'a4'): Promise<void> {
    setSaving(true);
    try {
      await api.exportHtmlPdf(preview.html, preview.fileStem, true, undefined, printFormat);
      setFeedback({ tone: 'success', text: 'A4/PDF aberto. No iPhone, confira em tela cheia e tire print ou compartilhe.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function openFullPreview(preview: ReceiptPreview): void {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      setFeedback({ tone: 'info', text: 'O navegador bloqueou a visualização. Use A4/PDF ou Compartilhar.' });
      return;
    }
    popup.document.open();
    popup.document.write(preview.html || '<p>Comprovante sem prévia HTML salva.</p>');
    popup.document.close();
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
        <span>Agora esta aba concentra Visualizar, A4/PDF e Enviar. No iPhone, use Visualizar para abrir limpo e tirar print; 58mm/80mm foram removidos daqui para não confundir.</span>
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
        <section className="mapp-form-panel mapp-receipt-preview">
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
            sandbox=""
            srcDoc={selected.html || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
          <div className="mapp-button-grid mapp-receipt-button-grid">
            <button type="button" className="mapp-primary-button" onClick={() => openFullPreview(selected)}>Visualizar / print iPhone</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportPreview(selected, 'a4')} disabled={saving}>A4 / PDF</button>
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
                              <button type="button" onClick={() => setSelected(creditReceipt)}>Visualizar</button>
                              <button type="button" onClick={() => void exportPreview(creditReceipt, 'a4')} disabled={saving}>A4/PDF</button>
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
                                        <button type="button" onClick={() => setSelected(parcelReceipt)}>Visualizar</button>
                                        <button type="button" onClick={() => void exportPreview(parcelReceipt, 'a4')} disabled={saving}>A4/PDF</button>
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
                    <button type="button" onClick={() => setSelected(preview)}>Ver</button>
                    <button type="button" onClick={() => void exportPreview(preview, 'a4')} disabled={saving}>A4</button>
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

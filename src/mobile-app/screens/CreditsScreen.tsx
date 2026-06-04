import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import {
  buildCreditPaymentReview,
  creditPaymentMethodLabel,
  formatBrazilianMoney,
  parseBrazilianMoneyInput,
  remainingInstallmentAmount,
  type CreditPaymentMethod,
  type CreditPaymentReview,
} from '../../lib/creditPaymentGuard';
import type { AppStatus, CreditInstallment, CreditSummary, PageKey, Settings } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';

interface CreditsScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type CreditFilter = 'todos' | 'aberto' | 'vencidos' | 'quitado';
type CreditPrintFormat = '58mm' | '80mm' | 'a4';

type ReceiveState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  amount: string;
  method: CreditPaymentMethod | '';
  redistribute: boolean;
};

function requestId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now()}-${random}`;
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

function safeWhatsapp(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function isOverdue(installment: CreditInstallment): boolean {
  if (installment.status === 'pago') return false;
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < startOfToday();
}

function remainingOf(installment: CreditInstallment): number {
  return remainingInstallmentAmount(installment);
}

function paidOf(installment: CreditInstallment): number {
  return Math.max(0, Number(installment.paid_amount || 0));
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

function creditOpenInstallments(credit: CreditSummary): CreditInstallment[] {
  return [...credit.installments]
    .filter((installment) => installment.status !== 'pago' && remainingOf(installment) > 0.009)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.number - b.number);
}

function creditPaidTotal(credit: CreditSummary): number {
  return Math.max(0, Number(credit.total || 0) - Number(credit.balance || 0));
}

type ReceiptStoreInfo = Pick<Settings, 'store_name' | 'phone' | 'whatsapp' | 'receipt_message'> & { logo_url?: string };

type ReceiptStatusTone = 'paid' | 'partial' | 'pending' | 'overdue' | 'danger' | 'neutral';

function receiptInitials(name: string): string {
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

function dueDateLabel(installment: CreditInstallment): string {
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return '';
  const days = Math.floor((startOfToday().getTime() - dueDate.getTime()) / 86400000);
  if (days > 0 && installmentStatusLabel(installment).toLowerCase().includes('venc')) return `Vencida há ${formatNumber(days)} dia(s)`;
  return '';
}

function statusReceiptTone(label: string): ReceiptStatusTone {
  const lower = label.toLowerCase();
  if (lower.includes('paga') || lower.includes('quit')) return 'paid';
  if (lower.includes('venc')) return 'overdue';
  if (lower.includes('parcial')) return 'partial';
  if (lower.includes('pend')) return 'pending';
  if (lower.includes('cancel')) return 'danger';
  return 'neutral';
}

function buildReceiptBrand(store: ReceiptStoreInfo): string {
  const name = store.store_name || 'Minha loja';
  const contact = [store.phone, store.whatsapp && store.whatsapp !== store.phone ? store.whatsapp : ''].filter(Boolean).join(' · ');
  const logo = store.logo_url
    ? `<img class="slf-logo-img" src="${escapeHtml(store.logo_url)}" alt="Logo da loja">`
    : `<span class="slf-logo-initials">${escapeHtml(receiptInitials(name))}</span>`;
  return `<div class="slf-brand">${logo}<div><div class="slf-title">${escapeHtml(name)}</div>${contact ? `<div class="slf-contact">${escapeHtml(contact)}</div>` : ''}</div></div>`;
}

function buildReceiptStyles(): string {
  return `
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      :root{color-scheme:light}
      body{margin:0;background:#f4f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif}
      .slf-receipt{max-width:920px;margin:0 auto;background:#fff;border-radius:20px;padding:20px;border:1px solid #dbe3ef;box-shadow:0 18px 44px rgba(15,23,42,.12)}
      .slf-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:14px}
      .slf-brand{display:flex;gap:10px;align-items:center;min-width:0}.slf-logo-img,.slf-logo-initials{width:52px;height:52px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-weight:900;object-fit:contain;padding:5px}.slf-title{font-size:20px;font-weight:950;line-height:1.05;color:#0f172a;word-break:break-word}.slf-contact{font-size:11px;color:#64748b;margin-top:3px}.slf-sub{font-size:12px;color:#64748b;margin-top:4px}.slf-badge{border-radius:999px;padding:9px 12px;font-size:12px;font-weight:950;white-space:nowrap;border:1px solid #e2e8f0}.slf-badge.paid{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.slf-badge.partial{background:#fffbeb;color:#b45309;border-color:#fde68a}.slf-badge.pending{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.slf-badge.overdue,.slf-badge.danger{background:#fef2f2;color:#b91c1c;border-color:#fecaca}.slf-badge.neutral{background:#f8fafc;color:#334155;border-color:#cbd5e1}
      .slf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:14px 0}.slf-info{border:1px solid #e5e7eb;border-radius:14px;padding:11px;background:#f8fafc}.slf-info span{display:block;font-size:11px;color:#64748b}.slf-info strong{display:block;margin-top:4px;font-size:15px;color:#111827;word-break:break-word}.slf-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.slf-kpi{border-radius:14px;background:#0f172a;color:#fff;padding:12px}.slf-kpi span{display:block;font-size:11px;opacity:.78}.slf-kpi strong{display:block;margin-top:5px;font-size:18px}.slf-kpi.light{background:#f8fafc;color:#0f172a;border:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{border-bottom:1px solid #e5e7eb;padding:9px 6px;text-align:left;vertical-align:top}th{color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.02em}.num{text-align:right;white-space:nowrap}.status-paid{color:#047857;font-weight:950}.status-partial{color:#b45309;font-weight:950}.status-pending{color:#1d4ed8;font-weight:950}.status-overdue,.status-danger{color:#b91c1c;font-weight:950}.slf-note{margin-top:12px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;padding:11px;color:#9a3412;font-size:12px;line-height:1.45}.slf-note.danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}.slf-note.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.slf-total{display:flex;justify-content:space-between;gap:10px;border-radius:14px;background:#111827;color:#fff;padding:12px;margin-top:10px;font-weight:950}.slf-footer{margin-top:14px;color:#64748b;font-size:11px;text-align:center}.slf-print-tip{margin-top:10px;border:1px dashed #cbd5e1;border-radius:12px;padding:9px;color:#475569;font-size:11px;text-align:center}
      @media print{body{background:#fff}.slf-receipt{box-shadow:none;border-radius:0;border:0}.no-print{display:none!important}}
      @media (max-width:560px){.slf-receipt{border-radius:0;padding:14px}.slf-grid,.slf-kpis{grid-template-columns:1fr}.slf-head{align-items:flex-start}.slf-logo-img,.slf-logo-initials{width:44px;height:44px;border-radius:14px}.slf-title{font-size:17px}.slf-badge{font-size:11px;padding:7px 9px}table{font-size:11px}th,td{padding:7px 4px}}
    </style>`;
}

function buildInstallmentReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary, installment: CreditInstallment): string {
  const paid = paidOf(installment);
  const rest = remainingOf(installment);
  const status = installmentStatusLabel(installment);
  const tone = statusReceiptTone(status);
  const paidDate = installment.paid_at ? formatDateTime(installment.paid_at) : 'Ainda não pago';
  const method = installment.payment_method ? creditPaymentMethodLabel(String(installment.payment_method)) : 'Não informado';
  const dueHint = dueDateLabel(installment);
  const noteClass = tone === 'paid' ? 'ok' : tone === 'overdue' ? 'danger' : '';
  const noteText = tone === 'paid'
    ? `Parcela quitada. Restante desta parcela: ${formatCurrency(0)}.`
    : tone === 'partial'
      ? `Pagamento parcial recebido. Ainda falta ${formatCurrency(rest)} nesta parcela.`
      : tone === 'overdue'
        ? `Atenção: esta parcela está atrasada. ${dueHint || 'Confira o vencimento e combine o recebimento com o cliente.'}`
        : 'Esta parcela ainda está em aberto. Envie este comprovante para o cliente acompanhar vencimento e saldo.';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parcela ${installment.number}/${credit.installments.length}</title>${buildReceiptStyles()}</head><body>
    <main class="slf-receipt">
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
      <table aria-label="Resumo da parcela">
        <tbody>
          <tr><th>Valor original</th><td class="num">${formatCurrency(installment.amount)}</td></tr>
          <tr><th>Pago nesta parcela</th><td class="num">${formatCurrency(paid)}</td></tr>
          <tr><th>Restante</th><td class="num">${formatCurrency(rest)}</td></tr>
          <tr><th>Status</th><td class="num status-${tone}">${escapeHtml(status)}</td></tr>
          <tr><th>Forma de pagamento</th><td class="num">${escapeHtml(method)}</td></tr>
          <tr><th>Data do pagamento</th><td class="num">${escapeHtml(paidDate)}</td></tr>
        </tbody>
      </table>
      <div class="slf-note ${noteClass}">${escapeHtml(noteText)}</div>
      <div class="slf-print-tip">No iPhone, abra em tela cheia e tire print ou use Compartilhar. No Android/PC, use Imprimir / salvar PDF.</div>
      <div class="slf-footer">${escapeHtml(store.receipt_message)}<br>Gerado por ${escapeHtml(store.store_name)} · ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    </main></body></html>`;
}

function buildCreditGeneralReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary): string {
  const paid = creditPaidTotal(credit);
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const partialCount = credit.installments.filter((installment) => installmentStatusLabel(installment).includes('Parcial')).length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  const nextOpen = creditOpenInstallments(credit)[0] ?? null;
  const generalStatus = balance <= 0.009 ? 'Quitado' : overdueCount > 0 ? 'Atrasado' : paid > 0 ? 'Parcial' : 'Pendente';
  const tone = statusReceiptTone(generalStatus);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crediário venda ${credit.sale_number}</title>${buildReceiptStyles()}</head><body>
    <main class="slf-receipt">
      <header class="slf-head">
        <div>${buildReceiptBrand(store)}<div class="slf-sub">Extrato completo do crediário / nota inteira</div></div>
        <strong class="slf-badge ${tone}">${escapeHtml(generalStatus.toUpperCase())}</strong>
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
          const rowTone = statusReceiptTone(label);
          return `<tr><td>${installment.number}/${credit.installments.length}</td><td>${escapeHtml(dateOnly(installment.due_date))}</td><td class="num">${formatCurrency(installment.amount)}</td><td class="num">${formatCurrency(paidOf(installment))}</td><td class="num">${formatCurrency(remainingOf(installment))}</td><td class="num status-${rowTone}">${escapeHtml(label)}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="slf-total"><span>Parcelas pagas</span><strong>${paidCount}/${credit.installments.length}</strong></div>
      <div class="slf-total"><span>Parciais / atrasadas</span><strong>${partialCount} parcial · ${overdueCount} vencida(s)</strong></div>
      <div class="slf-note">Este extrato mostra a nota inteira. Para enviar só uma parcela, use o botão Enviar na linha da parcela.</div>
      <div class="slf-print-tip">No iPhone, use Visualizar/print para abrir a tela limpa e tirar print. No Android/PC, use Imprimir / salvar PDF.</div>
      <div class="slf-footer">${escapeHtml(store.receipt_message)}<br>Gerado por ${escapeHtml(store.store_name)} · ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    </main></body></html>`;
}

function creditGeneralShareText(credit: CreditSummary): string {
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  const lines = [
    `Extrato do crediário · Venda #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Valor original: ${formatCurrency(credit.total)}`,
    `Pago: ${formatCurrency(creditPaidTotal(credit))}`,
    `Restante: ${formatCurrency(credit.balance)}`,
    `Parcelas pagas: ${paidCount}/${credit.installments.length}`,
    overdueCount ? `Atenção: ${overdueCount} parcela(s) vencida(s).` : 'Sem parcela vencida neste extrato.',
    'Parcelas:',
    ...credit.installments.map((installment) => `- ${installment.number}/${credit.installments.length}: ${installmentStatusLabel(installment)} · original ${formatCurrency(installment.amount)} · pago ${formatCurrency(paidOf(installment))} · restante ${formatCurrency(remainingOf(installment))}`),
  ];
  return lines.join('\n');
}

function installmentShareText(credit: CreditSummary, installment: CreditInstallment): string {
  const dueHint = dueDateLabel(installment);
  return [
    `Comprovante de parcela ${installment.number}/${credit.installments.length}`,
    `Venda #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Vencimento: ${dateOnly(installment.due_date)}${dueHint ? ` (${dueHint})` : ''}`,
    `Valor original: ${formatCurrency(installment.amount)}`,
    `Pago: ${formatCurrency(paidOf(installment))}`,
    `Restante: ${formatCurrency(remainingOf(installment))}`,
    `Status: ${installmentStatusLabel(installment)}`,
    installment.paid_at ? `Pago em: ${formatDateTime(installment.paid_at)}` : 'Pagamento: ainda não registrado',
  ].join('\n');
}

export function CreditsScreen({ status, refreshToken, onNavigate, onRefresh }: CreditsScreenProps): JSX.Element {
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CreditFilter>('aberto');
  const [receive, setReceive] = useState<ReceiveState | null>(null);
  const [paymentReview, setPaymentReview] = useState<CreditPaymentReview | null>(null);
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const receiptStore = useMemo(() => normalizeReceiptStore(status?.settings), [status?.settings]);

  const loadCredits = async () => {
    setLoading(true);
    try {
      const rows = await api.credits();
      setCredits(rows);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCredits();
  }, [refreshToken]);

  const summary = useMemo(() => {
    const openCredits = credits.filter((credit) => credit.status === 'aberto');
    const installments = credits.flatMap((credit) => credit.installments);
    const overdue = installments.filter(isOverdue);
    const nextOpen = installments
      .filter((installment) => installment.status !== 'pago')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;
    return {
      openCount: openCredits.length,
      openBalance: openCredits.reduce((sum, credit) => sum + Number(credit.balance || 0), 0),
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((sum, installment) => sum + remainingOf(installment), 0),
      nextOpen,
    };
  }, [credits]);

  const filteredCredits = useMemo(() => {
    const term = query.trim().toLowerCase();
    return credits.filter((credit) => {
      const hasOverdue = credit.installments.some(isOverdue);
      const matchesFilter =
        filter === 'todos'
        || (filter === 'aberto' && credit.status === 'aberto')
        || (filter === 'vencidos' && hasOverdue)
        || (filter === 'quitado' && credit.status === 'quitado');
      const matchesTerm = !term || [
        credit.customer_name,
        credit.customer_phone,
        credit.customer_whatsapp,
        String(credit.sale_number),
        credit.status,
      ].some((value) => String(value || '').toLowerCase().includes(term));
      return matchesFilter && matchesTerm;
    });
  }, [credits, filter, query]);

  function toggleCredit(creditId: string): void {
    setExpandedCredits((current) => ({ ...current, [creditId]: !current[creditId] }));
  }

  function openReceive(credit: CreditSummary, installment: CreditInstallment): void {
    if (installment.status === 'pago') {
      setFeedback({ tone: 'error', text: 'Essa parcela já está paga. Escolha outra parcela em aberto.' });
      return;
    }
    const amount = remainingOf(installment);
    setFeedback(null);
    setPaymentReview(null);
    setReceive({
      credit,
      installment,
      amount: amount.toFixed(2),
      method: 'dinheiro',
      redistribute: credit.installments.some((item) => item.number > installment.number && item.status !== 'pago'),
    });
  }

  function buildCurrentReview(): CreditPaymentReview | null {
    if (!receive || saving) return null;
    return buildCreditPaymentReview({
      credit: receive.credit,
      installment: receive.installment,
      rawAmount: receive.amount,
      method: receive.method,
      redistribute: receive.redistribute,
    });
  }

  function prepareReceiveConfirmation(): void {
    const review = buildCurrentReview();
    if (!review) return;
    setPaymentReview(review);
    if (!review.ok) setFeedback({ tone: 'error', text: review.message });
    else setFeedback({ tone: review.severity === 'exact' ? 'info' : 'error', text: review.message });
  }

  async function submitReceiveConfirmed(): Promise<void> {
    if (!receive || saving) return;
    const review = paymentReview ?? buildCurrentReview();
    if (!review) return;
    if (!review.ok) {
      setPaymentReview(review);
      setFeedback({ tone: 'error', text: review.message });
      return;
    }
    setSaving(true);
    try {
      await api.receiveInstallment({
        request_id: requestId('pay-mobile'),
        credit_id: receive.credit.id,
        installment_id: receive.installment.id,
        amount: review.amount,
        method: review.method,
        settle_with_redistribution: receive.redistribute,
        user_confirmed: true,
        typed_amount_preview: review.formattedAmount,
        before_after: {
          installment_original: review.installmentOriginal,
          installment_paid_before: review.installmentPaidBefore,
          credit_open_before: review.creditOpenBefore,
          remaining_after: review.remainingAfter,
          status_after: review.statusAfter,
        },
      });
      setReceive(null);
      setPaymentReview(null);
      setFeedback({ tone: 'success', text: 'Tudo certo: recebimento lançado. Caixa e crediário foram atualizados e sincronizados.' });
      await loadCredits();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function setExactReceiveAmount(): void {
    if (!receive) return;
    const exact = receive.redistribute ? Math.max(0, Number(receive.credit.balance || 0)) : remainingOf(receive.installment);
    setReceive({ ...receive, amount: exact.toFixed(2) });
    setPaymentReview(null);
    setFeedback({ tone: 'info', text: `Valor ajustado para ${formatBrazilianMoney(exact)}. Confira a prévia antes de confirmar.` });
  }

  function onReceiveAmountChange(value: string): void {
    if (!receive) return;
    setReceive({ ...receive, amount: value });
    setPaymentReview(null);
    const preview = parseBrazilianMoneyInput(value);
    if (preview.ok) setFeedback({ tone: 'info', text: `Valor que será registrado: ${preview.formatted}` });
    else setFeedback(null);
  }

  async function exportCreditReceipt(credit: CreditSummary, format: CreditPrintFormat): Promise<void> {
    setSaving(true);
    try {
      await api.exportHtmlPdf(buildCreditGeneralReceiptHtml(receiptStore, credit), `crediario-nota-${credit.sale_number || credit.id}`, true, undefined, format);
      setFeedback({ tone: 'success', text: `Comprovante geral ${format === 'a4' ? 'A4/PDF' : format} aberto para imprimir ou enviar.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function exportInstallmentReceipt(credit: CreditSummary, installment: CreditInstallment, format: CreditPrintFormat): Promise<void> {
    setSaving(true);
    try {
      await api.exportHtmlPdf(buildInstallmentReceiptHtml(receiptStore, credit, installment), `crediario-${credit.sale_number}-parcela-${installment.number}`, true, undefined, format);
      setFeedback({ tone: 'success', text: `Comprovante da parcela ${installment.number}/${credit.installments.length} aberto em ${format === 'a4' ? 'A4/PDF' : format}.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function shareText(text: string, phone: string, title: string): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        setFeedback({ tone: 'success', text: 'Comprovante enviado pelo compartilhamento do celular.' });
        return;
      } catch {
        // segue para WhatsApp/cópia quando usuário cancela ou o navegador bloqueia.
      }
    }
    const whatsapp = safeWhatsapp(phone);
    if (whatsapp) {
      await api.openExternalUrl(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`);
      setFeedback({ tone: 'success', text: 'WhatsApp aberto com o comprovante preenchido.' });
      return;
    }
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'info', text: 'Comprovante copiado. Cole no WhatsApp ou em outro app.' });
  }

  async function shareCreditReceipt(credit: CreditSummary): Promise<void> {
    const html = buildCreditGeneralReceiptHtml(receiptStore, credit);
    const text = `${creditGeneralShareText(credit)}\n\n${htmlToText(html).slice(0, 500)}`;
    await shareText(text, credit.customer_whatsapp || credit.customer_phone || '', `Crediário venda #${credit.sale_number}`);
  }

  async function shareInstallmentReceipt(credit: CreditSummary, installment: CreditInstallment): Promise<void> {
    const html = buildInstallmentReceiptHtml(receiptStore, credit, installment);
    const text = `${installmentShareText(credit, installment)}\n\n${htmlToText(html).slice(0, 400)}`;
    await shareText(text, credit.customer_whatsapp || credit.customer_phone || '', `Parcela ${installment.number}/${credit.installments.length}`);
  }

  return (
    <div className="mapp-screen mapp-credits-screen">
      <section className="mapp-mini-stat-grid mapp-credits-stats">
        <StatCard label="Em aberto" value={formatCurrency(summary.openBalance)} detail={`${formatNumber(summary.openCount)} cliente(s)`} icon="crediario" tone="purple" />
        <StatCard label="Vencidos" value={formatCurrency(summary.overdueTotal)} detail={`${formatNumber(summary.overdueCount)} parcela(s)`} icon="auditoria_logs" tone="orange" />
        <StatCard label="Clientes" value={formatNumber(status?.dashboard.credits_active_customers)} detail="com crediário ativo" icon="clientes" tone="sky" />
        <StatCard label="Próximo venc." value={summary.nextOpen ? dateOnly(summary.nextOpen.due_date) : '-'} detail={summary.nextOpen ? formatCurrency(remainingOf(summary.nextOpen)) : 'sem parcelas'} icon="comprovantes" tone="green" />
      </section>

      <section className="mapp-success-card">
        <strong>Ajuda rápida: notas expansíveis e comprovante por parcela</strong>
        <span>Abra uma nota para ver todas as parcelas. Cada parcela pode gerar comprovante com status Pago, Parcial, Pendente ou Vencido.</span>
      </section>

      {summary.overdueCount ? (
        <section className="mapp-stock-alert mapp-credit-alert">
          <span><InlineIcon name="crediario" size={24} /></span>
          <div>
            <strong>{formatNumber(summary.overdueCount)} parcela(s) vencida(s)</strong>
            <p>Priorize cobrança e recebimento para manter o caixa saudável.</p>
          </div>
          <button type="button" onClick={() => setFilter('vencidos')}>Ver vencidos</button>
        </section>
      ) : null}

      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-filters-card">
        <label className="mapp-search-field">
          <InlineIcon name="relatorios" size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, telefone ou venda" />
        </label>
        <div className="mapp-filter-pills">
          {[
            ['todos', `Todos ${formatNumber(credits.length)}`],
            ['aberto', `Abertos ${formatNumber(credits.filter((credit) => credit.status === 'aberto').length)}`],
            ['vencidos', `Vencidos ${formatNumber(summary.overdueCount)}`],
            ['quitado', `Quitados ${formatNumber(credits.filter((credit) => credit.status === 'quitado').length)}`],
          ].map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key as CreditFilter)}>{label}</button>
          ))}
        </div>
      </section>

      {receive ? (
        <section className="mapp-form-panel mapp-receive-panel" aria-label="Receber parcela">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-purple"><InlineIcon name="crediario" size={24} /></span>
            <div>
              <strong>Receber parcela {formatNumber(receive.installment.number)}</strong>
              <p>{receive.credit.customer_name} · venda #{String(receive.credit.sale_number).padStart(4, '0')}</p>
            </div>
          </div>
          <div className="mapp-form-grid">
            <label>
              <span>Valor recebido</span>
              <input inputMode="decimal" value={receive.amount} onChange={(event) => onReceiveAmountChange(event.target.value)} placeholder="Ex.: 10,00" />
            </label>
            <label>
              <span>Forma</span>
              <select value={receive.method} onChange={(event) => { setReceive({ ...receive, method: event.target.value as CreditPaymentMethod | '' }); setPaymentReview(null); }}>
                <option value="">Escolha a forma</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="span-2 mapp-check-field">
              <input type="checkbox" checked={receive.redistribute} onChange={(event) => { setReceive({ ...receive, redistribute: event.target.checked }); setPaymentReview(null); }} />
              <span>Redistribuir diferença nas próximas parcelas</span>
            </label>
          </div>
          <div className="mapp-sale-total-box">
            <div><span>Parcela</span><strong>{formatCurrency(receive.installment.amount)}</strong></div>
            <div><span>Pago</span><strong>{formatCurrency(receive.installment.paid_amount)}</strong></div>
            <div><span>Restante</span><strong>{formatCurrency(remainingOf(receive.installment))}</strong></div>
          </div>
          {paymentReview ? (
            <section className={`mapp-credit-payment-review mapp-credit-payment-review-${paymentReview.severity}`} aria-live="polite">
              <strong>{paymentReview.message}</strong>
              <p>Valor que será registrado: <b>{paymentReview.formattedAmount}</b></p>
              {paymentReview.amount > paymentReview.installmentOpenBefore + 0.009 ? (
                <div className="mapp-credit-payment-alert">
                  <span>Saldo em aberto: <b>{formatCurrency(paymentReview.installmentOpenBefore)}</b></span>
                  <span>Valor digitado: <b>{formatCurrency(paymentReview.amount)}</b></span>
                  <span>Diferença: <b>{formatCurrency(paymentReview.difference)}</b></span>
                </div>
              ) : null}
              {paymentReview.severity === 'partial' ? (
                <div className="mapp-credit-payment-alert">
                  <span>Valor da parcela: <b>{formatCurrency(paymentReview.installmentOpenBefore)}</b></span>
                  <span>Valor recebido: <b>{formatCurrency(paymentReview.amount)}</b></span>
                  <span>Vai faltar: <b>{formatCurrency(paymentReview.missing)}</b></span>
                </div>
              ) : null}
              <div className="mapp-credit-payment-summary">
                <span>Cliente <b>{receive.credit.customer_name}</b></span>
                <span>Parcela <b>{formatNumber(receive.installment.number)}</b></span>
                <span>Valor original <b>{formatCurrency(paymentReview.installmentOriginal)}</b></span>
                <span>Já pago <b>{formatCurrency(paymentReview.installmentPaidBefore)}</b></span>
                <span>Valor recebido agora <b>{formatCurrency(paymentReview.amount)}</b></span>
                <span>Restante depois do pagamento <b>{formatCurrency(paymentReview.remainingAfter)}</b></span>
                <span>Status depois do pagamento <b>{paymentReview.statusAfter}</b></span>
                <span>Abatimento em próximas parcelas <b>{paymentReview.applyToFuture > 0 ? formatCurrency(paymentReview.applyToFuture) : 'Não haverá'}</b></span>
                <span>Forma de pagamento <b>{creditPaymentMethodLabel(paymentReview.method)}</b></span>
              </div>
              <small>Se recebeu errado, registre a correção com cuidado no caixa/crediário ou procure o responsável.</small>
            </section>
          ) : null}
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => { setReceive(null); setPaymentReview(null); }}>Cancelar</button>
            {paymentReview ? <button type="button" className="mapp-secondary-button" onClick={() => setPaymentReview(null)}>Corrigir valor</button> : null}
            {paymentReview && !paymentReview.ok ? <button type="button" className="mapp-secondary-button" onClick={setExactReceiveAmount}>Usar saldo exato</button> : null}
            {!paymentReview ? (
              <button type="button" className="mapp-primary-button" onClick={prepareReceiveConfirmation} disabled={saving}>{saving ? 'Conferindo...' : 'Conferir antes de receber'}</button>
            ) : paymentReview.ok ? (
              <button type="button" className="mapp-primary-button" onClick={() => void submitReceiveConfirmed()} disabled={saving}>
                {saving ? 'Recebendo...' : paymentReview.severity === 'over-installment' ? 'Confirmar mesmo assim' : 'Confirmar recebimento'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {loading ? <div className="mapp-inline-status">Carregando crediário...</div> : null}

      {filteredCredits.length ? (
        <section className="mapp-credit-list" aria-label="Lista de crediários">
          {filteredCredits.map((credit) => {
            const openInstallments = creditOpenInstallments(credit);
            const nextInstallment = openInstallments[0] ?? credit.installments[0];
            const expanded = Boolean(expandedCredits[credit.id]);
            const visibleInstallments = expanded ? credit.installments : credit.installments.slice(0, 2);
            const paidCount = credit.installments.filter((item) => installmentStatusLabel(item) === 'Paga').length;
            return (
              <article key={credit.id} className={`mapp-credit-card ${expanded ? 'expanded' : ''}`}>
                <button type="button" className="mapp-credit-note-head" onClick={() => toggleCredit(credit.id)} aria-expanded={expanded}>
                  <span><InlineIcon name="clientes" size={24} /></span>
                  <div>
                    <strong>{credit.customer_name}</strong>
                    <small>Nota/Venda #{String(credit.sale_number).padStart(4, '0')} · {formatDateTime(credit.created_at)}</small>
                    <small>{paidCount}/{credit.installments.length} parcela(s) pagas · toque para {expanded ? 'recolher' : 'abrir'}</small>
                  </div>
                  <em className={credit.status === 'quitado' ? 'ok' : 'warn'}>{credit.status === 'quitado' ? 'Quitado' : 'Aberto'}</em>
                </button>
                <div className="mapp-credit-totals">
                  <div><span>Valor original</span><strong>{formatCurrency(credit.total)}</strong></div>
                  <div><span>Pago</span><strong>{formatCurrency(creditPaidTotal(credit))}</strong></div>
                  <div><span>Restante</span><strong>{formatCurrency(credit.balance)}</strong></div>
                  <div><span>Contato</span><strong>{credit.customer_whatsapp || credit.customer_phone || '-'}</strong></div>
                </div>
                <div className="mapp-credit-note-actions" aria-label="Ações do comprovante geral da nota">
                  <button type="button" onClick={() => void exportCreditReceipt(credit, 'a4')} disabled={saving}>Visualizar/print</button>
                  <button type="button" onClick={() => void exportCreditReceipt(credit, '58mm')} disabled={saving}>Extrato 58mm</button>
                  <button type="button" onClick={() => void exportCreditReceipt(credit, '80mm')} disabled={saving}>Extrato 80mm</button>
                  <button type="button" onClick={() => void exportCreditReceipt(credit, 'a4')} disabled={saving}>Extrato A4</button>
                  <button type="button" onClick={() => void shareCreditReceipt(credit)} disabled={saving}>Enviar extrato</button>
                </div>
                <div className="mapp-installment-list">
                  {visibleInstallments.map((installment) => {
                    const statusLabel = installmentStatusLabel(installment);
                    const tone = installmentStatusTone(installment);
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
                        <div className="mapp-installment-actions">
                          {installment.status !== 'pago' && remainingOf(installment) > 0.009 ? <button type="button" onClick={() => openReceive(credit, installment)}>Receber</button> : null}
                          <button type="button" onClick={() => void exportInstallmentReceipt(credit, installment, 'a4')} disabled={saving}>Ver/print</button>
                          <button type="button" onClick={() => void exportInstallmentReceipt(credit, installment, '58mm')} disabled={saving}>58</button>
                          <button type="button" onClick={() => void exportInstallmentReceipt(credit, installment, '80mm')} disabled={saving}>80</button>
                          <button type="button" onClick={() => void exportInstallmentReceipt(credit, installment, 'a4')} disabled={saving}>A4</button>
                          <button type="button" onClick={() => void shareInstallmentReceipt(credit, installment)} disabled={saving}>Enviar</button>
                        </div>
                      </div>
                    );
                  })}
                  {credit.installments.length > visibleInstallments.length ? (
                    <button type="button" className="mapp-credit-expand-button" onClick={() => toggleCredit(credit.id)}>
                      Ver todas as {formatNumber(credit.installments.length)} parcelas
                    </button>
                  ) : null}
                </div>
                {nextInstallment && credit.status !== 'quitado' ? (
                  <button type="button" className="mapp-credit-primary-action" onClick={() => openReceive(credit, nextInstallment)}>
                    Receber próxima parcela
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : !loading ? (
        <EmptyState icon="crediario" title="Sem crediário encontrado" detail={query ? 'Tente buscar por outro cliente ou venda.' : 'Vendas no crediário aparecerão aqui.'} actionLabel="Abrir PDV" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}

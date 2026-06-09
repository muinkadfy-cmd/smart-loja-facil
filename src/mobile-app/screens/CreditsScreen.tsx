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
import { COMPACT_CREDIT_LIMIT, LOAD_MORE_STEP, SEARCH_RESULT_LIMIT, useDebouncedValue } from '../../lib/listLimits';
import type { AppStatus, CreditInstallment, CreditSummary, PageKey } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { notifyMobileAction } from '../components/actionToast';
import { clearCreditFocusPayload, readCreditFocusPayload } from '../deepLinks';

interface CreditsScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type CreditFilter = 'todos' | 'aberto' | 'vencidos' | 'quitado';
type CreditStatusTone = 'ok' | 'warn' | 'danger' | 'neutral';

type ReceiveState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  amount: string;
  method: CreditPaymentMethod | '';
  redistribute: boolean;
  moveShortfallToNext: boolean;
};

type EditInstallmentState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  amount: string;
  dueDate: string;
  reason: string;
  redistributeDifferenceToNext: boolean;
};

type CorrectionState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  mode: 'estorno' | 'complemento';
  amount: string;
  method: CreditPaymentMethod | '';
  reason: string;
};

const RECEIPTS_FOCUS_SALE_KEY = 'smart-loja:receipts-focus-sale-v1';

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

function installmentStatusTone(installment: CreditInstallment): CreditStatusTone {
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

function nextInstallmentAfter(credit: CreditSummary, installment: CreditInstallment): CreditInstallment | null {
  return [...credit.installments]
    .filter((item) => item.number > installment.number)
    .sort((a, b) => a.number - b.number)[0] ?? null;
}

function installmentInputDate(value: string): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function creditPaidTotal(credit: CreditSummary): number {
  return Math.max(0, Number(credit.total || 0) - Number(credit.balance || 0));
}

function creditStatusInfo(credit: CreditSummary): { label: string; tone: CreditStatusTone; detail: string } {
  const paidCount = credit.installments.filter((item) => installmentStatusLabel(item) === 'Paga').length;
  const openCount = creditOpenInstallments(credit).length;
  const overdueCount = credit.installments.filter(isOverdue).length;

  if (credit.status === 'quitado' || Number(credit.balance || 0) <= 0.009) {
    return { label: 'Quitado', tone: 'ok', detail: 'Todas as parcelas estão pagas.' };
  }

  if (overdueCount > 0) {
    return { label: 'Vencido', tone: 'danger', detail: `${formatNumber(overdueCount)} parcela(s) vencida(s).` };
  }

  if (paidCount > 0) {
    return { label: 'Parcial', tone: 'warn', detail: `${formatNumber(paidCount)}/${formatNumber(credit.installments.length)} parcela(s) pagas.` };
  }

  return { label: 'Aberto', tone: 'neutral', detail: `${formatNumber(openCount)} parcela(s) para receber.` };
}

function nextCreditActionLabel(credit: CreditSummary): string {
  const next = creditOpenInstallments(credit)[0];
  if (!next) return 'Nenhuma parcela em aberto';
  return `${installmentStatusLabel(next)} · parcela ${formatNumber(next.number)}/${formatNumber(credit.installments.length)} · vence ${dateOnly(next.due_date)}`;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'C';
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first ?? 'C'}${second ?? 'L'}`.toUpperCase();
}

export function CreditsScreen({ status, refreshToken, onNavigate, onRefresh }: CreditsScreenProps): JSX.Element {
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [visibleCreditCount, setVisibleCreditCount] = useState(COMPACT_CREDIT_LIMIT);
  const [filter, setFilter] = useState<CreditFilter>('aberto');
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [receive, setReceive] = useState<ReceiveState | null>(null);
  const [editInstallment, setEditInstallment] = useState<EditInstallmentState | null>(null);
  const [correction, setCorrection] = useState<CorrectionState | null>(null);
  const [paymentReview, setPaymentReview] = useState<CreditPaymentReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [deepLinkFocusHandled, setDeepLinkFocusHandled] = useState(false);

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
    const term = debouncedQuery.trim().toLowerCase();
    return credits.filter((credit) => {
      const hasOverdue = credit.installments.some(isOverdue);
      const matchesFilter =
        filter === 'todos'
        || (filter === 'aberto' && credit.status === 'aberto')
        || (filter === 'vencidos' && hasOverdue)
        || (filter === 'quitado' && credit.status === 'quitado');
      const installmentText = credit.installments.map((item) => `parcela ${item.number} ${installmentStatusLabel(item)} ${item.due_date}`).join(' ');
      const matchesTerm = !term || [
        credit.customer_name,
        credit.customer_phone,
        credit.customer_whatsapp,
        String(credit.sale_number),
        `nota ${credit.sale_number}`,
        `venda ${credit.sale_number}`,
        credit.status,
        installmentText,
      ].some((value) => String(value || '').toLowerCase().includes(term));
      return matchesFilter && matchesTerm;
    });
  }, [credits, debouncedQuery, filter]);

  useEffect(() => {
    setVisibleCreditCount(debouncedQuery.trim() ? SEARCH_RESULT_LIMIT : COMPACT_CREDIT_LIMIT);
  }, [debouncedQuery, filter]);

  const visibleCredits = useMemo(() => filteredCredits.slice(0, visibleCreditCount), [filteredCredits, visibleCreditCount]);

  function toggleCreditExpanded(creditId: string): void {
    setExpandedCredits((current) => ({ ...current, [creditId]: !current[creditId] }));
  }

  function openReceiptsForCredit(credit: CreditSummary, installment?: CreditInstallment): void {
    try {
      window.localStorage.setItem(RECEIPTS_FOCUS_SALE_KEY, JSON.stringify({
        sale_number: credit.sale_number,
        credit_id: credit.id,
        installment_number: installment?.number,
        created_at: Date.now(),
      }));
    } catch {
      // Sem ação: se o navegador bloquear storage, a aba Comprovantes ainda abre normalmente.
    }
    const message = installment ? 'Abrindo o recibo desta parcela na aba Comprovantes.' : 'Abrindo o extrato desta nota na aba Comprovantes.';
    setFeedback({ tone: 'info', text: message });
    notifyMobileAction({ title: installment ? 'Recibo da parcela' : 'Extrato da nota', message, tone: 'info', page: 'receipts', actionLabel: 'Ver' });
    onNavigate('receipts');
  }

  function openReceive(credit: CreditSummary, installment: CreditInstallment): void {
    if (installment.status === 'pago') {
      setFeedback({ tone: 'error', text: 'Essa parcela já está paga. Escolha outra parcela em aberto.' });
      return;
    }
    const amount = remainingOf(installment);
    setFeedback({ tone: 'info', text: `Recebimento da parcela ${formatNumber(installment.number)} aberto sem sair do ponto atual da lista.` });
    setPaymentReview(null);
    setReceive({
      credit,
      installment,
      amount: amount.toFixed(2),
      method: 'dinheiro',
      redistribute: credit.installments.some((item) => item.number > installment.number && item.status !== 'pago'),
      moveShortfallToNext: false,
    });
  }

  function openEditInstallment(credit: CreditSummary, installment: CreditInstallment): void {
    setFeedback({ tone: 'info', text: 'Ajuste aberto. Edite valor/vencimento com motivo para manter auditoria.' });
    setEditInstallment({
      credit,
      installment,
      amount: Number(installment.amount || 0).toFixed(2),
      dueDate: installmentInputDate(installment.due_date),
      reason: '',
      redistributeDifferenceToNext: Boolean(nextInstallmentAfter(credit, installment)),
    });
  }

  function openCorrection(credit: CreditSummary, installment: CreditInstallment, mode: 'estorno' | 'complemento'): void {
    const defaultAmount = mode === 'estorno' ? Math.max(0, paidOf(installment)) : Math.max(0, remainingOf(installment));
    setFeedback({ tone: 'info', text: mode === 'estorno' ? 'Informe o valor errado para estornar com motivo.' : 'Informe o complemento que faltou receber.' });
    setCorrection({ credit, installment, mode, amount: defaultAmount.toFixed(2), method: 'dinheiro', reason: '' });
  }

  async function submitEditInstallment(): Promise<void> {
    if (!editInstallment || saving) return;
    const amountPreview = parseBrazilianMoneyInput(editInstallment.amount);
    const reason = editInstallment.reason.trim();
    if (!amountPreview.ok) {
      setFeedback({ tone: 'error', text: amountPreview.message });
      return;
    }
    if (!editInstallment.dueDate) {
      setFeedback({ tone: 'error', text: 'Informe o vencimento correto da parcela.' });
      return;
    }
    if (reason.length < 6) {
      setFeedback({ tone: 'error', text: 'Informe um motivo com pelo menos 6 letras para auditoria.' });
      return;
    }
    setSaving(true);
    try {
      await api.adjustCreditInstallment({
        request_id: requestId('credit-edit'),
        credit_id: editInstallment.credit.id,
        installment_id: editInstallment.installment.id,
        amount: amountPreview.amount,
        due_date: editInstallment.dueDate,
        reason,
        redistribute_difference_to_next: editInstallment.redistributeDifferenceToNext,
      });
      setEditInstallment(null);
      setFeedback({ tone: 'success', text: 'Parcela ajustada com auditoria. Valor, vencimento e saldo foram recalculados.' });
      await loadCredits();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function submitCorrection(): Promise<void> {
    if (!correction || saving) return;
    const amountPreview = parseBrazilianMoneyInput(correction.amount);
    const reason = correction.reason.trim();
    if (!amountPreview.ok) {
      setFeedback({ tone: 'error', text: amountPreview.message });
      return;
    }
    if (!correction.method) {
      setFeedback({ tone: 'error', text: 'Escolha a forma do acerto para o caixa.' });
      return;
    }
    if (reason.length < 6) {
      setFeedback({ tone: 'error', text: 'Informe o motivo da correção para auditoria.' });
      return;
    }
    setSaving(true);
    try {
      if (correction.mode === 'complemento') {
        await api.receiveInstallment({
          request_id: requestId('credit-complement'),
          credit_id: correction.credit.id,
          installment_id: correction.installment.id,
          amount: amountPreview.amount,
          method: correction.method,
          settle_with_redistribution: false,
          user_confirmed: true,
          correction_reason: reason,
        });
      } else {
        await api.correctCreditPayment({
          request_id: requestId('credit-refund'),
          credit_id: correction.credit.id,
          installment_id: correction.installment.id,
          amount: amountPreview.amount,
          method: correction.method,
          reason,
        });
      }
      setCorrection(null);
      setFeedback({ tone: 'success', text: correction.mode === 'estorno' ? 'Estorno lançado com auditoria e caixa ajustado.' : 'Complemento recebido com auditoria.' });
      await loadCredits();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
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
        move_shortfall_to_next: receive.moveShortfallToNext,
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
      notifyMobileAction({
        title: 'Parcela recebida',
        message: `${receive.credit.customer_name} · parcela ${formatNumber(receive.installment.number)} lançada no caixa e no crediário.`,
        tone: 'success',
        page: 'receipts',
        actionLabel: 'Comprovante',
      });
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

  useEffect(() => {
    if (deepLinkFocusHandled || !credits.length || loading) return;
    const focus = readCreditFocusPayload();
    if (!focus) {
      setDeepLinkFocusHandled(true);
      return;
    }
    const targetCredit = credits.find((credit) =>
      (focus.credit_id && credit.id === focus.credit_id)
      || (focus.sale_number && Number(credit.sale_number) === Number(focus.sale_number))
    );
    if (!targetCredit) {
      clearCreditFocusPayload();
      setDeepLinkFocusHandled(true);
      setFeedback({ tone: 'info', text: 'Abri o Crediário, mas não encontrei a conta do alerta. Use a busca pelo cliente ou venda.' });
      return;
    }

    const targetInstallment = targetCredit.installments.find((installment) =>
      (focus.installment_id && installment.id === focus.installment_id)
      || (focus.installment_number && installment.number === focus.installment_number)
    ) ?? creditOpenInstallments(targetCredit)[0] ?? targetCredit.installments[0];

    setFilter(targetCredit.status === 'quitado' ? 'todos' : 'aberto');
    setQuery(String(targetCredit.sale_number || targetCredit.customer_name || ''));
    setVisibleCreditCount((count) => Math.max(count, COMPACT_CREDIT_LIMIT));
    setExpandedCredits((current) => ({ ...current, [targetCredit.id]: true }));
    window.setTimeout(() => {
      document.querySelector(`[data-credit-id="${targetCredit.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);

    if (focus.action === 'receive' && targetInstallment && targetInstallment.status !== 'pago' && remainingOf(targetInstallment) > 0.009) {
      openReceive(targetCredit, targetInstallment);
    } else if (focus.action === 'receipt' && targetInstallment) {
      openReceiptsForCredit(targetCredit, targetInstallment);
    } else {
      setFeedback({ tone: 'success', text: `Conta da venda #${String(targetCredit.sale_number || 0).padStart(4, '0')} aberta a partir da notificação.` });
    }
    clearCreditFocusPayload();
    setDeepLinkFocusHandled(true);
  }, [credits, deepLinkFocusHandled, loading]);

  return (
    <div className="mapp-screen mapp-credits-screen">
      <section className="mapp-mini-stat-grid mapp-credits-stats">
        <StatCard label="Em aberto" value={formatCurrency(summary.openBalance)} detail={`${formatNumber(summary.openCount)} crediário(s)`} icon="crediario" tone="purple" />
        <StatCard label="Vencidos" value={formatCurrency(summary.overdueTotal)} detail={`${formatNumber(summary.overdueCount)} parcela(s)`} icon="auditoria_logs" tone="orange" />
        <StatCard label="Clientes" value={formatNumber(status?.dashboard.credits_active_customers)} detail="com crediário ativo" icon="clientes" tone="sky" />
        <StatCard label="Próx. venc." value={summary.nextOpen ? dateOnly(summary.nextOpen.due_date) : '-'} detail={summary.nextOpen ? formatCurrency(remainingOf(summary.nextOpen)) : 'sem parcelas'} icon="comprovantes" tone="green" />
      </section>

      <section className="mapp-success-card mapp-credit-help-card">
        <strong>Receba parcelas com conferência</strong>
        <span>Toque na nota para abrir/recolher. Agora você pode editar vencimento/valor, receber, lançar complemento ou estornar valor errado com auditoria.</span>
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, venda, telefone ou status" />
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

      {editInstallment ? (
        <div className="mapp-credit-receive-backdrop" role="presentation" onClick={() => setEditInstallment(null)}>
          <section className="mapp-form-panel mapp-receive-panel mapp-receive-drawer" role="dialog" aria-modal="true" aria-label="Editar parcela" onClick={(event) => event.stopPropagation()}>
            <span className="mapp-receive-drawer-grip" aria-hidden="true" />
            <div className="mapp-form-head">
              <span className="mapp-form-icon tone-purple"><InlineIcon name="crediario" size={24} /></span>
              <div>
                <strong>Editar parcela {formatNumber(editInstallment.installment.number)}</strong>
                <p>{editInstallment.credit.customer_name} · venda #{String(editInstallment.credit.sale_number).padStart(4, '0')}</p>
              </div>
            </div>
            <div className="mapp-sale-total-box">
              <div><span>Valor atual</span><strong>{formatCurrency(editInstallment.installment.amount)}</strong></div>
              <div><span>Pago</span><strong>{formatCurrency(paidOf(editInstallment.installment))}</strong></div>
              <div><span>Saldo</span><strong>{formatCurrency(remainingOf(editInstallment.installment))}</strong></div>
            </div>
            <div className="mapp-form-grid">
              <label>
                <span>Novo valor da parcela</span>
                <input inputMode="decimal" value={editInstallment.amount} onChange={(event) => setEditInstallment({ ...editInstallment, amount: event.target.value })} placeholder="Ex.: 100,00" />
              </label>
              <label>
                <span>Novo vencimento</span>
                <input type="date" value={editInstallment.dueDate} onChange={(event) => setEditInstallment({ ...editInstallment, dueDate: event.target.value })} />
              </label>
              <label className="span-2 mapp-check-field">
                <input type="checkbox" checked={editInstallment.redistributeDifferenceToNext} onChange={(event) => setEditInstallment({ ...editInstallment, redistributeDifferenceToNext: event.target.checked })} disabled={!nextInstallmentAfter(editInstallment.credit, editInstallment.installment)} />
                <span>Compensar diferença na próxima parcela para manter o total da nota</span>
              </label>
              <label className="span-2">
                <span>Motivo obrigatório</span>
                <textarea value={editInstallment.reason} onChange={(event) => setEditInstallment({ ...editInstallment, reason: event.target.value })} placeholder="Ex.: cliente pediu mudança de vencimento / valor lançado errado" rows={3} />
              </label>
            </div>
            <section className="mapp-credit-payment-review ok">
              <strong>Prévia segura</strong>
              <p>Não apaga histórico. O ajuste recalcula saldo, mantém auditoria e bloqueia valor menor que o já pago.</p>
            </section>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-secondary-button" onClick={() => setEditInstallment(null)}>Cancelar</button>
              <button type="button" className="mapp-primary-button" onClick={() => void submitEditInstallment()} disabled={saving}>{saving ? 'Salvando...' : 'Salvar ajuste'}</button>
            </div>
          </section>
        </div>
      ) : null}

      {correction ? (
        <div className="mapp-credit-receive-backdrop" role="presentation" onClick={() => setCorrection(null)}>
          <section className="mapp-form-panel mapp-receive-panel mapp-receive-drawer" role="dialog" aria-modal="true" aria-label="Corrigir pagamento" onClick={(event) => event.stopPropagation()}>
            <span className="mapp-receive-drawer-grip" aria-hidden="true" />
            <div className="mapp-form-head">
              <span className="mapp-form-icon tone-purple"><InlineIcon name="crediario" size={24} /></span>
              <div>
                <strong>{correction.mode === 'estorno' ? 'Estornar valor errado' : 'Receber complemento'}</strong>
                <p>{correction.credit.customer_name} · parcela {formatNumber(correction.installment.number)}</p>
              </div>
            </div>
            <div className="mapp-sale-total-box">
              <div><span>Original</span><strong>{formatCurrency(correction.installment.amount)}</strong></div>
              <div><span>Pago</span><strong>{formatCurrency(paidOf(correction.installment))}</strong></div>
              <div><span>Saldo</span><strong>{formatCurrency(remainingOf(correction.installment))}</strong></div>
            </div>
            <div className="mapp-form-grid">
              <label>
                <span>{correction.mode === 'estorno' ? 'Valor a estornar' : 'Valor complementar'}</span>
                <input inputMode="decimal" value={correction.amount} onChange={(event) => setCorrection({ ...correction, amount: event.target.value })} placeholder="Ex.: 10,00" />
              </label>
              <label>
                <span>Forma no caixa</span>
                <select value={correction.method} onChange={(event) => setCorrection({ ...correction, method: event.target.value as CreditPaymentMethod | '' })}>
                  <option value="">Escolha</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="span-2">
                <span>Motivo obrigatório</span>
                <textarea value={correction.reason} onChange={(event) => setCorrection({ ...correction, reason: event.target.value })} placeholder="Ex.: valor digitado errado / forma errada / cliente pagou complemento" rows={3} />
              </label>
            </div>
            <section className={`mapp-credit-payment-review ${correction.mode === 'estorno' ? 'blocked' : 'ok'}`}>
              <strong>{correction.mode === 'estorno' ? 'Estorno com caixa' : 'Complemento seguro'}</strong>
              <p>{correction.mode === 'estorno' ? 'Lança saída no caixa, devolve saldo ao crediário e preserva histórico.' : 'Lança novo recebimento sem apagar o pagamento anterior.'}</p>
            </section>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-secondary-button" onClick={() => setCorrection(null)}>Cancelar</button>
              <button type="button" className="mapp-primary-button" onClick={() => void submitCorrection()} disabled={saving}>{saving ? 'Corrigindo...' : 'Confirmar correção'}</button>
            </div>
          </section>
        </div>
      ) : null}

      {receive ? (
        <div className="mapp-credit-receive-backdrop" role="presentation" onClick={() => { setReceive(null); setPaymentReview(null); }}>
        <section className="mapp-form-panel mapp-receive-panel mapp-receive-drawer" role="dialog" aria-modal="true" aria-label="Receber parcela" onClick={(event) => event.stopPropagation()}>
          <span className="mapp-receive-drawer-grip" aria-hidden="true" />
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
              <span>Abater sobra nas próximas parcelas quando pagar a mais</span>
            </label>
            <label className="span-2 mapp-check-field">
              <input type="checkbox" checked={receive.moveShortfallToNext} onChange={(event) => { setReceive({ ...receive, moveShortfallToNext: event.target.checked }); setPaymentReview(null); }} disabled={!nextInstallmentAfter(receive.credit, receive.installment)} />
              <span>Se pagar a menos, jogar a falta para a próxima parcela</span>
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
                <span>Falta jogada para próxima <b>{receive.moveShortfallToNext && paymentReview.missing > 0 ? formatCurrency(paymentReview.missing) : 'Não haverá'}</b></span>
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
      </div>
      ) : null}

      {loading ? <div className="mapp-inline-status">Carregando crediário...</div> : null}

      {filteredCredits.length ? (
        <>
        <section className="mapp-credit-list" aria-label="Crediários para receber">
          {visibleCredits.map((credit) => {
            const openInstallments = creditOpenInstallments(credit);
            const nextInstallment = openInstallments[0] ?? credit.installments[0];
            const paidCount = credit.installments.filter((item) => installmentStatusLabel(item) === 'Paga').length;
            const statusInfo = creditStatusInfo(credit);
            const isExpanded = Boolean(expandedCredits[credit.id]);
            const visibleInstallments = isExpanded ? credit.installments : (nextInstallment ? [nextInstallment] : []);
            const hiddenInstallments = Math.max(0, credit.installments.length - visibleInstallments.length);
            return (
              <article key={credit.id} data-credit-id={credit.id} className={`mapp-credit-card mapp-credit-card-operations ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <button
                  type="button"
                  className="mapp-credit-note-head mapp-credit-note-toggle"
                  onClick={() => toggleCreditExpanded(credit.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Recolher' : 'Abrir'} parcelas da venda ${String(credit.sale_number).padStart(4, '0')}`}
                >
                  <span><InlineIcon name="crediario" size={24} /></span>
                  <div>
                    <strong>{credit.customer_name || 'Cliente sem nome'}</strong>
                    <small>Venda #{String(credit.sale_number).padStart(4, '0')} · {formatDateTime(credit.created_at)}</small>
                    <small>{statusInfo.detail} · {nextCreditActionLabel(credit)}</small>
                  </div>
                  <em className={statusInfo.tone}>{statusInfo.label}</em>
                </button>
                <div className="mapp-credit-totals mapp-credit-totals-compact">
                  <div><span>Total</span><strong>{formatCurrency(credit.total)}</strong></div>
                  <div><span>Pago</span><strong>{formatCurrency(creditPaidTotal(credit))}</strong></div>
                  <div><span>Saldo</span><strong>{formatCurrency(credit.balance)}</strong></div>
                  <div><span>Contato</span><strong>{credit.customer_whatsapp || credit.customer_phone || '-'}</strong></div>
                </div>
                <div className="mapp-credit-progress" aria-label={`${paidCount} de ${credit.installments.length} parcelas pagas`}>
                  <span style={{ width: `${credit.installments.length ? Math.round((paidCount / credit.installments.length) * 100) : 0}%` }} />
                </div>
                {nextInstallment ? (
                  <div className="mapp-credit-next-strip">
                    <span>Próxima cobrança</span>
                    <strong>Parcela {formatNumber(nextInstallment.number)}/{formatNumber(credit.installments.length)}</strong>
                    <small>{dateOnly(nextInstallment.due_date)} · {formatCurrency(remainingOf(nextInstallment))}</small>
                  </div>
                ) : null}
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
                            <span>Saldo <b>{formatCurrency(remainingOf(installment))}</b></span>
                          </div>
                        </div>
                        <b className={`mapp-installment-status ${tone}`}>{statusLabel}</b>
                        <div className="mapp-installment-actions mapp-installment-actions-slim">
                          <button type="button" className="mapp-secondary-button" onClick={() => openReceiptsForCredit(credit, installment)}>Ver recibo</button>
                          <button type="button" className="mapp-secondary-button" onClick={() => openEditInstallment(credit, installment)}>Editar</button>
                          {paidOf(installment) > 0.009 ? (
                            <button type="button" className="mapp-secondary-button" onClick={() => openCorrection(credit, installment, 'estorno')}>Estornar</button>
                          ) : null}
                          {installment.status !== 'pago' && remainingOf(installment) > 0.009 ? (
                            <>
                              <button type="button" className="mapp-secondary-button" onClick={() => openCorrection(credit, installment, 'complemento')}>Complemento</button>
                              <button type="button" className="mapp-primary-button" onClick={() => openReceive(credit, installment)}>Receber</button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hiddenInstallments ? (
                  <button type="button" className="mapp-credit-expand-button" onClick={() => toggleCreditExpanded(credit.id)}>
                    Ver todas as parcelas ({formatNumber(credit.installments.length)})
                  </button>
                ) : null}
                {isExpanded && credit.installments.length > 1 ? (
                  <button type="button" className="mapp-credit-collapse-button" onClick={() => toggleCreditExpanded(credit.id)}>
                    Recolher parcelas e deixar compacto
                  </button>
                ) : null}
                <div className="mapp-credit-note-actions mapp-credit-note-actions-muted" aria-label="Ações do crediário">
                  {nextInstallment && credit.status !== 'quitado' ? (
                    <button type="button" className="mapp-credit-primary-action" onClick={() => openReceive(credit, nextInstallment)}>
                      Receber próxima parcela
                    </button>
                  ) : null}
                  <button type="button" className="mapp-secondary-button" onClick={() => openReceiptsForCredit(credit)}>Ver extrato da nota</button>
                </div>
              </article>
            );
          })}
        </section>
        {visibleCredits.length < filteredCredits.length && !debouncedQuery.trim() ? (
          <button type="button" className="mapp-secondary-button mapp-list-more-button" onClick={() => setVisibleCreditCount((count) => count + LOAD_MORE_STEP)}>
            Carregar mais crediários ({formatNumber(visibleCredits.length)} de {formatNumber(filteredCredits.length)})
          </button>
        ) : null}
        </>
      ) : !loading ? (
        <EmptyState icon="crediario" title="Sem crediário encontrado" detail={query ? 'Tente buscar por outro cliente ou venda.' : 'Vendas no crediário aparecerão aqui.'} actionLabel="Abrir PDV" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}

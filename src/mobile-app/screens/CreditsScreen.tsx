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
type CreditMode = 'simples' | 'avancado';

type ReceiveState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  amount: string;
  method: CreditPaymentMethod | '';
  redistribute: boolean;
  moveShortfallToNext: boolean;
};

type AutomaticReceivePlan = {
  parsedOk: boolean;
  amount: number;
  installmentOpen: number;
  creditOpen: number;
  next: CreditInstallment | null;
  redistribute: boolean;
  moveShortfallToNext: boolean;
  overpay: number;
  shortfall: number;
  title: string;
  detail: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
};

type EditInstallmentState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  amount: string;
  dueDate: string;
  reason: string;
  redistributeDifferenceToNext: boolean;
  confirmed: boolean;
};

type CorrectionState = {
  credit: CreditSummary;
  installment: CreditInstallment;
  mode: 'estorno' | 'complemento';
  amount: string;
  method: CreditPaymentMethod | '';
  reason: string;
  confirmed: boolean;
};

type CorrectionMenuState = {
  credit: CreditSummary;
  installment: CreditInstallment;
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

function nextOpenInstallmentAfter(credit: CreditSummary, installment: CreditInstallment): CreditInstallment | null {
  return [...credit.installments]
    .filter((item) => item.number > installment.number && item.status !== 'pago' && remainingOf(item) > 0.009)
    .sort((a, b) => a.number - b.number)[0] ?? null;
}

function automaticReceivePlan(receive: ReceiveState): AutomaticReceivePlan {
  const parsed = parseBrazilianMoneyInput(receive.amount);
  const installmentOpen = remainingOf(receive.installment);
  const creditOpen = Math.max(0, Number(receive.credit.balance || 0));
  const next = nextOpenInstallmentAfter(receive.credit, receive.installment);
  if (!parsed.ok) {
    return {
      parsedOk: false,
      amount: 0,
      installmentOpen,
      creditOpen,
      next,
      redistribute: false,
      moveShortfallToNext: false,
      overpay: 0,
      shortfall: 0,
      title: 'Digite o valor recebido',
      detail: 'Depois de digitar, o sistema calcula sozinho se precisa abater sobra ou jogar falta para a próxima parcela.',
      tone: 'neutral',
    };
  }
  const amount = parsed.amount;
  const overpay = Math.max(0, Math.round((amount - installmentOpen) * 100) / 100);
  const shortfall = Math.max(0, Math.round((installmentOpen - amount) * 100) / 100);
  if (amount > creditOpen + 0.009) {
    return {
      parsedOk: true,
      amount,
      installmentOpen,
      creditOpen,
      next,
      redistribute: false,
      moveShortfallToNext: false,
      overpay,
      shortfall: 0,
      title: 'Valor maior que o saldo total',
      detail: 'Confira o valor digitado. Ele ficou maior que tudo que o cliente ainda deve.',
      tone: 'danger',
    };
  }
  if (overpay > 0.009) {
    return {
      parsedOk: true,
      amount,
      installmentOpen,
      creditOpen,
      next,
      redistribute: true,
      moveShortfallToNext: false,
      overpay,
      shortfall: 0,
      title: 'Automático: cliente pagou a mais',
      detail: `Vou quitar esta parcela e descontar ${formatCurrency(overpay)} nas próximas parcelas.`,
      tone: 'ok',
    };
  }
  if (shortfall > 0.009 && next) {
    return {
      parsedOk: true,
      amount,
      installmentOpen,
      creditOpen,
      next,
      redistribute: false,
      moveShortfallToNext: true,
      overpay: 0,
      shortfall,
      title: 'Automático: cliente pagou a menos',
      detail: `Vou fechar esta parcela com o valor recebido e colocar ${formatCurrency(shortfall)} na próxima parcela.`,
      tone: 'warn',
    };
  }
  if (shortfall > 0.009) {
    return {
      parsedOk: true,
      amount,
      installmentOpen,
      creditOpen,
      next,
      redistribute: false,
      moveShortfallToNext: false,
      overpay: 0,
      shortfall,
      title: 'Pagamento parcial na última parcela',
      detail: `Não existe próxima parcela. O restante de ${formatCurrency(shortfall)} ficará em aberto nesta parcela.`,
      tone: 'warn',
    };
  }
  return {
    parsedOk: true,
    amount,
    installmentOpen,
    creditOpen,
    next,
    redistribute: false,
    moveShortfallToNext: false,
    overpay: 0,
    shortfall: 0,
    title: 'Automático: valor exato',
    detail: 'Vou quitar esta parcela sem mexer nas próximas.',
    tone: 'ok',
  };
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

function pluralLabel(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function creditStatusInfo(credit: CreditSummary): { label: string; tone: CreditStatusTone; detail: string } {
  const paidCount = credit.installments.filter((item) => installmentStatusLabel(item) === 'Paga').length;
  const openCount = creditOpenInstallments(credit).length;
  const overdueCount = credit.installments.filter(isOverdue).length;

  if (credit.status === 'quitado' || Number(credit.balance || 0) <= 0.009) {
    return { label: 'Quitado', tone: 'ok', detail: 'Todas as parcelas estão pagas.' };
  }

  if (overdueCount > 0) {
    return { label: 'Vencido', tone: 'danger', detail: `${pluralLabel(overdueCount, 'parcela vencida', 'parcelas vencidas')}.` };
  }

  if (paidCount > 0) {
    return { label: 'Parcial', tone: 'warn', detail: `${formatNumber(paidCount)}/${formatNumber(credit.installments.length)} parcelas pagas.` };
  }

  return { label: 'Aberto', tone: 'neutral', detail: `${pluralLabel(openCount, 'parcela para receber', 'parcelas para receber')}.` };
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
  const [correctionMenu, setCorrectionMenu] = useState<CorrectionMenuState | null>(null);
  const [creditMode, setCreditMode] = useState<CreditMode>('simples');
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
    setCorrectionMenu(null);
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
      redistribute: false,
      moveShortfallToNext: false,
    });
  }

  function openEditInstallment(credit: CreditSummary, installment: CreditInstallment): void {
    setCorrectionMenu(null);
    setFeedback({ tone: 'info', text: 'Ajuste aberto. Edite valor/vencimento com motivo para manter auditoria.' });
    setEditInstallment({
      credit,
      installment,
      amount: Number(installment.amount || 0).toFixed(2),
      dueDate: installmentInputDate(installment.due_date),
      reason: '',
      redistributeDifferenceToNext: Boolean(nextInstallmentAfter(credit, installment)),
      confirmed: false,
    });
  }

  function openCorrection(credit: CreditSummary, installment: CreditInstallment, mode: 'estorno' | 'complemento'): void {
    setCorrectionMenu(null);
    const defaultAmount = mode === 'estorno' ? Math.max(0, paidOf(installment)) : Math.max(0, remainingOf(installment));
    setFeedback({ tone: 'info', text: mode === 'estorno' ? 'Informe o valor errado para estornar com motivo.' : 'Informe o complemento que faltou receber.' });
    setCorrection({ credit, installment, mode, amount: defaultAmount.toFixed(2), method: 'dinheiro', reason: '', confirmed: false });
  }

  function openCorrectionMenu(credit: CreditSummary, installment: CreditInstallment): void {
    setCorrectionMenu({ credit, installment });
    setFeedback({ tone: 'info', text: 'Escolha o que quer corrigir. As ações perigosas continuam com motivo e confirmação.' });
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
    if (!editInstallment.confirmed) {
      setFeedback({ tone: 'error', text: 'Marque a confirmação de segurança antes de salvar o ajuste.' });
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
    if (!correction.confirmed) {
      setFeedback({ tone: 'error', text: 'Marque a confirmação de segurança antes de corrigir o pagamento.' });
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

  function receivePlan(receiveState = receive): AutomaticReceivePlan | null {
    return receiveState ? automaticReceivePlan(receiveState) : null;
  }

  function buildCurrentReview(): CreditPaymentReview | null {
    if (!receive || saving) return null;
    const plan = automaticReceivePlan(receive);
    return buildCreditPaymentReview({
      credit: receive.credit,
      installment: receive.installment,
      rawAmount: receive.amount,
      method: receive.method,
      redistribute: creditMode === 'avancado' ? receive.redistribute : plan.redistribute,
    });
  }

  function prepareReceiveConfirmation(): void {
    const review = buildCurrentReview();
    if (!review) return;
    setPaymentReview(review);
    if (!review.ok) setFeedback({ tone: 'error', text: review.message });
    else setFeedback({ tone: review.severity === 'exact' ? 'info' : 'success', text: review.message });
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
    const plan = automaticReceivePlan(receive);
    const autoRedistribute = creditMode === 'avancado' ? receive.redistribute : plan.redistribute;
    const autoMoveShortfall = creditMode === 'avancado' ? receive.moveShortfallToNext : plan.moveShortfallToNext;
    setSaving(true);
    try {
      await api.receiveInstallment({
        request_id: requestId('pay-mobile'),
        credit_id: receive.credit.id,
        installment_id: receive.installment.id,
        amount: review.amount,
        method: review.method,
        settle_with_redistribution: autoRedistribute,
        move_shortfall_to_next: autoMoveShortfall,
        automatic_balance_rule: creditMode === 'avancado' ? 'manual_override' : plan.title,
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
    const exact = remainingOf(receive.installment);
    const updated = { ...receive, amount: exact.toFixed(2), redistribute: false, moveShortfallToNext: false };
    setReceive(updated);
    setPaymentReview(null);
    setFeedback({ tone: 'info', text: `Valor ajustado para ${formatBrazilianMoney(exact)}. O sistema vai quitar só esta parcela.` });
  }

  function setTotalOpenReceiveAmount(): void {
    if (!receive) return;
    const totalOpen = Math.max(0, Number(receive.credit.balance || 0));
    const updated = { ...receive, amount: totalOpen.toFixed(2), redistribute: totalOpen > remainingOf(receive.installment) + 0.009, moveShortfallToNext: false };
    setReceive(updated);
    setPaymentReview(null);
    setFeedback({ tone: 'info', text: `Valor ajustado para ${formatBrazilianMoney(totalOpen)}. Se passar da parcela, o sistema abate automaticamente nas próximas.` });
  }

  function onReceiveAmountChange(value: string): void {
    if (!receive) return;
    const nextState = { ...receive, amount: value };
    const plan = automaticReceivePlan(nextState);
    setReceive({ ...nextState, redistribute: plan.redistribute, moveShortfallToNext: plan.moveShortfallToNext });
    setPaymentReview(null);
    const preview = parseBrazilianMoneyInput(value);
    if (preview.ok) setFeedback({ tone: plan.tone === 'danger' ? 'error' : 'info', text: `${preview.formatted} · ${plan.detail}` });
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

  const editPreview = editInstallment ? (() => {
    const parsed = parseBrazilianMoneyInput(editInstallment.amount);
    const oldAmount = Number(editInstallment.installment.amount || 0);
    const paid = paidOf(editInstallment.installment);
    const next = nextInstallmentAfter(editInstallment.credit, editInstallment.installment);
    const newAmount = parsed.ok ? parsed.amount : oldAmount;
    const delta = Math.round((newAmount - oldAmount) * 100) / 100;
    const saldoAfter = Math.max(0, newAmount - paid);
    const nextAfter = next && editInstallment.redistributeDifferenceToNext ? Number(next.amount || 0) - delta : null;
    return { parsed, oldAmount, paid, newAmount, delta, saldoAfter, next, nextAfter };
  })() : null;

  const correctionPreview = correction ? (() => {
    const parsed = parseBrazilianMoneyInput(correction.amount);
    const amount = parsed.ok ? parsed.amount : 0;
    const paid = paidOf(correction.installment);
    const saldo = remainingOf(correction.installment);
    if (correction.mode === 'estorno') {
      return { parsed, amount, caixa: 'SAÍDA no caixa', paidAfter: Math.max(0, paid - amount), saldoAfter: saldo + amount, detail: 'O pagamento antigo fica no histórico e o caixa recebe uma saída de correção.' };
    }
    return { parsed, amount, caixa: 'ENTRADA no caixa', paidAfter: paid + amount, saldoAfter: Math.max(0, saldo - amount), detail: 'O complemento entra como novo recebimento, sem apagar o pagamento anterior.' };
  })() : null;

  return (
    <div className="mapp-screen mapp-credits-screen">
      <section className="mapp-mini-stat-grid mapp-credits-stats">
        <StatCard label="Em aberto" value={formatCurrency(summary.openBalance)} detail={`${pluralLabel(summary.openCount, 'crediário', 'crediários')}`} icon="crediario" tone="purple" />
        <StatCard label="Vencidos" value={formatCurrency(summary.overdueTotal)} detail={`${pluralLabel(summary.overdueCount, 'parcela', 'parcelas')}`} icon="auditoria_logs" tone="orange" />
        <StatCard label="Clientes" value={formatNumber(status?.dashboard.credits_active_customers)} detail="com crediário ativo" icon="clientes" tone="sky" />
        <StatCard label="Próximo vencimento" value={summary.nextOpen ? dateOnly(summary.nextOpen.due_date) : '-'} detail={summary.nextOpen ? formatCurrency(remainingOf(summary.nextOpen)) : 'sem parcelas'} icon="comprovantes" tone="green" />
      </section>

      <section className="mapp-success-card mapp-credit-help-card">
        <strong>Crediário fácil para operador leigo</strong>
        <span>Use o modo simples no dia a dia: receber, ver recibo e corrigir com assistente. Deixe o modo avançado só para responsável.</span>
      </section>

      <section className="mapp-credit-mode-card" aria-label="Modo da aba crediário">
        <div>
          <strong>Modo da tela</strong>
          <span>{creditMode === 'simples' ? 'Mostrando só ações essenciais para evitar erro.' : 'Ações avançadas liberadas para correção rápida.'}</span>
        </div>
        <div className="mapp-credit-mode-buttons">
          <button type="button" className={creditMode === 'simples' ? 'active' : ''} onClick={() => setCreditMode('simples')}>Simples</button>
          <button type="button" className={creditMode === 'avancado' ? 'active' : ''} onClick={() => setCreditMode('avancado')}>Avançado</button>
        </div>
      </section>

      {summary.overdueCount ? (
        <section className="mapp-stock-alert mapp-credit-alert">
          <span><InlineIcon name="crediario" size={24} /></span>
          <div>
            <strong>{pluralLabel(summary.overdueCount, 'parcela vencida', 'parcelas vencidas')}</strong>
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

      {correctionMenu ? (
        <div className="mapp-credit-receive-backdrop" role="presentation" onClick={() => setCorrectionMenu(null)}>
          <section className="mapp-form-panel mapp-receive-panel mapp-receive-drawer" role="dialog" aria-modal="true" aria-label="Assistente de correção" onClick={(event) => event.stopPropagation()}>
            <span className="mapp-receive-drawer-grip" aria-hidden="true" />
            <div className="mapp-form-head">
              <span className="mapp-form-icon tone-purple"><InlineIcon name="crediario" size={24} /></span>
              <div>
                <strong>O que você quer corrigir?</strong>
                <p>{correctionMenu.credit.customer_name} · parcela {formatNumber(correctionMenu.installment.number)}</p>
              </div>
            </div>
            <div className="mapp-credit-assistant-grid">
              <button type="button" onClick={() => openEditInstallment(correctionMenu.credit, correctionMenu.installment)}>
                <strong>Mudar valor ou vencimento</strong>
                <span>Use quando a parcela foi criada com preço ou data errada.</span>
              </button>
              {paidOf(correctionMenu.installment) > 0.009 ? (
                <button type="button" onClick={() => openCorrection(correctionMenu.credit, correctionMenu.installment, 'estorno')}>
                  <strong>Digitei valor pago errado</strong>
                  <span>Estorna com saída no caixa e mantém histórico.</span>
                </button>
              ) : null}
              {correctionMenu.installment.status !== 'pago' && remainingOf(correctionMenu.installment) > 0.009 ? (
                <button type="button" onClick={() => openCorrection(correctionMenu.credit, correctionMenu.installment, 'complemento')}>
                  <strong>Receber valor que faltou</strong>
                  <span>Lança complemento sem apagar pagamento anterior.</span>
                </button>
              ) : null}
              <button type="button" onClick={() => { openReceiptsForCredit(correctionMenu.credit, correctionMenu.installment); setCorrectionMenu(null); }}>
                <strong>Ver recibo/extrato</strong>
                <span>Abre comprovantes para conferir o histórico da venda.</span>
              </button>
            </div>
            <section className="mapp-credit-payment-review ok">
              <strong>Para usuário leigo</strong>
              <p>Correção não apaga pagamento antigo. Tudo pede motivo e mostra o impacto antes de salvar.</p>
            </section>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-secondary-button" onClick={() => setCorrectionMenu(null)}>Fechar</button>
            </div>
          </section>
        </div>
      ) : null}

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
                <input inputMode="decimal" value={editInstallment.amount} onChange={(event) => setEditInstallment({ ...editInstallment, amount: event.target.value, confirmed: false })} placeholder="Ex.: 100,00" />
              </label>
              <label>
                <span>Novo vencimento</span>
                <input type="date" value={editInstallment.dueDate} onChange={(event) => setEditInstallment({ ...editInstallment, dueDate: event.target.value, confirmed: false })} />
              </label>
              <label className="span-2 mapp-check-field">
                <input type="checkbox" checked={editInstallment.redistributeDifferenceToNext} onChange={(event) => setEditInstallment({ ...editInstallment, redistributeDifferenceToNext: event.target.checked, confirmed: false })} disabled={!nextInstallmentAfter(editInstallment.credit, editInstallment.installment)} />
                <span>Compensar diferença na próxima parcela para manter o total da nota</span>
              </label>
              <label className="span-2">
                <span>Motivo obrigatório</span>
                <textarea value={editInstallment.reason} onChange={(event) => setEditInstallment({ ...editInstallment, reason: event.target.value, confirmed: false })} placeholder="Ex.: cliente pediu mudança de vencimento / valor lançado errado" rows={3} />
              </label>
            </div>
            <section className="mapp-credit-payment-review ok">
              <strong>Prévia antes/depois</strong>
              {editPreview ? (
                <div className="mapp-credit-before-after">
                  <span>Antes: <b>{formatCurrency(editPreview.oldAmount)}</b></span>
                  <span>Depois: <b>{formatCurrency(editPreview.newAmount)}</b></span>
                  <span>Pago continua: <b>{formatCurrency(editPreview.paid)}</b></span>
                  <span>Saldo depois: <b>{formatCurrency(editPreview.saldoAfter)}</b></span>
                  <span>Próxima parcela: <b>{editPreview.next && editInstallment.redistributeDifferenceToNext && editPreview.nextAfter !== null ? formatCurrency(editPreview.nextAfter) : 'não altera'}</b></span>
                </div>
              ) : null}
              <p>Não apaga histórico. O ajuste recalcula saldo, mantém auditoria e bloqueia valor menor que o já pago.</p>
            </section>
            <label className="mapp-danger-ack">
              <input type="checkbox" checked={editInstallment.confirmed} onChange={(event) => setEditInstallment({ ...editInstallment, confirmed: event.target.checked })} />
              <span>Confirmo que conferi o antes/depois e quero salvar esta correção.</span>
            </label>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-secondary-button" onClick={() => setEditInstallment(null)}>Cancelar</button>
              <button type="button" className="mapp-primary-button" onClick={() => void submitEditInstallment()} disabled={saving || !editInstallment.confirmed}>{saving ? 'Salvando...' : 'Salvar ajuste'}</button>
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
                <input inputMode="decimal" value={correction.amount} onChange={(event) => setCorrection({ ...correction, amount: event.target.value, confirmed: false })} placeholder="Ex.: 10,00" />
              </label>
              <label>
                <span>Forma no caixa</span>
                <select value={correction.method} onChange={(event) => setCorrection({ ...correction, method: event.target.value as CreditPaymentMethod | '', confirmed: false })}>
                  <option value="">Escolha</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="span-2">
                <span>Motivo obrigatório</span>
                <textarea value={correction.reason} onChange={(event) => setCorrection({ ...correction, reason: event.target.value, confirmed: false })} placeholder="Ex.: valor digitado errado / forma errada / cliente pagou complemento" rows={3} />
              </label>
            </div>
            <section className={`mapp-credit-payment-review ${correction.mode === 'estorno' ? 'blocked' : 'ok'}`}>
              <strong>{correction.mode === 'estorno' ? 'Estorno com caixa' : 'Complemento seguro'}</strong>
              {correctionPreview ? (
                <div className="mapp-credit-before-after">
                  <span>Ação no caixa: <b>{correctionPreview.caixa}</b></span>
                  <span>Valor da correção: <b>{formatCurrency(correctionPreview.amount)}</b></span>
                  <span>Pago depois: <b>{formatCurrency(correctionPreview.paidAfter)}</b></span>
                  <span>Saldo depois: <b>{formatCurrency(correctionPreview.saldoAfter)}</b></span>
                </div>
              ) : null}
              <p>{correctionPreview?.detail || (correction.mode === 'estorno' ? 'Lança saída no caixa, devolve saldo ao crediário e preserva histórico.' : 'Lança novo recebimento sem apagar o pagamento anterior.')}</p>
            </section>
            <label className="mapp-danger-ack">
              <input type="checkbox" checked={correction.confirmed} onChange={(event) => setCorrection({ ...correction, confirmed: event.target.checked })} />
              <span>Confirmo que conferi o impacto no caixa e no saldo do cliente.</span>
            </label>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-secondary-button" onClick={() => setCorrection(null)}>Cancelar</button>
              <button type="button" className="mapp-primary-button" onClick={() => void submitCorrection()} disabled={saving || !correction.confirmed}>{saving ? 'Corrigindo...' : 'Confirmar correção'}</button>
            </div>
          </section>
        </div>
      ) : null}

      {receive ? (() => {
        const plan = automaticReceivePlan(receive);
        const activeRedistribute = creditMode === 'avancado' ? receive.redistribute : plan.redistribute;
        const activeMoveShortfall = creditMode === 'avancado' ? receive.moveShortfallToNext : plan.moveShortfallToNext;
        return (
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
            <div className={`span-2 mapp-credit-auto-box mapp-credit-auto-box-${plan.tone}`}>
              <strong>{plan.title}</strong>
              <span>{plan.detail}</span>
              {plan.next ? <small>Próxima parcela: {formatNumber(plan.next.number)}/{formatNumber(receive.credit.installments.length)} · vence {dateOnly(plan.next.due_date)}</small> : null}
            </div>
            {creditMode === 'avancado' ? (
              <div className="span-2 mapp-credit-advanced-rules">
                <strong>Avançado: alterar regra automática</strong>
                <label className="mapp-check-field">
                  <input type="checkbox" checked={receive.redistribute} onChange={(event) => { setReceive({ ...receive, redistribute: event.target.checked }); setPaymentReview(null); }} />
                  <span>Forçar desconto da sobra nas próximas parcelas</span>
                </label>
                <label className="mapp-check-field">
                  <input type="checkbox" checked={receive.moveShortfallToNext} onChange={(event) => { setReceive({ ...receive, moveShortfallToNext: event.target.checked }); setPaymentReview(null); }} disabled={!nextOpenInstallmentAfter(receive.credit, receive.installment)} />
                  <span>Forçar falta para a próxima parcela</span>
                </label>
              </div>
            ) : null}
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
                <span>Abatimento em próximas parcelas <b>{activeRedistribute && paymentReview.applyToFuture > 0 ? formatCurrency(paymentReview.applyToFuture) : 'Não haverá'}</b></span>
                <span>Falta jogada para próxima <b>{activeMoveShortfall && paymentReview.missing > 0 ? formatCurrency(paymentReview.missing) : 'Não haverá'}</b></span>
                <span>Forma de pagamento <b>{creditPaymentMethodLabel(paymentReview.method)}</b></span>
              </div>
              <small>Se recebeu errado, registre a correção com cuidado no caixa/crediário ou procure o responsável.</small>
            </section>
          ) : null}
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => { setReceive(null); setPaymentReview(null); }}>Cancelar</button>
            {paymentReview ? <button type="button" className="mapp-secondary-button" onClick={() => setPaymentReview(null)}>Corrigir valor</button> : null}
            {paymentReview && !paymentReview.ok ? <button type="button" className="mapp-secondary-button" onClick={setExactReceiveAmount}>Usar valor da parcela</button> : null}
            {paymentReview && !paymentReview.ok ? <button type="button" className="mapp-secondary-button" onClick={setTotalOpenReceiveAmount}>Usar saldo total</button> : null}
            {!paymentReview ? (
              <button type="button" className="mapp-primary-button" onClick={prepareReceiveConfirmation} disabled={saving}>{saving ? 'Conferindo...' : 'Conferir antes de receber'}</button>
            ) : paymentReview.ok ? (
              <button type="button" className="mapp-primary-button" onClick={() => void submitReceiveConfirmed()} disabled={saving}>
                {saving ? 'Recebendo...' : 'Confirmar recebimento'}
              </button>
            ) : null}
          </div>
        </section>
      </div>
        );
      })() : null}

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
                          {installment.status !== 'pago' && remainingOf(installment) > 0.009 ? (
                            <button type="button" className="mapp-primary-button" onClick={() => openReceive(credit, installment)}>Receber</button>
                          ) : null}
                          <button type="button" className="mapp-secondary-button strong" onClick={() => openCorrectionMenu(credit, installment)}>Corrigir</button>
                          {creditMode === 'avancado' ? (
                            <>
                              <button type="button" className="mapp-secondary-button" onClick={() => openEditInstallment(credit, installment)}>Editar</button>
                              {paidOf(installment) > 0.009 ? (
                                <button type="button" className="mapp-secondary-button" onClick={() => openCorrection(credit, installment, 'estorno')}>Estornar</button>
                              ) : null}
                              {installment.status !== 'pago' && remainingOf(installment) > 0.009 ? (
                                <button type="button" className="mapp-secondary-button" onClick={() => openCorrection(credit, installment, 'complemento')}>Complemento</button>
                              ) : null}
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

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { parseBrazilianMoneyInput } from '../../lib/creditPaymentGuard';
import type { AppStatus, CashMovement, CashSummary } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { notifyMobileAction } from '../components/actionToast';

interface CashScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onRefresh: () => void;
}

type CashFormMode = 'open' | 'movement' | 'close';
type FeedbackTone = 'success' | 'error' | 'info';

type Feedback = {
  tone: FeedbackTone;
  text: string;
};

function numberFromInput(value: string): number {
  const parsed = parseBrazilianMoneyInput(value);
  return parsed.ok ? parsed.amount : 0;
}

function movementLabel(type: string): string {
  return type === 'saida' ? 'Saída' : 'Entrada';
}

function methodLabel(method: string): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  if (method === 'ajuste') return 'Ajuste';
  return method || 'Dinheiro';
}

function toneForMovement(movement: CashMovement): 'green' | 'orange' {
  return movement.type === 'saida' ? 'orange' : 'green';
}

function StatusFeedback({ feedback }: { feedback: Feedback | null }): JSX.Element | null {
  if (!feedback) return null;
  return <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div>;
}

export function CashScreen({ status, refreshToken, onRefresh }: CashScreenProps): JSX.Element {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [mode, setMode] = useState<CashFormMode>('open');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [closingAmount, setClosingAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementMethod, setMovementMethod] = useState('dinheiro');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadCash = async () => {
    setLoading(true);
    try {
      const payload = await api.cashSummary();
      setSummary(payload);
      setClosingAmount(String(payload.expected_total.toFixed(2)));
      setMode(payload.open_cash ? 'movement' : 'open');
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCash();
  }, [refreshToken]);

  const expectedTotal = summary?.expected_total ?? 0;
  const difference = useMemo(() => numberFromInput(closingAmount) - expectedTotal, [closingAmount, expectedTotal]);
  const hasOpenCash = Boolean(summary?.open_cash);
  const movements = summary?.movements ?? [];

  async function submitOpenCash(): Promise<void> {
    const amount = numberFromInput(openingAmount);
    if (amount < 0) {
      setFeedback({ tone: 'error', text: 'O valor inicial não pode ser negativo.' });
      return;
    }
    setSaving(true);
    try {
      const payload = await api.openCash(amount, notes.trim());
      setSummary(payload);
      setClosingAmount(String(payload.expected_total.toFixed(2)));
      setNotes('');
      setMode('movement');
      setFeedback({ tone: 'success', text: 'Tudo certo: caixa aberto e sincronizado. Vendas, entradas e saídas já podem ser acompanhadas.' });
      notifyMobileAction({ title: 'Caixa aberto', message: `Saldo inicial ${formatCurrency(amount)} registrado com segurança.`, tone: 'success', page: 'cash', actionLabel: 'Ver caixa' });
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function submitMovement(): Promise<void> {
    const amount = numberFromInput(movementAmount);
    const reason = movementReason.trim();
    if (amount <= 0) {
      setFeedback({ tone: 'error', text: 'Informe um valor maior que R$ 0,00.' });
      return;
    }
    if (!reason) {
      setFeedback({ tone: 'error', text: 'Informe o motivo para a loja entender esse lançamento depois.' });
      return;
    }
    setSaving(true);
    try {
      const payload = await api.addCashMovement(movementType, movementMethod, amount, reason);
      setSummary(payload);
      setClosingAmount(String(payload.expected_total.toFixed(2)));
      setMovementAmount('');
      setMovementReason('');
      setFeedback({ tone: 'success', text: `${movementLabel(movementType)} lançada e sincronizada no caixa.` });
      notifyMobileAction({ title: `${movementLabel(movementType)} lançada`, message: `${formatCurrency(amount)} registrado no caixa.`, tone: movementType === 'saida' ? 'warning' : 'success', page: 'cash', actionLabel: 'Ver caixa' });
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function submitCloseCash(): Promise<void> {
    const amount = numberFromInput(closingAmount);
    if (!summary?.open_cash) {
      setFeedback({ tone: 'error', text: 'Não existe caixa aberto para fechar.' });
      return;
    }
    if (amount < 0) {
      setFeedback({ tone: 'error', text: 'O valor contado não pode ser negativo.' });
      return;
    }
    const ok = window.confirm('Fechar o caixa agora? Confira o valor contado antes de confirmar.');
    if (!ok) return;
    setSaving(true);
    try {
      const payload = await api.closeCash(amount, notes.trim());
      setSummary(payload);
      setNotes('');
      setMode('open');
      setFeedback({ tone: 'success', text: 'Caixa fechado com conferência. O histórico ficou preservado.' });
      notifyMobileAction({ title: 'Caixa fechado', message: `Valor contado ${formatCurrency(amount)} registrado no histórico.`, tone: 'success', page: 'cash', actionLabel: 'Histórico' });
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mapp-screen mapp-cash-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Entradas hoje" value={formatCurrency(summary?.today_in)} detail="vendas e recebimentos" icon="caixa" tone="green" />
        <StatCard label="Saídas hoje" value={formatCurrency(summary?.today_out)} detail="retiradas e ajustes" icon="remover_menos" tone="orange" />
        <StatCard label="Saldo esperado" value={formatCurrency(expectedTotal)} detail={hasOpenCash ? 'caixa aberto' : 'caixa fechado'} icon="dinheiro" tone="blue" />
        <StatCard label="Status" value={hasOpenCash ? 'Aberto' : 'Fechado'} detail={summary?.open_cash ? formatDateTime(summary.open_cash.opened_at) : 'abra para controlar'} icon="abrir_caixa" tone={hasOpenCash ? 'green' : 'orange'} />
      </section>

      <section className="mapp-success-card">
        <strong>Ajuda rápida: abra o caixa antes de começar o dia</strong>
        <span>Resumo simples: Inicial + Entradas - Saídas = Saldo esperado.</span>
      </section>

      {loading ? <div className="mapp-inline-status">Carregando caixa...</div> : null}
      <StatusFeedback feedback={feedback} />

      <section className="mapp-ops-toggle" aria-label="Ações do caixa">
        <button type="button" className={mode === 'open' ? 'active' : ''} onClick={() => setMode('open')} disabled={hasOpenCash}>Abrir</button>
        <button type="button" className={mode === 'movement' ? 'active' : ''} onClick={() => setMode('movement')}>Entrada / saída</button>
        <button type="button" className={mode === 'close' ? 'active' : ''} onClick={() => setMode('close')} disabled={!hasOpenCash}>Fechar</button>
      </section>

      {!hasOpenCash ? (
        <section className="mapp-warning-card mapp-cash-guide">
          <span><InlineIcon name="abrir_caixa" size={24} /></span>
          <div>
            <strong>Caixa fechado</strong>
            <p>Abra o caixa para acompanhar saldo, entradas e saídas do dia com mais segurança.</p>
          </div>
          <button type="button" onClick={() => setMode('open')}>Abrir caixa</button>
        </section>
      ) : null}

      {mode === 'open' ? (
        <section className="mapp-form-panel">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-green"><InlineIcon name="abrir_caixa" size={24} /></span>
            <div>
              <strong>Abrir caixa</strong>
              <p>Informe o dinheiro inicial. Atenção: esta ação precisa confirmar na nuvem para evitar duplicidade.</p>
            </div>
          </div>
          <div className="mapp-form-grid">
            <label>
              <span>Valor inicial</span>
              <input inputMode="decimal" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="0,00" disabled={hasOpenCash} />
            </label>
            <label>
              <span>Observação</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: abertura da manhã" disabled={hasOpenCash} />
            </label>
          </div>
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => void loadCash()}>Atualizar</button>
            <button type="button" className="mapp-primary-button" onClick={() => void submitOpenCash()} disabled={saving || hasOpenCash}>{saving ? 'Abrindo...' : 'Abrir caixa'}</button>
          </div>
        </section>
      ) : null}

      {mode === 'movement' ? (
        <section className="mapp-form-panel">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-blue"><InlineIcon name="caixa" size={24} /></span>
            <div>
              <strong>Entrada ou saída manual</strong>
              <p>Use para troco, retirada, ajuste ou dinheiro extra. Sempre informe o motivo.</p>
            </div>
          </div>
          <div className="mapp-payment-segments">
            {(['entrada', 'saida'] as const).map((type) => (
              <button key={type} type="button" className={movementType === type ? 'active' : ''} onClick={() => setMovementType(type)}>{movementLabel(type)}</button>
            ))}
          </div>
          <div className="mapp-form-grid">
            <label>
              <span>Forma</span>
              <select value={movementMethod} onChange={(event) => setMovementMethod(event.target.value)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </label>
            <label>
              <span>Valor</span>
              <input inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder="0,00" />
            </label>
            <label className="span-2">
              <span>Motivo *</span>
              <input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Ex.: troco, sangria, reforço de caixa" />
            </label>
          </div>
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => void loadCash()}>Atualizar</button>
            <button type="button" className="mapp-primary-button" onClick={() => void submitMovement()} disabled={saving}>{saving ? 'Lançando...' : 'Lançar movimento'}</button>
          </div>
        </section>
      ) : null}

      {mode === 'close' ? (
        <section className="mapp-form-panel mapp-danger-panel">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-orange"><InlineIcon name="bloqueio_seguro" size={24} /></span>
            <div>
              <strong>Fechar caixa</strong>
              <p>Confira o valor contado. Depois de fechar, o histórico continua protegido.</p>
            </div>
          </div>
          <div className="mapp-cash-close-summary">
            <span>Esperado <strong>{formatCurrency(expectedTotal)}</strong></span>
            <span>Diferença <strong className={Math.abs(difference) > 0.009 ? 'warn' : 'ok'}>{formatCurrency(difference)}</strong></span>
          </div>
          <div className="mapp-form-grid">
            <label>
              <span>Valor contado</span>
              <input inputMode="decimal" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} placeholder="0,00" />
            </label>
            <label>
              <span>Observação</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: conferido no fim do dia" />
            </label>
          </div>
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => setMode('movement')}>Voltar</button>
            <button type="button" className="mapp-primary-button" onClick={() => void submitCloseCash()} disabled={saving || !hasOpenCash}>{saving ? 'Fechando...' : 'Fechar caixa'}</button>
          </div>
        </section>
      ) : null}

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Movimentos de hoje</h2><button type="button" onClick={() => void loadCash()}>Atualizar</button></div>
        {movements.length ? (
          <div className="mapp-list-stack">
            {movements.slice(0, 14).map((movement) => (
              <ListCard
                key={movement.id}
                icon={movement.type === 'saida' ? 'remover_menos' : 'dinheiro'}
                title={movement.reason || 'Movimento de caixa'}
                subtitle={`${movementLabel(movement.type)} · ${methodLabel(movement.method)} · ${formatDateTime(movement.created_at)}`}
                value={formatCurrency(movement.amount)}
                tone={toneForMovement(movement)}
              />
            ))}
          </div>
        ) : !loading ? (
          <EmptyState icon="caixa" title="Sem movimentos hoje" detail="Abra o caixa ou lance a primeira entrada/saída para acompanhar aqui." actionLabel="Lançar movimento" actionPage="cash" onNavigate={() => setMode('movement')} />
        ) : null}
      </section>

      <section className="mapp-version-card">
        <strong>Resumo para conferência</strong>
        <span>{formatNumber(movements.length)} movimento(s) hoje · {status?.sqlite_ok ? 'nuvem conectada' : 'verificar login'}</span>
      </section>
    </div>
  );
}

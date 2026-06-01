import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime, money } from '../lib/format';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { CashMovement, CashSummary } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

function movementMethodLabel(method: string): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  if (method === 'ajuste') return 'Ajuste';
  return method;
}

function movementTypeLabel(type: string): string {
  if (type === 'entrada') return 'Entrada';
  if (type === 'saida') return 'Saída';
  return type;
}

export function CashPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [methodFilter, setMethodFilter] = useState('todas');
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('saida');
  const [movementMethod, setMovementMethod] = useState('dinheiro');
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const permissions = useWebPermissions(refreshToken);
  const canOperate = permissions.canOperate;

  useEffect(() => {
    api.cashSummary()
      .then((payload) => {
        setSummary(payload);
        setClosingAmount(payload.expected_total);
      })
      .catch(() => undefined);
  }, [refreshToken]);

  const difference = useMemo(() => closingAmount - (summary?.expected_total ?? 0), [closingAmount, summary]);
  const methods = useMemo(() => (
    ['todas', ...Array.from(new Set((summary?.movements ?? []).map((row) => row.method).filter(Boolean))).sort((a, b) => a.localeCompare(b))]
  ), [summary]);
  const filteredMovements = useMemo(() => (summary?.movements ?? []).filter((row) => {
    const matchesType = typeFilter === 'todos' || row.type === typeFilter;
    const matchesMethod = methodFilter === 'todas' || row.method === methodFilter;
    const matchesQuery = matchesFilterQuery(query, [
      row.created_at,
      row.type,
      row.method,
      row.reason,
      row.amount,
    ]);
    return matchesType && matchesMethod && matchesQuery;
  }), [methodFilter, query, summary, typeFilter]);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para abrir o caixa.');
      return;
    }
    if (openingAmount < 0) {
      setError('O valor inicial não pode ser negativo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = await api.openCash(openingAmount, notes.trim());
      setSummary(payload);
      setClosingAmount(payload.expected_total);
      setMessage('Caixa aberto com registro no SQLite e auditoria.');
      setNotes('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !summary?.open_cash) return;
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para fechar o caixa.');
      return;
    }
    if (closingAmount < 0) {
      setError('O valor contado não pode ser negativo.');
      return;
    }
    const ok = window.confirm('Fechar o caixa de hoje? Confira o valor contado antes de confirmar.');
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const payload = await api.closeCash(closingAmount, notes.trim());
      setSummary(payload);
      setMessage('Caixa fechado com conferência e auditoria.');
      setNotes('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para lançar movimentos no caixa.');
      return;
    }
    if (movementAmount <= 0) {
      setError('Informe um valor maior que zero para o movimento.');
      return;
    }
    if (!movementReason.trim()) {
      setError('Informe o motivo do movimento manual.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = await api.addCashMovement(movementType, movementMethod, movementAmount, movementReason.trim());
      setSummary(payload);
      setClosingAmount(payload.expected_total);
      setMovementAmount(0);
      setMovementReason('');
      setMessage('Movimento manual lançado no caixa com auditoria.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack classic-legacy-page cash-light-v65 cash-premium-v90">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>Caixa</h1>
          <p>Acompanhe abertura, entradas, saídas, conferência e fechamento com leitura simples e segura.</p>
        </div>
      </div>
      {!canOperate && permissions.isWeb ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage}</span></div> : null}
      <div className="cash-helper-v90"><strong>Fluxo seguro do caixa</strong><span>1. Abra o caixa · 2. Registre entradas e saídas · 3. Confira o valor contado antes de fechar.</span></div>
      <section className="metric-grid cash-grid classic-cash-summary-grid">
        <article className="metric-card"><span>Entradas hoje</span><strong>{money(summary?.today_in ?? 0)}</strong><small>Vendas, recebimentos e reforços</small></article>
        <article className="metric-card"><span>Saídas hoje</span><strong>{money(summary?.today_out ?? 0)}</strong><small>Retiradas, sangrias e ajustes</small></article>
        <article className="metric-card"><span>Saldo esperado</span><strong>{money(summary?.expected_total ?? 0)}</strong><small>Valor esperado para conferência</small></article>
        <article className="metric-card"><span>Status</span><strong>{summary?.open_cash ? 'Aberto' : 'Fechado'}</strong><small>{summary?.open_cash ? `Aberto em ${dateTime(summary.open_cash.opened_at)}` : 'Abra o caixa para registrar o dia'}</small></article>
      </section>

      {!summary?.open_cash ? (
        <section className="panel classic-panel form-panel classic-legacy-form-panel cash-action-panel-v90">
          <div className="panel-head"><h2>Abrir caixa</h2><span className="pill pill-info">Registro auditado</span></div>
          <form className="form-grid compact" onSubmit={open}>
            <label>Valor inicial<input type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(Number(event.target.value))} readOnly={!canOperate} /></label>
            <label className="span-2">Observação<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: abertura da manhã" readOnly={!canOperate} /></label>
            <button className="primary-btn cash-primary-action-v90" disabled={busy || !canOperate}>{busy ? 'Abrindo...' : canOperate ? 'Abrir caixa' : 'Somente leitura'}</button>
          </form>
        </section>
      ) : (
        <section className="panel classic-panel form-panel classic-legacy-form-panel cash-action-panel-v90">
          <div className="panel-head"><h2>Fechar caixa</h2><span className={`pill ${Math.abs(difference) > 0.009 ? 'pill-warning' : 'pill-success'}`}>Diferença {money(difference)}</span></div>
          <form className="form-grid compact" onSubmit={close}>
            <label>Valor contado<input type="number" min="0" step="0.01" value={closingAmount} onChange={(event) => setClosingAmount(Number(event.target.value))} readOnly={!canOperate} /></label>
            <label className="span-2">Observação<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: conferido no fim do dia" readOnly={!canOperate} /></label>
            <button className="primary-btn cash-primary-action-v90" disabled={busy || !canOperate}>{busy ? 'Fechando...' : canOperate ? 'Fechar caixa' : 'Somente leitura'}</button>
          </form>
        </section>
      )}

      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <section className="panel classic-panel form-panel classic-legacy-form-panel cash-movement-panel-v90">
        <div className="panel-head"><h2>Lançamento manual</h2><span className="pill pill-info">Entrada / saída</span></div>
        <form className="form-grid compact" onSubmit={addMovement}>
          <label>Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value as 'entrada' | 'saida')} disabled={!canOperate}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          <label>Forma<select value={movementMethod} onChange={(event) => setMovementMethod(event.target.value)} disabled={!canOperate}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="ajuste">Ajuste</option></select></label>
          <label>Valor<input type="number" min="0.01" step="0.01" value={movementAmount} onChange={(event) => setMovementAmount(Number(event.target.value))} readOnly={!canOperate} /></label>
          <label className="span-2">Motivo<input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Ex.: sangria, troco, reforço de caixa" readOnly={!canOperate} /></label>
          <button className="secondary-btn cash-secondary-action-v90" disabled={busy || !canOperate}>{busy ? 'Lançando...' : canOperate ? 'Lançar movimento' : 'Somente leitura'}</button>
        </form>
      </section>

      <section className="panel classic-panel classic-legacy-table-panel cash-table-panel-v90">
        <div className="panel-head"><h2>Movimentos de hoje</h2><span className="pill pill-info">Histórico protegido</span></div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por motivo, forma, tipo ou horário"
          summary={`${filteredMovements.length} de ${(summary?.movements ?? []).length} movimentos visíveis`}
          selects={[
            {
              label: 'Tipo',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'entrada', label: 'Entradas' },
                { value: 'saida', label: 'Saídas' },
              ],
            },
            {
              label: 'Forma',
              value: methodFilter,
              onChange: setMethodFilter,
              options: methods.map((option) => ({
                value: option,
                label: option === 'todas' ? 'Todas' : movementMethodLabel(option),
              })),
            },
          ]}
        />
        <DataTable<CashMovement>
          rows={filteredMovements}
          empty="Nenhum movimento lançado no caixa hoje. Quando houver venda, recebimento ou lançamento manual, aparece aqui."
          columns={[
            { key: 'date', label: 'Hora', render: (row) => dateTime(row.created_at) },
            { key: 'type', label: 'Tipo', render: (row) => <span className={`pill ${row.type === 'entrada' ? 'pill-success' : 'pill-warning'}`}>{movementTypeLabel(row.type)}</span> },
            { key: 'method', label: 'Forma', render: (row) => movementMethodLabel(row.method) },
            { key: 'reason', label: 'Motivo', render: (row) => row.reason },
            { key: 'amount', label: 'Valor', align: 'right', render: (row) => money(row.amount) },
          ]}
        />
      </section>
    </div>
  );
}

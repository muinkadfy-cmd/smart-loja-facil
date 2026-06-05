import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { FRIENDLY_LIST_MESSAGES, LOAD_MORE_STEP, SEARCH_RESULT_LIMIT } from '../lib/listLimits';
import type { ReportColumn, ReportData, ReportKind, ReportMetric } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

function dateOffset(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

const reportOptions: Array<{ value: ReportKind; label: string; accent: 'blue' | 'green' | 'pink' | 'orange' }> = [
  { value: 'vendas', label: 'Vendas por período', accent: 'blue' },
  { value: 'caixa', label: 'Caixa por período', accent: 'green' },
  { value: 'crediario', label: 'Crediário em aberto', accent: 'pink' },
  { value: 'estoque_baixo', label: 'Estoque baixo', accent: 'orange' },
];

function metricToneClass(tone: ReportMetric['tone']): string {
  if (tone === 'green') return 'tone-green';
  if (tone === 'purple') return 'tone-purple';
  if (tone === 'pink') return 'tone-pink';
  if (tone === 'orange') return 'tone-orange';
  return 'tone-blue';
}

function dynamicColumn(rowColumns: ReportColumn[]) {
  return rowColumns.map((column) => ({
    key: column.key,
    label: column.label,
    align: column.align,
    render: (row: Record<string, string>) => row[column.key] || '-',
  }));
}

export function ReportsPage({ refreshToken }: PageProps): JSX.Element {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ report: ReportKind; from: string; to: string }>({ report: 'vendas', from: today, to: today });
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [visibleRows, setVisibleRows] = useState(SEARCH_RESULT_LIMIT);

  const activeReport = useMemo(() => reportOptions.find((item) => item.value === form.report) ?? reportOptions[0], [form.report]);
  const periodLabel = form.from === form.to ? 'Hoje' : `${form.from.split('-').reverse().join('/')} até ${form.to.split('-').reverse().join('/')}`;
  const tableColumns = useMemo(() => dynamicColumn(data?.columns ?? []), [data?.columns]);

  function applyPreset(type: 'today' | 'last7' | 'month') {
    if (type === 'today') {
      setForm((current) => ({ ...current, from: today, to: today }));
      return;
    }
    if (type === 'last7') {
      setForm((current) => ({ ...current, from: dateOffset(-6), to: today }));
      return;
    }
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    setForm((current) => ({ ...current, from: firstDay, to: today }));
  }

  async function loadReport(nextForm = form) {
    if (nextForm.from > nextForm.to) {
      setError('A data inicial não pode ser maior que a data final.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await api.reportData(nextForm.report, nextForm.from, nextForm.to));
      setVisibleRows(SEARCH_RESULT_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadReport();
  }

  async function exportCsv() {
    if (form.from > form.to || exporting) {
      if (form.from > form.to) setError('A data inicial não pode ser maior que a data final.');
      return;
    }
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const path = await api.reportsCsv(form.report, form.from, form.to);
      await api.revealFile(path);
      setMessage(`CSV gerado com sucesso em ${path}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Relatórios</h1>
          <p>Veja só os números principais do período, de forma simples e objetiva.</p>
        </div>
        <div className="hero-status reports-hero-status">
          <span className="status-chip"><AppIcon name="relatorios" size={16} className="app-icon-button-inline" />Números na tela</span>
          <span className="status-chip"><AppIcon name="buscar" size={16} className="app-icon-button-inline" />Consulta rápida</span>
        </div>
      </div>

      <section className="panel reports-hero-panel">
        <div className="reports-summary-grid">
          <article className="mini-insight-card tone-blue">
            <small>Relatório</small>
            <strong>{activeReport.label}</strong>
            <p>Visual na tela com tabela detalhada.</p>
          </article>
          <article className="mini-insight-card tone-purple">
            <small>Período</small>
            <strong>{periodLabel}</strong>
            <p>Filtro atual para os números exibidos.</p>
          </article>
          <article className={`mini-insight-card tone-${activeReport.accent}`}>
            <small>Registros</small>
            <strong>{data ? data.total_rows : 0}</strong>
            <p>{data ? 'Base usada para calcular os indicadores.' : 'Sem dados carregados.'}</p>
          </article>
        </div>
      </section>

      <section className="panel form-panel reports-panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Filtro do relatório</h2>
            <p>Escolha o tipo e o período para atualizar os números.</p>
          </div>
          <div className="preset-row">
            <button type="button" className="secondary-btn small" onClick={() => applyPreset('today')}><AppIcon name="calendario_data" size={16} className="app-icon-button-inline" />Hoje</button>
            <button type="button" className="secondary-btn small" onClick={() => applyPreset('last7')}><AppIcon name="calendario_data" size={16} className="app-icon-button-inline" />Últimos 7 dias</button>
            <button type="button" className="secondary-btn small" onClick={() => applyPreset('month')}><AppIcon name="calendario_data" size={16} className="app-icon-button-inline" />Este mês</button>
          </div>
        </div>
        <form className="form-grid compact reports-form-grid" onSubmit={submit}>
          <label>Relatório<select value={form.report} onChange={(e) => setForm({ ...form, report: e.target.value as ReportKind })}>{reportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>De<input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
          <label>Até<input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
          <button className="primary-btn" disabled={loading}><AppIcon name="atualizar" size={16} className="app-icon-button-inline" />{loading ? 'Atualizando...' : 'Atualizar números'}</button>
        </form>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}

      {data ? (
        <>
          <section className="panel reports-preview-panel">
            <div className="panel-head panel-head-tight">
              <div>
                <h2>{data.title}</h2>
                <p>{data.description}</p>
              </div>
              <div className="reports-preview-meta">
                <span className="pill">{data.total_rows} registro(s)</span>
                <span className="pill">Atualizado em {dateTime(data.generated_at)}</span>
              </div>
            </div>
            <div className="reports-summary-grid reports-preview-grid">
              {data.summary.map((metric) => (
                <article key={metric.label} className={`mini-insight-card ${metricToneClass(metric.tone)}`}>
                  <small>{metric.label}</small>
                  <strong>{metric.value}</strong>
                  <p>{metric.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel classic-panel">
            <div className="classic-panel-header">
              <h2>Dados detalhados</h2>
              <div className="table-actions">
                <button type="button" className="secondary-btn" onClick={exportCsv} disabled={exporting}>
                  <AppIcon name="relatorios" size={16} className="app-icon-button-inline" />
                  {exporting ? 'Gerando CSV...' : 'Exportar CSV'}
                </button>
              </div>
            </div>
            <DataTable<Record<string, string>>
              rows={data.rows.slice(0, visibleRows)}
              empty={data.empty_message}
              columns={tableColumns}
              getRowKey={(_, index) => `${data.report}-${index}`}
            />
            <div className="classic-table-footer">
              <span>{data.rows.length > visibleRows ? FRIENDLY_LIST_MESSAGES.firstResults : `${data.rows.length} linha(s) carregada(s).`}</span>
              {data.rows.length > visibleRows ? (
                <button type="button" className="secondary-btn small" onClick={() => setVisibleRows((count) => count + LOAD_MORE_STEP)}>
                  Carregar mais
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        !loading && !error && (
          <section className="panel empty-state-panel">
            <div className="empty-state-icon"><AppIcon name="relatorios" size={32} className="app-icon-page" /></div>
            <div>
              <strong>Nenhum relatório carregado ainda</strong>
              <p>Escolha o filtro e clique em Atualizar números.</p>
            </div>
          </section>
        )
      )}
    </div>
  );
}

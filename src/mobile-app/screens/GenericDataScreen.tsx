import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, AuditEvent, BackupInfo, CashSummary, CreditSummary, Customer, OrderSummary, PageKey, Product, ReceiptSummary, ReportData, ReportKind, SaleSummary, Settings } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { getMobileRoute } from '../mobileAppRoutes';

interface GenericDataScreenProps {
  page: PageKey;
  status: AppStatus | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type ScreenRecord = { id: string; title: string; subtitle: string; value?: string; tone?: string };

type ScreenData = {
  records: ScreenRecord[];
  metrics: Array<{ label: string; value: string; detail: string }>;
  loading: boolean;
  error: string | null;
};

async function loadPageData(page: PageKey, status: AppStatus | null): Promise<Omit<ScreenData, 'loading' | 'error'>> {
  if (page === 'sales') {
    const rows = await api.sales();
    const sales = rows as SaleSummary[];
    return {
      metrics: [
        { label: 'Vendas', value: formatNumber(sales.length), detail: 'registradas' },
        { label: 'Hoje', value: formatCurrency(status?.dashboard.today_sales_total), detail: `${formatNumber(status?.dashboard.today_sales_count)} venda(s)` },
      ],
      records: sales.slice(0, 12).map((sale) => ({ id: sale.id, title: `Venda #${String(sale.number).padStart(4, '0')}`, subtitle: `${sale.customer_name || 'Consumidor'} · ${sale.payment_method.toUpperCase()} · ${formatDateTime(sale.created_at)}`, value: formatCurrency(sale.total), tone: 'blue' })),
    };
  }
  if (page === 'products') {
    const rows = await api.products();
    const products = rows as Product[];
    const lowStock = products.filter((product) => product.stock <= (status?.settings.low_stock_limit ?? 3)).length;
    return {
      metrics: [
        { label: 'Produtos', value: formatNumber(products.length), detail: 'no catálogo' },
        { label: 'Estoque baixo', value: formatNumber(lowStock), detail: 'precisam atenção' },
      ],
      records: products.slice(0, 12).map((product) => ({ id: product.id, title: product.name, subtitle: `${product.category || 'Sem categoria'} · Estoque ${formatNumber(product.stock)}`, value: formatCurrency(product.promo_price ?? product.price), tone: product.stock <= (status?.settings.low_stock_limit ?? 3) ? 'orange' : 'sky' })),
    };
  }
  if (page === 'customers') {
    const rows = await api.customers();
    const customers = rows as Customer[];
    return {
      metrics: [
        { label: 'Clientes', value: formatNumber(customers.length), detail: 'na base' },
        { label: 'Ativos', value: formatNumber(customers.filter((customer) => customer.status === 'ativo').length), detail: 'em atendimento' },
      ],
      records: customers.slice(0, 12).map((customer) => ({ id: customer.id, title: customer.name, subtitle: `${customer.phone || customer.whatsapp || 'Sem telefone'} · ${customer.status}`, value: customer.credit_limit ? `Limite ${formatCurrency(customer.credit_limit)}` : undefined, tone: 'purple' })),
    };
  }
  if (page === 'orders') {
    const rows = await api.orders();
    const orders = rows as OrderSummary[];
    return {
      metrics: [
        { label: 'Pedidos', value: formatNumber(orders.length), detail: 'registrados' },
        { label: 'Abertos', value: formatNumber(orders.filter((order) => order.status === 'aberto').length), detail: 'para acompanhar' },
      ],
      records: orders.slice(0, 12).map((order) => ({ id: order.id, title: `Pedido #${String(order.number).padStart(4, '0')}`, subtitle: `${order.customer_name || 'Cliente'} · ${order.status} · ${formatDateTime(order.created_at)}`, value: formatCurrency(order.total), tone: 'orange' })),
    };
  }
  if (page === 'cash') {
    const cash = await api.cashSummary() as CashSummary;
    return {
      metrics: [
        { label: 'Entradas', value: formatCurrency(cash.today_in), detail: 'hoje' },
        { label: 'Saídas', value: formatCurrency(cash.today_out), detail: 'hoje' },
        { label: 'Saldo', value: formatCurrency(cash.expected_total), detail: cash.open_cash ? 'caixa aberto' : 'caixa fechado' },
      ],
      records: cash.movements.slice(0, 12).map((movement) => ({ id: movement.id, title: movement.reason || 'Movimento de caixa', subtitle: `${movement.type} · ${movement.method} · ${formatDateTime(movement.created_at)}`, value: formatCurrency(movement.amount), tone: movement.type === 'saida' ? 'orange' : 'green' })),
    };
  }
  if (page === 'credits') {
    const rows = await api.credits();
    const credits = rows as CreditSummary[];
    const openTotal = credits.reduce((sum, credit) => sum + Number(credit.balance || 0), 0);
    return {
      metrics: [
        { label: 'Crediários', value: formatNumber(credits.length), detail: 'clientes' },
        { label: 'Em aberto', value: formatCurrency(openTotal), detail: 'a receber' },
      ],
      records: credits.slice(0, 12).map((credit) => ({ id: credit.id, title: credit.customer_name, subtitle: `Venda #${credit.sale_number} · ${credit.status}`, value: formatCurrency(credit.balance), tone: 'purple' })),
    };
  }
  if (page === 'receipts') {
    const rows = await api.receipts();
    const receipts = rows as ReceiptSummary[];
    return {
      metrics: [
        { label: 'Comprovantes', value: formatNumber(receipts.length), detail: 'gerados' },
      ],
      records: receipts.slice(0, 12).map((receipt) => ({ id: receipt.id, title: `Comprovante #${receipt.sale_number}`, subtitle: `${receipt.customer_name || 'Consumidor'} · ${receipt.receipt_type} · ${formatDateTime(receipt.created_at)}`, value: formatCurrency(receipt.total), tone: 'sky' })),
    };
  }
  if (page === 'backup') {
    const rows = await api.backups();
    const backups = rows as BackupInfo[];
    return {
      metrics: [
        { label: 'Backups', value: formatNumber(backups.length), detail: 'cópias' },
      ],
      records: backups.slice(0, 12).map((backup) => ({ id: backup.id, title: backup.file_name, subtitle: `${backup.integrity_ok ? 'Íntegro' : 'Revisar'} · ${formatDateTime(backup.created_at)}`, value: `${Math.max(1, Math.round(backup.size_bytes / 1024))} KB`, tone: backup.integrity_ok ? 'green' : 'orange' })),
    };
  }
  if (page === 'audit') {
    const rows = await api.audit();
    const audits = rows as AuditEvent[];
    return {
      metrics: [
        { label: 'Logs', value: formatNumber(audits.length), detail: 'ações' },
      ],
      records: audits.slice(0, 12).map((audit) => ({ id: audit.id, title: audit.action, subtitle: `${audit.entity} · ${formatDateTime(audit.created_at)}`, value: 'log', tone: 'slate' })),
    };
  }
  return {
    metrics: [
      { label: 'Status', value: status?.sqlite_ok ? 'Online' : 'Verificar', detail: 'nuvem' },
    ],
    records: [],
  };
}

function emptyText(page: PageKey): { title: string; detail: string; action: string; actionPage: PageKey } {
  if (page === 'sales') return { title: 'Nenhuma venda ainda', detail: 'Abra o PDV para registrar a primeira venda.', action: 'Nova venda', actionPage: 'sales' };
  if (page === 'products') return { title: 'Nenhum produto cadastrado', detail: 'Cadastre produtos para vender no celular e no computador.', action: 'Novo produto', actionPage: 'products' };
  if (page === 'customers') return { title: 'Nenhum cliente cadastrado', detail: 'Cadastre clientes para pedidos, vendas e crediário.', action: 'Novo cliente', actionPage: 'customers' };
  if (page === 'orders') return { title: 'Nenhum pedido aberto', detail: 'Crie pedidos para acompanhar separação e entrega.', action: 'Novo pedido', actionPage: 'orders' };
  if (page === 'cash') return { title: 'Sem movimentos no caixa', detail: 'Abra o caixa ou registre uma entrada/saída.', action: 'Abrir caixa', actionPage: 'cash' };
  if (page === 'credits') return { title: 'Sem crediário em aberto', detail: 'As parcelas de clientes aparecerão aqui.', action: 'Ver vendas', actionPage: 'sales' };
  return { title: 'Nada encontrado ainda', detail: 'Quando houver registros, eles aparecerão nesta tela.', action: 'Voltar ao início', actionPage: 'dashboard' };
}

export function GenericDataScreen({ page, status, refreshToken, onNavigate, onRefresh }: GenericDataScreenProps): JSX.Element {
  const route = getMobileRoute(page);
  const [data, setData] = useState<ScreenData>({ records: [], metrics: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setData((current) => ({ ...current, loading: true, error: null }));
    loadPageData(page, status)
      .then((result) => {
        if (!active) return;
        setData({ ...result, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setData({ records: [], metrics: [], loading: false, error: error instanceof Error ? error.message : String(error) });
      });
    return () => { active = false; };
  }, [page, status, refreshToken]);

  const empty = useMemo(() => emptyText(page), [page]);
  if (page === 'diagnostics') {
    return <DiagnosticsScreen status={status} onRefresh={onRefresh} />;
  }

  if (page === 'reports') {
    return <ReportsScreen refreshToken={refreshToken} onRefresh={onRefresh} />;
  }

  if (page === 'audit') {
    return <AuditLogsScreen refreshToken={refreshToken} onRefresh={onRefresh} />;
  }

  if (page === 'settings') {
    return <SettingsScreen status={status} onRefresh={onRefresh} />;
  }

  return (
    <div className="mapp-screen">
      <section className="mapp-panel mapp-action-panel">
        <span className={`mapp-panel-icon tone-${route.tone}`}>{route.label.slice(0, 1)}</span>
        <div>
          <strong>{route.primaryAction}</strong>
          <p>{route.subtitle}</p>
        </div>
        <button type="button" onClick={onRefresh}>Atualizar</button>
      </section>

      <section className="mapp-mini-stat-grid">
        {data.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} icon={route.icon} tone={route.tone} />
        ))}
      </section>

      {data.loading ? <div className="mapp-inline-status">Carregando {route.label.toLowerCase()}...</div> : null}
      {data.error ? <div className="mapp-error-box">{data.error}</div> : null}

      {data.records.length ? (
        <section className="mapp-section-block">
          <div className="mapp-section-title"><h2>Registros recentes</h2><button type="button" onClick={onRefresh}>Atualizar</button></div>
          <div className="mapp-list-stack">
            {data.records.map((row) => <ListCard key={row.id} icon={route.icon} title={row.title} subtitle={row.subtitle} value={row.value} tone={row.tone ?? route.tone} />)}
          </div>
        </section>
      ) : !data.loading ? (
        <EmptyState icon={route.icon} title={empty.title} detail={empty.detail} actionLabel={empty.action} actionPage={empty.actionPage} onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}

function inputDate(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function metricTone(tone: ReportData['summary'][number]['tone']): 'blue' | 'purple' | 'green' | 'orange' {
  if (tone === 'pink') return 'purple';
  return tone;
}

function reportKindHelp(kind: ReportKind): string {
  if (kind === 'crediario') return 'Mostra crediários abertos no período pela data de criação. Confira vencimentos nas parcelas do cliente.';
  if (kind === 'estoque_baixo') return 'Estoque baixo é uma foto da situação atual e não depende do período escolhido.';
  if (kind === 'caixa') return 'Mostra movimentos do caixa no período. Conferência completa usa abertura, entradas, saídas e fechamento.';
  return 'Vendas canceladas podem aparecer na lista para histórico, mas não entram no total vendido.';
}

function humanReportStatus(value: string): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('cancel')) return 'Cancelada — não entra no total';
  if (text.includes('final') || text.includes('pago') || text.includes('paid')) return 'Finalizada';
  if (text.includes('parcial')) return 'Parcial';
  if (text.includes('pend') || text.includes('open')) return 'Pendente';
  return value || '-';
}

function ReportsScreen({ refreshToken, onRefresh }: { refreshToken: number; onRefresh: () => void }): JSX.Element {
  const [kind, setKind] = useState<ReportKind>('vendas');
  const [from, setFrom] = useState(() => inputDate(30));
  const [to, setTo] = useState(() => inputDate(0));
  const [report, setReport] = useState<ReportData | null>(null);
  const [visibleRows, setVisibleRows] = useState(15);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setVisibleRows(15);
    api.reportData(kind, from, to)
      .then((payload) => {
        if (!active) return;
        setReport(payload);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReport(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [kind, from, to, refreshToken]);

  const exportCsv = async () => {
    setFeedback(null);
    setError(null);
    try {
      await api.reportsCsv(kind, from, to);
      setFeedback('Relatório exportado em CSV.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const copySummary = async () => {
    if (!report) return;
    const lines = [
      report.title,
      `Período: ${from} até ${to}`,
      report.description,
      '',
      ...report.summary.map((metric) => `${metric.label}: ${metric.value} — ${metric.detail}`),
      '',
      `Registros: ${report.total_rows}`,
      `Observação: ${reportKindHelp(report.report)}`,
    ];
    await navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
    setFeedback('Resumo copiado para enviar no WhatsApp ou para suporte.');
  };

  return (
    <div className="mapp-screen mapp-reports-screen">
      <section className="mapp-panel mapp-report-toolbar">
        <div className="mapp-report-tabs" role="tablist" aria-label="Tipo de relatório">
          {[
            ['vendas', 'Vendas'],
            ['caixa', 'Caixa'],
            ['crediario', 'Crediário'],
            ['estoque_baixo', 'Estoque'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={kind === value ? 'active' : ''} onClick={() => setKind(value as ReportKind)}>{label}</button>
          ))}
        </div>
        <div className="mapp-report-help">
          <strong>Ajuda rápida</strong>
          <span>{reportKindHelp(kind)}</span>
        </div>
        <div className="mapp-form-grid">
          <label>
            <span>Data inicial</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={kind === 'estoque_baixo'} />
          </label>
          <label>
            <span>Data final</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={kind === 'estoque_baixo'} />
          </label>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={onRefresh}>Atualizar</button>
          <button type="button" className="mapp-secondary-button" onClick={copySummary} disabled={!report}>Copiar resumo</button>
          <button type="button" className="mapp-secondary-button" onClick={exportCsv}>Exportar CSV</button>
        </div>
      </section>

      {feedback ? <div className="mapp-form-feedback mapp-form-feedback-success">{feedback}</div> : null}
      {error ? <div className="mapp-error-box">{error}</div> : null}
      {loading ? <div className="mapp-inline-status">Carregando relatório...</div> : null}

      {report ? (
        <>
          <section className="mapp-mini-stat-grid">
            {report.summary.map((metric) => (
              <StatCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} icon="relatorios" tone={metricTone(metric.tone)} />
            ))}
          </section>
          <section className="mapp-section-block">
            <div className="mapp-section-title"><h2>{report.title}</h2><button type="button" onClick={exportCsv}>CSV</button></div>
            <p className="mapp-section-note">{report.description} {reportKindHelp(report.report)}</p>
            {report.rows.length ? (
              <div className="mapp-report-list">
                {report.rows.slice(0, visibleRows).map((row, index) => {
                  const first = report.columns[0];
                  const last = report.columns[report.columns.length - 1];
                  const middle = report.columns.slice(1, -1).map((column) => {
                    const value = row[column.key];
                    if (!value) return '';
                    return column.key === 'status' ? humanReportStatus(value) : value;
                  }).filter(Boolean).join(' · ');
                  return (
                    <ListCard
                      key={`${first?.key ?? 'row'}-${index}`}
                      icon="relatorios"
                      title={row[first?.key ?? ''] || `Registro ${index + 1}`}
                      subtitle={middle || report.description}
                      value={row[last?.key ?? '']}
                      tone="blue"
                    />
                  );
                })}
                {report.rows.length > visibleRows ? (
                  <button type="button" className="mapp-secondary-button mapp-load-more" onClick={() => setVisibleRows((count) => count + 15)}>
                    Ver mais registros ({report.rows.length - visibleRows} restantes)
                  </button>
                ) : null}
              </div>
            ) : (
              <EmptyState icon="relatorios" title="Sem dados no período" detail={report.empty_message} actionLabel="Atualizar" actionPage="reports" onNavigate={onRefresh as unknown as (page: PageKey) => void} />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

type AuditFilter = 'todos' | 'erros' | 'avisos' | 'vendas' | 'crediario' | 'caixa' | 'backup' | 'sync';

function auditLabel(entity: string): string {
  const text = entity.toLowerCase();
  if (text.includes('sale')) return 'Venda';
  if (text.includes('credit') || text.includes('installment')) return 'Crediário';
  if (text.includes('cash')) return 'Caixa';
  if (text.includes('backup')) return 'Backup';
  if (text.includes('product')) return 'Produto';
  if (text.includes('customer')) return 'Cliente';
  if (text.includes('order')) return 'Pedido';
  return entity || 'Sistema';
}

function auditSimpleText(event: AuditEvent): string {
  const action = event.action.toLowerCase();
  const area = auditLabel(event.entity);
  if (action.includes('error') || action.includes('fail')) return `${area}: erro registrado. Copie para suporte se persistir.`;
  if (action.includes('create')) return `${area}: registro criado.`;
  if (action.includes('update') || action.includes('save')) return `${area}: alteração salva.`;
  if (action.includes('cancel')) return `${area}: cancelamento registrado.`;
  if (action.includes('payment') || action.includes('receive')) return `${area}: pagamento/recebimento registrado.`;
  if (action.includes('open')) return `${area}: abertura registrada.`;
  if (action.includes('close')) return `${area}: fechamento registrado.`;
  return `${area}: ${event.action || 'atividade registrada'}.`;
}

function auditDetailsText(details: string): string {
  if (!details) return 'Sem detalhes adicionais.';
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const pairs = Object.entries(parsed).filter(([key]) => !/token|senha|password|secret|key|jwt/i.test(key)).slice(0, 8);
    if (pairs.length === 0) return 'Detalhes técnicos ocultos por segurança.';
    return pairs.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
  } catch {
    return details.replace(/token|jwt|secret|password|senha/gi, 'dado protegido').slice(0, 220);
  }
}

function auditMatchesFilter(event: AuditEvent, filter: AuditFilter): boolean {
  const text = `${event.entity} ${event.action} ${event.details}`.toLowerCase();
  if (filter === 'todos') return true;
  if (filter === 'erros') return /erro|error|fail|falha/.test(text);
  if (filter === 'avisos') return /warn|aviso|aten/.test(text);
  if (filter === 'vendas') return /sale|venda/.test(text);
  if (filter === 'crediario') return /credit|installment|credi/.test(text);
  if (filter === 'caixa') return /cash|caixa/.test(text);
  if (filter === 'backup') return /backup/.test(text);
  if (filter === 'sync') return /sync|outbox|sincron/.test(text);
  return true;
}

function AuditLogsScreen({ refreshToken, onRefresh }: { refreshToken: number; onRefresh: () => void }): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditFilter>('todos');
  const [visibleRows, setVisibleRows] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.audit()
      .then((rows) => { if (active) setEvents(rows); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshToken]);

  useEffect(() => setVisibleRows(30), [filter]);

  const filtered = events.filter((event) => auditMatchesFilter(event, filter));
  const errorEvents = events.filter((event) => auditMatchesFilter(event, 'erros'));

  const copyLogs = async (onlyErrors = false) => {
    const source = onlyErrors ? errorEvents : filtered;
    const lines = source.slice(0, 50).map((event) => [
      formatDateTime(event.created_at),
      auditSimpleText(event),
      auditDetailsText(event.details),
    ].join(' | '));
    await navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
    setFeedback(onlyErrors ? 'Últimos erros copiados para suporte.' : 'Últimos logs visíveis copiados para suporte.');
  };

  return (
    <div className="mapp-screen mapp-audit-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Logs" value={formatNumber(events.length)} detail="ações recentes" icon="auditoria_logs" tone="blue" />
        <StatCard label="Erros" value={formatNumber(errorEvents.length)} detail="para suporte" icon="bloqueio_seguro" tone="orange" />
      </section>
      <section className="mapp-success-card">
        <strong>Ajuda rápida: logs para suporte</strong>
        <span>Copie os últimos logs quando algo der errado. O texto evita senha, chave privada e termos técnicos desnecessários.</span>
      </section>
      <div className="mapp-filter-pills" role="tablist" aria-label="Filtrar logs">
        {[
          ['todos', 'Todos'], ['erros', 'Erros'], ['avisos', 'Avisos'], ['vendas', 'Vendas'], ['crediario', 'Crediário'], ['caixa', 'Caixa'], ['backup', 'Backup'], ['sync', 'Sync'],
        ].map(([key, label]) => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key as AuditFilter)}>{label}</button>)}
      </div>
      <div className="mapp-button-grid">
        <button type="button" className="mapp-primary-button" onClick={onRefresh}>Atualizar</button>
        <button type="button" className="mapp-secondary-button" onClick={() => void copyLogs(false)}>Copiar últimos logs</button>
        <button type="button" className="mapp-secondary-button" onClick={() => void copyLogs(true)} disabled={errorEvents.length === 0}>Copiar último erro</button>
      </div>
      {feedback ? <div className="mapp-form-feedback mapp-form-feedback-success">{feedback}</div> : null}
      {error ? <div className="mapp-error-box">{error}</div> : null}
      {loading ? <div className="mapp-inline-status">Carregando logs...</div> : null}
      {filtered.length ? (
        <section className="mapp-list-stack mapp-audit-list">
          {filtered.slice(0, visibleRows).map((event) => (
            <article key={event.id} className="mapp-audit-card">
              <span className="mapp-audit-badge">{auditLabel(event.entity)}</span>
              <strong>{auditSimpleText(event)}</strong>
              <p>{auditDetailsText(event.details)}</p>
              <time>{formatDateTime(event.created_at)}</time>
            </article>
          ))}
          {filtered.length > visibleRows ? <button type="button" className="mapp-secondary-button mapp-load-more" onClick={() => setVisibleRows((count) => count + 30)}>Ver mais logs ({filtered.length - visibleRows} restantes)</button> : null}
        </section>
      ) : !loading ? (
        <EmptyState icon="auditoria_logs" title="Nenhum log neste filtro" detail="Quando houver ação ou erro, os detalhes aparecerão aqui para suporte." actionLabel="Atualizar" actionPage="audit" onNavigate={onRefresh as unknown as (page: PageKey) => void} />
      ) : null}
    </div>
  );
}

function fallbackSettings(status: AppStatus | null): Settings {
  return status?.settings ?? {
    store_name: 'Jaque Confecções e Presentes',
    owner_name: '',
    phone: '',
    whatsapp: '',
    address: '',
    receipt_message: '',
    low_stock_limit: 3,
    slow_mode: false,
    admin_password_enabled: false,
    receipt_width_mm: 80,
    updated_at: '',
  };
}

function SettingsScreen({ status, onRefresh }: { status: AppStatus | null; onRefresh: () => void }): JSX.Element {
  const [form, setForm] = useState<Settings>(() => fallbackSettings(status));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.settings()
      .then((settings) => {
        if (active) setForm(settings);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [status?.version]);

  const save = async () => {
    if (!form.store_name.trim()) {
      setError('Informe o nome da loja antes de salvar.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const saved = await api.saveSettings({ ...form, store_name: form.store_name.trim(), updated_at: new Date().toISOString() });
      setForm(saved);
      setFeedback('Configurações salvas e sincronizadas.');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mapp-screen mapp-settings-screen">
      <section className="mapp-form-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-slate"><InlineIcon name="configuracoes" size={32} /></span>
          <div>
            <strong>Dados da loja</strong>
            <p>Preferências principais usadas no celular, no caixa e nos comprovantes.</p>
          </div>
        </div>
        {loading ? <div className="mapp-inline-status">Carregando configurações...</div> : null}
        {feedback ? <div className="mapp-form-feedback mapp-form-feedback-success">{feedback}</div> : null}
        {error ? <div className="mapp-form-feedback mapp-form-feedback-error">{error}</div> : null}
        <div className="mapp-form-grid">
          <label className="span-2">
            <span>Nome da loja *</span>
            <input value={form.store_name} onChange={(event) => setForm({ ...form, store_name: event.target.value })} placeholder="Nome comercial" />
          </label>
          <label>
            <span>Responsável</span>
            <input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} placeholder="Nome do responsável" />
          </label>
          <label>
            <span>Telefone</span>
            <input inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" />
          </label>
          <label>
            <span>WhatsApp</span>
            <input inputMode="tel" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} placeholder="(00) 00000-0000" />
          </label>
          <label>
            <span>Estoque mínimo</span>
            <input inputMode="numeric" value={String(form.low_stock_limit)} onChange={(event) => setForm({ ...form, low_stock_limit: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="span-2">
            <span>Endereço</span>
            <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro" />
          </label>
          <label className="span-2">
            <span>Mensagem no comprovante</span>
            <textarea value={form.receipt_message} onChange={(event) => setForm({ ...form, receipt_message: event.target.value })} placeholder="Obrigado pela preferência." />
          </label>
        </div>
        <div className="mapp-form-actions">
          <button type="button" className="mapp-secondary-button" onClick={onRefresh}>Sincronizar</button>
          <button type="button" className="mapp-primary-button" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar configurações'}</button>
        </div>
      </section>
    </div>
  );
}

interface PlaceholderProps {
  page: PageKey;
  status: AppStatus | null;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

function PlaceholderScreen({ page, status, onNavigate, onRefresh }: PlaceholderProps): JSX.Element {
  const route = getMobileRoute(page);
  const checklist = [
    'Layout novo isolado',
    'Nuvem preservada',
    'Mobile-first ativo',
    'Pronto para migração da função completa',
  ];
  return (
    <div className="mapp-screen">
      <section className="mapp-panel mapp-action-panel">
        <span className={`mapp-panel-icon tone-${route.tone}`}>{route.label.slice(0, 1)}</span>
        <div>
          <strong>{route.primaryAction}</strong>
          <p>{route.subtitle}</p>
        </div>
        <button type="button" onClick={onRefresh}>Atualizar</button>
      </section>
      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Fase 1</h2><button type="button" onClick={() => onNavigate('dashboard')}>Início</button></div>
        <div className="mapp-check-list">
          {checklist.map((item) => <span key={item}>✓ {item}</span>)}
        </div>
      </section>
      <EmptyState icon={route.icon} title={`${route.label} pronto para conectar`} detail="Esta tela já tem layout novo. A função completa pode ser migrada no próximo lote sem herdar CSS antigo." actionLabel="Voltar ao Dashboard" actionPage="dashboard" onNavigate={onNavigate} />
      <section className="mapp-version-card">
        <strong>Versão atual</strong>
        <span>{status?.version ?? 'pwa-supabase-v135-proposta-comercial'}</span>
      </section>
    </div>
  );
}

function DiagnosticsScreen({ status, onRefresh }: { status: AppStatus | null; onRefresh: () => void }): JSX.Element {
  const clearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      window.location.reload();
    }
  };
  const copyDiagnostic = async () => {
    const text = [
      `Versão: ${status?.version ?? 'sem versão'}`,
      `Nuvem: ${status?.sqlite_ok ? 'online' : 'verificar login'}`,
      `Loja: ${status?.settings.store_name ?? 'sem loja'}`,
      `Cache: smart-loja-pwa-supabase-v135-proposta-comercial`,
      `Largura: ${window.innerWidth}px`,
      `Altura: ${window.innerHeight}px`,
    ].join('\n');
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  };
  return (
    <div className="mapp-screen">
      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Diagnóstico simples</h2><button type="button" onClick={onRefresh}>Atualizar</button></div>
        <div className="mapp-diagnostic-grid">
          <span><b>Nuvem</b><strong>{status?.sqlite_ok ? 'Online' : 'Verificar login'}</strong></span>
          <span><b>Versão</b><strong>{status?.version ?? 'v135'}</strong></span>
          <span><b>Mobile</b><strong>{window.innerWidth <= 860 ? 'Sim' : 'Desktop'}</strong></span>
          <span><b>Cache</b><strong>v135 proposta</strong></span>
        </div>
      </section>
      <section className="mapp-button-grid">
        <button type="button" className="mapp-primary-button" onClick={onRefresh}>Sincronizar agora</button>
        <button type="button" className="mapp-secondary-button" onClick={() => window.location.reload()}>Recarregar tela</button>
        <button type="button" className="mapp-secondary-button" onClick={copyDiagnostic}>Copiar diagnóstico</button>
        <button type="button" className="mapp-secondary-button" onClick={clearCache}>Limpar cache</button>
      </section>
    </div>
  );
}

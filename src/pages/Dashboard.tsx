import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { StatCard } from '../components/StatCard';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import type {
  AppStatus,
  DashboardData,
  DashboardSalesPeriod,
  DashboardSalesPoint,
  PageKey,
  SaleSummary,
} from '../types';

interface PageProps {
  status: AppStatus | null;
  refreshToken: number;
  onChanged: () => void;
  onNavigate: (page: PageKey) => void;
}

function paymentTone(method: string): string {
  if (method === 'dinheiro') return 'money';
  if (method === 'pix') return 'pix';
  if (method === 'cartao') return 'card';
  return 'other';
}

function paymentLabel(method: string): string {
  if (method === 'cartao') return 'Cartao';
  if (method === 'crediario') return 'Crediario';
  return method;
}

function axisLabel(value: number): string {
  if (value <= 0) return '0';
  if (value >= 1000) {
    const scaled = value / 1000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace('.0', '');
    return `${text}k`;
  }
  return `${Math.round(value)}`;
}

function chartUpperBound(maxValue: number): number {
  if (maxValue <= 0) return 0;
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const step = Math.ceil(roughStep / magnitude) * magnitude;
  return step * 4;
}

function tickLabel(period: DashboardSalesPeriod, index: number, total: number, label: string): string {
  if (period === 'today') return label;
  if (total <= 8) return label;
  if (total <= 12) return index % 2 === 0 || index === total - 1 ? label : '';
  if (total <= 20) return index % 3 === 0 || index === total - 1 ? label : '';
  return index % 5 === 0 || index === total - 1 ? label : '';
}

function periodCaption(period: DashboardSalesPeriod): string {
  if (period === 'today') return 'Hoje';
  if (period === '7d') return 'Ultimos 7 dias';
  if (period === '30d') return 'Ultimos 30 dias';
  return 'Este mes';
}

export function Dashboard({ status, refreshToken, onNavigate }: PageProps): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(status?.dashboard ?? null);
  const [chartPeriod, setChartPeriod] = useState<DashboardSalesPeriod>('today');
  const [salesSeries, setSalesSeries] = useState<DashboardSalesPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    api.dashboard().then(setData).catch(() => undefined);
  }, [refreshToken]);

  useEffect(() => {
    setChartLoading(true);
    api.dashboardSalesSeries(chartPeriod)
      .then(setSalesSeries)
      .catch(() => setSalesSeries([]))
      .finally(() => setChartLoading(false));
  }, [chartPeriod, refreshToken]);

  const paymentTotal = data?.payment_today.reduce((sum, item) => sum + item.total, 0) ?? 0;
  const donutStyle = useMemo(() => {
    const palette = ['#57b966', '#4e83e5', '#f1b941', '#7f63d8'];
    const parts = (data?.payment_today ?? [])
      .filter((item) => item.total > 0)
      .map((item, index) => ({ color: palette[index % palette.length], total: item.total }));
    if (parts.length === 0 || paymentTotal <= 0) {
      return { background: 'conic-gradient(#d9e4f7 0deg 360deg)' };
    }
    let cursor = 0;
    const gradients = parts.map((part) => {
      const next = cursor + (part.total / paymentTotal) * 360;
      const rule = `${part.color} ${cursor.toFixed(1)}deg ${next.toFixed(1)}deg`;
      cursor = next;
      return rule;
    });
    return { background: `conic-gradient(${gradients.join(', ')})` };
  }, [data?.payment_today, paymentTotal]);

  const chartModel = useMemo(() => {
    const activeSeries = salesSeries.length > 0 ? salesSeries : (
      chartPeriod === 'today'
        ? Array.from({ length: 8 }, (_, index) => ({ label: `${String(index * 3).padStart(2, '0')}h`, total: 0 }))
        : []
    );
    const maxValue = activeSeries.reduce((highest, point) => Math.max(highest, point.total), 0);
    const upperBound = chartUpperBound(maxValue);
    const yValues = upperBound <= 0
      ? [0, 0, 0, 0, 0]
      : [upperBound, upperBound * 0.75, upperBound * 0.5, upperBound * 0.25, 0];
    const width = 720;
    const left = 14;
    const top = 18;
    const bottom = 224;
    const usableWidth = width - (left * 2);
    const usableHeight = bottom - top;
    const points = activeSeries.map((point, index) => {
      const x = activeSeries.length <= 1 ? width / 2 : left + ((usableWidth * index) / (activeSeries.length - 1));
      const ratio = upperBound <= 0 ? 0 : point.total / upperBound;
      const y = upperBound <= 0 ? bottom : top + ((1 - ratio) * usableHeight);
      return { ...point, x, y };
    });
    const linePath = points.length === 0
      ? ''
      : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const areaPath = points.length === 0
      ? ''
      : `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z`;
    const peakIndex = points.reduce((best, point, index, all) => (
      point.total > all[best].total ? index : best
    ), 0);
    const peakPoint = points[peakIndex] ?? null;
    return { activeSeries, yValues, points, linePath, areaPath, peakPoint, maxValue, upperBound };
  }, [chartPeriod, salesSeries]);

  return (
    <div className="stack classic-dashboard-stack">
      <section className="stats-grid classic-stats-grid">
        <StatCard icon="vendas_pdv" label="Vendas (Hoje)" value={money(data?.today_sales_total)} hint={`${data?.today_sales_count ?? 0} registradas`} tone="blue" />
        <StatCard icon="pedidos" label="Pedidos (Abertos)" value={String(data?.orders_open ?? 0)} hint="aguardando envio" tone="purple" />
        <StatCard icon="clientes" label="Clientes" value={String(data?.customers_total ?? 0)} hint="cadastros ativos" tone="green" />
        <StatCard icon="crediario" label="Crediario (Ativos)" value={money(data?.credits_open_total)} hint={`${data?.credits_active_customers ?? 0} clientes`} tone="yellow" />
        <StatCard icon="estoque_baixo" label="Estoque Baixo" value={String(data?.low_stock_count ?? 0)} hint="produtos criticos" tone="red" />
      </section>

      <section className="classic-dashboard-main">
        <article className="panel classic-panel">
          <div className="classic-panel-header">
            <h2>Resumo de Vendas</h2>
            <div className="classic-tab-strip">
              <button type="button" className={chartPeriod === 'today' ? 'active' : ''} onClick={() => setChartPeriod('today')}>Hoje</button>
              <button type="button" className={chartPeriod === '7d' ? 'active' : ''} onClick={() => setChartPeriod('7d')}>7 dias</button>
              <button type="button" className={chartPeriod === '30d' ? 'active' : ''} onClick={() => setChartPeriod('30d')}>30 dias</button>
              <button type="button" className={chartPeriod === 'month' ? 'active' : ''} onClick={() => setChartPeriod('month')}>Este mes</button>
            </div>
          </div>
          <div className="classic-chart-card">
            <div className="classic-chart-grid">
              <div className="classic-chart-y">
                {chartModel.yValues.map((value, index) => <span key={`${value}-${index}`}>{axisLabel(value)}</span>)}
              </div>
              <div className="classic-chart-area">
                <div className="classic-line-surface">
                  <svg viewBox="0 0 720 240" className="classic-line-svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(62, 122, 255, 0.28)" />
                        <stop offset="100%" stopColor="rgba(62, 122, 255, 0.02)" />
                      </linearGradient>
                    </defs>
                    {chartModel.areaPath && <path d={chartModel.areaPath} fill="url(#salesArea)" />}
                    {chartModel.linePath && <path d={chartModel.linePath} fill="none" stroke="#3e7aff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                    {chartModel.peakPoint && chartModel.maxValue > 0 && (
                      <circle cx={chartModel.peakPoint.x} cy={chartModel.peakPoint.y} r="6" fill="#3e7aff" />
                    )}
                  </svg>
                  {chartModel.peakPoint ? (
                    <div
                      className={`classic-chart-tooltip ${chartModel.maxValue > 0 ? 'classic-chart-tooltip-live' : 'classic-chart-tooltip-empty'}`}
                      style={{
                        left: `${(chartModel.peakPoint.x / 720) * 100}%`,
                        top: chartModel.maxValue > 0 ? `${Math.max(26, chartModel.peakPoint.y - 58)}px` : '26px',
                      }}
                    >
                      <strong>{chartModel.peakPoint.label}</strong>
                      <span>{money(chartModel.peakPoint.total)}</span>
                    </div>
                  ) : (
                    <div className="classic-chart-tooltip classic-chart-tooltip-empty">
                      <strong>{periodCaption(chartPeriod)}</strong>
                      <span>Sem vendas no periodo.</span>
                    </div>
                  )}
                </div>
                <div
                  className="classic-chart-x"
                  style={{ gridTemplateColumns: `repeat(${Math.max(chartModel.activeSeries.length, 1)}, 1fr)` }}
                >
                  {chartModel.activeSeries.length > 0
                    ? chartModel.activeSeries.map((point, index) => (
                      <span key={`${point.label}-${index}`}>{tickLabel(chartPeriod, index, chartModel.activeSeries.length, point.label)}</span>
                    ))
                    : <span>{periodCaption(chartPeriod)}</span>}
                </div>
                <small className="muted">
                  {chartLoading ? 'Atualizando grafico...' : `Serie real do periodo: ${periodCaption(chartPeriod)}`}
                </small>
              </div>
            </div>
          </div>
        </article>

        <article className="panel classic-panel classic-donut-panel">
          <div className="classic-panel-header">
            <h2>Formas de Pagamento (Hoje)</h2>
          </div>
          <div className="classic-donut-layout">
            <div className="classic-donut-wrap">
              <div className="classic-donut-ring" style={donutStyle}>
                <div className="classic-donut-center">
                  <strong>{money(paymentTotal)}</strong>
                  <span>Total</span>
                </div>
              </div>
              <small>Transacoes: {(data?.payment_today ?? []).reduce((sum, item) => sum + item.count, 0)}</small>
            </div>
            <div className="classic-payment-list">
              {(data?.payment_today ?? []).length === 0 && <p className="muted">Sem pagamentos hoje.</p>}
              {(data?.payment_today ?? []).map((item) => (
                <div key={item.method} className="classic-payment-row">
                  <div className="classic-payment-name">
                    <span className={`classic-payment-swatch ${paymentTone(item.method)}`} />
                    <strong>{paymentLabel(item.method)}</strong>
                  </div>
                  <span>{money(item.total)}</span>
                  <small>{paymentTotal > 0 ? `${((item.total / paymentTotal) * 100).toFixed(1)}%` : '0%'}</small>
                </div>
              ))}
              <button type="button" className="classic-detail-button" onClick={() => onNavigate('reports')}>Ver detalhes</button>
            </div>
          </div>
        </article>
      </section>

      <section className="classic-dashboard-main">
        <article className="panel classic-panel">
          <div className="classic-panel-header">
            <h2>Ultimas Vendas</h2>
            <button type="button" className="classic-detail-button" onClick={() => onNavigate('sales')}>Ver todas</button>
          </div>
          <DataTable<SaleSummary>
            rows={data?.recent_sales ?? []}
            empty="Nenhuma venda lancada."
            getRowKey={(row) => row.id}
            columns={[
              { key: 'number', label: 'Venda', render: (row) => `#${row.number.toString().padStart(6, '0')}` },
              { key: 'customer', label: 'Cliente', render: (row) => row.customer_name || 'Balcao' },
              { key: 'method', label: 'Forma', render: (row) => paymentLabel(row.payment_method) },
              { key: 'total', label: 'Total', align: 'right', render: (row) => money(row.total) },
              { key: 'date', label: 'Data', render: (row) => dateTime(row.created_at) },
              { key: 'user', label: 'Usuario', render: () => 'Administrador' },
            ]}
          />
        </article>

        <article className="panel classic-panel classic-quick-panel">
          <div className="classic-panel-header">
            <h2>Acoes Rapidas</h2>
          </div>
          <div className="classic-quick-grid">
            <button type="button" onClick={() => onNavigate('sales')}><AppIcon name="vendas_pdv" size={24} className="app-icon-button-inline" />Nova Venda (PDV)</button>
            <button type="button" onClick={() => onNavigate('products')}><AppIcon name="produtos" size={24} className="app-icon-button-inline" />Novo Produto</button>
            <button type="button" onClick={() => onNavigate('orders')}><AppIcon name="pedidos" size={24} className="app-icon-button-inline" />Novo Pedido</button>
            <button type="button" onClick={() => onNavigate('customers')}><AppIcon name="clientes" size={24} className="app-icon-button-inline" />Buscar Cliente</button>
            <button type="button" onClick={() => onNavigate('cash')}><AppIcon name="abrir_caixa" size={24} className="app-icon-button-inline" />Abrir Caixa</button>
            <button type="button" onClick={() => onNavigate('reports')}><AppIcon name="relatorios" size={24} className="app-icon-button-inline" />Relatorios</button>
          </div>
          <button type="button" className="classic-shortcuts-button" onClick={() => onNavigate('settings')}><AppIcon name="acoes_rapidas" size={24} className="app-icon-button-inline" />Atalhos e operacoes</button>
        </article>
      </section>
    </div>
  );
}

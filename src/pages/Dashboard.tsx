import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { getRuntimeInfo } from '../lib/runtime';
import { getWebStoreContext, webRoleLabel, type WebStoreRole } from '../lib/webApi';
import type { AppStatus, DashboardData, DashboardSalesPeriod, DashboardSalesPoint, PageKey, Product } from '../types';

interface PageProps {
  status: AppStatus | null;
  refreshToken: number;
  onChanged: () => void;
  onNavigate: (page: PageKey) => void;
}

interface WebDashboardIdentity {
  email: string;
  role: WebStoreRole | 'sem login';
  storeName: string;
}

function axisLabel(value: number): string {
  if (value <= 0) return '0';
  if (value >= 1000) {
    const scaled = value / 1000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace('.0', '');
    return `R$ ${text}k`;
  }
  return `R$ ${Math.round(value)}`;
}

function chartUpperBound(maxValue: number): number {
  if (maxValue <= 0) return 0;
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const step = Math.ceil(roughStep / magnitude) * magnitude;
  return step * 4;
}

function periodLabel(period: DashboardSalesPeriod): string {
  if (period === 'today') return 'Hoje';
  if (period === '7d') return '7 dias';
  if (period === '30d') return '30 dias';
  return 'Este mês';
}

function formatTimeAgo(value?: string): string {
  if (!value) return 'agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'agora';
  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `há ${diffDay} dia${diffDay > 1 ? 's' : ''}`;
}

function chartLabel(point: DashboardSalesPoint | null): string {
  if (!point) return 'Sem dados';
  return `${point.label} · ${money(point.total)}`;
}

export function Dashboard({ status, refreshToken, onNavigate }: PageProps): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(status?.dashboard ?? null);
  const [chartPeriod, setChartPeriod] = useState<DashboardSalesPeriod>('7d');
  const [salesSeries, setSalesSeries] = useState<DashboardSalesPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [webIdentity, setWebIdentity] = useState<WebDashboardIdentity>({ email: '', role: 'sem login', storeName: '' });

  useEffect(() => {
    api.dashboard().then(setData).catch(() => undefined);
    api.products().then(setProducts).catch(() => setProducts([]));
  }, [refreshToken]);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    let active = true;
    void getWebStoreContext({ createIfMissing: false })
      .then((context) => {
        if (!active) return;
        setWebIdentity({ email: context.email, role: context.role, storeName: context.store.name });
      })
      .catch(() => {
        if (!active) return;
        setWebIdentity({ email: '', role: 'sem login', storeName: '' });
      });
    return () => {
      active = false;
    };
  }, [refreshToken, runtimeInfo.isWeb, status?.db_path]);

  useEffect(() => {
    setChartLoading(true);
    api.dashboardSalesSeries(chartPeriod)
      .then(setSalesSeries)
      .catch(() => setSalesSeries([]))
      .finally(() => setChartLoading(false));
  }, [chartPeriod, refreshToken]);

  const todaySalesCount = data?.today_sales_count ?? 0;
  const todaySalesTotal = data?.today_sales_total ?? 0;
  const averageTicket = todaySalesCount > 0 ? todaySalesTotal / todaySalesCount : 0;
  const activeProducts = useMemo(() => products.filter((item) => item.status !== 'inativo').length, [products]);
  const storeName = webIdentity.storeName || status?.settings.store_name || 'Smart Loja Fácil';
  const userLabel = runtimeInfo.isWeb
    ? webIdentity.email || status?.settings.owner_name || 'Aguardando login'
    : status?.settings.owner_name || 'Administrador';
  const roleLabel = runtimeInfo.isWeb ? webRoleLabel(webIdentity.role) : 'Administrador';

  const chartModel = useMemo(() => {
    const activeSeries = salesSeries.length > 0
      ? salesSeries
      : (chartPeriod === 'today'
        ? Array.from({ length: 8 }, (_, index) => ({ label: `${String(index * 3).padStart(2, '0')}h`, total: 0 }))
        : []);
    const maxValue = activeSeries.reduce((highest, point) => Math.max(highest, point.total), 0);
    const upperBound = chartUpperBound(maxValue);
    const yValues = upperBound <= 0
      ? [0, 0, 0, 0, 0]
      : [upperBound, upperBound * 0.75, upperBound * 0.5, upperBound * 0.25, 0];
    const width = 720;
    const left = 18;
    const top = 18;
    const bottom = 228;
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
    const peakIndex = points.reduce((best, point, index, all) => (point.total > all[best].total ? index : best), 0);
    const peakPoint = points[peakIndex] ?? null;
    return { activeSeries, yValues, points, linePath, areaPath, peakPoint, maxValue };
  }, [chartPeriod, salesSeries]);

  const statusRows = runtimeInfo.isWeb ? [
    {
      label: 'Supabase',
      value: status?.sqlite_ok ? 'Conectado' : 'Login pendente',
      ok: Boolean(status?.sqlite_ok),
    },
    {
      label: 'Loja online',
      value: status?.offline_ready ? 'Ativa' : 'Verificando',
      ok: Boolean(status?.offline_ready),
    },
    {
      label: 'PWA/cache',
      value: status?.version ?? 'Verificando',
      ok: Boolean(status?.version),
    },
    {
      label: 'Última leitura',
      value: formatTimeAgo(status?.settings.updated_at),
      ok: true,
    },
  ] : [
    {
      label: 'SQLite local',
      value: status?.sqlite_ok ? 'Conectado' : 'Verificar',
      ok: Boolean(status?.sqlite_ok),
    },
    {
      label: 'Operação offline',
      value: status?.offline_ready ? 'Ativo' : 'Verificando',
      ok: Boolean(status?.offline_ready),
    },
    {
      label: 'Banco protegido',
      value: status?.db_path ? 'Pronto' : 'Sem caminho',
      ok: Boolean(status?.db_path),
    },
    {
      label: 'Última leitura',
      value: formatTimeAgo(status?.settings.updated_at),
      ok: true,
    },
  ];

  return (
    <div className="neo-dashboard">
      <section className="neo-kpi-grid" aria-label="Indicadores principais">
        <article className="neo-kpi-card neo-kpi-card-sales">
          <div>
            <span>Vendas hoje</span>
            <strong>{money(todaySalesTotal)}</strong>
            <small>↑ {todaySalesCount} venda{todaySalesCount !== 1 ? 's' : ''}</small>
          </div>
          <div className="neo-kpi-icon"><AppIcon name="vendas_pdv" size={24} className="app-icon-stat" /></div>
        </article>

        <article className="neo-kpi-card">
          <div>
            <span>Pedidos</span>
            <strong>{data?.orders_open ?? 0}</strong>
            <small>↑ {data?.orders_open ?? 0} em aberto</small>
          </div>
          <div className="neo-kpi-icon neo-kpi-icon-gold"><AppIcon name="pedidos" size={24} className="app-icon-stat" /></div>
        </article>

        <article className="neo-kpi-card">
          <div>
            <span>Produtos</span>
            <strong>{activeProducts}</strong>
            <small>{data?.low_stock_count ?? 0} baixo</small>
          </div>
          <div className="neo-kpi-icon"><AppIcon name="produtos" size={24} className="app-icon-stat" /></div>
        </article>

        <article className="neo-kpi-card">
          <div>
            <span>Clientes</span>
            <strong>{data?.customers_total ?? 0}</strong>
            <small>↑ base ativa</small>
          </div>
          <div className="neo-kpi-icon neo-kpi-icon-violet"><AppIcon name="clientes" size={24} className="app-icon-stat" /></div>
        </article>

        <article className="neo-kpi-card neo-kpi-card-ticket">
          <div>
            <span>Ticket médio</span>
            <strong>{money(averageTicket)}</strong>
            <small>↑ média</small>
          </div>
          <div className="neo-kpi-icon neo-kpi-icon-green"><AppIcon name="dinheiro" size={24} className="app-icon-stat" /></div>
        </article>
      </section>

      <div className="neo-dashboard-updated">
        <AppIcon name="atualizar" size={16} className="app-icon-chip" />
        <span>Atualizado agora há poucos segundos</span>
      </div>

      <section className="neo-surface neo-context-surface">
        <div className="neo-section-head">
          <div>
            <h2>Ambiente e conexões</h2>
            <p>Leitura rápida do sistema com foco em operação segura, visual limpo e mobile-first.</p>
          </div>
        </div>

        <div className="neo-context-grid">
          <article className="neo-context-card neo-context-card-store">
            <div className="neo-context-card-icon"><AppIcon name="loja_ativa" size={24} className="app-icon-stat" /></div>
            <div>
              <span>Loja ativa</span>
              <strong>{storeName}</strong>
              <small>{runtimeInfo.isWeb ? 'Supabase web/mobile' : 'ID: NEO-001 · Plano local'}</small>
            </div>
            <mark>Ativa</mark>
          </article>

          <article className="neo-context-card">
            <div className="neo-context-card-icon"><AppIcon name="usuario_administrador" size={24} className="app-icon-stat" /></div>
            <div>
              <span>Usuário</span>
              <strong>{roleLabel}</strong>
              <small>{userLabel}</small>
            </div>
            <mark className="purple">{roleLabel}</mark>
          </article>

          <article className="neo-context-card">
            <div className="neo-context-card-icon"><AppIcon name="offline_local" size={24} className="app-icon-stat" /></div>
            <div>
              <span>Ambiente</span>
              <strong>{runtimeInfo.isWeb ? 'Online' : status?.offline_ready ? 'Producao' : 'Verificando'}</strong>
              <small>{runtimeInfo.isWeb ? 'Supabase web/mobile' : status?.sqlite_ok ? 'SQLite local ativo' : 'Aguardando leitura do banco'}</small>
            </div>
            <mark className="green">{runtimeInfo.isWeb ? 'Web' : status?.sqlite_ok ? 'Local' : 'Checando'}</mark>
          </article>

          <article className="neo-context-card">
            <div className="neo-context-card-icon"><AppIcon name="atualizar" size={24} className="app-icon-stat" /></div>
            <div>
              <span>Última atualização</span>
              <strong>{status?.settings.updated_at ? dateTime(status.settings.updated_at) : 'Agora'}</strong>
              <small>{formatTimeAgo(status?.settings.updated_at)}</small>
            </div>
          </article>
        </div>

        <div className="neo-chip-row">
          <span className="neo-confirm-chip"><i />Menu inferior configurado</span>
          <span className="neo-confirm-chip"><i />Touch otimizado</span>
          <span className="neo-confirm-chip"><i />Cards compactos</span>
          <span className="neo-confirm-chip"><i />Tabelas seguras</span>
        </div>
      </section>

      <section className="neo-dashboard-grid">
        <article className="neo-surface neo-quick-surface">
          <div className="neo-section-head">
            <div>
              <h2>Atalhos rápidos</h2>
              <p>Atalhos principais para operar rápido no celular e no PC.</p>
            </div>
          </div>

          <div className="neo-quick-grid">
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('products')}>
              <span className="neo-quick-icon"><AppIcon name="novo_item_adicionar" size={24} className="app-icon-button-inline" /></span>
              <strong>Novo Produto</strong>
            </button>
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('orders')}>
              <span className="neo-quick-icon"><AppIcon name="pedidos" size={24} className="app-icon-button-inline" /></span>
              <strong>Novo Pedido</strong>
            </button>
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('sales')}>
              <span className="neo-quick-icon"><AppIcon name="vendas_pdv" size={24} className="app-icon-button-inline" /></span>
              <strong>Abrir PDV</strong>
            </button>
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('customers')}>
              <span className="neo-quick-icon"><AppIcon name="clientes" size={24} className="app-icon-button-inline" /></span>
              <strong>Novo Cliente</strong>
            </button>
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('reports')}>
              <span className="neo-quick-icon"><AppIcon name="relatorios" size={24} className="app-icon-button-inline" /></span>
              <strong>Relatórios</strong>
            </button>
            <button type="button" className="neo-quick-card" onClick={() => onNavigate('backup')}>
              <span className="neo-quick-icon"><AppIcon name="backup" size={24} className="app-icon-button-inline" /></span>
              <strong>Backup Agora</strong>
            </button>
          </div>
        </article>

        <article className="neo-surface neo-chart-surface">
          <div className="neo-section-head neo-section-head-space">
            <div>
              <h2>Vendas dos últimos períodos</h2>
              <p>Gráfico de performance com leitura limpa no desktop e no celular.</p>
            </div>
            <div className="neo-period-switcher" role="tablist" aria-label="Período do gráfico">
              {(['today', '7d', '30d', 'month'] as DashboardSalesPeriod[]).map((period) => (
                <button
                  type="button"
                  key={period}
                  className={chartPeriod === period ? 'active' : ''}
                  onClick={() => setChartPeriod(period)}
                >
                  {periodLabel(period)}
                </button>
              ))}
            </div>
          </div>

          <div className="neo-chart-layout">
            <div className="neo-chart-y-axis">
              {chartModel.yValues.map((value, index) => <span key={`${value}-${index}`}>{axisLabel(value)}</span>)}
            </div>
            <div className="neo-chart-stage">
              <svg viewBox="0 0 720 248" className="neo-chart-svg" aria-label={chartLabel(chartModel.peakPoint)} role="img">
                <defs>
                  <linearGradient id="neoChartArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(96, 128, 255, 0.42)" />
                    <stop offset="100%" stopColor="rgba(96, 128, 255, 0.02)" />
                  </linearGradient>
                </defs>
                {chartModel.yValues.map((value, index) => (
                  <line key={`grid-${value}-${index}`} x1="18" y1={18 + ((210 / 4) * index)} x2="702" y2={18 + ((210 / 4) * index)} className="neo-chart-grid-line" />
                ))}
                {chartModel.areaPath ? <path d={chartModel.areaPath} fill="url(#neoChartArea)" /> : null}
                {chartModel.linePath ? <path d={chartModel.linePath} fill="none" stroke="#7d86ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {chartModel.points.map((point) => (
                  <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="5" fill="#9fd0ff" stroke="#141f52" strokeWidth="3" />
                ))}
              </svg>

              {chartModel.peakPoint ? (
                <div
                  className="neo-chart-tooltip"
                  style={{
                    left: `${(chartModel.peakPoint.x / 720) * 100}%`,
                    top: `${Math.max(16, chartModel.peakPoint.y - 56)}px`,
                  }}
                >
                  <strong>{money(chartModel.peakPoint.total)}</strong>
                  <span>{chartModel.peakPoint.label}</span>
                </div>
              ) : null}

              <div className="neo-chart-x-axis" style={{ gridTemplateColumns: `repeat(${Math.max(chartModel.activeSeries.length, 1)}, 1fr)` }}>
                {chartModel.activeSeries.length > 0
                  ? chartModel.activeSeries.map((point, index) => <span key={`${point.label}-${index}`}>{point.label}</span>)
                  : <span>{periodLabel(chartPeriod)}</span>}
              </div>
            </div>
          </div>

          <div className="neo-chart-footer">
            <span>{chartLoading ? 'Atualizando gráfico...' : 'Série real carregada com dados do sistema.'}</span>
            <strong>{chartModel.peakPoint ? chartLabel(chartModel.peakPoint) : 'Sem vendas no período.'}</strong>
          </div>
        </article>

        <article className="neo-surface neo-system-surface">
          <div className="neo-section-head">
            <div>
              <h2>Status do sistema</h2>
              <p>Status essencial em cards compactos e legíveis.</p>
            </div>
          </div>

          <div className="neo-system-list">
            {statusRows.map((item) => (
              <div key={item.label} className="neo-system-row">
                <div className={`neo-system-dot ${item.ok ? 'ok' : 'warn'}`} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <button type="button" className="neo-diagnostic-button" onClick={() => onNavigate('audit')}>
            <AppIcon name="auditoria_logs" size={24} className="app-icon-button-inline" />
            Diagnóstico completo
          </button>
        </article>
      </section>

      <section className="neo-trust-strip">
        <div className="neo-trust-main">
          <span className="neo-trust-badge"><AppIcon name="bloqueio_seguro" size={24} className="app-icon-button-inline" /></span>
          <div>
            <strong>Segurança e performance</strong>
            <small>{runtimeInfo.isWeb ? 'PWA web/mobile com Supabase como foco principal.' : 'Operação local protegida, visual rápido e pronto para uso diário.'}</small>
          </div>
        </div>
        <div className="neo-trust-items">
          <span>{runtimeInfo.isWeb ? 'PWA instalado' : 'SSL Ativo'}</span>
          <span>{runtimeInfo.isWeb ? 'Cache versionado' : 'Backups diários'}</span>
          <span>{runtimeInfo.isWeb ? 'Dados na nuvem' : '99,9% Uptime local'}</span>
        </div>
      </section>
    </div>
  );
}

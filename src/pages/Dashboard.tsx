import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { getRuntimeInfo } from '../lib/runtime';
import { getPublicWebEnv } from '../lib/env';
import { getWebStoreContext, webRoleLabel, type WebStoreRole } from '../lib/webApi';
import type { AppStatus, DashboardData, PageKey, Product, SaleSummary } from '../types';

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

function formatDateMinute(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(safeDate);
}

function formatHour(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(safeDate);
}

function firstName(value?: string): string {
  const base = value?.trim();
  if (!base || base.includes('@')) return 'Ana';
  if (/aguardando|login|administrador|admin/i.test(base)) return 'Ana';
  return base.split(/\s+/)[0] || 'Ana';
}

function paymentLabel(value: SaleSummary['payment_method']): string {
  const labels: Record<SaleSummary['payment_method'], string> = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao: 'Cartão',
    crediario: 'Crediário',
  };
  return labels[value] ?? 'Venda';
}

export function Dashboard({ status, refreshToken, onNavigate }: PageProps): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(status?.dashboard ?? null);
  const [products, setProducts] = useState<Product[]>([]);
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const env = useMemo(() => getPublicWebEnv(), []);
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

  const todaySalesCount = data?.today_sales_count ?? 0;
  const todaySalesTotal = data?.today_sales_total ?? 0;
  const averageTicket = todaySalesCount > 0 ? todaySalesTotal / todaySalesCount : 0;
  const activeProducts = useMemo(() => products.filter((item) => item.status !== 'inativo').length, [products]);
  const lowStockCount = data?.low_stock_count ?? 0;
  const ownerName = runtimeInfo.isWeb ? webIdentity.email || status?.settings.owner_name : status?.settings.owner_name;
  const storeName = webIdentity.storeName || status?.settings.store_name || 'Smart Loja';
  const supabaseOk = runtimeInfo.isWeb ? Boolean(env.isConfigured && webIdentity.role !== 'sem login') : Boolean(status?.sqlite_ok);
  const cacheOk = Boolean(status?.offline_ready || status?.version);
  const lastUpdate = status?.settings.updated_at;
  const cloudSummary = runtimeInfo.isWeb
    ? (supabaseOk ? 'conectado e pronto' : env.isConfigured ? 'faça login para sincronizar' : 'nuvem ainda não configurada')
    : (status?.sqlite_ok ? 'banco local pronto' : 'verificando banco');
  const syncSummary = runtimeInfo.isWeb
    ? (supabaseOk ? 'sem pendências' : env.isConfigured ? 'aguardando login' : 'nuvem desativada')
    : (status?.sqlite_ok ? 'em dia' : 'verificando');
  const cacheSummary = cacheOk ? 'pronto para uso' : 'verificando';

  const topActions: Array<{ label: string; mobileLabel: string; icon: ProductActionIcon; page: PageKey }> = [
    { label: 'Nova venda', mobileLabel: 'PDV', icon: 'vendas_pdv', page: 'sales' },
    { label: 'Novo cliente', mobileLabel: 'Cliente', icon: 'clientes', page: 'customers' },
    { label: 'Novo produto', mobileLabel: 'Produto', icon: 'produtos', page: 'products' },
    { label: 'Relatórios', mobileLabel: 'Relatórios', icon: 'relatorios', page: 'reports' },
    { label: 'Mais ações', mobileLabel: 'Mais', icon: 'acoes_rapidas', page: 'settings' },
  ];

  const operationActions: Array<{ label: string; icon: ProductActionIcon; page: PageKey }> = [
    { label: 'Abrir PDV', icon: 'vendas_pdv', page: 'sales' },
    { label: 'Nova venda', icon: 'novo_item_adicionar', page: 'sales' },
    { label: 'Receber', icon: 'dinheiro', page: 'cash' },
    { label: 'Backup', icon: 'backup', page: 'backup' },
    { label: 'Diagnóstico', icon: 'auditoria_logs', page: 'audit' },
    { label: 'Cadastrar produto', icon: 'etiquetas', page: 'products' },
  ];

  const shortcutActions: Array<{ label: string; icon: ProductActionIcon; page: PageKey; tone: string }> = [
    { label: 'Vendas recentes', icon: 'vendas_pdv', page: 'sales', tone: 'blue' },
    { label: 'Clientes', icon: 'clientes', page: 'customers', tone: 'sky' },
    { label: 'Produtos', icon: 'produtos', page: 'products', tone: 'purple' },
    { label: 'Relatórios', icon: 'relatorios', page: 'reports', tone: 'orange' },
    { label: 'Pedidos', icon: 'pedidos', page: 'orders', tone: 'slate' },
    { label: 'Crediário', icon: 'crediario', page: 'credits', tone: 'indigo' },
    { label: 'Backup', icon: 'backup', page: 'backup', tone: 'dark' },
  ];

  const statusRows = [
    { label: 'Login', value: runtimeInfo.isWeb ? (webIdentity.email ? 'OK' : 'Pendente') : 'OK', ok: runtimeInfo.isWeb ? Boolean(webIdentity.email) : true },
    { label: 'Conexão', value: runtimeInfo.isWeb ? (supabaseOk ? 'Online' : 'Atenção') : status?.sqlite_ok ? 'Online' : 'Verificar', ok: supabaseOk || Boolean(status?.sqlite_ok) },
    { label: runtimeInfo.isWeb ? 'Supabase' : 'Banco local', value: supabaseOk ? 'Online' : status?.sqlite_ok ? 'Ativo' : 'Pendente', ok: supabaseOk || Boolean(status?.sqlite_ok) },
    { label: 'Cache', value: cacheOk ? 'Ativo' : 'Verificar', ok: cacheOk },
    { label: 'Permissões', value: 'OK', ok: true },
  ];

  const messages = [
    {
      tone: 'success',
      title: todaySalesCount > 0 ? `${todaySalesCount} venda${todaySalesCount > 1 ? 's' : ''} registrada${todaySalesCount > 1 ? 's' : ''} hoje` : 'Painel pronto para vender',
      detail: todaySalesCount > 0 ? `última ${formatTimeAgo(data?.recent_sales?.[0]?.created_at)}` : 'sem bloqueios críticos',
    },
    {
      tone: lowStockCount > 0 ? 'warning' : 'success',
      title: lowStockCount > 0 ? `${lowStockCount} ${lowStockCount === 1 ? 'item pede' : 'itens pedem'} reposição` : 'Estoque em dia',
      detail: lowStockCount > 0 ? 'vale revisar ainda hoje' : 'sem alerta crítico',
    },
    {
      tone: supabaseOk || status?.sqlite_ok ? 'info' : 'warning',
      title: supabaseOk || status?.sqlite_ok ? 'Sincronização em dia' : 'Sincronização aguardando conexão',
      detail: supabaseOk || status?.sqlite_ok ? formatTimeAgo(lastUpdate) : runtimeInfo.isWeb && !env.isConfigured ? 'configure a nuvem para sincronizar' : 'toque em atualizar quando a conexão voltar',
    },
  ];

  const recentSales = data?.recent_sales ?? [];

  return (
    <div className="neo-dashboard smart-dashboard-v61 master-dashboard-ref">
      <section className="dash-hero-band">
        <div className="dash-hero-copy">
          <h1>Bom dia, {firstName(ownerName)}! <span aria-hidden="true">👋</span></h1>
          <p>Painel pronto para vender, acompanhar os indicadores e seguir para a próxima ação sem complicação.</p>
        </div>

        <div className="dash-top-actions" aria-label="Ações rápidas principais">
          {topActions.map((action) => (
            <button type="button" key={action.label} onClick={() => onNavigate(action.page)}>
              <AppIcon name={action.icon} size={32} className="app-icon-toolbar" />
              <span className="dash-action-full">{action.label}</span>
              <span className="dash-action-mobile">{action.mobileLabel}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="dash-status-strip" aria-label="Status da loja">
        <article>
          <AppIcon name="bloqueio_seguro" size={32} className="app-icon-stat" />
          <span>
            <strong>Conexão segura</strong>
            <small>Conectado e protegido</small>
          </span>
        </article>
        <article>
          <AppIcon name="sqlite_ativo" size={32} className="app-icon-stat" />
          <span>
            <strong>{runtimeInfo.isWeb ? 'Supabase' : 'SQLite local'}</strong>
            <small>{cloudSummary}</small>
          </span>
        </article>
        <article>
          <AppIcon name="atualizar" size={32} className="app-icon-stat" />
          <span>
            <strong>Sincronização</strong>
            <small>{syncSummary}</small>
          </span>
        </article>
        <article>
          <AppIcon name="arquivo_banco_sqlite" size={32} className="app-icon-stat" />
          <span>
            <strong>Cache</strong>
            <small>{cacheSummary}</small>
          </span>
        </article>
        <article>
          <AppIcon name="calendario_data" size={32} className="app-icon-stat" />
          <span>
            <strong>Última atualização</strong>
            <small>{formatDateMinute(lastUpdate)}</small>
          </span>
        </article>
      </section>

      <section className="dash-kpi-grid" aria-label="Indicadores principais">
        <article className="dash-kpi-card">
          <span>Vendas hoje</span>
          <strong>{money(todaySalesTotal)}</strong>
          <small className="is-up">↑ {todaySalesCount} venda{todaySalesCount !== 1 ? 's' : ''} hoje</small>
          <AppIcon name="vendas_pdv" size={32} className="app-icon-stat" />
        </article>
        <article className="dash-kpi-card">
          <span>Pedidos</span>
          <strong>{data?.orders_open ?? 0}</strong>
          <small className="is-up">↑ em aberto</small>
          <AppIcon name="pedidos" size={32} className="app-icon-stat" />
        </article>
        <article className="dash-kpi-card">
          <span>Produtos</span>
          <strong>{activeProducts}</strong>
          <small className={lowStockCount > 0 ? 'is-warn' : 'is-up'}>{lowStockCount} com estoque baixo</small>
          <AppIcon name="produtos" size={32} className="app-icon-stat" />
        </article>
        <article className="dash-kpi-card">
          <span>Clientes</span>
          <strong>{data?.customers_total ?? 0}</strong>
          <small className="is-up">↑ clientes cadastrados</small>
          <AppIcon name="clientes" size={32} className="app-icon-stat" />
        </article>
        <article className="dash-kpi-card">
          <span>Ticket médio</span>
          <strong>{money(averageTicket)}</strong>
          <small className="is-up">↑ média por venda</small>
          <AppIcon name="dinheiro" size={32} className="app-icon-stat" />
        </article>
      </section>

      <section className="dash-main-grid">
        <article className="dash-panel dash-quick-operation">
          <div className="dash-panel-head">
            <h2>Operação rápida</h2>
          </div>
          <div className="dash-operation-grid">
            {operationActions.map((action) => (
              <button type="button" key={action.label} onClick={() => onNavigate(action.page)}>
                <AppIcon name={action.icon} size={32} className="app-icon-button-inline" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="dash-panel dash-operational-status">
          <div className="dash-panel-head">
            <h2>Status operacional</h2>
          </div>
          <div className="dash-status-list">
            {statusRows.map((item) => (
              <div key={item.label}>
                <i className={item.ok ? 'ok' : 'warn'} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dash-bottom-grid">
        <article className="dash-panel dash-shortcuts-panel">
          <div className="dash-panel-head">
            <h2>Atalhos rápidos</h2>
          </div>
          <div className="dash-shortcut-row">
            {shortcutActions.map((action) => (
              <button type="button" key={action.label} className={`tone-${action.tone}`} onClick={() => onNavigate(action.page)}>
                <AppIcon name={action.icon} size={24} className="app-icon-chip" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          <div className="dash-panel-head dash-message-head">
            <h2>Mensagens do sistema</h2>
          </div>
          <div className="dash-message-list">
            {messages.map((message) => (
              <div key={message.title} className={`dash-message dash-message-${message.tone}`}>
                <i />
                <strong>{message.title}</strong>
                <small>{message.detail}</small>
                <button type="button" aria-label="Fechar mensagem">×</button>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-panel dash-activity-panel">
          <div className="dash-panel-head dash-panel-head-space">
            <h2>Atividade recente</h2>
            <button type="button" onClick={() => onNavigate('sales')}>Ver todas</button>
          </div>

          {recentSales.length > 0 ? (
            <div className="dash-activity-table" role="table" aria-label="Atividade recente">
              <div role="row" className="dash-activity-header">
                <span>Atividade</span>
                <span>Detalhes</span>
                <span>Valor</span>
                <span>Hora</span>
              </div>
              {recentSales.slice(0, 5).map((sale) => (
                <div role="row" key={sale.id} className="dash-activity-row">
                  <span><AppIcon name="vendas_pdv" size={24} className="app-icon-chip" />Venda #{sale.number} realizada</span>
                  <span>{paymentLabel(sale.payment_method)} · {sale.customer_name || storeName}</span>
                  <strong>{money(sale.total)}</strong>
                  <time>{formatHour(sale.created_at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-empty-activity">
              <AppIcon name="vendas_pdv" size={32} className="app-icon-button-inline" />
              <strong>Nenhuma venda registrada ainda</strong>
              <span>Quando uma venda for concluída, ela aparece aqui automaticamente.</span>
            </div>
          )}
        </article>
      </section>

      <section className="dash-mobile-sync-row" aria-label="Resumo de sincronização">
        <span className="dash-message dash-message-success"><i />Venda salva com sucesso</span>
        <span className="dash-message dash-message-info"><i />{runtimeInfo.isWeb ? webRoleLabel(webIdentity.role) : 'Operação local'}</span>
      </section>
    </div>
  );
}

type ProductActionIcon =
  | 'acoes_rapidas'
  | 'arquivo_banco_sqlite'
  | 'atalhos'
  | 'auditoria_logs'
  | 'backup'
  | 'calendario_data'
  | 'clientes'
  | 'crediario'
  | 'dinheiro'
  | 'etiquetas'
  | 'novo_item_adicionar'
  | 'pedidos'
  | 'produtos'
  | 'relatorios'
  | 'sqlite_ativo'
  | 'vendas_pdv';

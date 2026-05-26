import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { buildAppAlerts } from '../lib/alerts';
import { api } from '../lib/api';
import { playOperationSound } from '../lib/sound';
import { getRuntimeInfo } from '../lib/runtime';
import type { DelphiIconName } from '../lib/icons';
import type { AppStatus, CreditSummary, PageKey, Product, Settings } from '../types';

const pages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'dashboard', label: 'Painel da Loja', icon: 'painel_da_loja' },
  { key: 'products', label: 'Produtos', icon: 'produtos' },
  { key: 'customers', label: 'Clientes', icon: 'clientes' },
  { key: 'orders', label: 'Pedidos', icon: 'pedidos' },
  { key: 'sales', label: 'Vendas / PDV', icon: 'vendas_pdv' },
  { key: 'cash', label: 'Caixa', icon: 'caixa' },
  { key: 'credits', label: 'Crediario', icon: 'crediario' },
  { key: 'receipts', label: 'Comprovantes', icon: 'comprovantes' },
  { key: 'reports', label: 'Relatorios', icon: 'relatorios' },
  { key: 'backup', label: 'Backup', icon: 'backup' },
  { key: 'settings', label: 'Configuracoes', icon: 'configuracoes' },
  { key: 'audit', label: 'Auditoria / Logs', icon: 'auditoria_logs' },
  { key: 'diagnostics', label: 'Diagnostico Web', icon: 'bloqueio_seguro' },
];

interface ShellProps {
  activePage: PageKey;
  setActivePage: (page: PageKey) => void;
  status: AppStatus | null;
  settings: Settings | null;
  children: React.ReactNode;
  onRefresh: () => void;
  refreshToken: number;
}

interface NavAlertMeta {
  count: number;
  level: 'danger' | 'warning' | 'info' | 'ok' | null;
}

function shortDbName(value: string | undefined): string {
  if (!value) return 'Banco local';
  return value.split(/[/\\]/).pop() || value;
}

function formatClassicDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function Shell({ activePage, setActivePage, status, settings, children, onRefresh, refreshToken }: ShellProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [toast, setToast] = useState<{ title: string; detail: string; page: PageKey; level: 'danger' | 'warning' | 'info' } | null>(null);
  const prevAlertSignature = useRef('');

  useEffect(() => {
    if (runtimeInfo.isWeb) {
      setProducts([]);
      setCredits([]);
      return undefined;
    }

    let alive = true;
    Promise.all([api.products(), api.credits()])
      .then(([nextProducts, nextCredits]) => {
        if (!alive) return;
        setProducts(nextProducts);
        setCredits(nextCredits);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [refreshToken, runtimeInfo.isWeb]);

  const alerts = useMemo(() => buildAppAlerts(status, products, credits), [credits, products, status]);

  const navAlerts = useMemo<Record<PageKey, NavAlertMeta>>(() => {
    const result = pages.reduce((acc, page) => {
      acc[page.key] = { count: 0, level: null };
      return acc;
    }, {} as Record<PageKey, NavAlertMeta>);

    const weight: Record<'danger' | 'warning' | 'info' | 'ok', number> = {
      danger: 4,
      warning: 3,
      info: 2,
      ok: 1,
    };

    for (const alert of alerts) {
      if (alert.level === 'ok') continue;
      const current = result[alert.page];
      current.count += 1;
      if (!current.level || weight[alert.level] > weight[current.level]) current.level = alert.level;
    }

    return result;
  }, [alerts]);

  const activeAlerts = alerts.filter((alert) => alert.page === activePage && alert.level !== 'ok');
  const sidebarAlerts = alerts.filter((alert) => alert.level !== 'ok').slice(0, 3);

  const activePageMeta = useMemo(() => pages.find((page) => page.key === activePage) ?? pages[0], [activePage]);
  const pageSubtitle = useMemo(() => {
    const subtitles: Record<PageKey, string> = {
      dashboard: 'Visao geral rapida do seu negocio.',
      products: 'Gerencie seu catalogo de produtos e estoque.',
      customers: 'Cadastre, localize e acompanhe seus clientes.',
      orders: 'Acompanhe pedidos locais e separacao.',
      sales: 'Faca a venda rapida de produtos.',
      cash: 'Controle o caixa e as movimentacoes.',
      credits: 'Consulte parcelas e recebimentos do crediario.',
      receipts: 'Abra e reenvie comprovantes salvos.',
      reports: 'Analise resultados e exporte relatorios.',
      backup: 'Proteja o banco local com copias e restauracao.',
      settings: 'Ajuste os dados da loja e preferencias.',
      audit: 'Consulte logs e historico operacional.',
      diagnostics: 'Valide Cloudflare, Supabase e modo de execucao.',
    };
    return subtitles[activePage];
  }, [activePage]);

  const todayLabel = useMemo(() => formatClassicDate(), []);
  const environmentLabel = runtimeInfo.isWeb ? 'Web/Supabase' : status?.offline_ready ? 'Local (Offline)' : 'Verificando';
  const lastSyncLabel = settings?.updated_at ? new Date(settings.updated_at).toLocaleString('pt-BR') : 'Sem registro';
  const storageLabel = runtimeInfo.storageLabel;

  useEffect(() => {
    const mainAlerts = alerts.filter((alert) => alert.level !== 'ok');
    const signature = mainAlerts.map((alert) => `${alert.id}:${alert.title}:${alert.detail}`).join('|');
    if (!signature) {
      prevAlertSignature.current = '';
      return;
    }
    if (signature !== prevAlertSignature.current) {
      const incoming = mainAlerts[0];
      setToast({ title: incoming.title, detail: incoming.detail, page: incoming.page, level: incoming.level as 'danger' | 'warning' | 'info' });
      playOperationSound(incoming.level === 'danger' ? 'error' : 'warning');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta da loja', { body: `${incoming.title} - ${incoming.detail}` });
      }
      prevAlertSignature.current = signature;
    }
  }, [alerts]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="classic-shell">
      <header className="window-titlebar">
        <div className="window-titlebar-left">
          <AppIcon name="app_logo_cadeado_carrinho" size={16} className="window-app-icon" />
          <strong>Smart Loja Facil Offline</strong>
        </div>
        <div className="window-controls" aria-hidden="true">
          <span className="window-btn">_</span>
          <span className="window-btn">[]</span>
          <span className="window-btn window-btn-close">X</span>
        </div>
      </header>

      <div className="workspace-strip">
        <span>Ambiente: <strong>{runtimeInfo.platformLabel}</strong></span>
        <span>Dados: <strong>{storageLabel}</strong></span>
        <button type="button" onClick={() => setActivePage('diagnostics')}>Diagnostico</button>
      </div>

      <div className="window-toolbar">
        <div className="window-toolbar-left">
          <button type="button" className="toolbar-btn" onClick={onRefresh}>
            <span className="toolbar-glyph"><AppIcon name="atualizar" size={32} className="app-icon-toolbar" /></span>
            <span>Atualizar</span>
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setActivePage('dashboard')}>
            <span className="toolbar-glyph"><AppIcon name="atalhos" size={32} className="app-icon-toolbar" /></span>
            <span>Atalhos</span>
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setActivePage('receipts')}>
            <span className="toolbar-glyph"><AppIcon name="imprimir" size={32} className="app-icon-toolbar" /></span>
            <span>Imprimir</span>
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setActivePage('settings')}>
            <span className="toolbar-glyph"><AppIcon name="ajuda" size={32} className="app-icon-toolbar" /></span>
            <span>Ajuda</span>
          </button>
        </div>
        <div className="window-toolbar-right">
          <span className="toolbar-status-chip toolbar-status-offline"><AppIcon name="offline_local" size={16} className="app-icon-chip" />{runtimeInfo.isWeb ? 'Web seguro' : '100% Offline'}</span>
          <span className="toolbar-status-chip toolbar-status-sqlite"><AppIcon name="sqlite_ativo" size={16} className="app-icon-chip" />{runtimeInfo.isWeb ? 'Supabase pronto' : 'SQLite ativo'}</span>
          <button type="button" className="toolbar-action-btn" onClick={onRefresh}><AppIcon name="atualizar" size={16} className="app-icon-chip" />Atualizar dados</button>
        </div>
      </div>

      <div className="app-shell classic-layout">
        <aside className="sidebar classic-sidebar">
          <div className="brand classic-brand">
            <AppIcon name="sistema_local" size={48} className="app-icon-brand" />
            <div>
              <strong>SMART LOJA FACIL</strong>
              <span>{runtimeInfo.isWeb ? 'Web/PWA em migracao' : 'Sistema Local e Offline'}</span>
            </div>
          </div>

          <nav className="nav-list classic-nav-list" aria-label="Menu principal">
            {pages.map((page) => {
              const pageAlert = navAlerts[page.key];
              return (
                <button
                  type="button"
                  key={page.key}
                  className={[
                    activePage === page.key ? 'active' : '',
                    pageAlert.level ? `nav-alert-${pageAlert.level}` : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setActivePage(page.key)}
                >
                  <span className="nav-icon-box"><AppIcon name={page.icon} size={16} className="app-icon-nav" /></span>
                  <span className="nav-label">{page.label}</span>
                  {pageAlert.count > 0 && <small className={`nav-badge nav-badge-${pageAlert.level}`}>{pageAlert.count}</small>}
                </button>
              );
            })}
          </nav>

          {sidebarAlerts.length > 0 && (
            <section className="side-alerts classic-side-alerts" aria-label="Alertas rapidos">
              <div className="side-alerts-head">
                <strong>Pontos de atencao</strong>
                <span>{sidebarAlerts.length}</span>
              </div>
              <div className="side-alert-list">
                {sidebarAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    className={`side-alert side-alert-${alert.level}`}
                    onClick={() => setActivePage(alert.page)}
                  >
                    <span className="alert-dot" aria-hidden="true" />
                    <span>
                      <strong>{alert.title}</strong>
                      <small>{alert.detail}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="local-status classic-local-status">
            <strong>Sistema Local</strong>
            <span className="ok-dot"><AppIcon name="sqlite_ativo" size={16} className="app-icon-chip" />{storageLabel}</span>
            <small>Ambiente: {runtimeInfo.platformLabel}</small>
            <small>Versao: {status?.version ?? '1.0.0'}</small>
          </div>
        </aside>

        <main className="content classic-content">
          <div className="classic-page-top">
            <div className="classic-greeting-card">
              <div className="classic-greeting-icon"><AppIcon name="usuario_administrador" size={24} className="app-icon-user" /></div>
              <div>
                <strong>Ola, Administrador</strong>
                <span>Bem-vindo(a) de volta!</span>
              </div>
            </div>
            <div className="search-box classic-search-box" aria-label="Busca visual">
              <span className="classic-search-icon"><AppIcon name="buscar" size={16} className="app-icon-chip" /></span>
              <input placeholder="Busca global (ex.: produto, cliente, pedido...)" readOnly />
              <kbd>Ctrl + K</kbd>
            </div>
            <div className="classic-page-health">
              <div className="classic-date-chip"><AppIcon name="calendario_data" size={16} className="app-icon-chip" />{todayLabel}</div>
              <div className="classic-offline-indicator">
                <span className="classic-offline-dot"><AppIcon name="offline_local" size={16} className="app-icon-chip" /></span>
                <strong>{runtimeInfo.isWeb ? 'Web' : 'Offline'}</strong>
              </div>
            </div>
          </div>

          {toast && (
            <button type="button" className={`floating-alert floating-alert-${toast.level}`} onClick={() => setActivePage(toast.page)}>
              <strong>{toast.title}</strong>
              <span>{toast.detail}</span>
            </button>
          )}

          <section className="page-frame classic-page-frame">
            <div className="classic-page-header">
              <div>
                <div className="classic-page-title-row">
                  <span className="classic-page-icon"><AppIcon name={activePageMeta.icon} size={24} className="app-icon-page" /></span>
                  <h1>{activePageMeta.label}</h1>
                </div>
                <p>{pageSubtitle}</p>
              </div>
              <div className="classic-page-header-status">
                <span className={`topbar-chip ${runtimeInfo.isWeb || status?.offline_ready ? 'ok' : 'warn'}`}>{environmentLabel}</span>
                <span className={`topbar-chip ${runtimeInfo.isWeb || status?.sqlite_ok ? 'ok' : 'warn'}`}>{runtimeInfo.isWeb ? 'Supabase web' : status?.sqlite_ok ? 'SQLite ativo' : 'SQLite indisponivel'}</span>
              </div>
            </div>

            {activeAlerts.length > 0 && (
              <div className={`page-alert-banner page-alert-${activeAlerts[0].level}`}>
                <strong>{activeAlerts[0].title}</strong>
                <span>{activeAlerts[0].detail}</span>
              </div>
            )}
            {children}
          </section>

          <footer className="statusbar classic-statusbar">
            <div className="status-item">
              <small className="status-label">LOJA ATIVA</small>
              <strong className="status-value">{settings?.store_name || 'Minha Loja'}</strong>
            </div>
            <div className="status-item">
              <small className="status-label">USUARIO</small>
              <strong className="status-value">Administrador</strong>
            </div>
            <div className="status-item">
              <small className="status-label">AMBIENTE</small>
              <strong className="status-value">{environmentLabel}</strong>
            </div>
            <div className="status-item">
              <small className="status-label">ARQUIVO</small>
              <strong className="status-value">{runtimeInfo.isWeb ? storageLabel : shortDbName(status?.db_path)}</strong>
            </div>
            <div className="status-item">
              <small className="status-label">ULTIMA ATUALIZACAO</small>
              <strong className="status-value">{lastSyncLabel}</strong>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

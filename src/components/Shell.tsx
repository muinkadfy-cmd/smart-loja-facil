import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { buildAppAlerts } from '../lib/alerts';
import { api } from '../lib/api';
import { playOperationSound } from '../lib/sound';
import { getRuntimeInfo } from '../lib/runtime';
import { getWebAuthSnapshot, webRoleLabel, webSyncQueueSnapshot, type WebStoreRole } from '../lib/webApi';
import type { DelphiIconName } from '../lib/icons';
import type { AppStatus, CreditSummary, PageKey, Product, Settings } from '../types';

const pages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'painel_da_loja' },
  { key: 'products', label: 'Produtos', icon: 'produtos' },
  { key: 'customers', label: 'Clientes', icon: 'clientes' },
  { key: 'orders', label: 'Pedidos', icon: 'pedidos' },
  { key: 'sales', label: 'Vendas / PDV', icon: 'vendas_pdv' },
  { key: 'cash', label: 'Caixa', icon: 'caixa' },
  { key: 'credits', label: 'Crediário', icon: 'crediario' },
  { key: 'receipts', label: 'Comprovantes', icon: 'comprovantes' },
  { key: 'reports', label: 'Relatórios', icon: 'relatorios' },
  { key: 'backup', label: 'Backup', icon: 'backup' },
  { key: 'settings', label: 'Configurações', icon: 'configuracoes' },
  { key: 'audit', label: 'Logs / Diagnóstico', icon: 'auditoria_logs' },
  { key: 'diagnostics', label: 'Diagnóstico Web', icon: 'bloqueio_seguro' },
];

const mobileMainPages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'dashboard', label: 'Início', icon: 'painel_da_loja' },
  { key: 'products', label: 'Produtos', icon: 'produtos' },
  { key: 'sales', label: 'Vendas', icon: 'vendas_pdv' },
  { key: 'customers', label: 'Clientes', icon: 'clientes' },
];

const headerActions: Array<{ key: string; label: string; mobileLabel: string; icon: DelphiIconName; action: 'refresh' | PageKey }> = [
  { key: 'refresh', label: 'Atualizar dados', mobileLabel: 'Atualizar', icon: 'atualizar', action: 'refresh' },
  { key: 'customers', label: 'Clientes', mobileLabel: 'Clientes', icon: 'clientes', action: 'customers' },
  { key: 'products', label: 'Produtos', mobileLabel: 'Produtos', icon: 'produtos', action: 'products' },
  { key: 'settings', label: 'Config. loja', mobileLabel: 'Config.', icon: 'configuracoes', action: 'settings' },
  { key: 'diagnostics', label: 'Diagnóstico', mobileLabel: 'Status', icon: 'bloqueio_seguro', action: 'diagnostics' },
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

interface WebIdentityState {
  email: string;
  role: WebStoreRole | 'sem login';
  storeName: string;
}

function shortDbName(value: string | undefined): string {
  if (!value) return 'Banco local';
  return value.split(/[/\\]/).pop() || value;
}

function formatClassicDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function pageSubtitle(page: PageKey): string {
  const subtitles: Record<PageKey, string> = {
    dashboard: 'Visão geral com atalhos, indicadores e status da loja online.',
    products: 'Gerencie catálogo, estoque e disponibilidade dos produtos.',
    customers: 'Cadastre, localize e acompanhe seus clientes com rapidez.',
    orders: 'Acompanhe pedidos locais e entregas sem perder o fluxo.',
    sales: 'Realize vendas, PDV e recebimentos com operação simples.',
    cash: 'Controle entradas, saídas e fechamento do caixa.',
    credits: 'Consulte o crediário, parcelas e recebimentos pendentes.',
    receipts: 'Abra, imprima e reenvie comprovantes salvos.',
    reports: 'Veja métricas, exporte relatórios e acompanhe resultados.',
    backup: 'Proteja seus dados com backup e restauração local.',
    settings: 'Ajuste a loja, preferências e configurações do sistema.',
    audit: 'Consulte alertas, trilhas de auditoria e diagnósticos.',
    diagnostics: 'Confira conexão, login, permissão, cache e sincronização.',
  };
  return subtitles[page];
}

function initialsFromSettings(settings: Settings | null): string {
  const base = settings?.owner_name?.trim() || 'Administrador';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}


function displayNameFromSettings(settings: Settings | null, fallbackEmail = ''): string {
  const ownerName = settings?.owner_name?.trim();
  if (ownerName && !ownerName.includes('@')) return ownerName;
  const email = fallbackEmail || ownerName || '';
  if (email.includes('@')) return email.split('@')[0] || 'Administrador';
  return ownerName || 'Administrador';
}

export function Shell({ activePage, setActivePage, status, settings, children, onRefresh, refreshToken }: ShellProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [toast, setToast] = useState<{ title: string; detail: string; page: PageKey; level: 'danger' | 'warning' | 'info' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [syncQueue, setSyncQueue] = useState(() => webSyncQueueSnapshot());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'));
  const [webIdentity, setWebIdentity] = useState<WebIdentityState>({ email: '', role: 'sem login', storeName: '' });
  const prevAlertSignature = useRef('');
  const prevSyncNoticeSignature = useRef('');


  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    const syncNetworkState = () => setNetworkOnline(navigator.onLine);
    window.addEventListener('online', syncNetworkState);
    window.addEventListener('offline', syncNetworkState);
    syncNetworkState();
    return () => {
      window.removeEventListener('online', syncNetworkState);
      window.removeEventListener('offline', syncNetworkState);
    };
  }, [runtimeInfo.isWeb]);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    const updateSyncSnapshot = () => setSyncQueue(webSyncQueueSnapshot());
    const updateOnVisible = () => {
      if (document.visibilityState === 'visible') updateSyncSnapshot();
    };
    window.addEventListener('smart-loja:web-sync-queue-changed', updateSyncSnapshot);
    window.addEventListener('smart-loja:web-remote-change', updateSyncSnapshot);
    window.addEventListener('online', updateSyncSnapshot);
    window.addEventListener('offline', updateSyncSnapshot);
    document.addEventListener('visibilitychange', updateOnVisible);
    updateSyncSnapshot();
    return () => {
      window.removeEventListener('smart-loja:web-sync-queue-changed', updateSyncSnapshot);
      window.removeEventListener('smart-loja:web-remote-change', updateSyncSnapshot);
      window.removeEventListener('online', updateSyncSnapshot);
      window.removeEventListener('offline', updateSyncSnapshot);
      document.removeEventListener('visibilitychange', updateOnVisible);
    };
  }, [runtimeInfo.isWeb]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    let active = true;
    void getWebAuthSnapshot({ createIfMissing: false })
      .then((snapshot) => {
        if (!active) return;
        setWebIdentity({
          email: snapshot.email,
          role: snapshot.role,
          storeName: snapshot.storeName || (snapshot.hasSession ? 'loja pendente' : ''),
        });
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
    return () => {
      alive = false;
    };
  }, [refreshToken, runtimeInfo.isWeb]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activePage]);

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
  const syncAlert = useMemo(() => {
    if (!runtimeInfo.isWeb) return null;
    const hasLogin = Boolean(webIdentity.email);
    if (!networkOnline) {
      return {
        level: 'warning' as const,
        title: syncQueue.pending > 0 ? `Sem internet · ${syncQueue.pending} alteração(ões) guardada(s)` : 'Sem internet neste aparelho',
        detail: syncQueue.pending > 0
          ? 'Nada foi perdido: ficou salvo neste aparelho e será enviado para a nuvem quando a conexão voltar.'
          : 'Você consegue consultar telas em cache. Para salvar na nuvem, espere a internet voltar.',
      };
    }
    if (syncQueue.pending > 0 && syncQueue.last_error) {
      return {
        level: 'danger' as const,
        title: `${syncQueue.pending} sincronização(ões) com erro`,
        detail: `A alteração está salva neste aparelho, mas ainda não subiu para a nuvem. Último erro: ${syncQueue.last_error}`,
      };
    }
    if (syncQueue.pending > 0) {
      return {
        level: 'warning' as const,
        title: `${syncQueue.pending} alteração(ões) aguardando sincronização`,
        detail: 'O app vai reenviar automaticamente. Mantenha a internet ligada e toque em Atualizar dados para forçar agora.',
      };
    }
    if (!hasLogin) {
      return {
        level: 'info' as const,
        title: 'Login pendente para sincronizar',
        detail: 'Entre com e-mail e senha para liberar cadastros, produtos, vendas, caixa, crediário e sincronização entre computador e celular.',
      };
    }
    if (hasLogin && !webIdentity.storeName) {
      return {
        level: 'info' as const,
        title: 'Loja ainda não vinculada',
        detail: 'Seu login está ativo. Toque em Atualizar dados para criar ou localizar a loja web e liberar a sincronização completa.',
      };
    }
    return null;
  }, [networkOnline, runtimeInfo.isWeb, syncQueue.last_error, syncQueue.pending, webIdentity.email, webIdentity.storeName]);

  const syncIssueCount = runtimeInfo.isWeb
    ? Number(!networkOnline) + Number(syncQueue.pending > 0) + Number(Boolean(syncQueue.last_error && syncQueue.pending > 0)) + Number(!webIdentity.email) + Number(Boolean(webIdentity.email && !webIdentity.storeName))
    : 0;
  const notificationCount = alerts.filter((alert) => alert.level !== 'ok').length + syncIssueCount;
  const activePageMeta = useMemo(() => pages.find((page) => page.key === activePage) ?? pages[0], [activePage]);
  const activePageTitle = activePage === 'dashboard' ? 'Resumo rápido' : activePageMeta.label;
  const environmentLabel = runtimeInfo.isWeb ? (networkOnline ? 'Online' : 'Sem internet') : status?.offline_ready ? 'Local / Offline' : 'Verificando';
  const avatarInitials = initialsFromSettings(settings);
  const greetingName = displayNameFromSettings(settings, webIdentity.email);
  const greetingDetail = runtimeInfo.isWeb
    ? `${webRoleLabel(webIdentity.role)} · ${webIdentity.storeName || 'aguardando loja web'}`
    : 'Bem-vindo(a) ao Smart Loja Fácil';
  const cloudDataLabel = runtimeInfo.isWeb
    ? syncQueue.pending > 0 ? `${syncQueue.pending} pendente(s)` : webIdentity.email && webIdentity.storeName && networkOnline ? 'Dados sincronizados' : webIdentity.email && networkOnline ? 'Loja pendente' : networkOnline ? 'Login pendente' : 'Sem conexão'
    : 'SQLite ativo';

  const requestSyncNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const nextPermission = await Notification.requestPermission();
    setNotificationPermission(nextPermission);
    if (nextPermission === 'granted') {
      new Notification('Avisos do Smart Loja Fácil ativados', { body: 'Vou avisar quando houver sincronização pendente, erro de envio ou internet offline.' });
    }
  }, []);

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
    if (!runtimeInfo.isWeb || !syncAlert) return;
    const signature = `${syncAlert.level}:${syncAlert.title}:${syncAlert.detail}`;
    if (signature === prevSyncNoticeSignature.current) return;
    prevSyncNoticeSignature.current = signature;
    const toastLevel = syncAlert.level === 'danger' ? 'danger' : syncAlert.level === 'warning' ? 'warning' : 'info';
    setToast({ title: syncAlert.title, detail: syncAlert.detail, page: 'diagnostics', level: toastLevel });
    if (syncAlert.level === 'danger' || syncAlert.level === 'warning') {
      playOperationSound(syncAlert.level === 'danger' ? 'error' : 'warning');
    }
    if (notificationPermission === 'granted') {
      new Notification('Smart Loja Fácil', { body: `${syncAlert.title} — ${syncAlert.detail}` });
    }
  }, [notificationPermission, runtimeInfo.isWeb, syncAlert]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isMoreActive = !mobileMainPages.some((page) => page.key === activePage);

  return (
    <div className={`neo-shell ${runtimeInfo.isWeb ? 'neo-shell-web' : 'neo-shell-local'} ${sidebarOpen ? 'neo-nav-open' : ''}`}>
      <div className="neo-windowbar">
        <div className="neo-windowbar-brand">
          <img src="/brand/smart-loja-icon.png" alt="" className="neo-windowbar-logo" />
          <strong>Smart Loja Fácil</strong>
        </div>
        <div className="neo-windowbar-right">
          <span>{runtimeInfo.isWeb ? 'PWA/Web' : 'Aplicativo local'}</span>
          <span>{runtimeInfo.isWeb ? (networkOnline ? 'Dados na nuvem' : 'Offline no aparelho') : shortDbName(status?.db_path)}</span>
        </div>
      </div>

      <div className="neo-layout">
        {sidebarOpen && <button type="button" className="neo-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />}

        <aside className={`neo-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="neo-sidebar-brand">
            <div className="neo-sidebar-brand-mark">
              <img src="/brand/smart-loja-icon.png" alt="" className="neo-brand-logo-img" />
            </div>
            <div className="neo-sidebar-brand-copy">
              <strong>SMART LOJA FÁCIL</strong>
              <small>{runtimeInfo.isWeb ? 'PWA sincronizado' : 'Store Manager Local'}</small>
            </div>
            <button type="button" className="neo-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">×</button>
          </div>

          <nav className="neo-nav" aria-label="Menu principal">
            {pages.map((page) => {
              const pageAlert = navAlerts[page.key];
              return (
                <button
                  type="button"
                  key={page.key}
                  className={`neo-nav-item ${activePage === page.key ? 'active' : ''} ${pageAlert.level ? `is-${pageAlert.level}` : ''}`.trim()}
                  onClick={() => setActivePage(page.key)}
                  aria-current={activePage === page.key ? 'page' : undefined}
                >
                  <span className="neo-nav-item-icon">
                    <AppIcon name={page.icon} size={16} className="app-icon-nav" />
                  </span>
                  <span className="neo-nav-item-label">{page.label}</span>
                  {pageAlert.count > 0 ? <small className={`neo-nav-item-badge ${pageAlert.level}`}>{pageAlert.count}</small> : null}
                </button>
              );
            })}
          </nav>

          <div className="neo-sidebar-footer">
            <div className="neo-env-block">
              <div>
                <small>Ambiente</small>
                <strong>{runtimeInfo.isWeb ? (networkOnline ? 'Online' : 'Offline') : 'Local'}</strong>
              </div>
              <span className="neo-status-dot" />
            </div>
            <div className="neo-version-block">
              <span>Versão {status?.version ?? '1.2.0'}</span>
              <button type="button" onClick={() => setActivePage('audit')}>Ver status do sistema</button>
            </div>
          </div>
        </aside>

        <main className="neo-main">
          <header className="neo-topbar">
            <div className="neo-topbar-mobile-row">
              <button type="button" className="neo-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
                <span />
                <span />
                <span />
              </button>
              <div className="neo-mobile-branding">
                <img src="/brand/smart-loja-icon.png" alt="" className="neo-mobile-brand-logo" />
                <div>
                  <strong>Smart Loja Fácil</strong>
                  <small>Store Manager</small>
                </div>
              </div>
              <div className="neo-mobile-tools">
                <button type="button" className="neo-notify-btn" onClick={() => setActivePage('audit')} aria-label="Notificações">
                  <AppIcon name="auditoria_logs" size={16} className="app-icon-chip" />
                  {notificationCount > 0 ? <span>{notificationCount}</span> : null}
                </button>
              </div>
            </div>

            <div className="neo-header-grid">
              <section className="neo-greeting-surface">
                <div className="neo-greeting-copy">
                  <strong>{runtimeInfo.isWeb && !webIdentity.email ? 'Aguardando login' : `Olá, ${greetingName}`}</strong>
                  <span>{runtimeInfo.isWeb && !webIdentity.email ? 'Entre para sincronizar a loja web' : greetingDetail}</span>
                </div>
                <div className="neo-user-pill">
                  <span>{avatarInitials}</span>
                  <i />
                </div>
              </section>

              <section className="neo-action-ribbon" aria-label="Atalhos principais">
                {headerActions.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className="neo-action-tile"
                    onClick={() => {
                      if (item.action === 'refresh') {
                        onRefresh();
                        return;
                      }
                      setActivePage(item.action);
                    }}
                  >
                    <span className="neo-action-icon"><AppIcon name={item.icon} size={16} className="app-icon-toolbar" /></span>
                    <span className="neo-action-label-full">{item.label}</span>
                    <span className="neo-action-label-mobile">{item.mobileLabel}</span>
                  </button>
                ))}
              </section>

              <section className="neo-header-status-row">
                <div className="neo-header-chip neo-header-chip-primary">
                  <AppIcon name="offline_local" size={16} className="app-icon-chip" />
                  <span>{runtimeInfo.isWeb ? (networkOnline ? 'Conexão segura' : 'Sem internet') : 'Modo local'}</span>
                </div>
                <div className={`neo-header-chip ${runtimeInfo.isWeb && syncQueue.pending > 0 ? 'neo-header-chip-warning' : ''}`}>
                  <AppIcon name="sqlite_ativo" size={16} className="app-icon-chip" />
                  <span>{cloudDataLabel}</span>
                </div>
                <div className="neo-header-chip">
                  <AppIcon name="calendario_data" size={16} className="app-icon-chip" />
                  <span>{formatClassicDate()}</span>
                </div>
              </section>
            </div>
          </header>

          {toast ? (
            <button type="button" className={`neo-toast neo-toast-${toast.level}`} onClick={() => setActivePage(toast.page)}>
              <strong>{toast.title}</strong>
              <span>{toast.detail}</span>
            </button>
          ) : null}

          <section className="neo-page-shell mobile-scroll-real-v69">
            <div className="neo-page-meta">
              <div>
                <div className="neo-page-meta-title">
                  <span className="neo-page-meta-icon"><AppIcon name={activePageMeta.icon} size={24} className="app-icon-page" /></span>
                  <h1>{activePageTitle}</h1>
                </div>
                <p>{pageSubtitle(activePage)}</p>
              </div>
              <div className="neo-page-meta-status">
                <span className={`neo-mini-chip ${(!runtimeInfo.isWeb || networkOnline) && (runtimeInfo.isWeb || status?.offline_ready) ? 'ok' : 'warn'}`}>{environmentLabel}</span>
                <span className={`neo-mini-chip ${(runtimeInfo.isWeb ? Boolean(webIdentity.email && webIdentity.storeName) : status?.sqlite_ok) ? 'ok' : 'warn'}`}>{runtimeInfo.isWeb ? cloudDataLabel : status?.sqlite_ok ? 'SQLite ativo' : 'SQLite indisponível'}</span>
              </div>
            </div>

            {syncAlert ? (
              <div className={`neo-sync-alert neo-sync-alert-${syncAlert.level}`} role="status" aria-live="polite">
                <div className="neo-sync-alert-dot" aria-hidden="true" />
                <div className="neo-sync-alert-copy">
                  <strong>{syncAlert.title}</strong>
                  <span>{syncAlert.detail}</span>
                  {syncQueue.last_success_at && syncQueue.pending === 0 ? <small>Último envio para a nuvem: {new Date(syncQueue.last_success_at).toLocaleString('pt-BR')}</small> : null}
                </div>
                <div className="neo-sync-alert-actions">
                  <button type="button" onClick={onRefresh}>Atualizar dados</button>
                  <button type="button" onClick={() => setActivePage('diagnostics')}>{runtimeInfo.isWeb && !webIdentity.email ? 'Entrar agora' : 'Ver diagnóstico'}</button>
                  {notificationPermission === 'default' ? <button type="button" onClick={requestSyncNotifications}>Ativar avisos</button> : null}
                </div>
              </div>
            ) : null}

            {activeAlerts.length > 0 ? (
              <div className={`neo-page-alert neo-page-alert-${activeAlerts[0].level}`}>
                <strong>{activeAlerts[0].title}</strong>
                <span>{activeAlerts[0].detail}</span>
              </div>
            ) : null}

            <div className="neo-page-content mobile-scroll-safe-v69">{children}</div>
          </section>
        </main>
      </div>

      <nav className="neo-mobile-dock" aria-label="Navegação mobile">
        {mobileMainPages.map((page) => (
          <button
            type="button"
            key={page.key}
            className={activePage === page.key ? 'active' : ''}
            onClick={() => setActivePage(page.key)}
            aria-current={activePage === page.key ? 'page' : undefined}
          >
            <AppIcon name={page.icon} size={16} className="app-icon-chip" />
            <span>{page.label}</span>
          </button>
        ))}
        <button type="button" className={isMoreActive ? 'active' : ''} onClick={() => setSidebarOpen(true)} aria-current={isMoreActive ? 'page' : undefined}>
          <AppIcon name="configuracoes" size={16} className="app-icon-chip" />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { buildAppAlerts } from '../lib/alerts';
import { api } from '../lib/api';
import { getOperationNotificationsEnabled, getOperationSoundsEnabled, playOperationSound, setOperationNotificationsEnabled, setOperationSoundsEnabled } from '../lib/sound';
import { getRuntimeInfo } from '../lib/runtime';
import { getPublicWebEnv } from '../lib/env';
import { flushWebOutbox, getWebOutboxStats, getWebRoleCapabilities, getWebStoreContext, readWebSyncSnapshot, type WebOutboxStats, type WebStoreRole, type WebSyncSnapshot } from '../lib/webApi';
import type { DelphiIconName } from '../lib/icons';
import type { AppStatus, CreditSummary, PageKey, Product, Settings } from '../types';

const pages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'painel_da_loja' },
  { key: 'sales', label: 'Vendas / PDV', icon: 'vendas_pdv' },
  { key: 'orders', label: 'Pedidos', icon: 'pedidos' },
  { key: 'products', label: 'Produtos', icon: 'produtos' },
  { key: 'customers', label: 'Clientes', icon: 'clientes' },
  { key: 'reports', label: 'Relatórios', icon: 'relatorios' },
  { key: 'cash', label: 'Caixa', icon: 'caixa' },
  { key: 'credits', label: 'Crediário', icon: 'crediario' },
  { key: 'receipts', label: 'Comprovantes', icon: 'comprovantes' },
  { key: 'backup', label: 'Backup', icon: 'backup' },
  { key: 'settings', label: 'Configurações', icon: 'configuracoes' },
  { key: 'audit', label: 'Logs / Diagnóstico', icon: 'auditoria_logs' },
  { key: 'diagnostics', label: 'Diagnóstico Web', icon: 'bloqueio_seguro' },
  { key: 'coupons', label: 'Cupom', icon: 'etiquetas' },
];

const mobileDockPages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'dashboard', label: 'Painel', icon: 'painel_da_loja' },
  { key: 'sales', label: 'PDV', icon: 'vendas_pdv' },
  { key: 'orders', label: 'Pedidos', icon: 'pedidos' },
  { key: 'products', label: 'Estoque', icon: 'produtos' },
  { key: 'customers', label: 'Clientes', icon: 'clientes' },
  { key: 'reports', label: 'Relat.', icon: 'relatorios' },
  { key: 'cash', label: 'Caixa', icon: 'caixa' },
  { key: 'credits', label: 'Crédito', icon: 'crediario' },
  { key: 'receipts', label: 'Recibos', icon: 'comprovantes' },
  { key: 'settings', label: 'Config.', icon: 'configuracoes' },
  { key: 'coupons', label: 'Cupom', icon: 'etiquetas' },
];

const mobileQuickPages: Array<{ key: PageKey; label: string; icon: DelphiIconName }> = [
  { key: 'sales', label: 'PDV', icon: 'vendas_pdv' },
  { key: 'products', label: 'Produto', icon: 'produtos' },
  { key: 'customers', label: 'Cliente', icon: 'clientes' },
  { key: 'orders', label: 'Pedidos', icon: 'pedidos' },
  { key: 'cash', label: 'Caixa', icon: 'caixa' },
  { key: 'credits', label: 'Crediário', icon: 'crediario' },
  { key: 'reports', label: 'Relatórios', icon: 'relatorios' },
  { key: 'backup', label: 'Backup', icon: 'backup' },
  { key: 'coupons', label: 'Cupom', icon: 'etiquetas' },
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


function BellIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M18 9.8c0-3.25-2.15-5.8-6-5.8S6 6.55 6 9.8v3.35c0 .58-.22 1.14-.62 1.55l-.96.98c-.65.66-.18 1.78.75 1.78h13.66c.93 0 1.4-1.12.75-1.78l-.96-.98A2.2 2.2 0 0 1 18 13.15V9.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 19.1c.35.72 1.16 1.2 2.25 1.2s1.9-.48 2.25-1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 3.3V2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

async function clearBrowserCaches(): Promise<number> {
  if (!('caches' in window)) return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  return keys.length;
}

async function askServiceWorkerToSkipWaiting(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    await registration?.update().catch(() => undefined);
    return false;
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

function shortDbName(value: string | undefined): string {
  if (!value) return 'Banco local';
  return value.split(/[/\\]/).pop() || value;
}

function pageSubtitle(page: PageKey): string {
  const subtitles: Record<PageKey, string> = {
    dashboard: 'Acompanhe o desempenho da loja, veja alertas e siga para a próxima ação com rapidez.',
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
    coupons: 'Gere e compartilhe cupom promocional PNG fiel à arte enviada.',
  };
  return subtitles[page];
}


function compactVersionLabel(value: string | undefined): string {
  if (!value) return 'v2.4.7';
  const compact = value.replace(/^pwa-supabase-/i, '').replace(/-/g, ' ').trim();
  if (/^v\d+/i.test(compact)) return compact;
  return value.length > 22 ? `${value.slice(0, 22)}…` : value;
}

function alertActionLabel(page: PageKey): string {
  const labels: Record<PageKey, string> = {
    dashboard: 'Ver painel',
    products: 'Abrir produtos',
    customers: 'Abrir clientes',
    orders: 'Abrir pedidos',
    sales: 'Abrir PDV',
    cash: 'Abrir caixa',
    credits: 'Abrir crediário',
    receipts: 'Abrir comprovantes',
    reports: 'Abrir relatórios',
    backup: 'Abrir backup',
    settings: 'Abrir configurações',
    audit: 'Abrir logs',
    diagnostics: 'Ver diagnóstico',
    coupons: 'Abrir cupom',
  };
  return labels[page];
}

function initialsFromSettings(settings: Settings | null): string {
  const base = settings?.owner_name?.trim() || 'Administrador';
  if (/aguardando|login|administrador|admin/i.test(base)) return 'AL';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}


export function Shell({ activePage, setActivePage, status, settings, children, onRefresh, refreshToken }: ShellProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const webEnv = useMemo(() => (runtimeInfo.isWeb ? getPublicWebEnv() : null), [runtimeInfo.isWeb]);
  const [products, setProducts] = useState<Product[]>([]);
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [toast, setToast] = useState<{ title: string; detail: string; page: PageKey; level: 'danger' | 'warning' | 'info' } | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(() => getOperationSoundsEnabled());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getOperationNotificationsEnabled());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [webIdentity, setWebIdentity] = useState<WebIdentityState>({ email: '', role: 'sem login', storeName: '' });
  const [outboxStats, setOutboxStats] = useState<WebOutboxStats>(() => getWebOutboxStats());
  const [syncSnapshot, setSyncSnapshot] = useState<WebSyncSnapshot>(() => readWebSyncSnapshot());
  const [outboxBusy, setOutboxBusy] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState(false);
  const [cacheActionBusy, setCacheActionBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const prevAlertSignature = useRef('');
  const autoFlushAttemptedRef = useRef(false);
  const quickAccessRef = useRef<HTMLDivElement | null>(null);

  function navigatePage(page: PageKey): void {
    setSidebarOpen(false);
    setAlertsOpen(false);
    setQuickSearch('');
    setActivePage(page);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.querySelector<HTMLElement>('.neo-main')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.querySelector<HTMLElement>('.neo-page-shell')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.neo-main');
    const pageShell = document.querySelector<HTMLElement>('.neo-page-shell');
    window.requestAnimationFrame(() => {
      main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      pageShell?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [activePage]);


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
    const syncOutboxState = () => setOutboxStats(getWebOutboxStats());
    window.addEventListener('smart-loja:web-outbox-change', syncOutboxState);
    window.addEventListener('storage', syncOutboxState);
    syncOutboxState();
    return () => {
      window.removeEventListener('smart-loja:web-outbox-change', syncOutboxState);
      window.removeEventListener('storage', syncOutboxState);
    };
  }, [runtimeInfo.isWeb]);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    const syncCloudState = () => setSyncSnapshot(readWebSyncSnapshot());
    window.addEventListener('smart-loja:web-sync-status', syncCloudState);
    window.addEventListener('storage', syncCloudState);
    syncCloudState();
    return () => {
      window.removeEventListener('smart-loja:web-sync-status', syncCloudState);
      window.removeEventListener('storage', syncCloudState);
    };
  }, [runtimeInfo.isWeb]);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return;
    if (!networkOnline || outboxStats.total === 0) {
      autoFlushAttemptedRef.current = false;
      return;
    }
    if (autoFlushAttemptedRef.current || outboxBusy) return;
    autoFlushAttemptedRef.current = true;
    setOutboxBusy(true);
    void flushWebOutbox()
      .then((stats) => {
        setOutboxStats(stats);
        if (stats.total === 0) onRefresh();
      })
      .catch(() => setOutboxStats(getWebOutboxStats()))
      .finally(() => setOutboxBusy(false));
  }, [networkOnline, onRefresh, outboxBusy, outboxStats.total, runtimeInfo.isWeb]);

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
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.neo-page-shell')?.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector<HTMLElement>('.neo-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [activePage]);

  useEffect(() => {
    const activeButton = quickAccessRef.current?.querySelector<HTMLButtonElement>('button[aria-current="page"]');
    activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activePage]);


  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    const handleUpdate = () => {
      setPwaUpdateAvailable(true);
      setCacheMessage('Nova versão disponível. Toque para atualizar com segurança.');
      if (soundsEnabled) playOperationSound('warning');
    };
    window.addEventListener('smart-loja:pwa-update', handleUpdate);
    return () => window.removeEventListener('smart-loja:pwa-update', handleUpdate);
  }, [runtimeInfo.isWeb, soundsEnabled]);

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
  const priorityAlerts = alerts.filter((alert) => alert.level !== 'ok');
  const alertsToDisplay = priorityAlerts.length > 0 ? priorityAlerts : alerts;
  const notificationCount = priorityAlerts.length;
  const alertSummaryLabel = notificationCount > 0 ? `${notificationCount} atenção(ões)` : 'Nenhum alerta importante agora';
  const primaryAlert = alertsToDisplay[0];
  const activePageMeta = useMemo(() => pages.find((page) => page.key === activePage) ?? pages[0], [activePage]);
  const activePageTitle = activePage === 'dashboard' ? 'Dashboard' : activePageMeta.label;
  const environmentLabel = runtimeInfo.isWeb ? (networkOnline ? 'Online' : 'Sem internet') : status?.offline_ready ? 'Local / Offline' : 'Verificando';
  const avatarInitials = initialsFromSettings(settings);
  const sidebarVersionLabel = compactVersionLabel(status?.version);
  const cloudDataLabel = runtimeInfo.isWeb
    ? outboxStats.total > 0 ? `${outboxStats.total} pendente(s)` : !webEnv?.isConfigured ? 'Nuvem não configurada' : status?.sqlite_ok && networkOnline ? 'Dados sincronizados' : networkOnline ? 'Faça login' : 'Sem conexão'
    : 'SQLite ativo';
  const liveSyncLabel = runtimeInfo.isWeb
    ? syncSnapshot.status === 'syncing' ? 'Sincronizando' : syncSnapshot.status === 'pending' ? 'Sync pendente' : syncSnapshot.status === 'error' ? 'Falha sync' : syncSnapshot.module === 'Atualização automática' ? 'Multiaparelhos ativo' : 'Sync pronto'
    : 'Local';
  const liveSyncOk = !runtimeInfo.isWeb || (syncSnapshot.status !== 'pending' && syncSnapshot.status !== 'error');
  const roleCapabilities = useMemo(() => getWebRoleCapabilities(webIdentity.role), [webIdentity.role]);
  const displayStoreName = webIdentity.storeName || status?.settings.store_name || settings?.store_name || 'Jaque Confecções e Presentes';

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
      if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(displayStoreName, { body: `${incoming.title} - ${incoming.detail}` });
      }
      prevAlertSignature.current = signature;
    }
  }, [alerts, notificationsEnabled, displayStoreName]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function submitQuickSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = quickSearch.trim().toLowerCase();
    if (!query) return;
    if (query.includes('produto') || query.includes('estoque') || query.includes('catálogo') || query.includes('catalogo')) navigatePage('products');
    else if (query.includes('cliente') || query.includes('pessoa')) navigatePage('customers');
    else if (query.includes('venda') || query.includes('pdv') || query.includes('receber')) navigatePage('sales');
    else if (query.includes('pedido') || query.includes('entrega')) navigatePage('orders');
    else if (query.includes('caixa') || query.includes('dinheiro')) navigatePage('cash');
    else if (query.includes('credi') || query.includes('parcela')) navigatePage('credits');
    else if (query.includes('relat') || query.includes('resultado')) navigatePage('reports');
    else if (query.includes('backup') || query.includes('copia') || query.includes('cópia')) navigatePage('backup');
    else if (query.includes('config') || query.includes('loja')) navigatePage('settings');
    else if (query.includes('diagn') || query.includes('status') || query.includes('sync') || query.includes('supabase')) navigatePage('diagnostics');
    else navigatePage('dashboard');
    setQuickSearch('');
  }

  function retryPendingSync(): void {
    if (!runtimeInfo.isWeb || outboxBusy) return;
    setOutboxBusy(true);
    void flushWebOutbox()
      .then((stats) => {
        setOutboxStats(stats);
        if (stats.total === 0) onRefresh();
      })
      .catch(() => setOutboxStats(getWebOutboxStats()))
      .finally(() => setOutboxBusy(false));
  }

  function toggleSounds(): void {
    const next = !soundsEnabled;
    setSoundsEnabled(next);
    setOperationSoundsEnabled(next);
    if (next) playOperationSound('success');
  }

  function toggleNotifications(): void {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    setOperationNotificationsEnabled(next);
    if (next && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }



  function refreshPageNow(): void {
    setCacheMessage('Atualizando a tela...');
    window.setTimeout(() => window.location.reload(), 120);
  }

  function installPwaUpdate(): void {
    if (!runtimeInfo.isWeb || cacheActionBusy) return;
    setCacheActionBusy(true);
    setCacheMessage('Instalando nova versão...');
    void askServiceWorkerToSkipWaiting()
      .then((updated) => {
        if (updated) {
          setCacheMessage('Nova versão instalada. A tela será atualizada.');
          window.setTimeout(() => window.location.reload(), 700);
          return;
        }
        setCacheMessage('Conferindo atualização e recarregando...');
        window.setTimeout(() => window.location.reload(), 700);
      })
      .catch(() => {
        setCacheMessage('Não foi possível instalar agora. Recarregando a tela.');
        window.setTimeout(() => window.location.reload(), 900);
      })
      .finally(() => setCacheActionBusy(false));
  }

  function clearCacheAndReload(): void {
    if (!runtimeInfo.isWeb || cacheActionBusy) return;
    setCacheActionBusy(true);
    setCacheMessage('Limpando cache do sistema...');
    void clearBrowserCaches()
      .then((count) => {
        setCacheMessage(count > 0 ? `Cache limpo (${count}). Abrindo versão nova...` : 'Cache conferido. Abrindo versão nova...');
        window.setTimeout(() => window.location.reload(), 900);
      })
      .catch(() => {
        setCacheMessage('Não deu para limpar tudo, mas vamos atualizar a tela.');
        window.setTimeout(() => window.location.reload(), 900);
      })
      .finally(() => setCacheActionBusy(false));
  }

  function openAlertPage(page: PageKey): void {
    navigatePage(page);
  }

  return (
    <div className={`neo-shell ${runtimeInfo.isWeb ? 'neo-shell-web' : 'neo-shell-local'} neo-page-${activePage} ${sidebarOpen ? 'neo-nav-open' : ''} ${runtimeInfo.isWeb && !roleCapabilities.canOperate ? 'neo-role-readonly' : ''}`.trim()}>
      <div className="neo-windowbar">
        <div className="neo-windowbar-brand">
          <AppIcon name="app_logo_cadeado_carrinho" size={32} alt={displayStoreName} className="neo-windowbar-logo" />
          <strong>{displayStoreName}</strong>
        </div>
        <div className="neo-windowbar-right">
          <span>{runtimeInfo.isWeb ? 'WEB' : 'DESKTOP'}</span>
          <span>{runtimeInfo.isWeb ? (networkOnline ? 'Online' : 'Offline') : shortDbName(status?.db_path)}</span>
        </div>
      </div>

      <div className="neo-layout">
        {sidebarOpen && <button type="button" className="neo-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />}

        <aside className={`neo-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="neo-sidebar-brand">
            <div className="neo-sidebar-brand-mark">
              <AppIcon name="app_logo_cadeado_carrinho" size={48} alt={displayStoreName} className="neo-brand-logo-img" />
            </div>
            <div className="neo-sidebar-brand-copy">
              <strong>{displayStoreName}</strong>
              <small><i />{runtimeInfo.isWeb ? 'Online' : 'Local ativo'}</small>
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
                  onClick={() => navigatePage(page.key)}
                  aria-current={activePage === page.key ? 'page' : undefined}
                >
                  <span className="neo-nav-item-icon">
                    <AppIcon name={page.icon} size={32} className="app-icon-nav" />
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
                <strong>{runtimeInfo.isWeb ? (networkOnline ? 'Produção' : 'Offline') : 'Produção'}</strong>
              </div>
              <span className="neo-status-dot" />
            </div>
            <div className="neo-version-block">
              <span>Versão</span>
              <strong title={status?.version ?? sidebarVersionLabel}>{sidebarVersionLabel}</strong>
              <button type="button" onClick={() => navigatePage('audit')}>Abrir diagnóstico</button>
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
                <AppIcon name="app_logo_cadeado_carrinho" size={32} alt={displayStoreName} className="neo-mobile-brand-logo" />
                <strong>{displayStoreName}</strong>
              </div>
              <div className="neo-mobile-tools">
                <button type="button" className="neo-notify-btn" onClick={() => setAlertsOpen((value) => !value)} aria-label="Notificações">
                  <BellIcon className="neo-bell-inline-icon" />
                  {notificationCount > 0 ? <span>{notificationCount}</span> : null}
                </button>
              </div>
            </div>

            <div className="neo-mobile-quick-access" ref={quickAccessRef} aria-label="Acesso rápido mobile">
              {mobileQuickPages.map((page) => (
                <button
                  type="button"
                  key={page.key}
                  className={activePage === page.key ? 'active' : ''}
                  onClick={() => navigatePage(page.key)}
                  aria-current={activePage === page.key ? 'page' : undefined}
                >
                  <AppIcon name={page.icon} size={24} className="app-icon-chip" />
                  <span>{page.label}</span>
                </button>
              ))}
            </div>

            <div className="neo-header-grid">
              <form className="neo-command-search" onSubmit={submitQuickSearch} role="search" aria-label="Buscar módulo do sistema">
                <AppIcon name="buscar" size={24} className="app-icon-chip" />
                <input
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  placeholder="Buscar no sistema..."
                  aria-label="Buscar módulo no sistema"
                />
                <button type="submit" aria-label="Abrir busca">⌘ K</button>
              </form>

              <section className="neo-topbar-actions" aria-label="Status e usuário">
                <button type="button" className="neo-icon-tool" onClick={onRefresh} aria-label="Sincronizar dados">
                  <AppIcon name="backup" size={24} className="app-icon-chip" />
                  <span className="neo-tool-ok" />
                </button>
                <button type="button" className="neo-icon-tool neo-bell-tool" onClick={() => setAlertsOpen((value) => !value)} aria-label="Notificações">
                  <BellIcon className="neo-bell-inline-icon" />
                  {notificationCount > 0 ? <span className="neo-alert-count">{notificationCount}</span> : null}
                </button>
                <button type="button" className="neo-store-switch" onClick={() => navigatePage('settings')} aria-label="Loja ativa">
                  <span className="neo-store-avatar">{avatarInitials}</span>
                  <span>
                    <small>Loja ativa</small>
                    <strong>{displayStoreName}</strong>
                  </span>
                  <i>⌄</i>
                </button>
              </section>
            </div>
          </header>

          {toast && !alertsOpen ? (
            <button type="button" className={`neo-toast neo-toast-${toast.level}`} onClick={() => openAlertPage(toast.page)}>
              <strong>{toast.title}</strong>
              <span>{toast.detail}</span>
            </button>
          ) : null}

          {runtimeInfo.isWeb && (pwaUpdateAvailable || cacheMessage) ? (
            <section className={`neo-pwa-update-banner ${pwaUpdateAvailable ? 'has-update' : ''}`} aria-live="polite">
              <div>
                <strong>{pwaUpdateAvailable ? 'Nova versão disponível' : 'Atualização do sistema'}</strong>
                <span>{cacheMessage || 'Existe uma atualização pronta para instalar neste aparelho.'}</span>
              </div>
              <div className="neo-pwa-update-actions">
                <button type="button" onClick={installPwaUpdate} disabled={cacheActionBusy}>
                  {cacheActionBusy ? 'Aguarde...' : 'Atualizar agora'}
                </button>
                <button type="button" onClick={clearCacheAndReload} disabled={cacheActionBusy}>Atualizar cache</button>
              </div>
            </section>
          ) : null}

          {alertsOpen ? (
            <section className="neo-alert-center" aria-label="Central de alertas da loja" aria-live="polite">
              <div className="neo-alert-center-head">
                <div className="neo-alert-center-title">
                  <span className={`neo-alert-center-icon ${notificationCount > 0 ? 'has-alert' : 'is-ok'}`}>
                    <BellIcon className="neo-bell-inline-icon" />
                  </span>
                  <span>
                    <strong>Alertas da loja</strong>
                    <small>{alertSummaryLabel}</small>
                  </span>
                </div>
                <button type="button" className="neo-alert-close" onClick={() => setAlertsOpen(false)} aria-label="Fechar alertas">×</button>
              </div>

              {primaryAlert ? (
                <div className={`neo-alert-feature neo-alert-feature-${primaryAlert.level}`}>
                  <span className="neo-alert-card-dot" />
                  <span>
                    <strong>{primaryAlert.title}</strong>
                    <small>{primaryAlert.detail}</small>
                  </span>
                  <button type="button" onClick={() => openAlertPage(primaryAlert.page)}>{alertActionLabel(primaryAlert.page)}</button>
                </div>
              ) : null}

              <div className="neo-alert-preferences" aria-label="Preferências de avisos">
                <button type="button" className={soundsEnabled ? 'active' : ''} onClick={toggleSounds}>
                  <span>Som do sistema</span>
                  <strong>{soundsEnabled ? 'Ligado' : 'Desligado'}</strong>
                </button>
                <button type="button" className={notificationsEnabled ? 'active' : ''} onClick={toggleNotifications}>
                  <span>Avisos do navegador</span>
                  <strong>{notificationsEnabled ? 'Ativos' : 'Pausados'}</strong>
                </button>
              </div>

              <div className="neo-alert-list">
                {alertsToDisplay.map((alert) => (
                  <button type="button" key={alert.id} className={`neo-alert-card neo-alert-card-${alert.level}`} onClick={() => openAlertPage(alert.page)}>
                    <span className="neo-alert-card-dot" />
                    <span>
                      <strong>{alert.title}</strong>
                      <small>{alert.detail}</small>
                    </span>
                    <em>{alertActionLabel(alert.page)}</em>
                  </button>
                ))}
              </div>

              <div className="neo-alert-actions">
                <button type="button" onClick={onRefresh}>Sincronizar agora</button>
                <button type="button" onClick={refreshPageNow}>Recarregar tela</button>
                <button type="button" onClick={() => openAlertPage('diagnostics')}>Ver diagnóstico</button>
                <button type="button" onClick={clearCacheAndReload} disabled={cacheActionBusy}>{cacheActionBusy ? 'Aguarde...' : 'Atualizar cache'}</button>
              </div>
            </section>
          ) : null}

          <section className="neo-page-shell">
            <div className="neo-page-meta">
              <div>
                <div className="neo-page-meta-title">
                  <span className="neo-page-meta-icon"><AppIcon name={activePageMeta.icon} size={32} className="app-icon-page" /></span>
                  <h1>{activePageTitle}</h1>
                </div>
                <p>{pageSubtitle(activePage)}</p>
              </div>
              <div className="neo-page-meta-status">
                <span className={`neo-mini-chip ${(!runtimeInfo.isWeb || networkOnline) && (runtimeInfo.isWeb || status?.offline_ready) ? 'ok' : 'warn'}`}>{environmentLabel}</span>
                <span className={`neo-mini-chip ${(runtimeInfo.isWeb ? status?.sqlite_ok : status?.sqlite_ok) ? 'ok' : 'warn'}`}>{runtimeInfo.isWeb ? cloudDataLabel : status?.sqlite_ok ? 'SQLite ativo' : 'SQLite indisponível'}</span>
                {runtimeInfo.isWeb ? <span className={`neo-mini-chip ${liveSyncOk ? 'ok' : 'warn'}`}>{liveSyncLabel}</span> : null}
              </div>
            </div>

            {runtimeInfo.isWeb && !networkOnline ? (
              <div className="neo-page-alert neo-page-alert-warning neo-offline-banner">
                <span className="neo-page-alert-dot" />
                <span>
                  <strong>Sem internet neste aparelho</strong>
                  <small>Você pode abrir telas em cache. Alterações feitas sem conexão ficam pendentes para reenvio quando voltar a internet.</small>
                </span>
              </div>
            ) : null}

            {runtimeInfo.isWeb && outboxStats.total > 0 ? (
              <div className="neo-page-alert neo-page-alert-warning neo-sync-pending-banner">
                <span className="neo-page-alert-dot" />
                <span>
                  <strong>{outboxStats.total} alteração(ões) pendente(s) neste aparelho</strong>
                  <small>{outboxStats.lastError || 'Assim que a conexão estiver boa, toque para reenviar e conferir se apareceu no outro aparelho.'}</small>
                </span>
                <button type="button" className="neo-inline-action" onClick={retryPendingSync} disabled={outboxBusy || !networkOnline}>{outboxBusy ? 'Enviando...' : 'Reenviar agora'}</button>
              </div>
            ) : null}

            {runtimeInfo.isWeb && webIdentity.role !== 'sem login' && !roleCapabilities.canOperate ? (
              <div className="neo-page-alert neo-page-alert-info neo-role-banner">
                <span className="neo-page-alert-dot" />
                <span>
                  <strong>Perfil de leitura</strong>
                  <small>Você pode consultar dados, mas botões de salvar, excluir, receber ou alterar são bloqueados para proteger a loja.</small>
                </span>
              </div>
            ) : null}

            {activeAlerts.length > 0 && !alertsOpen && !toast ? (
              <div className={`neo-page-alert neo-page-alert-${activeAlerts[0].level}`}>
                <span className="neo-page-alert-dot" />
                <span>
                  <strong>{activeAlerts[0].title}</strong>
                  <small>{activeAlerts[0].detail}</small>
                </span>
                <button type="button" className="neo-inline-action" onClick={() => openAlertPage(activeAlerts[0].page)}>{alertActionLabel(activeAlerts[0].page)}</button>
              </div>
            ) : null}

            <div className="neo-page-content neo-live-content">{children}</div>
          </section>
        </main>
      </div>

      <nav className="neo-mobile-dock" aria-label="Navegação mobile">
        {mobileDockPages.map((page) => (
          <button
            type="button"
            key={page.key}
            className={activePage === page.key ? 'active' : ''}
            onClick={() => navigatePage(page.key)}
            aria-current={activePage === page.key ? 'page' : undefined}
          >
            <AppIcon name={page.icon} size={32} className="app-icon-chip" />
            <span>{page.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

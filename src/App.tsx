import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './components/Modal';
import { Shell } from './components/Shell';
import { PwaUpdateNotice } from './components/PwaUpdateNotice';
import { Welcome } from './pages/Welcome';
import { api } from './lib/api';
import { subscribeWebStoreChanges, type WebRealtimeEvent } from './lib/webApi';
import { getRuntimeInfo, hasTauriWindowMetadata } from './lib/runtime';
import { getPreferredBackupFolder, setPreferredBackupFolder } from './lib/preferences';
import { playOperationSound } from './lib/sound';
import type { AppStatus, PageKey, Settings } from './types';


const Dashboard = React.lazy(async () => ({ default: (await import('./pages/Dashboard')).Dashboard }));
const CustomersPage = React.lazy(async () => ({ default: (await import('./pages/Customers')).CustomersPage }));
const ProductsPage = React.lazy(async () => ({ default: (await import('./pages/Products')).ProductsPage }));
const SalesPage = React.lazy(async () => ({ default: (await import('./pages/Sales')).SalesPage }));
const CashPage = React.lazy(async () => ({ default: (await import('./pages/Cash')).CashPage }));
const CreditsPage = React.lazy(async () => ({ default: (await import('./pages/Credits')).CreditsPage }));
const OrdersPage = React.lazy(async () => ({ default: (await import('./pages/Orders')).OrdersPage }));
const ReceiptsPage = React.lazy(async () => ({ default: (await import('./pages/Receipts')).ReceiptsPage }));
const ReportsPage = React.lazy(async () => ({ default: (await import('./pages/Reports')).ReportsPage }));
const BackupPage = React.lazy(async () => ({ default: (await import('./pages/Backup')).BackupPage }));
const SettingsPage = React.lazy(async () => ({ default: (await import('./pages/Settings')).SettingsPage }));
const AuditPage = React.lazy(async () => ({ default: (await import('./pages/Audit')).AuditPage }));
const WebDiagnosticsPage = React.lazy(async () => ({ default: (await import('./pages/WebDiagnostics')).WebDiagnosticsPage }));
const WebMigrationPage = React.lazy(async () => ({ default: (await import('./pages/WebMigration')).WebMigrationPage }));

export default function App(): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [entered, setEntered] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [preferredBackupFolder, setPreferredBackupFolderState] = useState<string | null>(getPreferredBackupFolder());
  const startupSoundPlayed = useRef(false);
  const forceCloseRef = useRef(false);
  const lastWebAutoRefreshRef = useRef(0);

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.boot();
      setStatus(payload);
      setSettings(payload.settings);
      if (!runtimeInfo.isWeb && !startupSoundPlayed.current) {
        startupSoundPlayed.current = true;
        playOperationSound('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [runtimeInfo.isWeb]);

  useEffect(() => {
    if (entered) void boot();
  }, [boot, entered]);

  useEffect(() => {
    if (!runtimeInfo.isWeb) return undefined;
    const reloadWebSession = () => void boot();
    window.addEventListener('smart-loja:web-session-changed', reloadWebSession);
    return () => window.removeEventListener('smart-loja:web-session-changed', reloadWebSession);
  }, [boot, runtimeInfo.isWeb]);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!entered || !runtimeInfo.isWeb) return undefined;

    const refreshVisibleWebData = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastWebAutoRefreshRef.current < 15000) return;
      lastWebAutoRefreshRef.current = now;
      setRefreshToken((value) => value + 1);
      void boot();
    };

    window.addEventListener('focus', refreshVisibleWebData);
    window.addEventListener('online', refreshVisibleWebData);
    document.addEventListener('visibilitychange', refreshVisibleWebData);
    return () => {
      window.removeEventListener('focus', refreshVisibleWebData);
      window.removeEventListener('online', refreshVisibleWebData);
      document.removeEventListener('visibilitychange', refreshVisibleWebData);
    };
  }, [boot, entered, runtimeInfo.isWeb]);

  useEffect(() => {
    if (!entered || !runtimeInfo.isWeb || !status?.sqlite_ok) return undefined;

    let active = true;
    let dispose: (() => void) | undefined;
    let refreshTimer = 0;

    const scheduleCloudRefresh = (_event: WebRealtimeEvent) => {
      if (!active || document.visibilityState === 'hidden') return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (!active) return;
        setRefreshToken((value) => value + 1);
        void boot();
      }, 500);
    };

    void subscribeWebStoreChanges(scheduleCloudRefresh)
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe();
          return;
        }
        dispose = unsubscribe;
      })
      .catch(() => undefined);

    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      if (dispose) dispose();
    };
  }, [boot, entered, runtimeInfo.isWeb, status?.sqlite_ok, status?.db_path]);

  useEffect(() => {
    document.documentElement.classList.toggle('slow-mode', Boolean(settings?.slow_mode));
  }, [settings?.slow_mode]);

  useEffect(() => {
    if (!entered || runtimeInfo.isWeb || !hasTauriWindowMetadata()) return undefined;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested((event) => {
        if (forceCloseRef.current) return;
        event.preventDefault();
        setPreferredBackupFolderState(getPreferredBackupFolder());
        setCloseError(null);
        setCloseBusy(false);
        setClosePromptOpen(true);
      }))
      .then((dispose) => {
        if (cancelled) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [entered, runtimeInfo.isWeb]);

  const requestAppExit = useCallback(() => {
    setClosePromptOpen(false);
    void api.exitApp().catch((err) => {
      forceCloseRef.current = false;
      setCloseError(err instanceof Error ? err.message : String(err));
      setCloseBusy(false);
      setClosePromptOpen(true);
    });
  }, []);

  const closeWithoutBackup = useCallback(async () => {
    setCloseBusy(true);
    setCloseError(null);
    try {
      forceCloseRef.current = true;
      requestAppExit();
    } catch (err) {
      forceCloseRef.current = false;
      setCloseError(err instanceof Error ? err.message : String(err));
      setCloseBusy(false);
    }
  }, [requestAppExit]);

  const backupAndClose = useCallback(async () => {
    setCloseBusy(true);
    setCloseError(null);
    try {
      let folder = preferredBackupFolder;
      if (!folder) {
        folder = await api.pickBackupFolder();
        if (!folder) {
          setCloseBusy(false);
          return;
        }
      }
      setPreferredBackupFolder(folder);
      setPreferredBackupFolderState(folder);
      await api.createBackupTo(folder);
      forceCloseRef.current = true;
      requestAppExit();
    } catch (err) {
      forceCloseRef.current = false;
      setCloseError(err instanceof Error ? err.message : String(err));
      setCloseBusy(false);
    }
  }, [preferredBackupFolder, requestAppExit]);

  const page = useMemo(() => {
    const props = { refreshToken, onChanged: refresh };

    if (runtimeInfo.isWeb) {
      if (activePage === 'diagnostics' || activePage === 'audit') return <WebDiagnosticsPage />;
      if (activePage === 'dashboard') return <Dashboard status={status} onNavigate={setActivePage} {...props} />;
      if (activePage === 'customers') return <CustomersPage {...props} />;
      if (activePage === 'products') return <ProductsPage {...props} />;
      if (activePage === 'sales') return <SalesPage {...props} />;
      if (activePage === 'cash') return <CashPage {...props} />;
      if (activePage === 'credits') return <CreditsPage {...props} />;
      if (activePage === 'orders') return <OrdersPage {...props} />;
      if (activePage === 'receipts') return <ReceiptsPage {...props} />;
      if (activePage === 'reports') return <ReportsPage {...props} />;
      if (activePage === 'backup') return <BackupPage {...props} />;
      if (activePage === 'settings') return <SettingsPage settings={settings} onSettingsSaved={setSettings} {...props} />;
      return <WebMigrationPage activePage={activePage} onOpenDiagnostics={() => setActivePage('diagnostics')} />;
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard status={status} onNavigate={setActivePage} {...props} />;
      case 'customers':
        return <CustomersPage {...props} />;
      case 'products':
        return <ProductsPage {...props} />;
      case 'sales':
        return <SalesPage {...props} />;
      case 'cash':
        return <CashPage {...props} />;
      case 'credits':
        return <CreditsPage {...props} />;
      case 'orders':
        return <OrdersPage {...props} />;
      case 'receipts':
        return <ReceiptsPage {...props} />;
      case 'reports':
        return <ReportsPage {...props} />;
      case 'backup':
        return <BackupPage {...props} />;
      case 'settings':
        return <SettingsPage settings={settings} onSettingsSaved={setSettings} {...props} />;
      case 'audit':
        return <AuditPage {...props} />;
      case 'diagnostics':
        return <WebDiagnosticsPage />;
      default:
        return <Dashboard status={status} onNavigate={setActivePage} {...props} />;
    }
  }, [activePage, refreshToken, refresh, runtimeInfo.isWeb, settings, status]);

  if (!entered) {
    return <Welcome onEnter={() => setEntered(true)} />;
  }

  return (
    <>
      <Shell activePage={activePage} setActivePage={setActivePage} status={status} settings={settings} onRefresh={refresh} refreshToken={refreshToken}>
        <PwaUpdateNotice />
        {loading && <div className="notice">{runtimeInfo.isWeb ? 'Preparando loja online...' : 'Carregando SQLite local...'}</div>}
        {error && <div className="error-box">{error}</div>}
        <React.Suspense fallback={<div className="notice">Carregando módulo...</div>}>
          {page}
        </React.Suspense>
      </Shell>

      <Modal open={closePromptOpen} title="Fechar o sistema" onClose={() => !closeBusy && setClosePromptOpen(false)}>
        <div className="close-flow">
          <div className="close-flow-hero">
            <span className="micro-label close-flow-kicker">Saída segura</span>
            <p>Antes de fechar, você pode gerar um backup completo e sair com mais segurança, ou fechar agora sem criar uma nova cópia.</p>
          </div>

          <div className="close-flow-grid">
            <section className="close-flow-card close-flow-card-primary">
              <span className="close-flow-badge close-flow-badge-safe">Recomendado</span>
              <strong>Backup antes de fechar</strong>
              <span>Salva banco, comprovantes e arquivos do sistema antes de encerrar o aplicativo.</span>
            </section>
            <section className="close-flow-card close-flow-card-muted">
              <span className="close-flow-badge close-flow-badge-risk">Atenção</span>
              <strong>Fechar sem novo backup</strong>
              <span>Use essa opção apenas quando você já tiver salvo uma cópia recente.</span>
            </section>
          </div>

          {preferredBackupFolder ? (
            <div className="close-flow-path">
              <span className="micro-label">Pasta do backup</span>
              <strong>{preferredBackupFolder}</strong>
            </div>
          ) : (
            <div className="close-flow-path close-flow-path-empty">
              <span className="micro-label">Pasta do backup</span>
              <strong>Nenhuma pasta padrão salva</strong>
              <span>Ao clicar em backup, o sistema vai pedir a pasta.</span>
            </div>
          )}

          {closeError && <div className="error-box">{closeError}</div>}

          <div className="close-flow-actions">
            <button type="button" className="primary-btn close-flow-main-btn" onClick={backupAndClose} disabled={closeBusy}>
              {closeBusy ? 'Processando...' : 'Fazer backup e fechar'}
            </button>
            <button type="button" className="secondary-btn close-flow-secondary-btn close-flow-danger-btn" onClick={closeWithoutBackup} disabled={closeBusy}>
              Fechar sem salvar
            </button>
            <button type="button" className="ghost-btn close-flow-cancel-btn" onClick={() => setClosePromptOpen(false)} disabled={closeBusy}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

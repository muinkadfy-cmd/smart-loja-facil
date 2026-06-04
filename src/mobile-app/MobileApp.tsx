import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppStatus, PageKey, Settings } from '../types';
import { CreditsScreen } from './screens/CreditsScreen';
import { BackupScreen } from './screens/BackupScreen';
import { CashScreen } from './screens/CashScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { GenericDataScreen } from './screens/GenericDataScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { ReceiptsScreen } from './screens/ReceiptsScreen';
import { CustomersScreen, ProductsScreen } from './screens/ProductsCustomersScreens';
import { SalesScreen } from './screens/SalesScreen';
import { MobileShell } from './layout/MobileShell';
import { InlineIcon } from './components/InlineIcon';
import { getWebOutboxStats, readWebDemoMode, readWebSyncSnapshot, readWebTrainingMode, type WebOutboxStats, type WebSyncSnapshot } from '../lib/webApi';

interface MobileAppProps {
  activePage: PageKey;
  status: AppStatus | null;
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
  onLogout: () => void;
}

type MobileAlertTone = 'danger' | 'warning' | 'info' | 'success';

interface MobileAlertItem {
  title: string;
  detail: string;
  action: string;
  page: PageKey;
  tone: MobileAlertTone;
  icon: 'offline_local' | 'bloqueio_seguro' | 'estoque_baixo' | 'vendas_pdv' | 'atualizar' | 'loja_ativa' | 'backup' | 'painel_da_loja';
}

function emptyOutboxStats(): WebOutboxStats {
  return { total: 0, pending: 0, error: 0, lastCreatedAt: '', lastError: '' };
}

export function MobileApp({ activePage, status, settings, loading, error, refreshToken, onNavigate, onRefresh, onLogout }: MobileAppProps): JSX.Element {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [trainingModeActive, setTrainingModeActive] = useState(() => readWebTrainingMode().enabled);
  const [demoModeActive, setDemoModeActive] = useState(() => readWebDemoMode().enabled);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [syncSnapshot, setSyncSnapshot] = useState<WebSyncSnapshot>(() => readWebSyncSnapshot());
  const [outboxStats, setOutboxStats] = useState<WebOutboxStats>(() => {
    try { return getWebOutboxStats(); } catch { return emptyOutboxStats(); }
  });

  useEffect(() => {
    const handler = () => setUpdateAvailable(true);
    window.addEventListener('smart-loja:pwa-update', handler);
    return () => window.removeEventListener('smart-loja:pwa-update', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTrainingModeActive(readWebTrainingMode().enabled);
      setDemoModeActive(readWebDemoMode().enabled);
    };
    window.addEventListener('smart-loja:web-training-mode-change', handler);
    window.addEventListener('smart-loja:web-demo-mode-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('smart-loja:web-training-mode-change', handler);
      window.removeEventListener('smart-loja:web-demo-mode-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  useEffect(() => {
    const syncUiStatus = () => {
      setNetworkOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
      setSyncSnapshot(readWebSyncSnapshot());
      try { setOutboxStats(getWebOutboxStats()); } catch { setOutboxStats(emptyOutboxStats()); }
    };
    window.addEventListener('online', syncUiStatus);
    window.addEventListener('offline', syncUiStatus);
    window.addEventListener('smart-loja:web-sync-status', syncUiStatus);
    window.addEventListener('smart-loja:web-outbox-change', syncUiStatus);
    window.addEventListener('smart-loja:web-session-changed', syncUiStatus);
    window.addEventListener('storage', syncUiStatus);
    syncUiStatus();
    return () => {
      window.removeEventListener('online', syncUiStatus);
      window.removeEventListener('offline', syncUiStatus);
      window.removeEventListener('smart-loja:web-sync-status', syncUiStatus);
      window.removeEventListener('smart-loja:web-outbox-change', syncUiStatus);
      window.removeEventListener('smart-loja:web-session-changed', syncUiStatus);
      window.removeEventListener('storage', syncUiStatus);
    };
  }, [refreshToken]);

  const alerts = useMemo<MobileAlertItem[]>(() => {
    const dashboard = status?.dashboard;
    const items: MobileAlertItem[] = [];
    if (!networkOnline) items.push({ title: 'Sem internet neste aparelho', detail: 'As ações podem ficar pendentes. Conecte a internet antes de vender de verdade.', action: 'Diagnóstico', page: 'diagnostics', tone: 'danger', icon: 'offline_local' });
    if (error) items.push({ title: 'Atenção no carregamento', detail: error.slice(0, 180), action: 'Diagnóstico', page: 'diagnostics', tone: 'danger', icon: 'bloqueio_seguro' });
    if (!status?.sqlite_ok) items.push({ title: 'Entre para sincronizar', detail: 'Faça login para ver a mesma loja no celular e no computador.', action: 'Diagnóstico', page: 'diagnostics', tone: networkOnline ? 'warning' : 'danger', icon: 'bloqueio_seguro' });
    if (outboxStats.error > 0) items.push({ title: 'Pendência com erro', detail: `${outboxStats.error} alteração(ões) precisam de atenção antes de vender sem acompanhamento.`, action: 'Ver pendências', page: 'diagnostics', tone: 'danger', icon: 'backup' });
    if (outboxStats.pending > 0) items.push({ title: 'Ainda falta enviar', detail: `${outboxStats.pending} alteração(ões) estão guardadas neste aparelho aguardando sincronização.`, action: 'Enviar agora', page: 'diagnostics', tone: 'warning', icon: 'backup' });
    if (syncSnapshot.status === 'error') items.push({ title: 'Falha de sincronização', detail: syncSnapshot.detail || 'Não foi possível confirmar a última sincronização.', action: 'Diagnóstico', page: 'diagnostics', tone: 'danger', icon: 'offline_local' });
    if (syncSnapshot.status === 'pending') items.push({ title: 'Sincronização pendente', detail: syncSnapshot.detail || 'Existe algo aguardando envio para a nuvem.', action: 'Resolver', page: 'diagnostics', tone: 'warning', icon: 'offline_local' });
    if (syncSnapshot.status === 'syncing') items.push({ title: 'Sincronizando agora', detail: 'O app está enviando ou buscando dados da loja. Aguarde concluir antes de fechar.', action: 'Ver status', page: 'diagnostics', tone: 'info', icon: 'atualizar' });
    if ((dashboard?.low_stock_count ?? 0) > 0) items.push({ title: 'Estoque baixo', detail: `${dashboard?.low_stock_count ?? 0} produto(s) precisam de reposição.`, action: 'Ver produtos', page: 'products', tone: 'warning', icon: 'estoque_baixo' });
    if ((dashboard?.today_sales_count ?? 0) === 0) items.push({ title: 'Nenhuma venda hoje', detail: 'Abra o PDV para registrar a primeira venda do dia.', action: 'Abrir PDV', page: 'sales', tone: 'info', icon: 'vendas_pdv' });
    if (updateAvailable) items.push({ title: 'Nova versão disponível', detail: 'Atualize o PWA neste aparelho para evitar cache antigo.', action: 'Atualizar', page: 'diagnostics', tone: 'info', icon: 'atualizar' });
    if (demoModeActive) items.push({ title: 'Ambiente demo ativo', detail: 'O app está usando dados fictícios separados da loja real.', action: 'Ver demo', page: 'diagnostics', tone: 'info', icon: 'loja_ativa' });
    if (trainingModeActive) items.push({ title: 'Modo treinamento ativo', detail: 'Gravações reais estão bloqueadas para demonstração segura.', action: 'Ver modo', page: 'diagnostics', tone: 'warning', icon: 'bloqueio_seguro' });
    return items.length ? items.slice(0, 8) : [{ title: 'Tudo certo', detail: 'Nenhum alerta importante agora. Dados prontos para conferência.', action: 'Dashboard', page: 'dashboard' as PageKey, tone: 'success', icon: 'painel_da_loja' }];
  }, [status, updateAvailable, demoModeActive, trainingModeActive, networkOnline, syncSnapshot, outboxStats, error]);

  const navigate = useCallback((page: PageKey) => {
    onNavigate(page);
  }, [onNavigate]);

  const installUpdate = useCallback(() => {
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, []);

  return (
    <MobileShell
      activePage={activePage}
      status={status}
      settings={settings}
      loading={loading}
      error={error}
      alertsCount={alerts.filter((alert) => alert.tone !== 'success').length}
      updateAvailable={updateAvailable}
      onNavigate={navigate}
      onRefresh={onRefresh}
      onOpenAlerts={() => setAlertsOpen(true)}
      onInstallUpdate={installUpdate}
      onLogout={onLogout}
    >
      {activePage === 'dashboard' ? (
        <DashboardScreen status={status} onNavigate={navigate} />
      ) : activePage === 'sales' ? (
        <SalesScreen status={status} refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'products' ? (
        <ProductsScreen status={status} refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'customers' ? (
        <CustomersScreen status={status} refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'orders' ? (
        <OrdersScreen refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'cash' ? (
        <CashScreen status={status} refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'credits' ? (
        <CreditsScreen status={status} refreshToken={refreshToken} onNavigate={navigate} onRefresh={onRefresh} />
      ) : activePage === 'receipts' ? (
        <ReceiptsScreen refreshToken={refreshToken} onNavigate={navigate} onRefresh={onRefresh} />
      ) : activePage === 'backup' ? (
        <BackupScreen refreshToken={refreshToken} onRefresh={onRefresh} />
      ) : activePage === 'diagnostics' ? (
        <DiagnosticsScreen status={status} onRefresh={onRefresh} onNavigate={navigate} />
      ) : (
        <GenericDataScreen page={activePage} status={status} refreshToken={refreshToken} onNavigate={navigate} onRefresh={onRefresh} />
      )}

      {alertsOpen ? (
        <div className="mapp-alert-layer" role="dialog" aria-modal="true" aria-label="Alertas da loja">
          <section className="mapp-alert-card">
            <header>
              <div><strong>Central de avisos</strong><span>{alerts.filter((alert) => alert.tone !== 'success').length || 0} atenção(ões)</span></div>
              <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Fechar alertas">×</button>
            </header>
            <div className="mapp-alert-list">
              {alerts.map((alert) => (
                <article key={`${alert.title}-${alert.page}`} className={`mapp-alert-${alert.tone}`}>
                  <span className="mapp-alert-icon"><InlineIcon name={alert.icon} size={24} /></span>
                  <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
                  <button type="button" onClick={() => { setAlertsOpen(false); navigate(alert.page); }}>{alert.action}</button>
                </article>
              ))}
            </div>
            <div className="mapp-alert-actions">
              <button type="button" onClick={onRefresh}>Sincronizar agora</button>
              <button type="button" onClick={() => window.location.reload()}>Recarregar tela</button>
              <button type="button" className="mapp-alert-logout-action" onClick={() => { setAlertsOpen(false); onLogout(); }}>Sair da conta</button>
            </div>
          </section>
        </div>
      ) : null}
    </MobileShell>
  );
}

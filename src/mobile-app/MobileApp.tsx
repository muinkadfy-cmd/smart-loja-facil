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
import { readWebDemoMode, readWebTrainingMode } from '../lib/webApi';

interface MobileAppProps {
  activePage: PageKey;
  status: AppStatus | null;
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

export function MobileApp({ activePage, status, settings, loading, error, refreshToken, onNavigate, onRefresh }: MobileAppProps): JSX.Element {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [trainingModeActive, setTrainingModeActive] = useState(() => readWebTrainingMode().enabled);
  const [demoModeActive, setDemoModeActive] = useState(() => readWebDemoMode().enabled);

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

  const alerts = useMemo(() => {
    const dashboard = status?.dashboard;
    const items: Array<{ title: string; detail: string; action: string; page: PageKey }> = [];
    if (!status?.sqlite_ok) items.push({ title: 'Conecte o Supabase', detail: 'Faça login para sincronizar dados entre celular e computador.', action: 'Diagnóstico', page: 'diagnostics' });
    if ((dashboard?.low_stock_count ?? 0) > 0) items.push({ title: 'Estoque baixo', detail: `${dashboard?.low_stock_count ?? 0} produto(s) precisam de reposição.`, action: 'Ver produtos', page: 'products' });
    if ((dashboard?.today_sales_count ?? 0) === 0) items.push({ title: 'Nenhuma venda hoje', detail: 'Abra o PDV para registrar a primeira venda.', action: 'Abrir PDV', page: 'sales' });
    if (updateAvailable) items.push({ title: 'Nova versão disponível', detail: 'Atualize o PWA neste aparelho.', action: 'Atualizar', page: 'diagnostics' });
    if (demoModeActive) items.push({ title: 'Ambiente demo ativo', detail: 'O app está usando dados fictícios separados da loja real.', action: 'Ver demo', page: 'diagnostics' });
    if (trainingModeActive) items.push({ title: 'Modo treinamento ativo', detail: 'Gravações reais estão bloqueadas para demonstração segura.', action: 'Ver modo', page: 'diagnostics' });
    return items.length ? items : [{ title: 'Tudo certo', detail: 'Nenhum alerta crítico agora.', action: 'Dashboard', page: 'dashboard' as PageKey }];
  }, [status, updateAvailable, demoModeActive, trainingModeActive]);

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
      alertsCount={alerts.filter((alert) => alert.title !== 'Tudo certo').length}
      updateAvailable={updateAvailable}
      onNavigate={navigate}
      onRefresh={onRefresh}
      onOpenAlerts={() => setAlertsOpen(true)}
      onInstallUpdate={installUpdate}
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
              <div><strong>Alertas da loja</strong><span>{alerts.length} aviso(s)</span></div>
              <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Fechar alertas">×</button>
            </header>
            <div className="mapp-alert-list">
              {alerts.map((alert) => (
                <article key={`${alert.title}-${alert.page}`}>
                  <span />
                  <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
                  <button type="button" onClick={() => { setAlertsOpen(false); navigate(alert.page); }}>{alert.action}</button>
                </article>
              ))}
            </div>
            <div className="mapp-alert-actions">
              <button type="button" onClick={onRefresh}>Sincronizar agora</button>
              <button type="button" onClick={() => window.location.reload()}>Recarregar tela</button>
            </div>
          </section>
        </div>
      ) : null}
    </MobileShell>
  );
}

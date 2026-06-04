import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppStatus, PageKey, Settings } from '../../types';
import { getMobileRoute, getMobileRouteGroup, getMobileRoutesByGroup, MOBILE_ROUTE_GROUPS } from '../mobileAppRoutes';
import { InlineIcon } from '../components/InlineIcon';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { readWebDemoMode, readWebTrainingMode, type WebDemoModeState, type WebTrainingModeState } from '../../lib/webApi';

interface MobileShellProps {
  activePage: PageKey;
  status: AppStatus | null;
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  alertsCount: number;
  updateAvailable: boolean;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
  onOpenAlerts: () => void;
  onInstallUpdate: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function MobileShell({
  activePage,
  status,
  settings,
  loading,
  error,
  alertsCount,
  updateAvailable,
  onNavigate,
  onRefresh,
  onOpenAlerts,
  onInstallUpdate,
  onLogout,
  children,
}: MobileShellProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState<WebTrainingModeState>(() => readWebTrainingMode());
  const [demoMode, setDemoMode] = useState<WebDemoModeState>(() => readWebDemoMode());
  const pageRef = useRef<HTMLElement | null>(null);
  const route = getMobileRoute(activePage);
  const storeName = (settings?.store_name || status?.settings.store_name || 'Smart Loja Fácil Web').replace(/\s+Web$/i, '');
  const online = Boolean(status?.sqlite_ok);

  useEffect(() => {
    const syncTrainingMode = () => {
      setTrainingMode(readWebTrainingMode());
      setDemoMode(readWebDemoMode());
    };
    window.addEventListener('smart-loja:web-training-mode-change', syncTrainingMode);
    window.addEventListener('smart-loja:web-demo-mode-change', syncTrainingMode);
    window.addEventListener('storage', syncTrainingMode);
    return () => {
      window.removeEventListener('smart-loja:web-training-mode-change', syncTrainingMode);
      window.removeEventListener('smart-loja:web-demo-mode-change', syncTrainingMode);
      window.removeEventListener('storage', syncTrainingMode);
    };
  }, []);

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setMenuOpen(false);
  }, [activePage]);

  const activeGroup = useMemo(() => getMobileRouteGroup(activePage), [activePage]);
  const relatedRoutes = useMemo(() => getMobileRoutesByGroup(activeGroup), [activeGroup]);

  return (
    <div className="mapp-root">
      <aside className={`mapp-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="mapp-sidebar-head">
          <span className="mapp-logo-badge"><InlineIcon name="app_logo_cadeado_carrinho" size={32} /></span>
          <div>
            <strong>Smart Loja Fácil</strong>
            <small className={online ? 'is-online' : 'is-offline'}>{online ? 'Online' : 'Verificando'}</small>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        <div className="mapp-side-list">
          {MOBILE_ROUTE_GROUPS.map((group) => (
            <section key={group.id} className="mapp-side-group" aria-label={group.label}>
              <div className="mapp-side-group-title">
                <strong>{group.label}</strong>
                <small>{group.helper}</small>
              </div>
              {getMobileRoutesByGroup(group).map((item) => (
                <button key={item.key} type="button" className={item.key === activePage ? 'active' : ''} onClick={() => { setMenuOpen(false); onNavigate(item.key); }}>
                  <span><InlineIcon name={item.icon} size={24} /></span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="mapp-side-footer">
          <span>Ambiente</span>
          <strong>{demoMode.enabled ? 'Demo' : trainingMode.enabled ? 'Treinamento' : 'Produção'}</strong>
          <span>Versão</span>
          <strong>{status?.version?.replace('pwa-supabase-', '') || 'v147 alertas'}</strong>
          <button type="button" className="mapp-sidebar-logout" onClick={onLogout}>
            <InlineIcon name="bloqueio_seguro" size={24} />
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>

      {menuOpen ? <button type="button" className="mapp-dim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} /> : null}

      <section className="mapp-shell">
        <div className="mapp-mobile-top">
          <button type="button" className="mapp-menu-button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <MobileHeader status={status} settings={settings} alertsCount={alertsCount} onOpenAlerts={onOpenAlerts} onRefresh={onRefresh} onLogout={onLogout} />
        </div>

        <main ref={pageRef} className="mapp-page" id="mapp-page-scroll">
          <section className="mapp-store-card">
            <span className="mapp-avatar">{storeName.slice(0, 2).toUpperCase()}</span>
            <div>
              <small>Loja ativa</small>
              <strong>{storeName}</strong>
            </div>
            <button type="button" aria-label="Atualizar loja" onClick={onRefresh}>⌄</button>
          </section>

          {updateAvailable ? (
            <section className="mapp-update-banner">
              <div>
                <strong>Nova versão disponível</strong>
                <p>Atualize para usar a versão mais nova neste aparelho.</p>
              </div>
              <button type="button" onClick={onInstallUpdate}>Atualizar</button>
            </section>
          ) : null}


          {demoMode.enabled ? (
            <section className="mapp-demo-banner">
              <div>
                <strong>Ambiente demo ativo</strong>
                <p>Dados fictícios separados da loja real. Use para apresentar o sistema sem expor clientes, vendas ou estoque verdadeiro.</p>
              </div>
              <button type="button" onClick={() => onNavigate('diagnostics')}>Ver</button>
            </section>
          ) : null}

          {trainingMode.enabled ? (
            <section className="mapp-training-banner">
              <div>
                <strong>Modo treinamento ativo</strong>
                <p>Gravações reais estão bloqueadas. Desative no Diagnóstico Web antes da venda verdadeira.</p>
              </div>
              <button type="button" onClick={() => onNavigate('diagnostics')}>Ver</button>
            </section>
          ) : null}

          {loading ? <div className="mapp-inline-status">Sincronizando dados da loja...</div> : null}
          {error ? <div className="mapp-error-box">{error}</div> : null}

          <header className="mapp-page-title-row">
            <div>
              <h1>{route.label}</h1>
              <p>{route.subtitle}</p>
            </div>
            <span className={online ? 'mapp-online-chip' : 'mapp-warn-chip'}>{online ? 'Online' : 'Offline'}</span>
          </header>

          {relatedRoutes.length > 1 ? (
            <nav className="mapp-context-subnav" aria-label={`Sub-abas de ${activeGroup.label}`}>
              <div className="mapp-context-subnav-head">
                <strong>{activeGroup.label}</strong>
                <span>{activeGroup.helper}</span>
              </div>
              <div className="mapp-context-subnav-track">
                {relatedRoutes.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={item.key === activePage ? 'active' : ''}
                    onClick={() => onNavigate(item.key)}
                    aria-current={item.key === activePage ? 'page' : undefined}
                  >
                    <InlineIcon name={item.icon} size={24} />
                    <span>{item.shortLabel}</span>
                  </button>
                ))}
              </div>
            </nav>
          ) : null}

          {children}
        </main>

        <MobileBottomNav activePage={activePage} onNavigate={onNavigate} onOpenMore={() => setMenuOpen(true)} />
      </section>
    </div>
  );
}

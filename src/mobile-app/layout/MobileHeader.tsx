import type { AppStatus, Settings } from '../../types';
import { InlineIcon } from '../components/InlineIcon';

interface MobileHeaderProps {
  status: AppStatus | null;
  settings: Settings | null;
  alertsCount: number;
  onOpenAlerts: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export function MobileHeader({ status, settings, alertsCount, onOpenAlerts, onRefresh, onLogout }: MobileHeaderProps): JSX.Element {
  const storeName = (settings?.store_name || status?.settings.store_name || 'Jaque Confecções e Presentes').replace(/\s+Web$/i, '').trim() || 'Jaque Confecções e Presentes';
  return (
    <header className="mapp-header">
      <div className="mapp-header-brand">
        <span className="mapp-brand-dot"><InlineIcon name="app_logo_cadeado_carrinho" size={24} /></span>
        <strong className="mapp-header-store-name" title={storeName} aria-label={`Loja ${storeName}`}>{storeName}</strong>
      </div>
      <div className="mapp-header-actions">
        <button type="button" className="mapp-icon-button" onClick={onRefresh} aria-label="Atualizar dados">
          <InlineIcon name="atualizar" size={24} />
        </button>
        <button type="button" className="mapp-icon-button mapp-page-reload-button" onClick={() => window.location.reload()} aria-label="Recarregar página">
          <InlineIcon name="atualizar" size={24} />
        </button>
        <button type="button" className="mapp-icon-button mapp-bell-button" onClick={onOpenAlerts} aria-label={alertsCount > 0 ? `Abrir ${alertsCount} alerta(s)` : 'Abrir central de avisos'}>
          <span className="mapp-bell-shape" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M18 9.8a6 6 0 0 0-12 0c0 7-2.5 7.2-2.5 8.5h17C20.5 17 18 16.8 18 9.8Z" /><path d="M9.5 20a2.6 2.6 0 0 0 5 0" /></svg>
          </span>
          {alertsCount > 0 ? <span className="mapp-badge">{alertsCount}</span> : null}
        </button>
        <button type="button" className="mapp-icon-button mapp-logout-top-button" onClick={onLogout} aria-label="Sair da conta">
          <InlineIcon name="bloqueio_seguro" size={24} />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}

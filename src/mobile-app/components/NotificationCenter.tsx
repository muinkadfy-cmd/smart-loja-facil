import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { DelphiIconName } from '../../lib/icons';
import type { PageKey } from '../../types';
import { InlineIcon } from './InlineIcon';

export type NotificationTone = 'orange' | 'purple' | 'blue' | 'green';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: NotificationTone;
  icon: DelphiIconName;
  page?: PageKey;
}

interface NotificationCenterProps {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onNavigate: (page: PageKey) => void;
  onLogout?: () => void;
  title?: string;
  logoutLabel?: string;
  externalPanel?: ReactNode;
}

type NotificationTab = 'unread' | 'read';

const STORAGE_KEY = 'smart-loja:notification-center-v158';

interface NotificationState {
  readIds: string[];
  clearedIds: string[];
}

function readNotificationState(): NotificationState {
  if (typeof window === 'undefined') return { readIds: [], clearedIds: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<NotificationState>;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds.filter((id): id is string => typeof id === 'string') : [],
      clearedIds: Array.isArray(parsed.clearedIds) ? parsed.clearedIds.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return { readIds: [], clearedIds: [] };
  }
}

function writeNotificationState(state: NotificationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Se o navegador bloquear dados salvos no aparelho, a central continua funcionando na sessão atual.
  }
}

export function NotificationCard({ item, read, onRead }: { item: NotificationItem; read: boolean; onRead: (id: string) => void }): JSX.Element {
  return (
    <article className={`mapp-notification-card tone-${item.tone} ${read ? 'is-read' : 'is-unread'}`}>
      <span className="mapp-notification-unread-dot" aria-hidden="true" />
      <span className="mapp-notification-icon" aria-hidden="true"><InlineIcon name={item.icon} size={24} /></span>
      <div className="mapp-notification-copy">
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      <time className="mapp-notification-time">{item.time}</time>
      <button type="button" onClick={() => onRead(item.id)} aria-label={`Marcar ${item.title} como lida`}>
        {read ? 'Lida' : 'Ler'}
      </button>
    </article>
  );
}

export function NotificationTabs({
  activeTab,
  unreadCount,
  onTabChange,
  onClear,
}: {
  activeTab: NotificationTab;
  unreadCount: number;
  onTabChange: (tab: NotificationTab) => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="mapp-notification-tabs" role="tablist" aria-label="Filtros de notificações">
      <button type="button" role="tab" className={activeTab === 'read' ? 'active' : ''} aria-selected={activeTab === 'read'} onClick={() => onTabChange('read')}>
        Lidas
      </button>
      <button type="button" role="tab" className={activeTab === 'unread' ? 'active' : ''} aria-selected={activeTab === 'unread'} onClick={() => onTabChange('unread')}>
        Não lidas <span>{unreadCount}</span>
      </button>
      <button type="button" className="mapp-notification-clear-tab" onClick={onClear} aria-label="Limpar notificações lidas">
        Limpar
      </button>
    </div>
  );
}

export function NotificationActions({
  disabled,
  onMarkAllRead,
  onOpenFull,
  onLogout,
  logoutLabel = 'Sair da conta',
}: {
  disabled: boolean;
  onMarkAllRead: () => void;
  onOpenFull: () => void;
  onLogout?: () => void;
  logoutLabel?: string;
  externalPanel?: ReactNode;
}): JSX.Element {
  return (
    <footer className="mapp-notification-actions">
      <button type="button" className="mapp-notification-mark-all" onClick={onMarkAllRead} disabled={disabled} aria-label="Marcar todas as notificações como lidas">
        Marcar todas como lidas
      </button>
      <button type="button" className="mapp-notification-primary" onClick={onOpenFull} aria-label="Ver central completa de avisos">
        Ver central completa
      </button>
      {onLogout ? (
        <button type="button" className="mapp-notification-logout" onClick={onLogout} aria-label={logoutLabel}>
          {logoutLabel}
        </button>
      ) : null}
    </footer>
  );
}

export function NotificationCenter({ open, notifications, onClose, onNavigate, onLogout, title = 'Central de avisos', logoutLabel = 'Sair da conta', externalPanel }: NotificationCenterProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<NotificationTab>('unread');
  const [state, setState] = useState<NotificationState>(() => readNotificationState());
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !actionPending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actionPending, onClose, open]);

  useEffect(() => {
    writeNotificationState(state);
  }, [state]);

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !state.clearedIds.includes(item.id)),
    [notifications, state.clearedIds],
  );
  const unreadNotifications = visibleNotifications.filter((item) => !state.readIds.includes(item.id));
  const readNotifications = visibleNotifications.filter((item) => state.readIds.includes(item.id));
  const currentList = activeTab === 'unread' ? unreadNotifications : readNotifications;

  if (!open) return null;

  const markRead = (id: string) => {
    setActionPending(true);
    setState((current) => ({
      ...current,
      readIds: current.readIds.includes(id) ? current.readIds : [...current.readIds, id],
    }));
    window.setTimeout(() => setActionPending(false), 120);
  };

  const markAllRead = () => {
    setActionPending(true);
    setState((current) => ({
      ...current,
      readIds: Array.from(new Set([...current.readIds, ...visibleNotifications.map((item) => item.id)])),
    }));
    setActiveTab('read');
    window.setTimeout(() => setActionPending(false), 120);
  };

  const clearRead = () => {
    if (unreadNotifications.length > 0) {
      const confirmed = window.confirm('Existem avisos não lidos. Deseja limpar mesmo assim?');
      if (!confirmed) return;
    }
    setActionPending(true);
    setState((current) => ({
      readIds: current.readIds,
      clearedIds: Array.from(new Set([
        ...current.clearedIds,
        ...readNotifications.map((item) => item.id),
        ...(unreadNotifications.length > 0 ? unreadNotifications.map((item) => item.id) : []),
      ])),
    }));
    window.setTimeout(() => setActionPending(false), 120);
  };

  const openFullCenter = () => {
    onClose();
    onNavigate('diagnostics');
  };

  return (
    <div className="mapp-notification-layer" role="presentation" onMouseDown={() => { if (!actionPending) onClose(); }}>
      <section
        className="mapp-notification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mapp-notification-title"
        aria-describedby="mapp-notification-subtitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mapp-notification-head">
          <div>
            <h2 id="mapp-notification-title">{title}</h2>
            <p id="mapp-notification-subtitle">Alertas claros para usuário leigo</p>
          </div>
          <button type="button" className="mapp-notification-close" onClick={onClose} aria-label="Fechar notificações">
            ×
          </button>
        </header>

        {externalPanel ? <div className="mapp-notification-external-slot">{externalPanel}</div> : null}

        <NotificationTabs activeTab={activeTab} unreadCount={unreadNotifications.length} onTabChange={setActiveTab} onClear={clearRead} />

        <div className="mapp-notification-list" aria-live="polite">
          {currentList.length ? (
            currentList.map((item) => (
              <NotificationCard key={item.id} item={item} read={state.readIds.includes(item.id)} onRead={markRead} />
            ))
          ) : (
            <div className="mapp-notification-empty">
              <strong>{activeTab === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação lida'}</strong>
              <span>{activeTab === 'unread' ? 'Tudo certo por enquanto.' : 'Toque em Ler para guardar avisos nesta aba.'}</span>
            </div>
          )}
        </div>

        <NotificationActions disabled={visibleNotifications.length === 0 || unreadNotifications.length === 0} onMarkAllRead={markAllRead} onOpenFull={openFullCenter} onLogout={onLogout} logoutLabel={logoutLabel} />
      </section>
    </div>
  );
}

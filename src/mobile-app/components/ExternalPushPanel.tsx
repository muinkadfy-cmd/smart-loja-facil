import { useCallback, useEffect, useState } from 'react';
import type { PageKey } from '../../types';
import {
  disableWebPushNotifications,
  enableWebPushNotifications,
  getWebPushReadiness,
  onWebPushReadinessChange,
  sendWebPushTestNotification,
  type WebPushReadiness,
} from '../../lib/pushNotifications';
import { notifyMobileAction } from './actionToast';

const initialReadiness: WebPushReadiness = {
  supported: false,
  permission: 'unsupported',
  serviceWorker: false,
  pushManager: false,
  secureContext: false,
  configured: false,
  subscribed: false,
  savedInCloud: false,
  level: 'off',
  title: 'Verificando alertas externos',
  detail: 'Aguarde a leitura das permissões deste aparelho.',
  platformHint: 'Abra no celular para conferir a compatibilidade.',
};

function permissionLabel(permission: WebPushReadiness['permission']): string {
  if (permission === 'granted') return 'Permitido';
  if (permission === 'denied') return 'Bloqueado';
  if (permission === 'default') return 'Pedir permissão';
  return 'Indisponível';
}

function levelLabel(level: WebPushReadiness['level']): string {
  if (level === 'ok') return 'Ativo';
  if (level === 'warning') return 'Atenção';
  if (level === 'danger') return 'Bloqueado';
  return 'Desligado';
}

export function ExternalPushPanel({ onNavigate }: { onNavigate: (page: PageKey) => void }): JSX.Element {
  const [readiness, setReadiness] = useState<WebPushReadiness>(initialReadiness);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getWebPushReadiness().then(setReadiness).catch(() => {
      setReadiness({
        ...initialReadiness,
        level: 'danger',
        title: 'Não consegui verificar alertas',
        detail: 'Abra o diagnóstico para conferir permissão do celular, PWA e conexão.',
      });
    });
  }, []);

  useEffect(() => {
    refresh();
    return onWebPushReadinessChange(refresh);
  }, [refresh]);

  const runAction = async (action: 'enable' | 'disable' | 'test') => {
    setBusy(true);
    try {
      const result = action === 'enable'
        ? await enableWebPushNotifications()
        : action === 'disable'
          ? await disableWebPushNotifications()
          : await sendWebPushTestNotification();
      setReadiness(result.readiness);
      notifyMobileAction({
        title: result.title,
        message: result.detail,
        tone: result.ok ? 'success' : 'warning',
        page: result.ok ? undefined : 'diagnostics',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir agora.';
      notifyMobileAction({ title: 'Alertas externos', message, tone: 'error', page: 'diagnostics' });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`mapp-external-push-panel tone-${readiness.level}`} aria-label="Alertas externos do celular">
      <div className="mapp-external-push-main">
        <span className="mapp-external-push-icon" aria-hidden="true">🔔</span>
        <div>
          <strong>{readiness.title}</strong>
          <p>{readiness.detail}</p>
          <small>{readiness.platformHint}</small>
        </div>
      </div>
      <div className="mapp-external-push-grid" aria-label="Resumo dos alertas externos">
        <span><b>Status</b><strong>{levelLabel(readiness.level)}</strong></span>
        <span><b>Permissão</b><strong>{permissionLabel(readiness.permission)}</strong></span>
        <span><b>PWA</b><strong>{readiness.serviceWorker ? 'OK' : 'Pendente'}</strong></span>
        <span><b>Nuvem</b><strong>{readiness.savedInCloud ? 'Salvo' : readiness.configured ? 'Pronto' : 'Configurar'}</strong></span>
      </div>
      <div className="mapp-external-push-actions">
        {readiness.subscribed ? (
          <button type="button" className="ghost" onClick={() => void runAction('disable')} disabled={busy}>Desligar</button>
        ) : (
          <button type="button" className="primary" onClick={() => void runAction('enable')} disabled={busy || !readiness.supported}>Ativar alertas</button>
        )}
        <button type="button" onClick={() => void runAction('test')} disabled={busy || readiness.permission !== 'granted'}>Teste</button>
        <button type="button" className="ghost" onClick={() => onNavigate('diagnostics')}>Diagnóstico</button>
      </div>
    </section>
  );
}

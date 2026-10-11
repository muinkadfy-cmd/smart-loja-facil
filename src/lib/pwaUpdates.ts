import { useCallback, useEffect, useState } from 'react';
import packageInfo from '../../package.json';
import { getWebOutboxStats } from './webApi';

const CURRENT_VERSION = packageInfo.version;
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

type PublishedVersion = { version?: string; releasedAt?: string; notes?: string };

function versionLabel(value: string): string {
  return value.startsWith('0.1.') ? 'v' + value.slice(4) : value;
}

export interface PwaUpdateState {
  updateAvailable: boolean;
  updateLabel: string;
  updateBusy: boolean;
  updateError: string | null;
  installUpdate: () => Promise<void>;
}

/**
 * Verificação independente do SW: inclui Safari/iOS, abas abertas há horas e primeiro acesso.
 * Nunca apaga storage, outbox, SQLite nem força recarga antes da decisão do usuário.
 */
export function usePwaUpdate(): PwaUpdateState {
  const [latest, setLatest] = useState<string | null>(null);
  const [workerWaiting, setWorkerWaiting] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const checkUpdates = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const result = await fetch('/version.json?check=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (result.ok && result.headers.get('content-type')?.includes('json')) {
        const published = await result.json() as PublishedVersion;
        if (/^\d+\.\d+\.\d+$/.test(published.version || '')) {
          setLatest(published.version === CURRENT_VERSION ? null : published.version || null);
        }
      }
    } catch {
      // Mantenha o último aviso válido: falhas offline não significam que está atualizado.
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        setWorkerWaiting(Boolean(registration?.waiting && navigator.serviceWorker.controller));
      } catch {
        // Safari e navegadores restritivos podem negar acesso ao registro.
      }
    }
  }, []);

  useEffect(() => {
    void checkUpdates();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkUpdates();
    };
    const onUpdate = () => {
      setWorkerWaiting(true);
      void checkUpdates();
    };
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('smart-loja:pwa-update', onUpdate);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void checkUpdates(), VERSION_CHECK_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('smart-loja:pwa-update', onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkUpdates]);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (updateBusy) return;
    if (!navigator.onLine) {
      setUpdateError('Conecte-se à internet para atualizar com segurança.');
      return;
    }

    try {
      const outbox = getWebOutboxStats();
      if (outbox.pending > 0 || outbox.error > 0) {
        setUpdateError('Existem alterações pendentes neste aparelho. Sincronize e resolva as pendências antes de atualizar.');
        return;
      }
    } catch {
      setUpdateError('Não foi possível conferir as operações pendentes. Tente novamente antes de atualizar.');
      return;
    }

    setUpdateError(null);
    setUpdateBusy(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting && navigator.serviceWorker.controller) {
            // Controlador só é trocado após clique explícito. A recarga virá no controllerchange.
            let completed = false;
            const reload = () => {
              if (completed) return;
              completed = true;
              window.location.reload();
            };
            navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(reload, 4500);
            return;
          }
        }
      }
      // No Safari sem registro ativo, a página é obtida novamente da rede.
      const next = new URL(window.location.href);
      next.searchParams.set('pwa-update', Date.now().toString());
      window.location.replace(next.toString());
    } catch {
      setUpdateError('Não foi possível concluir a atualização. Verifique a internet e tente novamente.');
      setUpdateBusy(false);
    }
  }, [updateBusy]);

  return {
    updateAvailable: Boolean(latest || workerWaiting),
    updateLabel: latest ? versionLabel(latest) : 'nova versão',
    updateBusy,
    updateError,
    installUpdate,
  };
}

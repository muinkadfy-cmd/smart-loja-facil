import { useCallback, useEffect, useRef, useState } from 'react';
import { Welcome } from './pages/Welcome';
import { api } from './lib/api';
import { getSupabaseClient } from './lib/supabaseClient';
import { recordWebSyncSnapshot, subscribeWebStoreChanges } from './lib/webApi';
import { MobileApp } from './mobile-app/MobileApp';
import type { AppStatus, PageKey, Settings } from './types';

export default function App(): JSX.Element {
  const [entered, setEntered] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const lastWebAutoRefreshRef = useRef(0);

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.boot();
      setStatus(payload);
      setSettings(payload.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (entered) void boot();
  }, [boot, entered]);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
    void boot();
  }, [boot]);


  const logout = useCallback(async () => {
    const confirmed = window.confirm('Sair da conta neste aparelho? Dados já sincronizados continuam guardados na nuvem.');
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      if (client) await client.auth.signOut();
      recordWebSyncSnapshot('idle', 'Login', 'Você saiu da conta neste aparelho. Entre novamente para sincronizar.');
      window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed', { detail: { auth: 'signed-out' } }));
      setStatus(null);
      setSettings(null);
      setRefreshToken((value) => value + 1);
      setActivePage('dashboard');
      setEntered(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível sair agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const navigate = useCallback((page: PageKey) => {
    setActivePage(page);
    window.setTimeout(() => {
      document.getElementById('mapp-page-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }, []);

  useEffect(() => {
    if (!entered) return undefined;
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
    window.addEventListener('smart-loja:web-session-changed', refreshVisibleWebData);
    return () => {
      window.removeEventListener('focus', refreshVisibleWebData);
      window.removeEventListener('online', refreshVisibleWebData);
      document.removeEventListener('visibilitychange', refreshVisibleWebData);
      window.removeEventListener('smart-loja:web-session-changed', refreshVisibleWebData);
    };
  }, [boot, entered]);

  useEffect(() => {
    if (!entered || !status?.sqlite_ok) return undefined;
    let active = true;
    let dispose: (() => void) | undefined;
    let refreshTimer = 0;
    void subscribeWebStoreChanges(() => {
      if (!active || document.visibilityState === 'hidden') return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (!active) return;
        setRefreshToken((value) => value + 1);
        void boot();
      }, 500);
    }).then((unsubscribe) => {
      if (!active) unsubscribe();
      else dispose = unsubscribe;
    }).catch(() => undefined);
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      if (dispose) dispose();
    };
  }, [boot, entered, status?.sqlite_ok]);

  if (!entered) return <Welcome onEnter={() => setEntered(true)} />;

  return (
    <MobileApp
      activePage={activePage}
      status={status}
      settings={settings}
      loading={loading}
      error={error}
      refreshToken={refreshToken}
      onNavigate={navigate}
      onRefresh={refresh}
      onLogout={logout}
    />
  );
}

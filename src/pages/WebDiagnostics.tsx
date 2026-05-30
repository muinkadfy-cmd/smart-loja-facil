import React, { useEffect, useMemo, useState } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';
import { getWebRoleCapabilities, getWebStoreContext, WEB_APP_VERSION, webRemoteSyncHealth, webRoleLabel, webSyncQueueSnapshot, type WebStoreRole } from '../lib/webApi';

interface HealthItem {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'info';
  detail: string;
}

interface WebContextState {
  storeName: string;
  role: WebStoreRole | 'sem login';
  email: string;
  detail: string;
}


export function WebDiagnosticsPage(): JSX.Element {
  const runtime = useMemo(() => getRuntimeInfo(), []);
  const env = useMemo(() => getPublicWebEnv(), []);
  const [context, setContext] = useState<WebContextState>({
    storeName: 'Aguardando login',
    role: 'sem login',
    email: 'Entre para sincronizar',
    detail: 'Login Supabase ainda não carregado neste aparelho.',
  });
  const [copyMessage, setCopyMessage] = useState('');
  const [syncQueue, setSyncQueue] = useState(() => webSyncQueueSnapshot());
  const [remoteHealth, setRemoteHealth] = useState<Record<string, unknown> | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'));
  const [sessionRefresh, setSessionRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    if (!env.isConfigured || runtime.isTauri) return undefined;
    void getWebStoreContext({ createIfMissing: false })
      .then((payload) => {
        if (!active) return;
        setContext({
          storeName: payload.store.name,
          role: payload.role,
          email: payload.email,
          detail: `Loja ${payload.store.id.slice(0, 8)} com papel ${webRoleLabel(payload.role).toLowerCase()}.`,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setContext({
          storeName: 'Aguardando loja web',
          role: 'sem login',
          email: 'Não conectado',
          detail: error instanceof Error ? error.message : 'Entre no Supabase para carregar a loja.',
        });
      });
    return () => {
      active = false;
    };
  }, [env.isConfigured, runtime.isTauri, sessionRefresh]);

  useEffect(() => {
    const reloadSession = () => setSessionRefresh((value) => value + 1);
    window.addEventListener('smart-loja:web-session-changed', reloadSession);
    return () => window.removeEventListener('smart-loja:web-session-changed', reloadSession);
  }, []);

  useEffect(() => {
    const updateSyncSnapshot = () => setSyncQueue(webSyncQueueSnapshot());
    window.addEventListener('smart-loja:web-sync-queue-changed', updateSyncSnapshot);
    window.addEventListener('smart-loja:web-remote-change', updateSyncSnapshot);
    updateSyncSnapshot();
    return () => {
      window.removeEventListener('smart-loja:web-sync-queue-changed', updateSyncSnapshot);
      window.removeEventListener('smart-loja:web-remote-change', updateSyncSnapshot);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void webRemoteSyncHealth().then((health) => {
      if (active) setRemoteHealth(health);
    });
    return () => {
      active = false;
    };
  }, [context.storeName, context.role, syncQueue.last_success_at, syncQueue.pending]);

  const capabilities = getWebRoleCapabilities(context.role);
  const onlineLabel = typeof navigator === 'undefined' || navigator.onLine ? 'Online' : 'Sem internet';
  const swLabel = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker.controller ? 'Controlando cache' : 'Registrável'
    : 'Indisponível';
  const notificationLabel = notificationPermission === 'granted' ? 'Ativadas' : notificationPermission === 'default' ? 'Aguardando autorização' : 'Bloqueadas';

  const diagnosticText = [
    `Versão: ${WEB_APP_VERSION}`,
    `Ambiente: ${runtime.platformLabel}`,
    `Host: ${runtime.appHost}`,
    `Loja: ${context.storeName}`,
    `Usuário: ${context.email}`,
    `Papel: ${webRoleLabel(context.role)}`,
    `Permissão: ${capabilities.writeLabel}`,
    `Supabase URL: ${env.hasSupabaseUrl ? 'ok' : 'faltando'}`,
    `Supabase anon key: ${env.hasSupabaseAnonKey ? 'ok' : 'faltando'}`,
    `Origem Supabase: ${env.source === 'vite-env' ? 'Cloudflare/Vite env' : 'fallback publico v71'}`,
    `Rede: ${onlineLabel}`,
    `Service worker: ${swLabel}`,
    `Notificações: ${notificationLabel}`,
    `Fila de sync: ${syncQueue.pending} pendente(s)`,
    `Realtime: ${syncQueue.realtime_status}`,
    `Último sync reenviado: ${syncQueue.last_success_at || 'sem registro'}`,
    `Último erro de sync: ${syncQueue.last_error || 'sem erro local'}`,
    `Health remoto: ${remoteHealth ? JSON.stringify(remoteHealth) : 'indisponível ou migration v70 pendente'}`,
  ].join('\n');

  async function copyDiagnostic(): Promise<void> {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopyMessage('Diagnóstico copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar automaticamente. Selecione os dados na tela.');
    }
  }

  async function enableNotifications(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const nextPermission = await Notification.requestPermission();
    setNotificationPermission(nextPermission);
    if (nextPermission === 'granted') {
      new Notification('Smart Loja Fácil', { body: 'Avisos ativados para sincronização pendente, erro de envio e internet offline.' });
    }
  }

  const items: HealthItem[] = [
    {
      label: 'Ambiente',
      value: runtime.isWeb ? 'PWA / Navegador' : 'Aplicativo local',
      tone: runtime.isWeb ? 'ok' : 'info',
      detail: runtime.isWeb ? 'Rodando no navegador com foco web/mobile.' : 'Rodando no desktop local.',
    },
    {
      label: 'Loja ativa',
      value: context.storeName,
      tone: context.role === 'sem login' ? 'warn' : 'ok',
      detail: context.detail,
    },
    {
      label: 'Usuário e papel',
      value: `${webRoleLabel(context.role)} · ${context.email}`,
      tone: context.role === 'sem login' ? 'warn' : 'ok',
      detail: 'Permissões reforçadas no app e pela RLS do Supabase.',
    },
    {
      label: 'Permissão de escrita',
      value: capabilities.canOperate ? 'Liberada' : 'Somente leitura',
      tone: capabilities.canOperate ? 'ok' : 'warn',
      detail: capabilities.writeLabel,
    },
    {
      label: 'Rede do aparelho',
      value: onlineLabel,
      tone: onlineLabel === 'Online' ? 'ok' : 'warn',
      detail: onlineLabel === 'Online' ? 'Sincronização pode comunicar com Supabase.' : 'O app abre do cache, mas não salva na nuvem até a conexão voltar.',
    },
    {
      label: 'Service worker',
      value: swLabel,
      tone: swLabel === 'Indisponível' ? 'warn' : 'ok',
      detail: 'Cache versionado com limpeza de versões antigas.',
    },
    {
      label: 'Notificações leigas',
      value: notificationLabel,
      tone: notificationPermission === 'granted' ? 'ok' : notificationPermission === 'default' ? 'info' : 'warn',
      detail: notificationPermission === 'granted' ? 'O navegador pode avisar sobre pendência, erro de sync e internet offline.' : notificationPermission === 'default' ? 'Toque em Ativar avisos para receber alertas simples sobre sincronização.' : 'O navegador bloqueou avisos. Libere nas configurações do site se quiser notificações.',
    },
    {
      label: 'Fila de sincronização',
      value: syncQueue.pending > 0 ? `${syncQueue.pending} pendente(s)` : 'Sem pendência',
      tone: syncQueue.pending > 0 ? 'warn' : 'ok',
      detail: syncQueue.pending > 0 ? `Primeiro item: ${syncQueue.oldest_at || 'sem data'}. Último erro: ${syncQueue.last_error || 'aguardando envio'}.` : 'Nada ficou preso localmente neste aparelho.',
    },
    {
      label: 'Realtime web/mobile',
      value: syncQueue.realtime_status,
      tone: syncQueue.realtime_status.includes('conectado') ? 'ok' : 'info',
      detail: 'Quando outro dispositivo salva no Supabase, esta sessão recebe aviso e atualiza os dados.',
    },
    {
      label: 'Último reenvio',
      value: syncQueue.last_success_at || 'Sem registro',
      tone: syncQueue.last_success_at ? 'ok' : 'info',
      detail: 'Mostra quando a fila local conseguiu reenviar algo para o Supabase.',
    },
    {
      label: 'Health remoto SQL',
      value: remoteHealth ? 'RPC v70 OK' : 'Pendente',
      tone: remoteHealth ? 'ok' : 'warn',
      detail: remoteHealth ? `Conflitos abertos: ${String(remoteHealth.sync_conflicts_open ?? 0)} · outbox: ${String(remoteHealth.sync_outbox_pending ?? 0)}.` : 'Aplique a migration 202605300001_supabase_sync_hardening_v70.sql no Supabase.',
    },
    {
      label: 'URL Supabase',
      value: env.hasSupabaseUrl ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseUrl ? 'ok' : 'warn',
      detail: env.hasSupabaseUrl ? (env.source === 'vite-env' ? 'Variável pública encontrada no build.' : 'URL pública embutida como fallback seguro.') : 'Adicione VITE_SUPABASE_URL no Cloudflare.',
    },
    {
      label: 'Anon Key',
      value: env.hasSupabaseAnonKey ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseAnonKey ? 'ok' : 'warn',
      detail: env.hasSupabaseAnonKey ? (env.source === 'vite-env' ? 'Chave pública carregada no build.' : 'Anon public key embutida como fallback seguro.') : 'Adicione VITE_SUPABASE_ANON_KEY no Cloudflare.',
    },
    {
      label: 'Versão/cache',
      value: WEB_APP_VERSION,
      tone: 'ok',
      detail: 'Service Worker versionado e aviso de nova versão ativo.',
    },
  ];

  return (
    <div className="stack web-stack webdiagnostics-light-v65 webdiagnostics-safe-v66">
      <section className="web-hero-card">
        <span className="web-kicker">Diagnóstico de produção</span>
        <h1>PWA web/mobile com Supabase como foco principal</h1>
        <p>Esta tela valida login, loja ativa, papel do usuário, cache e conexão. Os detalhes técnicos ficam aqui para o dashboard continuar limpo para usuário leigo.</p>
        <div className="web-diagnostics-actions">
          <button type="button" className="primary-btn web-copy-diagnostic-btn" onClick={copyDiagnostic}>Copiar diagnóstico</button>
          {notificationPermission === 'default' ? <button type="button" className="secondary-btn web-copy-diagnostic-btn" onClick={enableNotifications}>Ativar avisos</button> : null}
          {copyMessage ? <span className="web-message">{copyMessage}</span> : null}
        </div>
      </section>

      <section className="web-health-grid web-health-grid-premium">
        {items.map((item) => (
          <article key={item.label} className={`web-health-card web-health-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="mobile-readiness-card">
        <span className="web-kicker">Pronto para celular</span>
        <h2>PWA atualizado, cache novo e área segura</h2>
        <p>O app agora tem manifest melhorado, cache versionado, aviso de atualização, fila local de sincronização e realtime para refletir alterações feitas em outro dispositivo.</p>
        <div className="mobile-readiness-grid">
          <span>Ícones 192/512</span>
          <span>Cache versionado</span>
          <span>Fila de sync</span>
          <span>Realtime ativo</span>
          <span>Aviso de nova versão</span>
          <span>Safe-area ativa</span>
        </div>
      </section>

      <section className="web-permission-grid" aria-label="Resumo de permissões web">
        <span className={capabilities.canRead ? 'ok' : 'warn'}>Leitura: {capabilities.canRead ? 'sim' : 'não'}</span>
        <span className={capabilities.canOperate ? 'ok' : 'warn'}>Operação: {capabilities.canOperate ? 'sim' : 'não'}</span>
        <span className={capabilities.canManageStore ? 'ok' : 'warn'}>Configurações: {capabilities.canManageStore ? 'sim' : 'não'}</span>
        <span className={capabilities.canManageMembers ? 'ok' : 'warn'}>Usuários: {capabilities.canManageMembers ? 'dono' : 'bloqueado'}</span>
      </section>

      <div className="web-two-col">
        <WebAuthPanel />
        <section className="web-card">
          <span className="web-kicker">Segurança</span>
          <h2>Regras de produção</h2>
          <ul className="web-check-list">
            <li>Frontend usa somente URL e anon key públicas.</li>
            <li>Service role e VAPID private key ficam fora do app.</li>
            <li>Loja ativa e papel do usuário são lidos pelo Supabase.</li>
            <li>Clientes, produtos, configurações, vendas, caixa, pedidos, crediário e comprovantes passam pela camada web/Supabase.</li>
            <li>Operações financeiras críticas usam RPC ou validação reforçada para evitar duplicidade.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

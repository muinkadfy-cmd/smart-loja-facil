import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { getPublicWebEnv } from '../lib/env';
import { getSupabaseClient, summarizeSession, type WebSessionSummary } from '../lib/supabaseClient';
import { humanizeWebError, recordWebSyncSnapshot } from '../lib/webApi';

const REMEMBER_EMAIL_KEY = 'smart-loja:web-auth-email';

interface WebAuthPanelProps {
  compact?: boolean;
  onOpenPanel?: () => void;
  onAuthenticated?: () => void;
  autoContinueWhenSession?: boolean;
}

export function WebAuthPanel({ compact = false, onOpenPanel, onAuthenticated, autoContinueWhenSession = false }: WebAuthPanelProps): JSX.Element {
  const env = useMemo(() => getPublicWebEnv(), []);
  const [session, setSession] = useState<WebSessionSummary | null>(null);
  const [email, setEmail] = useState(() => window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(Boolean(window.localStorage.getItem(REMEMBER_EMAIL_KEY)));
  const [busy, setBusy] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success' | 'info'>('info');
  const continuedAfterAuthRef = useRef(false);

  const continueAfterAuth = useCallback((delayMs = 0) => {
    if (!onAuthenticated || continuedAfterAuthRef.current) return;
    continuedAfterAuthRef.current = true;
    window.setTimeout(() => onAuthenticated(), delayMs);
  }, [onAuthenticated]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setSessionLoading(false);
      return undefined;
    }

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const currentSession = summarizeSession(data.session);
      setSession(currentSession);
      if (currentSession && autoContinueWhenSession) continueAfterAuth(120);
    }).finally(() => {
      if (active) setSessionLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      const summary = summarizeSession(nextSession);
      setSession(summary);
      if (summary && autoContinueWhenSession) continueAfterAuth(120);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [autoContinueWhenSession, continueAfterAuth]);

  useEffect(() => {
    const syncNetwork = () => setNetworkOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    window.addEventListener('online', syncNetwork);
    window.addEventListener('offline', syncNetwork);
    syncNetwork();
    return () => {
      window.removeEventListener('online', syncNetwork);
      window.removeEventListener('offline', syncNetwork);
    };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setMessageTone('info');
    const client = getSupabaseClient();
    if (!client) {
      setMessageTone('error');
      setMessage(env.hasUnsafeServiceRoleKey ? env.securityWarnings.join(' ') : 'Nuvem não configurada. Informe a URL e a chave pública anon/publishable para ativar login e sincronização.');
      recordWebSyncSnapshot('error', 'Login', 'Nuvem não configurada.');
      return;
    }
    if (!email.trim() || !password) {
      setMessageTone('error');
      setMessage('Não foi possível entrar. Confira login e senha.');
      return;
    }
    if (!networkOnline) {
      setMessageTone('error');
      setMessage('Sem internet neste aparelho. Entre quando a conexão voltar para sincronizar dados na nuvem.');
      recordWebSyncSnapshot('pending', 'Login', 'Login pendente por falta de internet.');
      return;
    }
    setBusy(true);
    recordWebSyncSnapshot('syncing', 'Login', 'Validando login seguro no Supabase...');
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      const detail = humanizeWebError(error);
      recordWebSyncSnapshot('error', 'Login', detail);
      setMessageTone('error');
      setMessage(detail);
      return;
    }
    if (rememberEmail) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    setPassword('');
    recordWebSyncSnapshot('synced', 'Login', 'Conexão segura. Sessão Supabase ativa neste aparelho.');
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed', { detail: { auth: 'signed-in' } }));
    setMessageTone('success');
    setMessage('Login confirmado. Abrindo o painel da loja...');
    continueAfterAuth(250);
  }

  async function signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
    setSession(null);
    recordWebSyncSnapshot('idle', 'Login', 'Sessão encerrada. Entre para sincronizar.');
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed', { detail: { auth: 'signed-out' } }));
    continuedAfterAuthRef.current = false;
    setMessageTone('info');
    setMessage('Sessão web encerrada.');
  }

  const statusTone = !env.isConfigured ? 'warn' : session ? 'ok' : networkOnline ? 'warn' : 'danger';
  const statusLabel = !env.isConfigured
    ? 'Nuvem não configurada'
    : session
      ? 'Conta conectada'
      : networkOnline
        ? 'Aguardando login'
        : 'Sem internet';

  if (!env.isConfigured) {
    return (
      <section className={`web-card web-auth-panel web-auth-panel-unconfigured ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
        <span className="web-kicker">Acesso da loja</span>
        <div className="web-auth-status-pill web-auth-status-warn">Nuvem não configurada</div>
        <h2>Falta configurar a nuvem</h2>
        <p>Configure as variáveis públicas no deploy para liberar login e sincronização. Não coloque chave privada no app.</p>
        {env.securityWarnings.length > 0 ? (
          <div className="web-auth-alert">{env.securityWarnings.join(' ')}</div>
        ) : null}
        <form className="web-auth-form web-auth-form-disabled" aria-label="Login aguardando configuração">
          <label>
            <span>E-mail</span>
            <div className="web-input-row">
              <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
              <input value="" placeholder="Digite seu e-mail" autoComplete="email" disabled readOnly />
            </div>
          </label>
          <label>
            <span>Senha</span>
            <div className="web-password-row web-input-row">
              <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
              <input value="" type="password" placeholder="Senha de acesso" autoComplete="current-password" disabled readOnly />
              <button type="button" className="secondary-btn" disabled>Ver</button>
            </div>
          </label>
          <button type="button" className="primary-btn" disabled>Entrar no painel</button>
        </form>
        <div className="web-code-list">
          {env.missing.map((item) => <code key={item}>{item}</code>)}
        </div>
      </section>
    );
  }

  if (session) {
    return (
      <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
        <span className="web-kicker">Acesso confirmado</span>
        <div className={`web-auth-status-pill web-auth-status-${statusTone}`}>{statusLabel}</div>
        <h2>{compact ? 'Abrindo painel' : session.email}</h2>
        {compact ? <strong className="web-auth-compact-email">{session.email}</strong> : <p>Conta conectada. Os dados da loja podem sincronizar entre PC e celular.</p>}
        {!compact ? (
          <div className="web-auth-session-grid">
            <span><strong>ID</strong><small>{session.userId}</small></span>
            <span><strong>Expira</strong><small>{session.expiresAt ? new Date(session.expiresAt * 1000).toLocaleString('pt-BR') : 'sessão persistente'}</small></span>
          </div>
        ) : null}
        <div className={`web-auth-session-actions ${compact ? 'web-auth-session-actions-compact' : ''}`}>
          {compact && onOpenPanel ? (
            <button type="button" className="primary-btn" onClick={onOpenPanel} disabled={busy}>Abrir painel agora</button>
          ) : null}
          <button type="button" className="secondary-btn" onClick={signOut} disabled={busy}>Sair</button>
        </div>
        {message && <small className={`web-message web-message-${messageTone}`}>{message}</small>}
      </section>
    );
  }

  return (
    <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
      <span className="web-kicker">Acesso da loja</span>
      <div className={`web-auth-status-pill web-auth-status-${statusTone}`}>{sessionLoading ? 'Verificando sessão...' : statusLabel}</div>
      <h2>Entrar no painel</h2>
      <p className="web-auth-primary-copy">Use o e-mail e a senha da loja para sincronizar no celular e no computador.</p>
      <form className="web-auth-form" onSubmit={signIn}>
        <label>
          <span>E-mail</span>
          <div className="web-input-row">
              <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail da loja" autoComplete="email" inputMode="email" />
            </div>
        </label>
        <label>
          <span>Senha</span>
          <div className="web-password-row web-input-row">
            <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Senha de acesso" autoComplete="current-password" />
            <button type="button" className="secondary-btn" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>
        <div className="web-auth-form-options">
          <label className="web-check-row">
            <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
            <span>Lembrar e-mail neste aparelho</span>
          </label>
          <button
            type="button"
            className="web-forgot-link"
            onClick={() => {
              setMessageTone('info');
              setMessage('Para recuperar a senha, solicite um novo acesso ao administrador da loja.');
            }}
          >
            Ajuda
          </button>
        </div>
        <button type="submit" className="primary-btn" disabled={busy || sessionLoading}>{busy ? 'Entrando com segurança...' : 'Entrar no painel'}</button>
      </form>
      <div className="web-auth-secure-note">
        <AppIcon name="bloqueio_seguro" size={16} />
        <span>Senha protegida. Nunca compartilhe acesso de dono com funcionário.</span>
      </div>
      {message && <small className={`web-message web-message-${messageTone}`}>{message}</small>}
    </section>
  );
}

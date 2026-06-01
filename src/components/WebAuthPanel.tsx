import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcon';
import { getPublicWebEnv } from '../lib/env';
import { getSupabaseClient, summarizeSession, type WebSessionSummary } from '../lib/supabaseClient';
import { humanizeWebError, recordWebSyncSnapshot } from '../lib/webApi';

const REMEMBER_EMAIL_KEY = 'smart-loja:web-auth-email';

interface WebAuthPanelProps {
  compact?: boolean;
}

export function WebAuthPanel({ compact = false }: WebAuthPanelProps): JSX.Element {
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

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setSessionLoading(false);
      return undefined;
    }

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setSession(summarizeSession(data.session));
    }).finally(() => {
      if (active) setSessionLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(summarizeSession(nextSession));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

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
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
    setMessageTone('success');
    setMessage('Login confirmado. Tudo pronto para vender.');
  }

  async function signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
    setSession(null);
    recordWebSyncSnapshot('idle', 'Login', 'Sessão encerrada. Entre para sincronizar.');
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
    setMessageTone('info');
    setMessage('Sessão web encerrada.');
  }

  const statusTone = !env.isConfigured ? 'warn' : session ? 'ok' : networkOnline ? 'warn' : 'danger';
  const statusLabel = !env.isConfigured
    ? 'Nuvem não configurada'
    : session
      ? 'Conexão segura'
      : networkOnline
        ? 'Login pendente'
        : 'Sem internet';

  if (!env.isConfigured) {
    return (
      <section className={`web-card web-auth-panel web-auth-panel-unconfigured ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
        <span className="web-kicker">Login web</span>
        <div className="web-auth-status-pill web-auth-status-warn">Nuvem não configurada</div>
        <h2>Login pronto para ativar</h2>
        <p>Configure somente variáveis públicas no Cloudflare para liberar login, celular e sincronização. Nunca use service_role no frontend.</p>
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
              <input value="" type="password" placeholder="Digite sua senha" autoComplete="current-password" disabled readOnly />
              <button type="button" className="secondary-btn" disabled>Ver</button>
            </div>
          </label>
          <button type="button" className="primary-btn" disabled>Entrar pela nuvem</button>
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
        <span className="web-kicker">Sessão web ativa</span>
        <div className={`web-auth-status-pill web-auth-status-${statusTone}`}>{statusLabel}</div>
        <h2>{session.email}</h2>
        <p>Login salvo com segurança pelo Supabase. Clientes, produtos e configurações usam a loja web ativa.</p>
        <div className="web-auth-session-grid">
          <span><strong>ID</strong><small>{session.userId}</small></span>
          <span><strong>Expira</strong><small>{session.expiresAt ? new Date(session.expiresAt * 1000).toLocaleString('pt-BR') : 'sessão persistente'}</small></span>
        </div>
        <button type="button" className="secondary-btn" onClick={signOut} disabled={busy}>Sair do modo web</button>
        {message && <small className={`web-message web-message-${messageTone}`}>{message}</small>}
      </section>
    );
  }

  return (
    <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
      <span className="web-kicker">Login web</span>
      <div className={`web-auth-status-pill web-auth-status-${statusTone}`}>{sessionLoading ? 'Verificando sessão...' : statusLabel}</div>
      <h2>Entrar para sincronizar dados na nuvem</h2>
      <p>Use o usuário criado no Supabase. O e-mail pode ficar salvo neste aparelho; a senha não é salva pelo app.</p>
      <form className="web-auth-form" onSubmit={signIn}>
        <label>
          <span>Login</span>
          <div className="web-input-row">
              <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Digite seu login" autoComplete="email" inputMode="email" />
            </div>
        </label>
        <label>
          <span>Senha</span>
          <div className="web-password-row web-input-row">
            <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" autoComplete="current-password" />
            <button type="button" className="secondary-btn" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>
        <div className="web-auth-form-options">
          <label className="web-check-row">
            <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
            <span>Lembrar acesso</span>
          </label>
          <button
            type="button"
            className="web-forgot-link"
            onClick={() => {
              setMessageTone('info');
              setMessage('Para recuperar a senha, solicite um novo acesso ao administrador da loja.');
            }}
          >
            Esqueci minha senha
          </button>
        </div>
        <button type="submit" className="primary-btn" disabled={busy || sessionLoading}>{busy ? 'Aguarde, entrando no sistema...' : 'Entrar'}</button>
      </form>
      {message && <small className={`web-message web-message-${messageTone}`}>{message}</small>}
    </section>
  );
}

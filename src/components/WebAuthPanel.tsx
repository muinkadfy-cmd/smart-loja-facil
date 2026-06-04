import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { getPublicWebEnv } from '../lib/env';
import { getSupabaseClient, summarizeSession, type WebSessionSummary } from '../lib/supabaseClient';
import { humanizeWebError, recordWebSyncSnapshot } from '../lib/webApi';

const REMEMBER_EMAIL_KEY = 'smart-loja:web-auth-email';
const REMEMBER_PASSWORD_KEY = 'smart-loja:web-auth-password-v1';
const AUTO_LOGIN_KEY = 'smart-loja:web-auth-auto-login';

function readStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // O navegador pode bloquear armazenamento local. O login manual continua funcionando.
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sem ação: limpar armazenamento pode falhar em modo privado.
  }
}

function encodeSavedPassword(value: string): string {
  try {
    return window.btoa(unescape(encodeURIComponent(value)));
  } catch {
    return '';
  }
}

function decodeSavedPassword(value: string): string {
  if (!value) return '';
  try {
    return decodeURIComponent(escape(window.atob(value)));
  } catch {
    return '';
  }
}

function readSavedPassword(): string {
  return decodeSavedPassword(readStorage(REMEMBER_PASSWORD_KEY));
}

interface WebAuthPanelProps {
  compact?: boolean;
  onOpenPanel?: () => void;
  onAuthenticated?: () => void;
  autoContinueWhenSession?: boolean;
}

export function WebAuthPanel({ compact = false, onOpenPanel, onAuthenticated, autoContinueWhenSession = false }: WebAuthPanelProps): JSX.Element {
  const env = useMemo(() => getPublicWebEnv(), []);
  const [session, setSession] = useState<WebSessionSummary | null>(null);
  const [email, setEmail] = useState(() => readStorage(REMEMBER_EMAIL_KEY));
  const [password, setPassword] = useState(() => readSavedPassword());
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(readStorage(REMEMBER_EMAIL_KEY)) || Boolean(readSavedPassword()));
  const [rememberPassword, setRememberPassword] = useState(() => Boolean(readSavedPassword()));
  const [autoLogin, setAutoLogin] = useState(() => readStorage(AUTO_LOGIN_KEY) === '1' && Boolean(readSavedPassword()));
  const [busy, setBusy] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success' | 'info'>('info');
  const continuedAfterAuthRef = useRef(false);
  const autoLoginAttemptRef = useRef(false);

  const continueAfterAuth = useCallback((delayMs = 0) => {
    if (!onAuthenticated || continuedAfterAuthRef.current) return;
    continuedAfterAuthRef.current = true;
    window.setTimeout(() => onAuthenticated(), delayMs);
  }, [onAuthenticated]);

  const persistLoginOptions = useCallback((nextEmail: string, nextPassword: string) => {
    const cleanEmail = nextEmail.trim();
    if (rememberEmail || rememberPassword || autoLogin) writeStorage(REMEMBER_EMAIL_KEY, cleanEmail);
    else removeStorage(REMEMBER_EMAIL_KEY);

    if (rememberPassword || autoLogin) {
      const encoded = encodeSavedPassword(nextPassword);
      if (encoded) writeStorage(REMEMBER_PASSWORD_KEY, encoded);
    } else {
      removeStorage(REMEMBER_PASSWORD_KEY);
    }

    if (autoLogin && (rememberPassword || nextPassword)) writeStorage(AUTO_LOGIN_KEY, '1');
    else removeStorage(AUTO_LOGIN_KEY);
  }, [autoLogin, rememberEmail, rememberPassword]);

  const authenticateAccount = useCallback(async (nextEmail: string, nextPassword: string, mode: 'manual' | 'auto' = 'manual'): Promise<void> => {
    setMessage(null);
    setMessageTone('info');
    const client = getSupabaseClient();
    if (!client) {
      setMessageTone('error');
      setMessage(env.hasUnsafeServiceRoleKey ? env.securityWarnings.join(' ') : 'Nuvem não configurada. Chame o suporte para ativar o login e a sincronização.');
      recordWebSyncSnapshot('error', 'Login', 'Nuvem não configurada.');
      return;
    }
    if (!nextEmail.trim() || !nextPassword) {
      setMessageTone('error');
      setMessage('Não foi possível entrar. Confira e-mail e senha.');
      return;
    }
    if (!networkOnline) {
      setMessageTone('error');
      setMessage('Sem internet neste aparelho. Entre quando a conexão voltar para sincronizar dados na nuvem.');
      recordWebSyncSnapshot('pending', 'Login', 'Login pendente por falta de internet.');
      return;
    }
    setBusy(true);
    recordWebSyncSnapshot('syncing', 'Login', mode === 'auto' ? 'Entrando automaticamente em aparelho confiável...' : 'Validando login seguro...');
    const { error } = await client.auth.signInWithPassword({ email: nextEmail.trim(), password: nextPassword });
    setBusy(false);
    if (error) {
      const detail = humanizeWebError(error);
      recordWebSyncSnapshot('error', 'Login', detail);
      setMessageTone('error');
      setMessage(detail);
      return;
    }
    persistLoginOptions(nextEmail, nextPassword);
    if (!rememberPassword && !autoLogin) setPassword('');
    recordWebSyncSnapshot('synced', 'Login', 'Tudo certo: login confirmado neste aparelho.');
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed', { detail: { auth: 'signed-in' } }));
    setMessageTone('success');
    setMessage(mode === 'auto' ? 'Login automático confirmado. Abrindo o painel...' : 'Login confirmado. Abrindo o painel da loja...');
    continueAfterAuth(mode === 'auto' ? 650 : 250);
  }, [autoLogin, continueAfterAuth, env.hasUnsafeServiceRoleKey, env.securityWarnings, networkOnline, persistLoginOptions, rememberPassword]);

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
    }).finally(() => {
      if (active) setSessionLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      const summary = summarizeSession(nextSession);
      setSession(summary);
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

  useEffect(() => {
    if (!autoContinueWhenSession || !autoLogin || autoLoginAttemptRef.current || sessionLoading || busy || !env.isConfigured) return;
    if (!networkOnline) return;
    autoLoginAttemptRef.current = true;
    if (session) {
      setMessageTone('success');
      setMessage('Login automático ativo. Abrindo o painel...');
      continueAfterAuth(850);
      return;
    }
    const savedPassword = readSavedPassword();
    if (email.trim() && savedPassword) {
      setMessageTone('info');
      setMessage('Login automático ativo neste aparelho. Entrando com segurança...');
      void authenticateAccount(email, savedPassword, 'auto');
    }
  }, [authenticateAccount, autoContinueWhenSession, autoLogin, busy, continueAfterAuth, email, env.isConfigured, networkOnline, session, sessionLoading]);

  function signIn(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void authenticateAccount(email, password, 'manual');
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
    autoLoginAttemptRef.current = false;
    setMessageTone('info');
    setMessage('Sessão encerrada neste aparelho. Seus dados salvos continuam disponíveis se você marcou para salvar.');
  }

  function clearSavedAccess(): void {
    removeStorage(REMEMBER_EMAIL_KEY);
    removeStorage(REMEMBER_PASSWORD_KEY);
    removeStorage(AUTO_LOGIN_KEY);
    setRememberEmail(false);
    setRememberPassword(false);
    setAutoLogin(false);
    setPassword('');
    autoLoginAttemptRef.current = false;
    setMessageTone('info');
    setMessage('Login, senha e entrada automática foram removidos deste aparelho.');
  }

  const handleRememberPasswordChange = (checked: boolean) => {
    setRememberPassword(checked);
    if (checked) setRememberEmail(true);
    if (!checked) {
      setAutoLogin(false);
      removeStorage(AUTO_LOGIN_KEY);
      removeStorage(REMEMBER_PASSWORD_KEY);
    }
  };

  const handleAutoLoginChange = (checked: boolean) => {
    setAutoLogin(checked);
    if (checked) {
      setRememberEmail(true);
      setRememberPassword(true);
    } else {
      removeStorage(AUTO_LOGIN_KEY);
    }
  };

  const statusTone = !env.isConfigured ? 'warn' : session ? 'ok' : networkOnline ? 'warn' : 'danger';
  const statusLabel = !env.isConfigured
    ? 'Nuvem não configurada'
    : session
      ? autoLogin
        ? 'Entrada automática ativa'
        : 'Conta pronta neste aparelho'
      : networkOnline
        ? autoLogin
          ? 'Entrando automático'
          : 'Aguardando login'
        : 'Sem internet';

  if (!env.isConfigured) {
    return (
      <section className={`web-card web-auth-panel web-auth-panel-unconfigured ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
        <div className="web-auth-mini-status">
          <span className="web-kicker">Acesso da loja</span>
          <div className="web-auth-status-pill web-auth-status-warn">Nuvem não configurada</div>
        </div>
        <h2>Falta configurar a nuvem</h2>
        <p className="web-auth-primary-copy">Chame o suporte para ativar a conexão da loja. Não informe senha nem chave privada nesta tela.</p>
        {env.securityWarnings.length > 0 ? (
          <div className="web-auth-alert">{env.securityWarnings.join(' ')}</div>
        ) : null}
        <form className="web-auth-form web-auth-form-disabled" aria-label="Login aguardando configuração">
          <label>
            <span>E-mail</span>
            <div className="web-input-row">
              <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
              <input value="" placeholder="E-mail da loja" autoComplete="email" disabled readOnly />
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

  return (
    <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact web-auth-panel-simple' : ''}`}>
      <div className="web-auth-mini-status">
        <span className="web-kicker">Acesso da loja</span>
        <div className={`web-auth-status-pill web-auth-status-${statusTone}`}>{sessionLoading ? 'Verificando sessão...' : statusLabel}</div>
      </div>
      <h2>{session ? 'Login pronto' : 'Entrar no painel'}</h2>
      <p className="web-auth-primary-copy">
        {session
          ? 'Ajuda rápida: a tela de login aparece sempre. Toque para abrir o painel ou deixe a entrada automática ativa neste aparelho.'
          : 'Ajuda rápida: entre com a conta da loja para sincronizar no celular e no computador.'}
      </p>
      {session ? (
        <div className="web-auth-session-ready" title={session.email}>
          <AppIcon name="usuario_administrador" size={16} />
          <span>{session.email}</span>
        </div>
      ) : null}
      {!session ? (
        <form className="web-auth-form" onSubmit={signIn}>
          <label>
            <span>E-mail</span>
            <div className="web-input-row">
              <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail da loja" autoComplete="username email" inputMode="email" />
            </div>
          </label>
          <label>
            <span>Senha</span>
            <div className="web-password-row web-input-row">
              <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Senha de acesso" autoComplete="current-password" />
              <button type="button" className="secondary-btn web-password-toggle" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </label>
          <div className="web-auth-save-grid" aria-label="Opções de acesso neste aparelho">
            <label className="web-check-row">
              <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
              <span>Salvar e-mail</span>
            </label>
            <label className="web-check-row web-check-row-warning">
              <input type="checkbox" checked={rememberPassword} onChange={(event) => handleRememberPasswordChange(event.target.checked)} />
              <span>Salvar senha neste aparelho confiável</span>
            </label>
            <label className="web-check-row web-check-row-auto">
              <input type="checkbox" checked={autoLogin} onChange={(event) => handleAutoLoginChange(event.target.checked)} />
              <span>Salvo neste aparelho: entrar automaticamente ao abrir</span>
            </label>
          </div>
          <div className="web-auth-login-tools">
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
            <button type="button" className="web-forgot-link web-clear-saved-login" onClick={clearSavedAccess}>Limpar salvos</button>
          </div>
          <button type="submit" className="primary-btn" disabled={busy || sessionLoading}>{busy ? 'Entrando com segurança...' : 'Entrar no painel'}</button>
        </form>
      ) : (
        <div className="web-auth-session-actions web-auth-session-actions-compact">
          {onOpenPanel ? (
            <button type="button" className="primary-btn" onClick={onOpenPanel} disabled={busy}>Abrir painel</button>
          ) : null}
          <button type="button" className="secondary-btn" onClick={signOut} disabled={busy}>Sair</button>
        </div>
      )}
      <div className="web-auth-secure-note">
        <AppIcon name="bloqueio_seguro" size={16} />
        <span>{rememberPassword || autoLogin ? 'Senha salva apenas neste aparelho. Use só em celular ou PC confiável.' : 'Senha protegida. Nunca compartilhe acesso de dono com funcionário.'}</span>
      </div>
      {message && <small className={`web-message web-message-${messageTone}`}>{message}</small>}
    </section>
  );
}

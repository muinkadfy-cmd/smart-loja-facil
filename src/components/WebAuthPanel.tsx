import React, { useEffect, useMemo, useState } from 'react';
import { getPublicWebEnv } from '../lib/env';
import { getSupabaseClient, summarizeSession, type WebSessionSummary } from '../lib/supabaseClient';

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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return undefined;

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setSession(summarizeSession(data.session));
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(summarizeSession(nextSession));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setMessage('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Cloudflare para ativar o login web.');
      return;
    }
    if (!email.trim() || !password) {
      setMessage('Informe e-mail e senha para entrar.');
      return;
    }
    setBusy(true);
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (rememberEmail) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    setPassword('');
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
    setMessage('Login confirmado. Clientes, produtos e configurações já podem sincronizar no Supabase.');
  }

  async function signUp(): Promise<void> {
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setMessage('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Cloudflare para criar login web.');
      return;
    }
    if (!email.trim() || !password) {
      setMessage('Informe e-mail e senha antes de criar a conta da loja.');
      return;
    }
    if (password.length < 6) {
      setMessage('Use uma senha com pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    const { data, error } = await client.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (rememberEmail) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    setPassword('');
    if (data.session) {
      window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
      setMessage('Conta criada e login ativo. A primeira loja será criada automaticamente como dono.');
      return;
    }
    setMessage('Conta criada. Se o Supabase pedir confirmação, confirme o e-mail e depois toque em Entrar e sincronizar.');
  }

  async function signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
    setSession(null);
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
    setMessage('Sessão web encerrada.');
  }

  if (!env.isConfigured) {
    return (
      <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact' : ''}`}>
        <span className="web-kicker">Login web</span>
        <h2>Conexão web ainda não configurada</h2>
        <p>Adicione as variáveis públicas no Cloudflare para liberar login, celular e sincronização.</p>
        <div className="web-code-list">
          {env.missing.map((item) => <code key={item}>{item}</code>)}
        </div>
      </section>
    );
  }

  if (session) {
    return (
      <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact' : ''}`}>
        <span className="web-kicker">Sessão web ativa</span>
        <h2>{session.email}</h2>
        <p>Login salvo com segurança pelo Supabase. Clientes, produtos e configurações usam a loja web ativa.</p>
        <div className="web-auth-session-grid">
          <span><strong>ID</strong><small>{session.userId}</small></span>
          <span><strong>Expira</strong><small>{session.expiresAt ? new Date(session.expiresAt * 1000).toLocaleString('pt-BR') : 'sessão persistente'}</small></span>
        </div>
        <button type="button" className="secondary-btn" onClick={signOut} disabled={busy}>Sair do modo web</button>
        {message && <small className="web-message">{message}</small>}
      </section>
    );
  }

  return (
    <section className={`web-card web-auth-panel ${compact ? 'web-auth-panel-compact' : ''}`}>
      <span className="web-kicker">Login web</span>
      <h2>Entrar na loja online</h2>
      <p>Use o usuário criado no Supabase. O e-mail pode ficar salvo neste aparelho e a sessão continua ativa com segurança.</p>
      <form className="web-auth-form" onSubmit={signIn}>
        <label>
          <span>E-mail</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@loja.com" autoComplete="email" />
        </label>
        <label>
          <span>Senha</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Sua senha" autoComplete="current-password" />
        </label>
        <label className="web-check-row">
          <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
          <span>Salvar e-mail neste aparelho</span>
        </label>
        <div className="web-auth-actions">
          <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Entrando...' : 'Entrar e sincronizar'}</button>
          <button type="button" className="secondary-btn" onClick={signUp} disabled={busy}>{busy ? 'Aguarde...' : 'Criar primeira conta da loja'}</button>
        </div>
      </form>
      {message && <small className="web-message">{message}</small>}
    </section>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
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
      setMessage('Configure a URL e a chave pública do Supabase no deploy para liberar o login da loja.');
      return;
    }
    if (!email.trim() || !password) {
      setMessage('Preencha e-mail e senha para entrar.');
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
    setMessage('Login confirmado. A loja já pode sincronizar clientes, produtos, vendas e crediário.');
  }

  async function signUp(): Promise<void> {
    setMessage(null);
    const client = getSupabaseClient();
    if (!client) {
      setMessage('Configure a URL e a chave pública do Supabase no deploy para criar a primeira conta.');
      return;
    }
    if (!email.trim() || !password) {
      setMessage('Preencha e-mail e senha antes de criar a conta da loja.');
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
      setMessage('Conta criada e login ativo. A primeira loja será preparada como dona do sistema.');
      return;
    }
    setMessage('Conta criada. Se o Supabase pedir confirmação, confirme o e-mail e depois toque em Entrar.');
  }

  async function signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
    setSession(null);
    window.dispatchEvent(new CustomEvent('smart-loja:web-session-changed'));
    setMessage('Sessão web encerrada com segurança.');
  }

  if (!env.isConfigured) {
    return (
      <section className={`web-card web-auth-panel web-auth-clean-v74 web-auth-config-v74 ${compact ? 'web-auth-panel-compact' : ''}`}>
        <div className="web-auth-clean-shell">
          <div className="web-auth-hero-side">
            <span className="web-auth-safe-badge">Supabase</span>
            <h2>Conexão da nuvem pendente</h2>
            <p>Falta configurar a URL e a chave pública para liberar login, celular e sincronização.</p>
          </div>
          <div className="web-auth-form-card">
            <strong>Configuração necessária</strong>
            <p>Adicione as variáveis públicas no Cloudflare ou no arquivo local de build.</p>
            <div className="web-code-list">
              {env.missing.map((item) => <code key={item}>{item}</code>)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (session) {
    return (
      <section className={`web-card web-auth-panel web-auth-clean-v74 web-auth-session-v74 ${compact ? 'web-auth-panel-compact' : ''}`}>
        <div className="web-auth-session-head">
          <span className="web-auth-icon-bubble">✓</span>
          <div>
            <span className="web-auth-safe-badge">Login ativo</span>
            <h2>{session.email}</h2>
            <p>Conta conectada ao Supabase. Os dados podem sincronizar entre web e celular.</p>
          </div>
        </div>
        <div className="web-auth-session-grid">
          <span><strong>ID do usuário</strong><small>{session.userId}</small></span>
          <span><strong>Sessão</strong><small>{session.expiresAt ? `expira em ${new Date(session.expiresAt * 1000).toLocaleString('pt-BR')}` : 'persistente'}</small></span>
        </div>
        <button type="button" className="secondary-btn web-auth-full-button" onClick={signOut} disabled={busy}>Sair do modo web</button>
        {message && <small className="web-message web-message-ok-v74">{message}</small>}
      </section>
    );
  }

  return (
    <section className={`web-card web-auth-panel web-auth-clean-v74 ${compact ? 'web-auth-panel-compact' : ''}`} aria-label="Login Supabase da loja">
      <div className="web-auth-clean-shell">
        <aside className="web-auth-hero-side" aria-label="Resumo da sincronização">
          <span className="web-auth-safe-badge">Supabase seguro</span>
          <h2>Entrar para sincronizar</h2>
          <p>Use e-mail e senha da loja. Depois do login, clientes, produtos, vendas, caixa e crediário podem aparecer no web e no celular.</p>
          <ul className="web-auth-benefits">
            <li><span>✓</span> Dados protegidos por loja</li>
            <li><span>✓</span> Web e mobile usando a mesma nuvem</li>
            <li><span>✓</span> Avisos claros quando algo ficar pendente</li>
          </ul>
        </aside>

        <form className="web-auth-form web-auth-form-card" onSubmit={signIn}>
          <div className="web-auth-form-title">
            <span className="web-auth-icon-bubble">🔐</span>
            <div>
              <strong>Login da loja</strong>
              <small>Entre com sua conta Supabase</small>
            </div>
          </div>

          <label className="web-auth-field">
            <span>E-mail</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@loja.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <label className="web-auth-field">
            <span>Senha</span>
            <div className="web-auth-password-wrap">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <label className="web-check-row web-auth-remember-row">
            <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
            <span>Salvar só o e-mail neste aparelho</span>
          </label>

          <div className="web-auth-actions">
            <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
            <button type="button" className="secondary-btn" onClick={signUp} disabled={busy}>{busy ? 'Aguarde...' : 'Criar conta'}</button>
          </div>

          <small className="web-auth-help-text">Não salvamos senha no navegador. A sessão fica protegida pelo Supabase.</small>
          {message && <small className="web-message">{message}</small>}
        </form>
      </div>
    </section>
  );
}

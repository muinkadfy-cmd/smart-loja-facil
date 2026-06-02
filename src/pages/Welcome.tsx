import React, { useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';

type WelcomeAction = (() => void) | undefined;

interface WelcomeProps {
  onEnter?: () => void;
  onContinue?: () => void;
  onStart?: () => void;
  onOpen?: () => void;
  loading?: boolean;
  entering?: boolean;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}

function resolveAction(props: WelcomeProps): WelcomeAction {
  return props.onEnter ?? props.onContinue ?? props.onStart ?? props.onOpen;
}

function isBusy(props: WelcomeProps): boolean {
  return Boolean(props.loading || props.entering || props.busy);
}

function WelcomeLayout(props: WelcomeProps): JSX.Element {
  const action = resolveAction(props);
  const busy = isBusy(props);
  const runtimeInfo = getRuntimeInfo();
  const webEnv = getPublicWebEnv();
  const isWeb = runtimeInfo.isWeb;
  const webReady = webEnv.isConfigured;
  const [localLogin, setLocalLogin] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [localRemember, setLocalRemember] = useState(true);
  const [showLocalPassword, setShowLocalPassword] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const handleEnter = () => {
    if (props.disabled || busy || !action) return;
    if (!isWeb && (!localLogin.trim() || !localPassword.trim())) {
      setLocalMessage('Não foi possível entrar. Confira login e senha.');
      return;
    }
    setLocalMessage(!isWeb ? 'Aguarde, entrando no sistema...' : null);
    action();
  };

  const handleLocalSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleEnter();
  };

  return (
    <main className={['welcome-screen login-landing classic-login-landing master-login-v69 master-login-v70 master-login-v82', props.className].filter(Boolean).join(' ')}>
      <section className="master-login-single-shell" aria-label="Login do Smart Loja Fácil">
        <section className="master-login-hero-panel" aria-label="Apresentação do sistema">
          <div className="master-login-hero-logo">
            <AppIcon name="app_logo_cadeado_carrinho" size={48} alt="Smart Loja Fácil" />
          </div>
          <span className="web-kicker">PWA/Web seguro</span>
          <h1>Venda fácil, <b>sem poluição</b>.</h1>
          <p>Entre com e-mail e senha para abrir sua loja no PC ou celular.</p>
        </section>

        <section className="master-login-form-card master-login-single-card" aria-label="Login web e mobile">
          <div className="master-login-form-head">
            <AppIcon name="app_logo_cadeado_carrinho" size={64} alt="Smart Loja Fácil" className="master-login-brand-icon" />
            <strong>SMART LOJA <b>FÁCIL</b></strong>
            <small>{isWeb ? 'Entrar na loja' : 'Entrada local'}</small>
          </div>

          {isWeb ? (
            <WebAuthPanel compact />
          ) : (
            <form className="web-card web-auth-panel web-auth-panel-compact master-login-local-card" onSubmit={handleLocalSubmit}>
              <span className="web-kicker">Entrada local</span>
              <div className="web-auth-status-pill web-auth-status-ok">Sistema local pronto</div>
              <h2>Entrar no sistema</h2>
              <p>Use seu login da loja para abrir o painel e operar com segurança neste computador.</p>
              <label>
                <span>Login</span>
                <div className="web-input-row">
                  <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
                  <input value={localLogin} onChange={(event) => setLocalLogin(event.target.value)} placeholder="Digite seu login" autoComplete="username" />
                </div>
              </label>
              <label>
                <span>Senha</span>
                <div className="web-password-row web-input-row">
                  <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
                  <input value={localPassword} onChange={(event) => setLocalPassword(event.target.value)} type={showLocalPassword ? 'text' : 'password'} placeholder="Digite sua senha" autoComplete="current-password" />
                  <button type="button" className="secondary-btn" onClick={() => setShowLocalPassword((value) => !value)}>
                    {showLocalPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </label>
              <div className="web-auth-form-options">
                <label className="web-check-row">
                  <input type="checkbox" checked={localRemember} onChange={(event) => setLocalRemember(event.target.checked)} />
                  <span>Lembrar acesso</span>
                </label>
                <button type="button" className="web-forgot-link" onClick={() => setLocalMessage('Solicite uma nova senha ao administrador da loja.')}>
                  Esqueci minha senha
                </button>
              </div>
              {localMessage && <small className={`web-message ${localMessage.startsWith('Não') ? 'web-message-error' : 'web-message-info'}`}>{localMessage}</small>}
            </form>
          )}

          {isWeb ? (
            <button type="button" className="secondary-btn master-login-panel-link" onClick={handleEnter} disabled={props.disabled || busy || !action}>
              {busy ? 'Abrindo...' : webReady ? 'Abrir painel' : 'Continuar'}
            </button>
          ) : (
            <button type="button" className="primary-btn master-login-final-btn" onClick={handleEnter} disabled={props.disabled || busy || !action}>
              {busy ? 'Abrindo...' : 'Entrar'}
            </button>
          )}
          
        </section>
      </section>
    </main>
  );
}

export function Welcome(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export function WelcomePage(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export function WelcomeScreen(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export default Welcome;

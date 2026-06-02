import React, { useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { WebAuthPanel } from '../components/WebAuthPanel';
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
  const isWeb = runtimeInfo.isWeb;
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
      <section className="master-login-centered-shell" aria-label="Login do Smart Loja Fácil">
        <section className="master-login-form-card master-login-single-card master-login-centered-card" aria-label="Acesso web e mobile">
          <div className="master-login-form-head master-login-centered-head">
            <AppIcon name="app_logo_cadeado_carrinho" size={64} alt="Smart Loja Fácil" className="master-login-brand-icon" />
            <strong>SMART LOJA <b>FÁCIL</b></strong>
            <small>Login simples para PC e celular</small>
          </div>

          {isWeb ? (
            <WebAuthPanel compact onOpenPanel={action} />
          ) : (
            <form className="web-card web-auth-panel web-auth-panel-compact web-auth-panel-simple master-login-local-card" onSubmit={handleLocalSubmit}>
              <h2>Entrar</h2>
              <label>
                <span>Login</span>
                <div className="web-input-row">
                  <AppIcon name="usuario_administrador" size={24} className="web-input-icon" />
                  <input
                    value={localLogin}
                    onChange={(event) => setLocalLogin(event.target.value)}
                    placeholder="Digite seu login"
                    autoComplete="username"
                  />
                </div>
              </label>
              <label>
                <span>Senha</span>
                <div className="web-password-row web-input-row">
                  <AppIcon name="bloqueio_seguro" size={24} className="web-input-icon" />
                  <input
                    value={localPassword}
                    onChange={(event) => setLocalPassword(event.target.value)}
                    type={showLocalPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                  <button type="button" className="secondary-btn" onClick={() => setShowLocalPassword((value) => !value)}>
                    {showLocalPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </label>
              <div className="web-auth-form-options">
                <label className="web-check-row">
                  <input type="checkbox" checked={localRemember} onChange={(event) => setLocalRemember(event.target.checked)} />
                  <span>Salvar login</span>
                </label>
              </div>
              <button type="submit" className="primary-btn master-login-final-btn" disabled={props.disabled || busy || !action}>
                {busy ? 'Abrindo...' : 'Entrar'}
              </button>
              {localMessage ? (
                <small className={`web-message ${localMessage.startsWith('Não') ? 'web-message-error' : 'web-message-info'}`}>{localMessage}</small>
              ) : null}
            </form>
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

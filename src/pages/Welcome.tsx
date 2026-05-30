import React from 'react';
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
  const statusLabel = isWeb ? 'PWA/Web seguro' : 'Offline local';
  const heroLine = isWeb ? 'web e pronto' : 'local e pronto';
  const heroText = isWeb
    ? 'Acesse no navegador e no celular com dados sincronizados na nuvem segura.'
    : 'O Smart Loja Fácil funciona completamente sem internet. Dados seguros no computador.';
  const securityText = isWeb
    ? 'Ambiente PWA/Web com login seguro e permissões por papel.'
    : 'Ambiente local, rápido e seguro para operar mesmo sem internet.';

  const handleEnter = () => {
    if (props.disabled || busy || !action) return;
    action();
  };

  const initialLogin = isWeb ? (
    <WebAuthPanel
      compact
      onAuthenticated={handleEnter}
      loginTitle="Entrar na loja"
      loginSubtitle="E-mail e senha Supabase"
      showHelp={false}
    />
  ) : null;

  return (
    <main className={['welcome-screen login-landing classic-login-landing login-clean-v60 login-clean-v75', props.className].filter(Boolean).join(' ')}>
      <section className="login-shell-card classic-login-card" aria-label="Entrada do Smart Loja Fácil">
        <header className="login-topbar classic-login-topbar">
          <div className="login-brand classic-login-brand">
            <span className="login-brand-mark classic-login-brand-mark" aria-hidden="true">
              <span className="login-brand-mark-inner">
                <img src="/brand/smart-loja-icon.png" alt="" className="login-brand-icon" />
              </span>
            </span>
            <div>
              <strong>Smart Loja Fácil</strong>
              <small>Sistema web para vender, cadastrar e sincronizar.</small>
            </div>
          </div>

          {!isWeb && (
            <button type="button" className="login-top-enter classic-menu-button" onClick={handleEnter} disabled={props.disabled || busy || !action}>
              {busy ? 'Abrindo...' : 'Entrar'}
            </button>
          )}
        </header>

        <div className="classic-login-status-strip">
          <span className="classic-status-badge classic-status-badge-ok">✓</span>
          <strong>{statusLabel}</strong>
          <span>•</span>
          <small>{securityText}</small>
        </div>

        <div className="login-main-grid classic-login-main-grid">
          <section className="login-hero-copy classic-login-hero-copy">
            <span className="login-status-pill classic-login-status-pill">
              <span className="login-status-dot" />
              {statusLabel}
            </span>

            <h2 className="login-mobile-title">Smart Loja Fácil</h2>

            <h1>
              Sistema rápido,
              <span> {heroLine}</span>
              para abrir.
            </h1>

            <p>{heroText}</p>

            {!isWeb && (
              <button type="button" className="login-main-enter classic-primary-enter" onClick={handleEnter} disabled={props.disabled || busy || !action}>
                <span>{busy ? 'Abrindo painel...' : 'Entrar no sistema'}</span>
                <strong aria-hidden="true">→</strong>
              </button>
            )}

            <div className="login-security-note classic-login-security-note login-security-note-v75">
              <span aria-hidden="true">☑</span>
              <small>{isWeb ? 'Login direto nesta tela. Depois de entrar, clientes, produtos, vendas e crediário sincronizam com Supabase.' : securityText}</small>
            </div>
          </section>

          <section className="login-visual-stage classic-login-visual-stage login-initial-auth-stage-v75" aria-label={isWeb ? 'Login Supabase inicial' : 'Resumo da entrada'}>
            {initialLogin ?? (
              <>
                <div className="login-clean-proof-v60">
                  <span>✓</span>
                  <strong>Pronto para loja local</strong>
                  <small>Dados locais seguros e operação offline.</small>
                </div>
                <div className="login-clean-proof-list-v60">
                  <span>Offline</span>
                  <span>Rápido</span>
                  <span>Seguro</span>
                </div>
              </>
            )}
          </section>
        </div>
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

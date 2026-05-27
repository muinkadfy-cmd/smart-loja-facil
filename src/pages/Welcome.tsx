import React from 'react';
import { AppIcon } from '../components/AppIcon';
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
    : 'Ambiente 100% local. Seus dados não saem do seu computador.';

  const handleEnter = () => {
    if (props.disabled || busy || !action) return;
    action();
  };

  return (
    <main className={['welcome-screen login-landing', props.className].filter(Boolean).join(' ')}>
      <section className="login-shell-card" aria-label="Entrada do Smart Loja Fácil">
        <header className="login-topbar">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">
              <span className="login-brand-mark-inner">
                <AppIcon name="app_logo_cadeado_carrinho" size={32} className="login-brand-icon" />
              </span>
            </span>
            <div>
              <strong>Smart Loja Fácil</strong>
              <small>Seu negócio, sempre pronto.</small>
            </div>
          </div>

          <nav className="login-nav" aria-label="Links informativos">
            <button type="button">Recursos</button>
            <button type="button">Segurança</button>
            <button type="button">Sobre</button>
            <button type="button">Suporte</button>
          </nav>

          <button type="button" className="login-top-enter" onClick={handleEnter} disabled={props.disabled || busy || !action}>
            {busy ? 'Abrindo...' : 'Entrar'}
          </button>
        </header>

        <div className="login-main-grid">
          <section className="login-hero-copy">
            <span className="login-status-pill">
              <span className="login-status-dot" />
              {statusLabel}
            </span>

            <h2 className="login-mobile-title">Smart Loja Fácil</h2>

            <h1>
              Sistema rápido,
              <span> {heroLine}</span>
              para abrir.
            </h1>

            <p>
              {heroText}
            </p>

            <button type="button" className="login-main-enter" onClick={handleEnter} disabled={props.disabled || busy || !action}>
              <span>{busy ? 'Abrindo painel...' : 'Entrar'}</span>
              <strong aria-hidden="true">→</strong>
            </button>

            <div className="login-security-note">
              <span aria-hidden="true">▣</span>
              <small>{securityText}</small>
            </div>
          </section>

          <section className="login-visual-stage" aria-label="Ilustracao do sistema no caixa">
            <div className="login-orbit" aria-hidden="true" />
            <div className="login-dots" aria-hidden="true" />
            <div className="login-pos-base" aria-hidden="true">
              <div className="login-printer">
                <span />
                <small />
              </div>
              <div className="login-monitor">
                <div className="login-monitor-bar">
                  <span />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="login-monitor-body">
                  <aside>
                    <b />
                    <b />
                    <b />
                    <b />
                  </aside>
                  <main>
                    <div className="login-mini-title" />
                    <div className="login-mini-cards">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="login-chart">
                      <em />
                      <em />
                      <em />
                      <em />
                      <em />
                      <em />
                    </div>
                  </main>
                </div>
              </div>
              <div className="login-keyboard" />
              <div className="login-scanner" />
            </div>
          </section>
        </div>

        <section className="login-feature-strip" aria-label="Destaques">
          <article>
            <span className="login-feature-icon login-feature-wifi" aria-hidden="true">⌁</span>
            <div>
              <strong>Sem internet</strong>
              <p>Funciona totalmente offline.</p>
            </div>
          </article>
          <article>
            <span className="login-feature-icon login-feature-db" aria-hidden="true">▣</span>
            <div>
              <strong>SQLite local</strong>
              <p>Dados seguros no computador.</p>
            </div>
          </article>
          <article>
            <span className="login-feature-icon login-feature-rocket" aria-hidden="true">↗</span>
            <div>
              <strong>Leve e direto</strong>
              <p>Interface simples para o dia a dia.</p>
            </div>
          </article>
        </section>

        <div className="login-mobile-cta-block">
          <button type="button" className="login-main-enter login-mobile-enter" onClick={handleEnter} disabled={props.disabled || busy || !action}>
            <span>{busy ? 'Abrindo painel...' : 'Entrar'}</span>
            <strong aria-hidden="true">→</strong>
          </button>
          <div className="login-security-note login-mobile-security">
            <span aria-hidden="true">▣</span>
            <small>{securityText}</small>
          </div>
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

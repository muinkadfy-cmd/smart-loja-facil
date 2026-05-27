import React, { useEffect, useMemo, useState } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';
import { getWebRoleCapabilities, getWebStoreContext, WEB_APP_VERSION, webRoleLabel, type WebStoreRole } from '../lib/webApi';

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
  }, [env.isConfigured, runtime.isTauri]);

  const capabilities = getWebRoleCapabilities(context.role);
  const onlineLabel = typeof navigator === 'undefined' || navigator.onLine ? 'Online' : 'Sem internet';
  const swLabel = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker.controller ? 'Controlando cache' : 'Registrável'
    : 'Indisponível';

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
    `Rede: ${onlineLabel}`,
    `Service worker: ${swLabel}`,
  ].join('\n');

  async function copyDiagnostic(): Promise<void> {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopyMessage('Diagnóstico copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar automaticamente. Selecione os dados na tela.');
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
      label: 'URL Supabase',
      value: env.hasSupabaseUrl ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseUrl ? 'ok' : 'warn',
      detail: env.hasSupabaseUrl ? 'Variável pública encontrada.' : 'Adicione VITE_SUPABASE_URL no Cloudflare.',
    },
    {
      label: 'Anon Key',
      value: env.hasSupabaseAnonKey ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseAnonKey ? 'ok' : 'warn',
      detail: env.hasSupabaseAnonKey ? 'Chave pública carregada.' : 'Adicione VITE_SUPABASE_ANON_KEY no Cloudflare.',
    },
    {
      label: 'Versão/cache',
      value: WEB_APP_VERSION,
      tone: 'ok',
      detail: 'Service Worker versionado e aviso de nova versão ativo.',
    },
  ];

  return (
    <div className="stack web-stack">
      <section className="web-hero-card">
        <span className="web-kicker">Diagnóstico de produção</span>
        <h1>PWA web/mobile com Supabase como foco principal</h1>
        <p>Esta tela valida login, loja ativa, papel do usuário, cache e conexão. Os detalhes técnicos ficam aqui para o dashboard continuar limpo para usuário leigo.</p>
        <div className="web-diagnostics-actions">
          <button type="button" className="primary-btn" onClick={copyDiagnostic}>Copiar diagnóstico</button>
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
        <h2>Instalação PWA, cache novo e área segura</h2>
        <p>O app agora tem manifest melhorado, ícones PNG/maskable, service worker com cache versionado e aviso de atualização para evitar arquivo antigo no celular.</p>
        <div className="mobile-readiness-grid">
          <span>Ícones 192/512</span>
          <span>Cache versionado</span>
          <span>Aviso de nova versão</span>
          <span>Safe-area mobile</span>
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
            <li>Clientes, produtos e configurações já passam pela camada web.</li>
            <li>Vendas, caixa e crediário continuam bloqueados até migração transacional.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

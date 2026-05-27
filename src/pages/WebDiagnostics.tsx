import React, { useEffect, useMemo, useState } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';
import { getWebStoreContext, WEB_APP_VERSION, type WebStoreRole } from '../lib/webApi';

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

function roleLabel(role: WebContextState['role']): string {
  const labels: Record<WebContextState['role'], string> = {
    owner: 'Dono',
    admin: 'Administrador',
    operator: 'Operador',
    viewer: 'Leitor',
    'sem login': 'Sem login',
  };
  return labels[role];
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
          detail: `Loja ${payload.store.id.slice(0, 8)} com papel ${roleLabel(payload.role).toLowerCase()}.`,
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
      label: 'Usuario e papel',
      value: `${roleLabel(context.role)} · ${context.email}`,
      tone: context.role === 'sem login' ? 'warn' : 'ok',
      detail: 'Permissões devem ser reforçadas pela RLS do Supabase.',
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

      <div className="web-two-col">
        <WebAuthPanel />
        <section className="web-card">
          <span className="web-kicker">Segurança</span>
          <h2>Regras de produção</h2>
          <ul className="web-check-list">
            <li>Frontend usa somente URL e anon key públicas.</li>
            <li>Service role e VAPID private key ficam fora do app.</li>
            <li>Loja ativa e papel do usuário sao lidos pelo Supabase.</li>
            <li>Clientes, produtos e configurações já passam pela camada web.</li>
            <li>Vendas, caixa e crediário continuam bloqueados até migração transacional.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

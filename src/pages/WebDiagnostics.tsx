import React, { useMemo } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';

interface HealthItem {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'info';
  detail: string;
}

export function WebDiagnosticsPage(): JSX.Element {
  const runtime = useMemo(() => getRuntimeInfo(), []);
  const env = useMemo(() => getPublicWebEnv(), []);
  const items: HealthItem[] = [
    {
      label: 'Ambiente',
      value: runtime.platformLabel,
      tone: runtime.isWeb ? 'ok' : 'info',
      detail: runtime.isWeb ? 'Rodando no navegador com camada web protegida.' : 'Rodando no app desktop com SQLite local.',
    },
    {
      label: 'Banco atual',
      value: runtime.storageLabel,
      tone: runtime.isTauri ? 'ok' : env.isConfigured ? 'ok' : 'warn',
      detail: runtime.isTauri ? 'Fluxos comerciais continuam no SQLite local.' : 'Para operar no celular, os modulos precisam ser migrados por etapas.',
    },
    {
      label: 'URL Supabase',
      value: env.hasSupabaseUrl ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseUrl ? 'ok' : 'warn',
      detail: env.hasSupabaseUrl ? 'Variavel publica encontrada.' : 'Adicione VITE_SUPABASE_URL no Cloudflare.',
    },
    {
      label: 'Anon Key',
      value: env.hasSupabaseAnonKey ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseAnonKey ? 'ok' : 'warn',
      detail: env.hasSupabaseAnonKey ? 'Chave publica carregada.' : 'Adicione VITE_SUPABASE_ANON_KEY no Cloudflare.',
    },
  ];

  return (
    <div className="stack web-stack">
      <section className="web-hero-card">
        <span className="web-kicker">Diagnostico de producao</span>
        <h1>Web/PWA preparado sem quebrar o PC</h1>
        <p>Esta tela verifica Cloudflare, variaveis publicas e login. Ela evita tela branca e separa com seguranca o futuro modo web do modo Tauri/SQLite.</p>
      </section>

      <section className="web-health-grid">
        {items.map((item) => (
          <article key={item.label} className={`web-health-card web-health-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="mobile-readiness-card">
        <span className="web-kicker">Prioridade mobile</span>
        <h2>Celular sem tela espremida</h2>
        <p>O shell foi ajustado para leitura em Android/iPhone, com menu rapido inferior, cards compactos, tabelas com rolagem segura e botoes tocaveis.</p>
        <div className="mobile-readiness-grid">
          <span>Menu inferior rolavel</span>
          <span>Toque minimo seguro</span>
          <span>Cards sem corte</span>
          <span>Tabelas sem estourar</span>
        </div>
      </section>

      <div className="web-two-col">
        <WebAuthPanel />
        <section className="web-card">
          <span className="web-kicker">Seguranca</span>
          <h2>Regras deste lote</h2>
          <ul className="web-check-list">
            <li>Desktop continua usando SQLite local.</li>
            <li>Navegador nao chama Tauri sem checar ambiente.</li>
            <li>Frontend usa somente URL e anon key publicas.</li>
            <li>Service role fica fora do GitHub e fora do Cloudflare Pages/Worker.</li>
            <li>Modulos ainda nao migrados mostram aviso seguro.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

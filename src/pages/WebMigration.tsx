import React from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import type { PageKey } from '../types';

const pageNames: Record<PageKey, string> = {
  dashboard: 'Painel da Loja',
  customers: 'Clientes',
  products: 'Produtos',
  sales: 'Vendas / PDV',
  cash: 'Caixa',
  credits: 'Crediário',
  orders: 'Pedidos',
  receipts: 'Comprovantes',
  reports: 'Relatórios',
  backup: 'Backup',
  settings: 'Configurações',
  audit: 'Auditoria / Logs',
  diagnostics: 'Diagnóstico Web',
};

const migrationOrder: Array<{ title: string; detail: string; status: 'done' | 'active' | 'next' }> = [
  { title: 'Runtime separado', detail: 'Web não tenta abrir SQLite/Tauri direto.', status: 'done' },
  { title: 'Login, loja e papel', detail: 'Supabase Auth, loja ativa e papel carregados no navegador.', status: 'done' },
  { title: 'Clientes, Produtos e Configurações', detail: 'Primeiros módulos ligados à camada Supabase web.', status: 'done' },
  { title: 'Vendas, Caixa e Crediário', detail: 'Entram depois com transações e proteção contra duplicidade.', status: 'active' },
];

interface WebMigrationPageProps {
  activePage: PageKey;
  onOpenDiagnostics: () => void;
}

export function WebMigrationPage({ activePage, onOpenDiagnostics }: WebMigrationPageProps): JSX.Element {
  const moduleName = pageNames[activePage] ?? 'Modulo';

  return (
    <div className="stack web-stack">
      <section className="web-hero-card web-hero-card-warning">
        <span className="web-kicker">Módulo em migração</span>
        <h1>{moduleName} ainda aguarda migração segura</h1>
        <p>No PWA, este modulo fica bloqueado ate entrar no Supabase com transacao, permissao e protecao contra duplicidade. Clientes, Produtos e Configurações ja foram liberados para a camada web.</p>
        <div className="web-hero-actions">
          <button type="button" className="primary-btn" onClick={onOpenDiagnostics}>Abrir diagnóstico web</button>
          <span className="status-chip">PWA protegido</span>
          <span className="status-chip">Supabase por etapas</span>
        </div>
      </section>

      <div className="web-two-col">
        <section className="web-card">
          <span className="web-kicker">Ordem correta</span>
          <h2>Plano de migração sem perda de dados</h2>
          <div className="web-timeline">
            {migrationOrder.map((item) => (
              <article key={item.title} className={`web-timeline-item web-timeline-${item.status}`}>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="web-card mobile-safe-card">
          <span className="web-kicker">Uso no celular</span>
          <h2>Fluxo seguro por etapas</h2>
          <p>Enquanto este módulo não estiver no Supabase, o app mostra este bloqueio no mobile para evitar tela branca, dado falso, venda duplicada ou salvamento inseguro.</p>
          <button type="button" className="secondary-btn" onClick={onOpenDiagnostics}>Ver status web</button>
        </section>
        <WebAuthPanel compact />
      </div>
    </div>
  );
}

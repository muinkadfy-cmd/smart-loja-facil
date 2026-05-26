import React from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import type { PageKey } from '../types';

const pageNames: Record<PageKey, string> = {
  dashboard: 'Painel da Loja',
  customers: 'Clientes',
  products: 'Produtos',
  sales: 'Vendas / PDV',
  cash: 'Caixa',
  credits: 'Crediario',
  orders: 'Pedidos',
  receipts: 'Comprovantes',
  reports: 'Relatorios',
  backup: 'Backup',
  settings: 'Configuracoes',
  audit: 'Auditoria / Logs',
  diagnostics: 'Diagnostico Web',
};

const migrationOrder: Array<{ title: string; detail: string; status: 'done' | 'active' | 'next' }> = [
  { title: 'Runtime separado', detail: 'Web nao tenta abrir SQLite/Tauri direto.', status: 'done' },
  { title: 'Login web', detail: 'Supabase Auth preparado com anon key publica.', status: 'active' },
  { title: 'Clientes e Produtos', detail: 'Primeiros modulos a receber CRUD cloud com RLS.', status: 'next' },
  { title: 'Vendas, Caixa e Crediario', detail: 'Entram depois com transacoes e protecao contra duplicidade.', status: 'next' },
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
        <span className="web-kicker">Modulo em migracao</span>
        <h1>{moduleName} ainda usa SQLite no PC</h1>
        <p>No Cloudflare, este modulo foi bloqueado de forma segura para nao salvar dados em cache ou mostrar informacao falsa. No aplicativo Tauri, ele continua funcionando com o banco local.</p>
        <div className="web-hero-actions">
          <button type="button" className="primary-btn" onClick={onOpenDiagnostics}>Abrir diagnostico web</button>
          <span className="status-chip">PC/Tauri preservado</span>
          <span className="status-chip">Cloud em preparacao</span>
        </div>
      </section>

      <div className="web-two-col">
        <section className="web-card">
          <span className="web-kicker">Ordem correta</span>
          <h2>Plano de migracao sem perda de dados</h2>
          <div className="web-timeline">
            {migrationOrder.map((item) => (
              <article key={item.title} className={`web-timeline-item web-timeline-${item.status}`}>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </section>
        <WebAuthPanel compact />
      </div>
    </div>
  );
}

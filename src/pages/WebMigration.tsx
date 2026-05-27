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
  { title: 'Permissões web no frontend', detail: 'Viewer bloqueado para escrita e configurações protegidas por papel.', status: 'done' },
  { title: 'Vendas, Caixa e Crediário', detail: 'Entram depois com transações e proteção contra duplicidade.', status: 'active' },
];


const moduleRequirements: Partial<Record<PageKey, Array<{ title: string; detail: string }>>> = {
  sales: [
    { title: 'Transação única', detail: 'Venda, itens, baixa de estoque, caixa, recibo e crediário precisam gravar juntos.' },
    { title: 'Idempotência', detail: 'client_request_id evita venda duplicada se o celular reenviar a mesma operação.' },
    { title: 'Permissão', detail: 'Leitor não vende; operador vende sem controlar dono/admin.' },
  ],
  cash: [
    { title: 'Caixa por sessão', detail: 'Abertura, movimentos e fechamento precisam respeitar a loja ativa.' },
    { title: 'Conferência', detail: 'Diferença de caixa deve ser clara e auditável antes de fechar.' },
    { title: 'Histórico seguro', detail: 'Movimentos não podem sumir nem duplicar ao perder internet.' },
  ],
  credits: [
    { title: 'Parcelas consistentes', detail: 'Pagamento parcial/total precisa atualizar saldo, parcela, caixa e auditoria.' },
    { title: 'Sem sobrescrever', detail: 'Recebimento feito em outro aparelho não pode ser perdido.' },
    { title: 'Comprovante', detail: 'Recibo de crediário precisa ser gerado no mesmo fluxo seguro.' },
  ],
  orders: [
    { title: 'Pedido web', detail: 'Criar, separar, entregar e cancelar com status igual no celular e PC.' },
    { title: 'Estoque', detail: 'Reservar ou baixar estoque precisa seguir regra comercial definida.' },
    { title: 'Auditoria', detail: 'Toda mudança de status precisa registrar usuário, data e motivo.' },
  ],
  receipts: [
    { title: 'Leitura segura', detail: 'Comprovantes podem entrar primeiro como consulta web.' },
    { title: 'Impressão PWA', detail: 'Mobile precisa usar visual limpo e fallback de compartilhamento.' },
    { title: 'Dados sensíveis', detail: 'Nunca exibir segredo, token ou dado privado em recibo público.' },
  ],
  reports: [
    { title: 'Relatórios filtrados', detail: 'Toda consulta precisa respeitar store_id e período.' },
    { title: 'Mobile', detail: 'Tabelas devem virar cards no celular, sem quebrar largura.' },
    { title: 'Exportação', detail: 'CSV/PDF web precisa funcionar sem depender de arquivo local do PC.' },
  ],
  backup: [
    { title: 'Backup web diferente', detail: 'No PWA não existe pasta local do Windows; precisa exportar dados da loja.' },
    { title: 'Segurança', detail: 'Exportação deve bloquear leitor e proteger dados de cliente.' },
    { title: 'Restauração', detail: 'Restore em nuvem precisa validação forte para não sobrescrever loja ativa.' },
  ],
};

function moduleHint(page: PageKey): Array<{ title: string; detail: string }> {
  return moduleRequirements[page] ?? [
    { title: 'Conexão Supabase', detail: 'Liberar somente quando leitura, escrita, RLS e fallback estiverem seguros.' },
    { title: 'Mobile-first', detail: 'A tela precisa caber no celular antes de ser liberada no desktop.' },
    { title: 'Sem dado falso', detail: 'Enquanto não migrar, o app bloqueia a operação real para evitar erro comercial.' },
  ];
}

interface WebMigrationPageProps {
  activePage: PageKey;
  onOpenDiagnostics: () => void;
}

export function WebMigrationPage({ activePage, onOpenDiagnostics }: WebMigrationPageProps): JSX.Element {
  const moduleName = pageNames[activePage] ?? 'Módulo';
  const hints = moduleHint(activePage);

  return (
    <div className="stack web-stack">
      <section className="web-hero-card web-hero-card-warning">
        <span className="web-kicker">Módulo em migração</span>
        <h1>{moduleName} ainda aguarda migração segura</h1>
        <p>No PWA, este módulo fica bloqueado até entrar no Supabase com transação, permissão e proteção contra duplicidade. Clientes, Produtos e Configurações já foram liberados para a camada web com proteção por papel.</p>
        <div className="web-hero-actions">
          <button type="button" className="primary-btn" onClick={onOpenDiagnostics}>Abrir diagnóstico web</button>
          <span className="status-chip">PWA protegido</span>
          <span className="status-chip">Supabase por etapas</span>
        </div>
        <div className="web-module-grid" aria-label="Requisitos para liberar este módulo">
          {hints.map((item) => (
            <article key={item.title} className="web-module-card">
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
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

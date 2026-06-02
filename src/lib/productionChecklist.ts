export type ProductionCheckTone = 'supabase' | 'mobile' | 'cache' | 'security';

export interface ProductionCheckItem {
  id: string;
  group: string;
  title: string;
  detail: string;
  expected: string;
  tone: ProductionCheckTone;
}

export interface ProductionCheckState {
  doneIds: string[];
  updatedAt: string;
}

export interface ProductionCheckSummary {
  total: number;
  done: number;
  pending: number;
  percent: number;
}

const CHECKLIST_KEY = 'smart-loja:lote97-production-checklist';
const LEGACY_CHECKLIST_KEYS = ['smart-loja:lote96-production-checklist', 'smart-loja:lote95-production-checklist', 'smart-loja:lote94-production-checklist', 'smart-loja:lote93-production-checklist', 'smart-loja:lote92-production-checklist', 'smart-loja:lote91-production-checklist', 'smart-loja:lote90-production-checklist', 'smart-loja:lote89-production-checklist', 'smart-loja:lote88-production-checklist', 'smart-loja:lote87-production-checklist', 'smart-loja:lote86-production-checklist', 'smart-loja:lote85-production-checklist', 'smart-loja:lote84-production-checklist', 'smart-loja:lote83-production-checklist', 'smart-loja:lote82-production-checklist', 'smart-loja:lote81-production-checklist', 'smart-loja:lote80-production-checklist', 'smart-loja:lote79-production-checklist', 'smart-loja:lote78-production-checklist', 'smart-loja:lote77-production-checklist', 'smart-loja:lote76-production-checklist', 'smart-loja:lote75-production-checklist'];

export const PRODUCTION_CHECKLIST: ProductionCheckItem[] = [
  {
    id: 'commercial-clean-package-v97',
    group: 'Release comercial',
    title: 'Pacote comercial limpo sem banco de teste',
    detail: 'Rodar release:commercial:check e release:commercial:prepare antes de enviar para cliente depois da atualização v97.',
    expected: 'Nenhum .sqlite3/.db/.env real no pacote final; manifest de release gerado e conferido.',
    tone: 'security',
  },
  {
    id: 'supabase-real-multi-device-v97',
    group: 'Supabase produção',
    title: 'Supabase real validado em dois aparelhos',
    detail: 'Testar owner/admin/operator/viewer, duas lojas, produto com foto, cliente, venda, caixa, crediário e atualização automática em PC e celular.',
    expected: 'Dados aparecem nos dois aparelhos sem precisar fechar o app, RLS bloqueia acesso cruzado e Storage product-photos carrega fotos corretamente.',
    tone: 'supabase',
  },

  {
    id: 'css-consolidation-v95',
    group: 'Release técnico',
    title: 'CSS legado consolidado sem quebra visual',
    detail: 'Rodar css_audit, conferir Dashboard, PDV, Produtos, Clientes, Caixa, Crediário, Relatórios, Backup e Configurações depois do Lote 95.',
    expected: 'Menos !important em styles.css/master-ui.css, módulo v95 ativo no diagnóstico e telas críticas preservadas.',
    tone: 'mobile',
  },
  {
    id: 'release-cleanup-v94',
    group: 'Release comercial',
    title: 'Pacote comercial limpo e auditoria técnica v94',
    detail: 'Rodar release_check, css_audit e commercial_package_check antes de gerar pacote para cliente.',
    expected: 'README atualizado, release_check sem duplicidades, auditoria CSS medindo todos os módulos e nenhum SQLite/.env real no ZIP final.',
    tone: 'security',
  },

  {
    id: 'backup-settings-premium-v93-fit',
    group: 'Backup e Configurações',
    title: 'Backup e Configurações com fluxo leigo e seguro',
    detail: 'Testar baixar backup, importar JSON, bloqueio de restauração por perfil, editar loja, estoque baixo e mensagem do comprovante.',
    expected: 'Alertas claros, confirmação dupla, botões com bom toque, cards legíveis, formulário sem corte lateral e somente leitura bem explicado.',
    tone: 'security',
  },
  {
    id: 'reports-premium-v92-fit',
    group: 'Relatórios',
    title: 'Relatórios com filtros, métricas e exportação claros',
    detail: 'Abrir Relatórios, testar Vendas, Caixa, Crediário, Estoque baixo, presets de data, tabela vazia e exportação CSV.',
    expected: 'Filtro legível, métricas com hierarquia, loading claro, CSV seguro, tabela sem corte lateral e leitura boa no celular.',
    tone: 'mobile',
  },
  {
    id: 'credits-premium-v91-fit',
    group: 'Crediário',
    title: 'Crediário mostra valor, pago, restante e vencidos com clareza',
    detail: 'Abrir Crediário, filtrar cliente, conferir parcelas, receber parcial/total, gerar PDF e testar WhatsApp.',
    expected: 'Cards, tabela e mobile mostram valor original, pago, restante, vencimento, status e ações sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'cash-premium-v90-fit',
    group: 'Caixa',
    title: 'Caixa validado no web e no mobile',
    detail: 'Abrir caixa, lançar entrada/saída, conferir diferença, fechar caixa e revisar movimentos no celular e desktop.',
    expected: 'Resumo claro, alertas legíveis, botões seguros, movimentos filtráveis, diferença destacada e sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'customers-premium-v89-fit',
    group: 'Clientes',
    title: 'Clientes cabe bem no web e no mobile',
    detail: 'Abrir Clientes, cadastrar, editar, buscar, filtrar, testar somente leitura e lista mobile.',
    expected: 'Cadastro com respiro, contatos legíveis, limite claro, filtros bons, tabela vazia comercial e sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'product-photos-storage-v88',
    group: 'Fotos e Storage',
    title: 'Foto de produto sobe para Supabase Storage',
    detail: 'Cadastrar ou editar produto com foto PNG/JPG/WEBP até 2 MB em aparelho web/mobile com Supabase configurado.',
    expected: 'Produto salva, foto aparece como URL da nuvem, outro aparelho carrega a mesma foto e o diagnóstico não mostra fallback base64.',
    tone: 'supabase',
  },
  {
    id: 'products-premium-v87-fit',
    group: 'Produtos',
    title: 'Produtos com tabela, filtros, cadastro e estoque premium',
    detail: 'Abrir Produtos, testar busca, filtros, lista vazia, cadastro/edição, foto, ações laterais e ajuste de estoque.',
    expected: 'KPIs legíveis, tabela sem visual cru, ações alinhadas, formulário com respiro, foto clara, ajuste de estoque sem corte e mobile funcionando.',
    tone: 'mobile',
  },
  {
    id: 'orders-premium-v86-fit',
    group: 'Pedidos',
    title: 'Pedidos cabe bem no web e no mobile',
    detail: 'Abrir Pedidos, montar pedido, testar somente leitura, busca, filtros, tabela vazia e lista mobile.',
    expected: 'Formulário com respiro, total claro, botões consistentes, filtros legíveis, tabela vazia comercial e sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'sales-pdv-premium-v85-fit',
    group: 'Vendas / PDV',
    title: 'PDV cabe no web e no mobile sem parecer tabela crua',
    detail: 'Abrir Vendas/PDV, testar adicionar produto, cliente, pagamentos, resumo, somente leitura e últimas vendas.',
    expected: 'Formulários com respiro, tabela vazia clara, pagamento legível, resumo destacado, botões com bom toque e sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'dashboard-mobile-v84-fit',
    group: 'Dashboard mobile',
    title: 'Dashboard no celular sem quebra de layout',
    detail: 'Abrir o painel inicial no celular e conferir hero, ações principais, indicadores, operação rápida, mensagens e atividade recente.',
    expected: 'Hero empilhado, botões sem texto vertical, cards alinhados, atalhos com toque bom e conteúdo sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'dashboard-premium-v83-fit',
    group: 'Dashboard e hierarquia',
    title: 'Dashboard cabe bem e mantém hierarquia no web e no mobile',
    detail: 'Abrir o painel inicial em desktop, notebook baixo e celular e conferir hero, status, KPIs, atalhos, mensagens e atividade recente.',
    expected: 'Topo sem poluição, cards com respiro, leitura clara, ações rápidas com bom toque e estado vazio sem corte lateral.',
    tone: 'mobile',
  },
  {
    id: 'login-premium-v82-fit',
    group: 'Login e primeira impressão',
    title: 'Login cabe inteiro no desktop e no celular',
    detail: 'Abrir a tela inicial em web desktop, notebook baixo e celular pequeno, com Supabase configurado e sem configurar.',
    expected: 'Logo, título, campos, botão principal, aviso da nuvem, botão sem nuvem e nota final aparecem sem corte, sem rolagem ruim e com hierarquia clara.',
    tone: 'mobile',
  },
  {
    id: 'owner-create-product',
    group: 'RLS e papéis',
    title: 'Owner cria produto no aparelho 1',
    detail: 'Entrar como dono, cadastrar um produto simples e confirmar que aparece na lista sem erro.',
    expected: 'Produto salvo na nuvem e visível depois de atualizar a página.',
    tone: 'supabase',
  },
  {
    id: 'operator-create-sale',
    group: 'RLS e papéis',
    title: 'Operador faz venda sem acessar configurações',
    detail: 'Entrar com usuário operador, criar venda pequena e tentar abrir/alterar configurações críticas.',
    expected: 'Venda liberada; configurações/usuários bloqueados visualmente e pela nuvem.',
    tone: 'security',
  },
  {
    id: 'viewer-readonly',
    group: 'RLS e papéis',
    title: 'Leitor consulta, mas não altera',
    detail: 'Entrar como leitor e tentar salvar cliente, produto, pedido, caixa e crediário.',
    expected: 'O app mostra bloqueio claro antes de salvar; Supabase também nega tentativa indevida.',
    tone: 'security',
  },
  {
    id: 'two-devices-sync',
    group: 'Multiaparelho',
    title: 'Dois aparelhos veem a mesma loja',
    detail: 'Abrir PC e celular na mesma loja, criar cliente em um e voltar para o outro app.',
    expected: 'A atualização automática recebe mudanças pela nuvem; ao focar/atualizar, os dois mostram o mesmo cliente, produto, venda e saldo.',
    tone: 'supabase',
  },
  {
    id: 'offline-pending-retry',
    group: 'Offline controlado',
    title: 'Pendência local reenvia ao voltar internet',
    detail: 'No celular, desligar internet, tentar salvar alteração segura, religar internet e tocar em reenviar.',
    expected: 'A alteração fica pendente, reenvia sem duplicar e o diagnóstico fica sem pendências.',
    tone: 'mobile',
  },
  {
    id: 'no-duplicate-sale',
    group: 'Dados críticos',
    title: 'Venda não duplica com internet instável',
    detail: 'Finalizar uma venda, simular oscilação e conferir lista de vendas/caixa/estoque.',
    expected: 'A venda, movimento de caixa e baixa de estoque aparecem uma única vez.',
    tone: 'supabase',
  },
  {
    id: 'cloudflare-cache-update',
    group: 'Cloudflare e PWA',
    title: 'Celular recebe a versão nova',
    detail: 'Depois do deploy, abrir o PWA já instalado, conferir aviso de atualização e versão no diagnóstico.',
    expected: 'Versão pwa-supabase-v97, cache v97, família neo v79, shell/sidebar v80, redução !important v81, login premium v82, dashboard premium v83, refinamento mobile v84, PDV premium v85, Pedidos premium v86 e Produtos premium v87, Fotos Storage v88, Clientes premium v89, Caixa premium v90, Crediário premium v91 e Relatórios premium v92 e Backup/Configurações premium v93 e release técnico v95 e consolidação CSS v95 e validação comercial v96 e sync multiaparelhos v97 aparecem corretamente.',
    tone: 'cache',
  },
  {
    id: 'rls-sql-policies-real',
    group: 'RLS real',
    title: 'Policies aplicadas no Supabase real',
    detail: 'Conferir no painel Supabase se stores, store_members, products, customers, sales, caixa, crediário e pedidos têm RLS ligada e policies por loja.',
    expected: 'Usuário de uma loja não enxerga nem altera dados de outra loja.',
    tone: 'security',
  },
  {
    id: 'design-system-mobile-tokens',
    group: 'Design system',
    title: 'Design/mobile sem regressão visual',
    detail: 'Abrir Diagnóstico Web e conferir o bloco Design system e tela atual em celular pequeno, tablet e web.',
    expected: 'Tokens, toque, safe-area e renderização aparecem sem alerta crítico.',
    tone: 'mobile',
  },
  {
    id: 'tauri-print-check',
    group: 'Tauri e impressão',
    title: 'Comprovante Tauri validado depois do logo externo',
    detail: 'Rodar cargo check/tauri dev e imprimir ou pré-visualizar comprovante após mover o logo base64 para asset.',
    expected: 'Aplicativo desktop abre e comprovante mantém logo, valores e layout corretos.',
    tone: 'cache',
  },
  {
    id: 'mobile-small-screen',
    group: 'Mobile real',
    title: 'Celular pequeno sem corte lateral',
    detail: 'Testar Dashboard, Produtos, Vendas, Crediário, Caixa e Backup em tela estreita.',
    expected: 'Sem texto letra por letra, sem botão coberto pelo menu e sem tabela estourada.',
    tone: 'mobile',
  },
  {
    id: 'neo-family-critical-shell',
    group: 'CSS e telas',
    title: 'Família neo-* validada sem corte',
    detail: 'Abrir Dashboard, Produtos, Vendas e Crediário e conferir shell, topbar, sidebar, action ribbon e dock mobile.',
    expected: 'Diagnóstico mostra família neo v79, shell/sidebar v80, redução !important v81, dashboard premium v83 e refinamento mobile v84 ativos, sem corte lateral e com toque confortável no menu/dock.',
    tone: 'mobile',
  },
  {
    id: 'css-module-visual-audit',
    group: 'CSS e telas',
    title: 'CSS modular e checklist visual por tela validados',
    detail: 'Abrir o Diagnóstico Web depois do deploy e conferir o bloco Inventário CSS + Checklist visual por módulo.',
    expected: 'CSS modular v77 + limpeza v78 + família neo v79 + shell/sidebar v80 + redução !important v81 + login premium v82 + dashboard premium v83 + refinamento mobile v84 + PDV premium v85 + Pedidos premium v86 + Produtos premium v87 + Fotos Storage v88 + Clientes premium v89 + Caixa premium v90 + Crediário premium v91 + Relatórios premium v92 ativos e telas críticas marcadas só depois de conferência real.',
    tone: 'mobile',
  },
];

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeState(value: unknown): ProductionCheckState {
  const source = value && typeof value === 'object' ? value as Partial<ProductionCheckState> : {};
  const allowedIds = new Set(PRODUCTION_CHECKLIST.map((item) => item.id));
  const doneIds = Array.isArray(source.doneIds)
    ? source.doneIds.filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    : [];
  return {
    doneIds: Array.from(new Set(doneIds)),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

export function readProductionCheckState(): ProductionCheckState {
  if (!canUseStorage()) return { doneIds: [], updatedAt: '' };
  try {
    const current = normalizeState(JSON.parse(window.localStorage.getItem(CHECKLIST_KEY) || '{}'));
    if (current.doneIds.length > 0 || current.updatedAt) return current;
    for (const key of LEGACY_CHECKLIST_KEYS) {
      const legacyRaw = window.localStorage.getItem(key);
      if (!legacyRaw) continue;
      const legacy = normalizeState(JSON.parse(legacyRaw));
      if (legacy.doneIds.length > 0 || legacy.updatedAt) {
        window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
    return current;
  } catch {
    return { doneIds: [], updatedAt: '' };
  }
}

export function saveProductionCheckState(doneIds: string[]): ProductionCheckState {
  const allowedIds = new Set(PRODUCTION_CHECKLIST.map((item) => item.id));
  const state: ProductionCheckState = {
    doneIds: Array.from(new Set(doneIds.filter((id) => allowedIds.has(id)))),
    updatedAt: new Date().toISOString(),
  };
  if (canUseStorage()) {
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('smart-loja:production-checklist-change', { detail: state }));
  }
  return state;
}

export function getProductionCheckSummary(state: ProductionCheckState): ProductionCheckSummary {
  const total = PRODUCTION_CHECKLIST.length;
  const done = state.doneIds.length;
  const pending = Math.max(0, total - done);
  return {
    total,
    done,
    pending,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function buildProductionChecklistText(state: ProductionCheckState): string {
  const done = new Set(state.doneIds);
  const summary = getProductionCheckSummary(state);
  const rows = PRODUCTION_CHECKLIST.map((item) => [
    done.has(item.id) ? '[OK]' : '[PENDENTE]',
    item.group,
    item.title,
    item.expected,
  ].join(' · '));

  return [
    `Checklist comercial Lote 97: ${summary.done}/${summary.total} (${summary.percent}%)`,
    `Atualizado: ${state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR') : 'sem marcações'}`,
    ...rows,
  ].join('\n');
}

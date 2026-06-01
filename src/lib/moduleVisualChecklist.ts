export type ModuleVisualTone = 'ok' | 'warn' | 'info';

export interface ModuleVisualItem {
  id: string;
  title: string;
  area: string;
  detail: string;
  expected: string;
  tone: ModuleVisualTone;
}

export interface ModuleVisualState {
  doneIds: string[];
  updatedAt: string;
}

export interface ModuleVisualSummary {
  total: number;
  done: number;
  pending: number;
  percent: number;
}

const MODULE_VISUAL_KEY = 'smart-loja:lote81-module-visual-checklist';
const LEGACY_MODULE_VISUAL_KEYS = ['smart-loja:lote80-module-visual-checklist', 'smart-loja:lote79-module-visual-checklist', 'smart-loja:lote78-module-visual-checklist', 'smart-loja:lote77-module-visual-checklist'];

export const MODULE_VISUAL_CHECKLIST: ModuleVisualItem[] = [
  {
    id: 'dashboard-mobile-web',
    title: 'Dashboard web e celular',
    area: 'Dashboard',
    detail: 'Abrir no desktop e no celular pequeno, conferir KPIs, atalhos, status e menu inferior.',
    expected: 'Sem corte lateral, sem cards gigantes no web e sem bottom nav cobrindo conteúdo.',
    tone: 'ok',
  },
  {
    id: 'produtos-form-table',
    title: 'Produtos: formulário, lista e foto',
    area: 'Produtos',
    detail: 'Cadastrar/editar produto, abrir lista e conferir leitura em mobile.',
    expected: 'Botões tocáveis, campos legíveis e tabela/card sem texto esmagado.',
    tone: 'warn',
  },
  {
    id: 'vendas-pdv-checkout',
    title: 'Vendas/PDV sem poluição',
    area: 'Vendas',
    detail: 'Buscar produto, montar carrinho e abrir finalização em tela estreita.',
    expected: 'Preço, total, pagamento e botão principal aparecem claros e sem scroll confuso.',
    tone: 'warn',
  },
  {
    id: 'caixa-critical-actions',
    title: 'Caixa com ações críticas protegidas',
    area: 'Caixa',
    detail: 'Conferir abrir/fechar caixa, resumo e movimentos no celular.',
    expected: 'Ações perigosas não ficam coladas e exigem leitura clara antes do clique.',
    tone: 'warn',
  },
  {
    id: 'crediario-parcelas',
    title: 'Crediário e parcelas',
    area: 'Crediário',
    detail: 'Abrir cliente com parcelas pagas/em aberto e conferir valores no mobile.',
    expected: 'Valor original, pago e aberto ficam fáceis de entender sem quebrar linha demais.',
    tone: 'warn',
  },
  {
    id: 'clientes-pedidos-basic',
    title: 'Clientes e pedidos',
    area: 'Clientes/Pedidos',
    detail: 'Criar cliente, abrir pedido e validar cards/listas no celular.',
    expected: 'Fluxo simples para usuário leigo, com mensagens de salvar/sincronizar claras.',
    tone: 'ok',
  },
  {
    id: 'backup-settings-permissions',
    title: 'Backup/configurações por papel',
    area: 'Backup/Configurações',
    detail: 'Entrar como leitor/operador e tentar ação sensível.',
    expected: 'Sistema bloqueia visualmente antes de tentar gravar no Supabase.',
    tone: 'info',
  },
  {
    id: 'neo-shell-family',
    title: 'Família neo-* sem corte lateral',
    area: 'Shell/Topbar/Dock',
    detail: 'Conferir sidebar, topbar, header grid, action ribbon, página principal e dock mobile em web e celular.',
    expected: 'Diagnóstico mostra família neo v79 + shell/sidebar v80 + redução !important v81 ativos, sem estouro lateral e com menu/toque confortável.',
    tone: 'warn',
  },
  {
    id: 'diagnostics-css-pwa',
    title: 'Diagnóstico, CSS e PWA',
    area: 'Diagnóstico',
    detail: 'Abrir diagnóstico depois do deploy e conferir versão, cache, CSS e checklist.',
    expected: 'Versão v81, cache v81, limpeza CSS v78, família neo v79 e shell/sidebar v80 + redução !important v81 aparecem no diagnóstico.',
    tone: 'info',
  },
];

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeModuleState(value: unknown): ModuleVisualState {
  const source = value && typeof value === 'object' ? value as Partial<ModuleVisualState> : {};
  const allowedIds = new Set(MODULE_VISUAL_CHECKLIST.map((item) => item.id));
  const doneIds = Array.isArray(source.doneIds)
    ? source.doneIds.filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    : [];
  return {
    doneIds: Array.from(new Set(doneIds)),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

export function readModuleVisualState(): ModuleVisualState {
  if (!canUseStorage()) return { doneIds: [], updatedAt: '' };
  try {
    const current = normalizeModuleState(JSON.parse(window.localStorage.getItem(MODULE_VISUAL_KEY) || '{}'));
    if (current.doneIds.length > 0 || current.updatedAt) return current;
    for (const key of LEGACY_MODULE_VISUAL_KEYS) {
      const legacyRaw = window.localStorage.getItem(key);
      if (!legacyRaw) continue;
      const legacy = normalizeModuleState(JSON.parse(legacyRaw));
      if (legacy.doneIds.length > 0 || legacy.updatedAt) {
        window.localStorage.setItem(MODULE_VISUAL_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
    return current;
  } catch {
    return { doneIds: [], updatedAt: '' };
  }
}

export function saveModuleVisualState(doneIds: string[]): ModuleVisualState {
  const allowedIds = new Set(MODULE_VISUAL_CHECKLIST.map((item) => item.id));
  const state: ModuleVisualState = {
    doneIds: Array.from(new Set(doneIds.filter((id) => allowedIds.has(id)))),
    updatedAt: new Date().toISOString(),
  };
  if (canUseStorage()) {
    window.localStorage.setItem(MODULE_VISUAL_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('smart-loja:module-visual-change', { detail: state }));
  }
  return state;
}

export function getModuleVisualSummary(state: ModuleVisualState): ModuleVisualSummary {
  const total = MODULE_VISUAL_CHECKLIST.length;
  const done = state.doneIds.filter((id) => MODULE_VISUAL_CHECKLIST.some((item) => item.id === id)).length;
  const pending = Math.max(0, total - done);
  return { total, done, pending, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function buildModuleVisualChecklistText(state: ModuleVisualState): string {
  const doneSet = new Set(state.doneIds);
  const summary = getModuleVisualSummary(state);
  return [
    `Checklist visual por tela — Lote 81`,
    `Progresso: ${summary.done}/${summary.total} (${summary.percent}%)`,
    `Atualizado em: ${state.updatedAt || 'não marcado'}`,
    ...MODULE_VISUAL_CHECKLIST.map((item) => `${doneSet.has(item.id) ? '[OK]' : '[PENDENTE]'} ${item.area} — ${item.title}: ${item.expected}`),
  ].join('\n');
}

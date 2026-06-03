import { useEffect, useMemo, useState } from 'react';
import {
  getWebOutboxStats,
  readWebOutbox,
  readWebSyncSnapshot,
  flushWebOutbox,
  WEB_APP_VERSION,
  WEB_CACHE_VERSION,
  getWebStoreContext,
  webRoleLabel,
  getWebRoleCapabilities,
  webCommercialValidation,
  webPrintTestReceipt,
  type WebCommercialCheckItem,
  type WebCommercialValidationReport,
  type WebOutboxStats,
  type WebSyncSnapshot,
  type WebStoreRole,
} from '../../lib/webApi';
import type { AppStatus } from '../../types';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatDateTime, formatNumber } from '../components/format';

interface DiagnosticsScreenProps {
  status: AppStatus | null;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };

type RoleState = {
  role: WebStoreRole | 'sem login';
  storeName: string;
  email: string;
};

interface GuidedCommercialStep {
  id: string;
  group: string;
  title: string;
  action: string;
  expected: string;
  role: string;
  device: string;
  risk: 'baixo' | 'medio' | 'alto';
}

const GUIDED_TEST_KEY = 'smart-loja:guided-commercial-test-v129';
const LEGACY_GUIDED_TEST_KEYS = ['smart-loja:guided-commercial-test-v128', 'smart-loja:guided-commercial-test-v127', 'smart-loja:guided-commercial-test-v126'];

const GUIDED_COMMERCIAL_STEPS: GuidedCommercialStep[] = [
  {
    id: 'owner-device-a-commercial-test',
    group: '1. Dono no aparelho principal',
    title: 'Dono entra e roda o teste comercial',
    action: 'No PC ou celular principal, entrar como dono, abrir Diagnóstico Web e tocar em Rodar teste comercial.',
    expected: 'O teste precisa ficar sem alerta vermelho. Alertas amarelos só podem ser de teste manual pendente.',
    role: 'Dono',
    device: 'Aparelho 1',
    risk: 'alto',
  },
  {
    id: 'owner-create-core-data',
    group: '1. Dono no aparelho principal',
    title: 'Criar cliente e produto reais de teste',
    action: 'Cadastrar um cliente TESTE e um produto TESTE com preço e estoque pequeno.',
    expected: 'Cliente e produto aparecem na lista, sem duplicar e sem mensagem de erro da nuvem.',
    role: 'Dono',
    device: 'Aparelho 1',
    risk: 'alto',
  },
  {
    id: 'device-b-load-same-data',
    group: '2. Segundo aparelho',
    title: 'Segundo aparelho puxa os mesmos dados',
    action: 'Abrir o PWA instalado em outro celular ou no navegador do PC e tocar em Puxar dados da nuvem.',
    expected: 'O mesmo cliente, produto, venda, caixa e pedido aparecem no segundo aparelho.',
    role: 'Dono/Admin',
    device: 'Aparelho 2',
    risk: 'alto',
  },
  {
    id: 'admin-operates-without-owner-power',
    group: '3. Administrador',
    title: 'Admin opera sem tomar lugar do dono',
    action: 'Entrar como admin, criar/editar cliente ou produto e tentar acessar ações de dono/permissões.',
    expected: 'Admin consegue operar a loja, mas não remove/promove dono nem libera área proibida.',
    role: 'Admin',
    device: 'Aparelho 1 ou 2',
    risk: 'alto',
  },
  {
    id: 'operator-sale-cash-order',
    group: '4. Operador',
    title: 'Operador vende, mas não altera configuração crítica',
    action: 'Entrar como operador, abrir caixa se permitido, fazer uma venda pequena e criar um pedido simples.',
    expected: 'Venda/pedido funcionam; configurações, usuários e permissões continuam bloqueados.',
    role: 'Operador',
    device: 'Aparelho 1 ou 2',
    risk: 'alto',
  },
  {
    id: 'viewer-read-only-block',
    group: '5. Leitor',
    title: 'Leitor consulta sem salvar nada',
    action: 'Entrar como leitor e tentar salvar cliente, produto, caixa, pedido e crediário.',
    expected: 'O app explica que é somente leitura e a nuvem também não aceita alteração.',
    role: 'Leitor',
    device: 'Aparelho 1 ou 2',
    risk: 'alto',
  },
  {
    id: 'offline-pending-retry-v127',
    group: '6. Internet fraca',
    title: 'Pendência offline não duplica',
    action: 'No celular, desligar internet, fazer uma alteração segura, religar e tocar em Reenviar pendências.',
    expected: 'A pendência some depois do envio e o dado não aparece duplicado.',
    role: 'Dono/Admin/Operador',
    device: 'Celular',
    risk: 'medio',
  },
  {
    id: 'print-real-58-80-a4',
    group: '7. Impressão',
    title: 'Testar impressão real 58mm, 80mm e A4',
    action: 'Usar os botões Teste 58mm, Teste 80mm e Teste A4/PDF e depois testar uma venda real controlada.',
    expected: 'O comprovante não corta informações importantes e a amostra não mexe no estoque/caixa.',
    role: 'Dono/Admin/Operador',
    device: 'Aparelho com impressora',
    risk: 'medio',
  },
  {
    id: 'backup-export-restore-controlled',
    group: '8. Backup',
    title: 'Backup e restauração controlados',
    action: 'Criar backup, baixar arquivo e testar restauração apenas em ambiente de teste ou loja vazia.',
    expected: 'Backup baixa corretamente e a restauração exige confirmação clara antes de mexer nos dados.',
    role: 'Dono/Admin',
    device: 'Aparelho 1',
    risk: 'medio',
  },
  {
    id: 'pwa-installed-cache-v127',
    group: '9. PWA e atualização',
    title: 'PWA instalado recebeu a versão nova',
    action: 'Depois do deploy, abrir o app instalado no celular, limpar cache antigo se necessário e conferir a versão no Diagnóstico.',
    expected: 'Aparece v129 no app/cache e as telas novas continuam funcionando no celular.',
    role: 'Qualquer papel',
    device: 'Celular instalado',
    risk: 'medio',
  },
  {
    id: 'final-evidence-copy',
    group: '10. Evidência antes de vender',
    title: 'Copiar relatório final para suporte/cliente',
    action: 'Com todos os testes marcados, tocar em Copiar roteiro e guardar a evidência junto do deploy.',
    expected: 'O relatório mostra quem testou, o que passou, o que falta e não expõe senha nem chave privada.',
    role: 'Dono/Admin',
    device: 'Aparelho principal',
    risk: 'baixo',
  },
];


type AssistedRunResult = 'pending' | 'passed' | 'failed' | 'blocked';

interface AssistedRealStep {
  id: string;
  phase: string;
  title: string;
  whatToDo: string;
  expected: string;
  evidence: string;
  critical: boolean;
}

interface AssistedRealState {
  results: Record<string, AssistedRunResult>;
  tester: string;
  deviceA: string;
  deviceB: string;
  notes: string;
  updatedAt: string;
}

type TriagePriority = 'P0' | 'P1' | 'P2';
type TriageStatus = 'falhou' | 'bloqueado' | 'alerta' | 'pendente';

interface CommercialTriageItem {
  id: string;
  priority: TriagePriority;
  area: string;
  title: string;
  source: string;
  impact: string;
  nextAction: string;
  evidence: string;
  status: TriageStatus;
}

const ASSISTED_RUN_KEY = 'smart-loja:assisted-commercial-run-v129';
const LEGACY_ASSISTED_RUN_KEYS = ['smart-loja:assisted-commercial-run-v128', 'smart-loja:assisted-commercial-run-v127'];

const ASSISTED_REAL_STEPS: AssistedRealStep[] = [
  {
    id: 'deploy-cache-v129-real',
    phase: '1. Deploy e atualização',
    title: 'Deploy aplicado e PWA abriu v129',
    whatToDo: 'Depois do deploy, abrir o app instalado no celular, entrar em Diagnóstico Web e conferir versão/cache v129.',
    expected: 'O celular mostra a versão nova, sem tela antiga presa e sem menu cortado.',
    evidence: 'Print do Diagnóstico Web com versão/cache v129.',
    critical: true,
  },
  {
    id: 'owner-auto-test-no-danger',
    phase: '2. Dono e teste automático',
    title: 'Dono rodou teste comercial sem alerta vermelho',
    whatToDo: 'Entrar como dono, tocar em Rodar teste comercial e revisar Segurança, Supabase/RLS, Sincronização e PWA/cache.',
    expected: 'Sem alerta vermelho. Amarelo só pode ser teste manual ainda pendente.',
    evidence: 'Relatório copiado pelo botão Copiar relatório.',
    critical: true,
  },
  {
    id: 'device-a-create-core-records',
    phase: '3. Dados principais',
    title: 'Aparelho 1 criou cliente, produto e venda controlada',
    whatToDo: 'Criar cliente TESTE, produto TESTE com estoque pequeno e venda de valor baixo.',
    expected: 'Cliente/produto/venda aparecem uma vez, com estoque e caixa coerentes.',
    evidence: 'Nome do cliente/produto TESTE e número/horário da venda.',
    critical: true,
  },
  {
    id: 'device-b-sees-core-records',
    phase: '3. Dados principais',
    title: 'Aparelho 2 enxergou os mesmos dados',
    whatToDo: 'No segundo aparelho, tocar em Puxar dados da nuvem e conferir o cliente, produto, venda e comprovante.',
    expected: 'Dados aparecem no outro aparelho sem duplicar e sem precisar reinstalar o PWA.',
    evidence: 'Print/lista do aparelho 2 com os dados TESTE.',
    critical: true,
  },
  {
    id: 'cash-real-open-move-close',
    phase: '4. Caixa',
    title: 'Caixa abriu, recebeu movimento e fechou corretamente',
    whatToDo: 'Abrir caixa, lançar entrada/saída pequena, fazer venda controlada e conferir fechamento.',
    expected: 'Saldo calculado bate com movimentos e venda; diferença aparece clara quando existir.',
    evidence: 'Valor inicial, total de entradas/saídas, venda e saldo final.',
    critical: true,
  },
  {
    id: 'order-real-cycle',
    phase: '5. Pedidos',
    title: 'Pedido passou pelo ciclo real',
    whatToDo: 'Criar pedido TESTE, mudar status para separado/entregue ou cancelar com motivo controlado.',
    expected: 'Status aparece igual nos dois aparelhos e não gera venda duplicada.',
    evidence: 'Código/nome do pedido e status final.',
    critical: true,
  },
  {
    id: 'credit-real-payment',
    phase: '6. Crediário',
    title: 'Crediário recebeu pagamento controlado',
    whatToDo: 'Criar venda/crediário pequeno, receber parcela parcial ou total e conferir valor original, pago e restante.',
    expected: 'Valor original não some, pago/restante ficam claros e comprovante pode ser aberto.',
    evidence: 'Cliente, parcela, valor pago e restante.',
    critical: true,
  },
  {
    id: 'roles-real-blocks',
    phase: '7. Permissões',
    title: 'Admin, operador e leitor respeitaram limites',
    whatToDo: 'Entrar como admin, operador e leitor. Tentar ações permitidas e bloqueadas em cada papel.',
    expected: 'Admin não remove dono; operador não altera permissões; leitor não salva dados.',
    evidence: 'Resumo dos três papéis testados.',
    critical: true,
  },
  {
    id: 'offline-real-retry-no-duplicate',
    phase: '8. Internet fraca',
    title: 'Pendência offline reenviou sem duplicar',
    whatToDo: 'Desligar internet, fazer alteração segura, religar, reenviar pendências e conferir no outro aparelho.',
    expected: 'A fila limpa ou mostra erro humano; o dado não aparece duplicado.',
    evidence: 'Antes/depois da fila e confirmação no outro aparelho.',
    critical: true,
  },
  {
    id: 'print-real-paper',
    phase: '9. Impressão',
    title: 'Impressão 58mm, 80mm ou A4 conferida em papel/PDF',
    whatToDo: 'Usar as amostras de impressão e uma venda real controlada na impressora ou PDF.',
    expected: 'Comprovante não corta nome, total, cliente, forma de pagamento nem mensagem da loja.',
    evidence: 'Foto do papel ou PDF salvo.',
    critical: false,
  },
  {
    id: 'backup-real-export-restore-safe',
    phase: '10. Backup',
    title: 'Backup exportado e restauração testada com segurança',
    whatToDo: 'Baixar backup e testar restauração somente em loja vazia/ambiente de teste.',
    expected: 'Backup baixa, restauração pede confirmação forte e não sobrescreve loja real por engano.',
    evidence: 'Nome do arquivo e ambiente usado no teste.',
    critical: false,
  },
  {
    id: 'final-sell-decision',
    phase: '11. Decisão comercial',
    title: 'Decisão final registrada antes de vender',
    whatToDo: 'Copiar a evidência assistida, listar falhas restantes e decidir piloto/venda/segurar.',
    expected: 'Nenhum item crítico falhou; pendências ficam claras para o próximo lote.',
    evidence: 'Texto copiado pelo botão Copiar execução.',
    critical: true,
  },
];

const ASSISTED_RESULT_LABEL: Record<AssistedRunResult, string> = {
  pending: 'Pendente',
  passed: 'Passou',
  failed: 'Falhou',
  blocked: 'Bloqueado',
};

function normalizeAssistedResult(value: unknown): AssistedRunResult {
  return value === 'passed' || value === 'failed' || value === 'blocked' ? value : 'pending';
}

function emptyAssistedState(): AssistedRealState {
  return { results: {}, tester: '', deviceA: '', deviceB: '', notes: '', updatedAt: '' };
}

function normalizeAssistedState(value: unknown): AssistedRealState {
  const source = value && typeof value === 'object' ? value as Partial<AssistedRealState> : {};
  const allowedIds = new Set(ASSISTED_REAL_STEPS.map((step) => step.id));
  const rawResults = source.results && typeof source.results === 'object' ? source.results as Record<string, unknown> : {};
  const results: Record<string, AssistedRunResult> = {};
  for (const [id, raw] of Object.entries(rawResults)) {
    const normalizedId = id === 'deploy-cache-v128-real' ? 'deploy-cache-v129-real' : id;
    if (!allowedIds.has(normalizedId)) continue;
    const normalized = normalizeAssistedResult(raw);
    if (normalized !== 'pending') results[normalizedId] = normalized;
  }
  return {
    results,
    tester: typeof source.tester === 'string' ? source.tester.slice(0, 80) : '',
    deviceA: typeof source.deviceA === 'string' ? source.deviceA.slice(0, 120) : '',
    deviceB: typeof source.deviceB === 'string' ? source.deviceB.slice(0, 120) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1200) : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readAssistedState(): AssistedRealState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyAssistedState();
  try {
    const current = normalizeAssistedState(JSON.parse(window.localStorage.getItem(ASSISTED_RUN_KEY) || '{}'));
    if (Object.keys(current.results).length || current.updatedAt) return current;
    for (const key of LEGACY_ASSISTED_RUN_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeAssistedState(JSON.parse(raw));
      if (Object.keys(legacy.results).length || legacy.updatedAt) {
        window.localStorage.setItem(ASSISTED_RUN_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyAssistedState();
  }
  return emptyAssistedState();
}

function saveAssistedState(state: AssistedRealState): AssistedRealState {
  const normalized = normalizeAssistedState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ASSISTED_RUN_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function summarizeAssistedState(state: AssistedRealState): { passed: number; failed: number; blocked: number; pending: number; total: number; percent: number; criticalProblems: number } {
  const total = ASSISTED_REAL_STEPS.length;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let criticalProblems = 0;
  for (const step of ASSISTED_REAL_STEPS) {
    const result = normalizeAssistedResult(state.results[step.id]);
    if (result === 'passed') passed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'blocked') blocked += 1;
    if (step.critical && (result === 'failed' || result === 'blocked')) criticalProblems += 1;
  }
  const pending = Math.max(0, total - passed - failed - blocked);
  return { passed, failed, blocked, pending, total, percent: Math.round((passed / total) * 100), criticalProblems };
}

function assistedDecisionText(summary: ReturnType<typeof summarizeAssistedState>, report: WebCommercialValidationReport | null): string {
  if (summary.criticalProblems > 0) return 'Não vender ainda: existe falha/bloqueio crítico.';
  if (summary.passed === summary.total && report?.readyLabel === 'piloto') return 'Pronto para piloto forte, com evidência copiada.';
  if (summary.passed >= Math.ceil(summary.total * 0.75) && !summary.failed && !summary.blocked) return 'Quase pronto: faltam poucos testes reais.';
  return 'Em validação: conclua os passos críticos antes de vender.';
}

function triagePriorityLabel(priority: TriagePriority): string {
  if (priority === 'P0') return 'P0 crítico';
  if (priority === 'P1') return 'P1 alto';
  return 'P2 médio';
}

function buildCommercialTriageItems(params: {
  state: AssistedRealState;
  report: WebCommercialValidationReport | null;
  outbox: WebOutboxStats;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): CommercialTriageItem[] {
  const items: CommercialTriageItem[] = [];
  for (const step of ASSISTED_REAL_STEPS) {
    const result = normalizeAssistedResult(params.state.results[step.id]);
    if (result !== 'failed' && result !== 'blocked') continue;
    items.push({
      id: `assist-${step.id}`,
      priority: step.critical ? 'P0' : 'P1',
      area: step.phase.replace(/^\d+\.\s*/, ''),
      title: step.title,
      source: 'Execução real assistida',
      impact: step.critical ? 'Pode afetar venda, dados, permissão, sync ou operação principal. Não vender antes de corrigir.' : 'Pode afetar acabamento operacional ou confiança do cliente. Corrigir antes de escala.',
      nextAction: result === 'blocked' ? `Desbloquear o teste: ${step.whatToDo}` : `Corrigir e repetir: ${step.whatToDo}`,
      evidence: step.evidence,
      status: result === 'failed' ? 'falhou' : 'bloqueado',
    });
  }

  for (const check of params.report?.checks ?? []) {
    if (check.level === 'ok') continue;
    if (check.level === 'warn' && check.area !== 'Teste real' && check.area !== 'PWA/cache' && check.area !== 'Sincronização') continue;
    items.push({
      id: `check-${check.id}`,
      priority: check.level === 'danger' ? 'P0' : check.area === 'Teste real' ? 'P1' : 'P2',
      area: check.area,
      title: check.title,
      source: 'Teste comercial automático',
      impact: check.level === 'danger' ? 'Alerta vermelho no diagnóstico. Segurar venda até resolver.' : 'Alerta amarelo. Pode ser pendência de validação manual ou cache/sync.',
      nextAction: check.detail,
      evidence: check.evidence,
      status: check.level === 'danger' ? 'falhou' : 'alerta',
    });
  }

  if (!params.online) {
    items.push({
      id: 'offline-now', priority: 'P1', area: 'Conexão', title: 'Aparelho offline no teste', source: 'Diagnóstico local',
      impact: 'Pode deixar vendas, clientes ou produtos pendentes neste aparelho.',
      nextAction: 'Conectar na internet, tocar em Reenviar pendências e conferir no segundo aparelho.',
      evidence: `Último status: ${params.snapshot.module} — ${params.snapshot.detail}`, status: 'bloqueado',
    });
  }

  if (params.outbox.total > 0) {
    items.push({
      id: 'outbox-pending-now', priority: params.outbox.error ? 'P0' : 'P1', area: 'Sincronização', title: 'Existem pendências neste aparelho', source: 'Fila local',
      impact: params.outbox.error ? 'Há erro de envio. Outro aparelho pode não ver a alteração.' : 'Ainda falta enviar alteração para a nuvem.',
      nextAction: 'Tocar em Reenviar pendências, conferir internet e copiar o erro se continuar.',
      evidence: `pendente=${params.outbox.pending}; erro=${params.outbox.error}; detalhe=${params.outbox.lastError || 'sem erro registrado'}`,
      status: params.outbox.error ? 'falhou' : 'pendente',
    });
  }

  const order: Record<TriagePriority, number> = { P0: 0, P1: 1, P2: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority] || a.area.localeCompare(b.area, 'pt-BR'));
}

function summarizeTriage(items: CommercialTriageItem[]): { p0: number; p1: number; p2: number; total: number; decision: string } {
  const p0 = items.filter((item) => item.priority === 'P0').length;
  const p1 = items.filter((item) => item.priority === 'P1').length;
  const p2 = items.filter((item) => item.priority === 'P2').length;
  const decision = p0 ? 'Não vender ainda: corrija os P0 primeiro.' : p1 ? 'Piloto com cuidado: resolva os P1 antes de escala.' : items.length ? 'Quase pronto: restam ajustes P2.' : 'Sem falha registrada: manter teste real e evidências.';
  return { p0, p1, p2, total: items.length, decision };
}

function buildTriageText(params: {
  items: CommercialTriageItem[];
  state: AssistedRealState;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const summary = summarizeTriage(params.items);
  const rows = params.items.length ? params.items.map((item) => [
    `[${item.priority}]`,
    item.status.toUpperCase(),
    item.area,
    item.title,
    `Fonte: ${item.source}`,
    `Impacto: ${item.impact}`,
    `Próxima ação: ${item.nextAction}`,
    `Evidência: ${item.evidence}`,
  ].join(' · ')) : ['[OK] Nenhuma falha ou bloqueio registrado neste aparelho. Continue validando em dois aparelhos antes de vender.'];
  return [
    'Smart Loja Fácil — plano de correção pós-teste v129',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${summary.decision}`,
    `Resumo: P0=${summary.p0}; P1=${summary.p1}; P2=${summary.p2}; total=${summary.total}`,
    `Responsável: ${params.state.tester || 'não informado'}`,
    `Aparelho 1: ${params.state.deviceA || 'não informado'}`,
    `Aparelho 2: ${params.state.deviceB || 'não informado'}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.notes ? `Observações livres: ${params.state.notes}` : 'Observações livres: nenhuma',
    '',
    'Itens para corrigir:',
    ...rows,
  ].join('\n');
}

function buildAssistedExecutionText(params: {
  state: AssistedRealState;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const summary = summarizeAssistedState(params.state);
  const rows = ASSISTED_REAL_STEPS.map((step) => {
    const result = normalizeAssistedResult(params.state.results[step.id]);
    return [
      `[${ASSISTED_RESULT_LABEL[result].toUpperCase()}]`,
      step.critical ? 'CRÍTICO' : 'IMPORTANTE',
      step.phase,
      step.title,
      `Esperado: ${step.expected}`,
      `Evidência: ${step.evidence}`,
    ].join(' · ');
  });
  return [
    'Smart Loja Fácil — execução real assistida v129',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Responsável: ${params.state.tester || 'não informado'}`,
    `Aparelho 1: ${params.state.deviceA || 'não informado'}`,
    `Aparelho 2: ${params.state.deviceB || 'não informado'}`,
    `Resultado: ${summary.passed}/${summary.total} passou; ${summary.failed} falhou; ${summary.blocked} bloqueado; ${summary.pending} pendente`,
    `Decisão: ${assistedDecisionText(summary, params.report)}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.notes ? `Observações/falhas: ${params.state.notes}` : 'Observações/falhas: nenhuma anotação registrada',
    '',
    'Passos assistidos:',
    ...rows,
  ].join('\n');
}

function normalizeGuidedDone(value: unknown): string[] {
  const allowed = new Set(GUIDED_COMMERCIAL_STEPS.map((step) => step.id));
  const source = value && typeof value === 'object' && Array.isArray((value as { doneIds?: unknown }).doneIds)
    ? (value as { doneIds: unknown[] }).doneIds
    : Array.isArray(value) ? value : [];
  return Array.from(new Set(source.filter((id): id is string => typeof id === 'string' && allowed.has(id))));
}

function readGuidedDoneIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const current = normalizeGuidedDone(JSON.parse(window.localStorage.getItem(GUIDED_TEST_KEY) || '[]'));
    if (current.length) return current;
    for (const key of LEGACY_GUIDED_TEST_KEYS) {
      const legacyRaw = window.localStorage.getItem(key);
      if (!legacyRaw) continue;
      const legacy = normalizeGuidedDone(JSON.parse(legacyRaw));
      if (legacy.length) {
        window.localStorage.setItem(GUIDED_TEST_KEY, JSON.stringify({ doneIds: legacy, updatedAt: new Date().toISOString() }));
        return legacy;
      }
    }
  } catch {
    return [];
  }
  return [];
}

function saveGuidedDoneIds(doneIds: string[]): string[] {
  const normalized = normalizeGuidedDone({ doneIds });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(GUIDED_TEST_KEY, JSON.stringify({ doneIds: normalized, updatedAt: new Date().toISOString() }));
  }
  return normalized;
}

function buildGuidedTestText(params: {
  doneIds: string[];
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const done = new Set(params.doneIds);
  const total = GUIDED_COMMERCIAL_STEPS.length;
  const doneCount = params.doneIds.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const rows = GUIDED_COMMERCIAL_STEPS.map((step) => [
    done.has(step.id) ? '[OK]' : '[PENDENTE]',
    step.group,
    step.role,
    step.device,
    step.title,
    step.expected,
  ].join(' · '));
  return [
    'Smart Loja Fácil — roteiro guiado comercial v129',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Progresso manual: ${doneCount}/${total} (${percent}%)`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Loja: ${params.roleState.storeName || params.report?.storeName || 'sem loja confirmada'}`,
    `E-mail: ${params.roleState.email || params.report?.email || 'sem login confirmado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    '',
    'Passos:',
    ...rows,
  ].join('\n');
}

function snapshotLabel(snapshot: WebSyncSnapshot): string {
  if (snapshot.status === 'synced') return 'Sincronizado';
  if (snapshot.status === 'syncing') return 'Enviando';
  if (snapshot.status === 'pending') return 'Pendente';
  if (snapshot.status === 'error') return 'Erro';
  return 'Aguardando';
}

function statusTone(snapshot: WebSyncSnapshot): 'green' | 'blue' | 'orange' | 'purple' {
  if (snapshot.status === 'synced') return 'green';
  if (snapshot.status === 'syncing') return 'blue';
  if (snapshot.status === 'pending') return 'orange';
  if (snapshot.status === 'error') return 'purple';
  return 'blue';
}

function checkToneClass(level: WebCommercialCheckItem['level']): string {
  if (level === 'ok') return 'ok';
  if (level === 'warn') return 'warn';
  return 'danger';
}

function readyText(report: WebCommercialValidationReport | null): string {
  if (!report) return 'Não testado';
  if (report.readyLabel === 'piloto') return 'Liberado para piloto controlado';
  if (report.readyLabel === 'quase') return 'Quase pronto';
  return 'Não vender ainda';
}

function reportToText(report: WebCommercialValidationReport, snapshot: WebSyncSnapshot): string {
  const lines = [
    'Smart Loja Fácil — teste comercial v129',
    `Gerado em: ${formatDateTime(report.createdAt)}`,
    `App: ${report.appVersion}`,
    `Cache: ${report.cacheVersion}`,
    `Loja: ${report.storeName}`,
    `E-mail: ${report.email}`,
    `Papel: ${report.roleLabel}`,
    `Nota automática: ${report.score}/10`,
    `Status: ${readyText(report)}`,
    `Pendências: ${report.outbox.total}`,
    `Última sincronização: ${snapshot.module} — ${snapshot.detail}`,
    '',
    'Checklist:',
    ...report.checks.map((check) => `- [${check.level.toUpperCase()}] ${check.area}: ${check.title} — ${check.detail} | ${check.evidence}`),
  ];
  return lines.join('\n');
}

export function DiagnosticsScreen({ status, onRefresh }: DiagnosticsScreenProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<WebSyncSnapshot>(() => readWebSyncSnapshot());
  const [outbox, setOutbox] = useState<WebOutboxStats>(() => getWebOutboxStats());
  const [roleState, setRoleState] = useState<RoleState>({ role: 'sem login', storeName: '', email: '' });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [commercialBusy, setCommercialBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState<'58mm' | '80mm' | 'a4' | null>(null);
  const [report, setReport] = useState<WebCommercialValidationReport | null>(null);
  const [guidedDoneIds, setGuidedDoneIds] = useState<string[]>(() => readGuidedDoneIds());
  const [assistedState, setAssistedState] = useState<AssistedRealState>(() => readAssistedState());

  const refreshLocal = () => {
    setSnapshot(readWebSyncSnapshot());
    setOutbox(getWebOutboxStats());
  };

  const loadRole = async () => {
    try {
      const context = await getWebStoreContext({ createIfMissing: false });
      setRoleState({ role: context.role, storeName: context.store.name, email: context.email });
    } catch {
      setRoleState({ role: 'sem login', storeName: '', email: '' });
    }
  };

  useEffect(() => {
    refreshLocal();
    void loadRole();
    const handler = () => refreshLocal();
    window.addEventListener('smart-loja:web-sync-status', handler);
    window.addEventListener('smart-loja:web-outbox-change', handler);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('smart-loja:web-sync-status', handler);
      window.removeEventListener('smart-loja:web-outbox-change', handler);
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const capabilities = useMemo(() => getWebRoleCapabilities(roleState.role), [roleState.role]);
  const pendingItems = useMemo(() => readWebOutbox().slice(0, 6), [outbox.total]);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const groupedChecks = useMemo(() => {
    const groups = new Map<string, WebCommercialCheckItem[]>();
    for (const check of report?.checks ?? []) {
      const rows = groups.get(check.area) ?? [];
      rows.push(check);
      groups.set(check.area, rows);
    }
    return Array.from(groups.entries());
  }, [report]);
  const guidedDoneSet = useMemo(() => new Set(guidedDoneIds), [guidedDoneIds]);
  const guidedGroups = useMemo(() => {
    const groups = new Map<string, GuidedCommercialStep[]>();
    for (const step of GUIDED_COMMERCIAL_STEPS) {
      const rows = groups.get(step.group) ?? [];
      rows.push(step);
      groups.set(step.group, rows);
    }
    return Array.from(groups.entries());
  }, []);
  const guidedDoneCount = guidedDoneIds.length;
  const guidedPercent = Math.round((guidedDoneCount / GUIDED_COMMERCIAL_STEPS.length) * 100);
  const assistedGroups = useMemo(() => {
    const groups = new Map<string, AssistedRealStep[]>();
    for (const step of ASSISTED_REAL_STEPS) {
      const rows = groups.get(step.phase) ?? [];
      rows.push(step);
      groups.set(step.phase, rows);
    }
    return Array.from(groups.entries());
  }, []);
  const assistedSummary = useMemo(() => summarizeAssistedState(assistedState), [assistedState]);
  const assistedDecision = assistedDecisionText(assistedSummary, report);
  const triageItems = useMemo(() => buildCommercialTriageItems({ state: assistedState, report, outbox, online, snapshot }), [assistedState, report, outbox, online, snapshot]);
  const triageSummary = useMemo(() => summarizeTriage(triageItems), [triageItems]);

  async function resendPending(): Promise<void> {
    setBusy(true);
    setFeedback(null);
    try {
      const stats = await flushWebOutbox();
      setOutbox(stats);
      setSnapshot(readWebSyncSnapshot());
      setFeedback({ tone: stats.total === 0 ? 'success' : 'info', text: stats.total === 0 ? 'Pendências enviadas para a nuvem.' : `${formatNumber(stats.total)} pendência(s) ainda precisam de atenção.` });
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function clearCache(): Promise<void> {
    const ok = window.confirm('Limpar cache antigo e recarregar a versão nova neste aparelho?');
    if (!ok) return;
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      window.location.reload();
    }
  }

  async function runCommercialTest(): Promise<void> {
    setCommercialBusy(true);
    setFeedback(null);
    try {
      const nextReport = await webCommercialValidation();
      setReport(nextReport);
      setOutbox(nextReport.outbox);
      setSnapshot(readWebSyncSnapshot());
      setFeedback({
        tone: nextReport.readyLabel === 'nao' ? 'error' : nextReport.readyLabel === 'piloto' ? 'success' : 'info',
        text: `Teste comercial concluído: ${nextReport.score}/10 — ${readyText(nextReport)}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setCommercialBusy(false);
    }
  }

  async function printTest(format: '58mm' | '80mm' | 'a4'): Promise<void> {
    setPrintBusy(format);
    setFeedback(null);
    try {
      await webPrintTestReceipt(format);
      setFeedback({ tone: 'success', text: `Amostra ${format} aberta. Ela não grava venda, não mexe no caixa e não baixa estoque.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setPrintBusy(null);
    }
  }

  function toggleGuidedStep(id: string): void {
    const done = new Set(guidedDoneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setGuidedDoneIds(saveGuidedDoneIds(Array.from(done)));
  }

  function resetGuidedSteps(): void {
    const ok = window.confirm('Zerar as marcações do roteiro guiado neste aparelho? Isso não apaga dados da loja.');
    if (!ok) return;
    setGuidedDoneIds(saveGuidedDoneIds([]));
    setFeedback({ tone: 'info', text: 'Roteiro guiado zerado neste aparelho. Os dados da loja não foram alterados.' });
  }

  async function copyGuidedScript(): Promise<void> {
    const text = buildGuidedTestText({ doneIds: guidedDoneIds, report, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Roteiro guiado copiado. Ele não mostra senha nem chave privada.' });
  }

  function patchAssistedState(patch: Partial<AssistedRealState>): void {
    setAssistedState((current) => saveAssistedState({ ...current, ...patch }));
  }

  function setAssistedResult(id: string, result: AssistedRunResult): void {
    setAssistedState((current) => {
      const results = { ...current.results };
      if (result === 'pending') delete results[id];
      else results[id] = result;
      return saveAssistedState({ ...current, results });
    });
  }

  function resetAssistedExecution(): void {
    const ok = window.confirm('Zerar a execução assistida neste aparelho? Isso não apaga dados da loja.');
    if (!ok) return;
    setAssistedState(saveAssistedState(emptyAssistedState()));
    setFeedback({ tone: 'info', text: 'Execução assistida zerada neste aparelho. Os dados da loja não foram alterados.' });
  }

  async function copyAssistedExecution(): Promise<void> {
    const text = buildAssistedExecutionText({ state: assistedState, report, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Execução assistida copiada. Guarde junto do deploy e dos prints dos aparelhos.' });
  }

  async function copyTriagePlan(): Promise<void> {
    const text = buildTriageText({ items: triageItems, state: assistedState, report, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: triageSummary.p0 ? 'error' : triageSummary.p1 ? 'info' : 'success', text: 'Plano de correção pós-teste copiado sem senha e sem chave privada.' });
  }

  async function copyDiagnostic(): Promise<void> {
    const text = report
      ? `${reportToText(report, snapshot)}\n\n${buildGuidedTestText({ doneIds: guidedDoneIds, report, snapshot, roleState, online })}\n\n${buildAssistedExecutionText({ state: assistedState, report, snapshot, roleState, online })}\n\n${buildTriageText({ items: triageItems, state: assistedState, report, snapshot, roleState, online })}`
      : [
          `App: ${WEB_APP_VERSION}`,
          `Cache: ${WEB_CACHE_VERSION}`,
          `Loja: ${roleState.storeName || status?.settings.store_name || 'sem loja'}`,
          `E-mail: ${roleState.email || 'sem login'}`,
          `Papel: ${webRoleLabel(roleState.role)}`,
          `Permissão: ${capabilities.writeLabel}`,
          `Conexão: ${online ? 'online' : 'offline'}`,
          `Nuvem: ${status?.sqlite_ok ? 'conectada' : 'verificar login/configuração'}`,
          `Pendências: ${outbox.total}`,
          `Última sincronização: ${snapshot.module} - ${snapshot.detail}`,
          `Largura: ${window.innerWidth}px`,
          `Altura: ${window.innerHeight}px`,
        ].join('\n');
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: report ? 'Relatório comercial copiado.' : 'Diagnóstico copiado. Pode enviar para suporte sem expor senha.' });
  }

  return (
    <div className="mapp-screen mapp-diagnostics-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Nuvem" value={status?.sqlite_ok ? 'Online' : 'Verificar'} detail={online ? 'internet ativa' : 'sem internet'} icon="bloqueio_seguro" tone={status?.sqlite_ok ? 'green' : 'orange'} />
        <StatCard label="Sincronização" value={snapshotLabel(snapshot)} detail={snapshot.module} icon="atualizar" tone={statusTone(snapshot)} />
        <StatCard label="Pendências" value={formatNumber(outbox.total)} detail={outbox.total ? 'neste aparelho' : 'fila limpa'} icon="offline_local" tone={outbox.total ? 'orange' : 'green'} />
        <StatCard label="Comercial" value={report ? `${report.score}/10` : 'Testar'} detail={readyText(report)} icon="relatorios" tone={report?.readyLabel === 'nao' ? 'orange' : report?.readyLabel === 'piloto' ? 'green' : 'blue'} />
      </section>

      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-form-panel mapp-commercial-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-green"><InlineIcon name="bloqueio_seguro" size={24} /></span>
          <div>
            <strong>Validação comercial real</strong>
            <p>Testa login, papel, leitura das tabelas, pendências, cache e PWA sem gravar dados.</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={() => void runCommercialTest()} disabled={commercialBusy}>{commercialBusy ? 'Testando...' : 'Rodar teste comercial'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDiagnostic()}>Copiar relatório</button>
          <button type="button" className="mapp-secondary-button" onClick={onRefresh}>Puxar dados</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void clearCache()}>Limpar cache antigo</button>
        </div>
      </section>

      {report ? (
        <section className="mapp-section-block mapp-commercial-report">
          <div className="mapp-section-title"><h2>Resultado comercial</h2><button type="button" onClick={() => void copyDiagnostic()}>Copiar</button></div>
          <div className="mapp-commercial-score-card">
            <span className={report.readyLabel === 'nao' ? 'danger' : report.readyLabel === 'piloto' ? 'ok' : 'warn'}>{report.score}/10</span>
            <div>
              <strong>{readyText(report)}</strong>
              <p>{report.storeName} · {report.roleLabel} · {formatDateTime(report.createdAt)}</p>
            </div>
          </div>
          <div className="mapp-commercial-groups">
            {groupedChecks.map(([area, checks]) => (
              <article key={area} className="mapp-commercial-group">
                <header><strong>{area}</strong><small>{checks.length} item(ns)</small></header>
                {checks.map((check) => (
                  <div key={check.id} className={`mapp-check-row ${checkToneClass(check.level)}`}>
                    <span>{check.level === 'ok' ? '✓' : check.level === 'warn' ? '!' : '×'}</span>
                    <div>
                      <strong>{check.title}</strong>
                      <p>{check.detail}</p>
                      <small>{check.evidence}</small>
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mapp-section-block mapp-guided-test-panel">
        <div className="mapp-section-title"><h2>Roteiro guiado multiaparelho</h2><button type="button" onClick={() => void copyGuidedScript()}>Copiar roteiro</button></div>
        <div className="mapp-guided-summary">
          <div>
            <strong>{guidedDoneCount}/{GUIDED_COMMERCIAL_STEPS.length} passos</strong>
            <p>{guidedPercent}% conferido manualmente. Marque somente depois de testar no aparelho real.</p>
          </div>
          <span className={guidedPercent >= 90 ? 'ok' : guidedPercent >= 60 ? 'warn' : 'danger'}>{guidedPercent}%</span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do roteiro guiado ${guidedPercent}%`}><span style={{ width: `${guidedPercent}%` }} /></div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => void copyGuidedScript()}>Copiar evidência</button>
          <button type="button" className="mapp-secondary-button" onClick={resetGuidedSteps}>Zerar roteiro</button>
        </div>
        <div className="mapp-guided-groups">
          {guidedGroups.map(([group, steps]) => (
            <article key={group} className="mapp-guided-group">
              <header><strong>{group}</strong><small>{steps.filter((step) => guidedDoneSet.has(step.id)).length}/{steps.length}</small></header>
              {steps.map((step) => {
                const done = guidedDoneSet.has(step.id);
                return (
                  <button key={step.id} type="button" className={`mapp-guided-step ${done ? 'done' : ''} risk-${step.risk}`} onClick={() => toggleGuidedStep(step.id)}>
                    <span className="mapp-guided-check">{done ? '✓' : ''}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.action}</p>
                      <small>{step.role} · {step.device} · Esperado: {step.expected}</small>
                    </div>
                  </button>
                );
              })}
            </article>
          ))}
        </div>
      </section>

      <section className="mapp-section-block mapp-assisted-execution-panel">
        <div className="mapp-section-title"><h2>Execução real assistida</h2><button type="button" onClick={() => void copyAssistedExecution()}>Copiar execução</button></div>
        <div className="mapp-assisted-summary">
          <div>
            <strong>{assistedSummary.passed}/{assistedSummary.total} passou</strong>
            <p>{assistedDecision}</p>
          </div>
          <span className={assistedSummary.criticalProblems ? 'danger' : assistedSummary.percent >= 90 ? 'ok' : assistedSummary.percent >= 60 ? 'warn' : 'danger'}>{assistedSummary.percent}%</span>
        </div>
        <div className="mapp-assisted-counters" aria-label="Resumo da execução real">
          <span><b>Falhou</b><strong>{assistedSummary.failed}</strong></span>
          <span><b>Bloqueado</b><strong>{assistedSummary.blocked}</strong></span>
          <span><b>Pendente</b><strong>{assistedSummary.pending}</strong></span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso da execução assistida ${assistedSummary.percent}%`}><span style={{ width: `${assistedSummary.percent}%` }} /></div>
        <div className="mapp-assisted-fields">
          <label>Responsável pelo teste<input value={assistedState.tester} onChange={(event) => patchAssistedState({ tester: event.target.value })} placeholder="Ex.: João / loja teste" /></label>
          <label>Aparelho 1<input value={assistedState.deviceA} onChange={(event) => patchAssistedState({ deviceA: event.target.value })} placeholder="Ex.: PC Chrome / celular dono" /></label>
          <label>Aparelho 2<input value={assistedState.deviceB} onChange={(event) => patchAssistedState({ deviceB: event.target.value })} placeholder="Ex.: Android instalado / navegador" /></label>
          <label>Falhas ou observações<textarea value={assistedState.notes} onChange={(event) => patchAssistedState({ notes: event.target.value })} placeholder="Anote aqui o que falhou, aparelho, papel e print usado como prova." rows={3} /></label>
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => void copyAssistedExecution()}>Copiar evidência assistida</button>
          <button type="button" className="mapp-secondary-button" onClick={resetAssistedExecution}>Zerar execução</button>
        </div>
        <div className="mapp-assisted-groups">
          {assistedGroups.map(([phase, steps]) => (
            <article key={phase} className="mapp-assisted-group">
              <header><strong>{phase}</strong><small>{steps.filter((step) => assistedState.results[step.id] === 'passed').length}/{steps.length}</small></header>
              {steps.map((step) => {
                const result = normalizeAssistedResult(assistedState.results[step.id]);
                return (
                  <div key={step.id} className={`mapp-assisted-step result-${result} ${step.critical ? 'critical' : 'optional'}`}>
                    <div className="mapp-assisted-step-main">
                      <span>{result === 'passed' ? '✓' : result === 'failed' ? '×' : result === 'blocked' ? '!' : ''}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.whatToDo}</p>
                        <small>Esperado: {step.expected}</small>
                        <small>Evidência: {step.evidence}</small>
                      </div>
                    </div>
                    <div className="mapp-assisted-choice-row" aria-label={`Resultado do passo ${step.title}`}>
                      <button type="button" className={result === 'passed' ? 'active ok' : ''} onClick={() => setAssistedResult(step.id, 'passed')}>Passou</button>
                      <button type="button" className={result === 'failed' ? 'active danger' : ''} onClick={() => setAssistedResult(step.id, 'failed')}>Falhou</button>
                      <button type="button" className={result === 'blocked' ? 'active warn' : ''} onClick={() => setAssistedResult(step.id, 'blocked')}>Bloqueado</button>
                      <button type="button" onClick={() => setAssistedResult(step.id, 'pending')}>Limpar</button>
                    </div>
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      </section>

      <section className="mapp-section-block mapp-triage-panel">
        <div className="mapp-section-title"><h2>Correção pós-teste</h2><button type="button" onClick={() => void copyTriagePlan()}>Copiar plano</button></div>
        <div className="mapp-triage-summary">
          <div>
            <strong>{triageSummary.decision}</strong>
            <p>Transforma Falhou/Bloqueado em prioridade real para corrigir sem chute.</p>
          </div>
          <span className={triageSummary.p0 ? 'danger' : triageSummary.p1 ? 'warn' : 'ok'}>{triageSummary.total ? `${triageSummary.total} item(ns)` : 'limpo'}</span>
        </div>
        <div className="mapp-assisted-counters" aria-label="Resumo das correções pós-teste">
          <span><b>P0</b><strong>{triageSummary.p0}</strong></span>
          <span><b>P1</b><strong>{triageSummary.p1}</strong></span>
          <span><b>P2</b><strong>{triageSummary.p2}</strong></span>
        </div>
        {triageItems.length ? (
          <div className="mapp-triage-list">
            {triageItems.map((item) => (
              <article key={item.id} className={`mapp-triage-item priority-${item.priority.toLowerCase()}`}>
                <header><span>{triagePriorityLabel(item.priority)}</span><small>{item.status} · {item.source}</small></header>
                <strong>{item.area} — {item.title}</strong>
                <p>{item.impact}</p>
                <div><b>Próxima ação:</b> {item.nextAction}</div>
                <small>Prova esperada: {item.evidence}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="mapp-success-card"><strong>Nenhuma falha marcada neste aparelho</strong><p>Continue testando em dois aparelhos. Se algo falhar, marque Falhou/Bloqueado na execução assistida e copie o plano.</p></div>
        )}
      </section>

      <section className="mapp-form-panel mapp-print-test-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
          <div>
            <strong>Teste seguro de impressão</strong>
            <p>Abre uma amostra sem vender, sem baixar estoque e sem alterar caixa.</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('58mm')} disabled={Boolean(printBusy)}>{printBusy === '58mm' ? 'Abrindo...' : 'Teste 58mm'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('80mm')} disabled={Boolean(printBusy)}>{printBusy === '80mm' ? 'Abrindo...' : 'Teste 80mm'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void printTest('a4')} disabled={Boolean(printBusy)}>{printBusy === 'a4' ? 'Abrindo...' : 'Teste A4/PDF'}</button>
        </div>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Diagnóstico simples</h2><button type="button" onClick={() => { refreshLocal(); void loadRole(); onRefresh(); }}>Atualizar</button></div>
        <div className="mapp-diagnostic-grid">
          <span><b>Loja</b><strong>{roleState.storeName || status?.settings.store_name || 'Sem loja'}</strong></span>
          <span><b>Conexão</b><strong>{online ? 'Online' : 'Offline'}</strong></span>
          <span><b>App</b><strong>{status?.version ?? WEB_APP_VERSION}</strong></span>
          <span><b>Cache</b><strong>v129 pós-teste</strong></span>
          <span><b>Papel</b><strong>{webRoleLabel(roleState.role)}</strong></span>
          <span><b>Permissão</b><strong>{capabilities.writeLabel}</strong></span>
          <span><b>Última área</b><strong>{snapshot.module}</strong></span>
          <span><b>Último envio</b><strong>{snapshot.at ? formatDateTime(snapshot.at) : 'Sem registro'}</strong></span>
        </div>
      </section>

      <section className="mapp-form-panel">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-green"><InlineIcon name="atualizar" size={24} /></span>
          <div>
            <strong>{snapshotLabel(snapshot)}</strong>
            <p>{snapshot.detail}</p>
          </div>
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={() => void resendPending()} disabled={busy}>{busy ? 'Enviando...' : 'Reenviar pendências'}</button>
          <button type="button" className="mapp-secondary-button" onClick={onRefresh}>Puxar dados da nuvem</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDiagnostic()}>Copiar diagnóstico</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void clearCache()}>Limpar cache antigo</button>
        </div>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Pendências neste aparelho</h2><button type="button" onClick={() => void resendPending()} disabled={busy}>Enviar</button></div>
        {pendingItems.length ? (
          <div className="mapp-list-stack">
            {pendingItems.map((item) => (
              <ListCard
                key={item.id}
                icon="offline_local"
                title={item.module}
                subtitle={`${item.action} · ${item.attempts} tentativa(s) · ${item.lastError || 'aguardando internet'}`}
                value={formatDateTime(item.createdAt)}
                tone={item.lastError ? 'orange' : 'blue'}
              />
            ))}
          </div>
        ) : (
          <div className="mapp-success-card"><strong>Sem pendências</strong><p>Tudo que este aparelho sabe já foi enviado ou não houve alteração offline.</p></div>
        )}
      </section>

      <section className="mapp-warning-card">
        <span><InlineIcon name="bloqueio_seguro" size={24} /></span>
        <div>
          <strong>Teste manual ainda é obrigatório antes de vender</strong>
          <p>Use a execução real assistida v129 em dois aparelhos. Marque Passou/Falhou/Bloqueado, copie a evidência e só venda quando não houver falha crítica.</p>
        </div>
        <button type="button" onClick={() => void copyDiagnostic()}>Copiar</button>
      </section>
    </div>
  );
}

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
  readWebDemoMode,
  readWebTrainingMode,
  saveWebDemoMode,
  saveWebTrainingMode,
  setWebDemoModeEnabled,
  setWebTrainingModeEnabled,
  type WebCommercialCheckItem,
  type WebCommercialValidationReport,
  type WebOutboxStats,
  type WebSyncSnapshot,
  type WebStoreRole,
  type WebDemoModeState,
  type WebTrainingModeState,
} from '../../lib/webApi';
import type { AppStatus, PageKey } from '../../types';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatDateTime, formatNumber } from '../components/format';

interface DiagnosticsScreenProps {
  status: AppStatus | null;
  onRefresh: () => void;
  onNavigate: (page: PageKey) => void;
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

const GUIDED_TEST_KEY = 'smart-loja:guided-commercial-test-v139';
const LEGACY_GUIDED_TEST_KEYS = ['smart-loja:guided-commercial-test-v138', 'smart-loja:guided-commercial-test-v137', 'smart-loja:guided-commercial-test-v136', 'smart-loja:guided-commercial-test-v135', 'smart-loja:guided-commercial-test-v134', 'smart-loja:guided-commercial-test-v133', 'smart-loja:guided-commercial-test-v131', 'smart-loja:guided-commercial-test-v129', 'smart-loja:guided-commercial-test-v128', 'smart-loja:guided-commercial-test-v127', 'smart-loja:guided-commercial-test-v126'];

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
    expected: 'Aparece v139 no app/cache e as telas novas continuam funcionando no celular.',
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


type FinalSellDecision = 'blocked' | 'pending' | 'ready';

interface FinalAcceptanceState {
  responsible: string;
  storeOrClient: string;
  note: string;
  acceptedAt: string;
  acceptedBy: string;
}

interface FinalSellGate {
  decision: FinalSellDecision;
  title: string;
  subtitle: string;
  score: number;
  stars: string;
  tone: 'danger' | 'warn' | 'ok';
  blockers: string[];
  warnings: string[];
}

interface FirstClientOnboardingStep {
  id: string;
  phase: string;
  title: string;
  action: string;
  expected: string;
  owner: string;
  priority: 'P1' | 'P2';
}

interface FirstClientOnboardingState {
  doneIds: string[];
  clientName: string;
  contactName: string;
  supportNote: string;
  updatedAt: string;
}

interface TrainingDemoStep {
  id: string;
  title: string;
  detail: string;
  protectedArea: string;
}

interface DemoModeStep {
  id: string;
  title: string;
  detail: string;
  area: string;
}

interface CommercialTourStep {
  id: string;
  order: number;
  title: string;
  page: PageKey;
  pageLabel: string;
  goal: string;
  script: string;
  show: string;
  close: string;
  proof: string;
  priority: 'P1' | 'P2';
}

interface CommercialTourState {
  doneIds: string[];
  currentId: string;
  presenter: string;
  audience: string;
  objective: string;
  note: string;
  updatedAt: string;
}

interface CommercialProposalPlan {
  id: 'starter' | 'standard' | 'premium';
  name: string;
  tag: string;
  monthly: string;
  setup: string;
  idealFor: string;
  promise: string;
  benefits: string[];
  delivery: string[];
  support: string;
}

interface CommercialProposalState {
  selectedPlanId: CommercialProposalPlan['id'];
  clientName: string;
  monthlyPrice: string;
  setupPrice: string;
  validUntil: string;
  nextStep: string;
  discountNote: string;
  notes: string;
  doneIds: string[];
  updatedAt: string;
}

interface ImplementationTermItem {
  id: string;
  title: string;
  detail: string;
  risk: 'P1' | 'P2';
}

interface ImplementationTermState {
  clientName: string;
  responsibleName: string;
  contact: string;
  chosenPlan: string;
  startDate: string;
  paymentSummary: string;
  supportScope: string;
  clientResponsibilities: string;
  limitations: string;
  notes: string;
  acceptedBy: string;
  acceptedAt: string;
  doneIds: string[];
  updatedAt: string;
}


type PostSalePriority = 'P0' | 'P1' | 'P2';
type PostSaleTicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'solved';

interface PostSaleSupportItem {
  id: string;
  title: string;
  detail: string;
  expected: string;
  priority: PostSalePriority;
}

interface PostSaleSupportTicket {
  id: string;
  title: string;
  category: string;
  priority: PostSalePriority;
  status: PostSaleTicketStatus;
  due: string;
  owner: string;
  evidence: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface PostSaleSupportState {
  clientName: string;
  supportOwner: string;
  supportChannel: string;
  firstReviewDate: string;
  slaNote: string;
  doneIds: string[];
  tickets: PostSaleSupportTicket[];
  updatedAt: string;
}

interface PostSaleTicketDraft {
  title: string;
  category: string;
  priority: PostSalePriority;
  due: string;
  owner: string;
}


type ClientFeedbackPriority = 'P0' | 'P1' | 'P2';
type ClientFeedbackStatus = 'new' | 'planned' | 'in_progress' | 'done';
type ClientSatisfaction = 'nao_informado' | 'ruim' | 'regular' | 'bom' | 'excelente';

interface ClientFeedbackItem {
  id: string;
  title: string;
  detail: string;
  expected: string;
  priority: ClientFeedbackPriority;
}

interface ClientImprovementItem {
  id: string;
  title: string;
  area: string;
  priority: ClientFeedbackPriority;
  status: ClientFeedbackStatus;
  impact: string;
  owner: string;
  due: string;
  evidence: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientFeedbackState {
  clientName: string;
  contactName: string;
  npsScore: number;
  satisfaction: ClientSatisfaction;
  mainPain: string;
  suggestedImprovement: string;
  priorityFocus: string;
  testimonial: string;
  nextAction: string;
  doneIds: string[];
  improvements: ClientImprovementItem[];
  updatedAt: string;
}

interface ClientImprovementDraft {
  title: string;
  area: string;
  priority: ClientFeedbackPriority;
  impact: string;
  owner: string;
  due: string;
}


type ExecutiveHealthDecision = 'blocked' | 'attention' | 'ready';

type ExecutiveHealthTone = 'danger' | 'warn' | 'ok';

interface ExecutiveHealthState {
  sponsor: string;
  clientName: string;
  scaleGoal: string;
  nextReview: string;
  notes: string;
  approvedBy: string;
  approvedAt: string;
  updatedAt: string;
}

interface ExecutiveHealthArea {
  id: string;
  title: string;
  score: number;
  tone: ExecutiveHealthTone;
  status: string;
  evidence: string;
  risk: string;
}

interface ExecutiveHealthSummary {
  score: number;
  stars: string;
  decision: ExecutiveHealthDecision;
  title: string;
  subtitle: string;
  blockers: string[];
  warnings: string[];
  areas: ExecutiveHealthArea[];
}


type RegressionAuditResult = 'pending' | 'passed' | 'failed' | 'blocked';
type RegressionAuditDecision = 'blocked' | 'attention' | 'ready';
type RegressionAuditPriority = 'P0' | 'P1' | 'P2';

interface RegressionAuditStep {
  id: string;
  group: string;
  title: string;
  action: string;
  expected: string;
  evidence: string;
  priority: RegressionAuditPriority;
}

interface RegressionAuditState {
  results: Record<string, RegressionAuditResult>;
  auditor: string;
  storeOrClient: string;
  deviceA: string;
  deviceB: string;
  notes: string;
  approvedBy: string;
  approvedAt: string;
  updatedAt: string;
}

interface RegressionAuditSummary {
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  total: number;
  percent: number;
  criticalOpen: number;
  decision: RegressionAuditDecision;
  title: string;
  subtitle: string;
  score: number;
  stars: string;
  blockers: string[];
  warnings: string[];
}


type DayOneImplantResult = 'pending' | 'passed' | 'failed' | 'blocked';
type DayOneImplantPriority = 'P0' | 'P1' | 'P2';
type DayOneImplantDecision = 'blocked' | 'attention' | 'ready';

interface DayOneImplantStep {
  id: string;
  phase: string;
  title: string;
  action: string;
  expected: string;
  evidence: string;
  priority: DayOneImplantPriority;
}

interface DayOneImplantState {
  results: Record<string, DayOneImplantResult>;
  clientName: string;
  implantor: string;
  storeContact: string;
  schedule: string;
  deviceA: string;
  deviceB: string;
  printer: string;
  internet: string;
  notes: string;
  acceptedBy: string;
  acceptedAt: string;
  updatedAt: string;
}

interface DayOneImplantSummary {
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  total: number;
  percent: number;
  criticalOpen: number;
  decision: DayOneImplantDecision;
  title: string;
  subtitle: string;
  score: number;
  stars: string;
  blockers: string[];
  warnings: string[];
}


type DayTwoFollowUpResult = 'pending' | 'passed' | 'failed' | 'blocked';
type DayTwoFollowUpPriority = 'P0' | 'P1' | 'P2';
type DayTwoFollowUpDecision = 'blocked' | 'attention' | 'stable';

interface DayTwoFollowUpStep {
  id: string;
  phase: string;
  title: string;
  action: string;
  expected: string;
  evidence: string;
  priority: DayTwoFollowUpPriority;
}

interface DayTwoFollowUpState {
  results: Record<string, DayTwoFollowUpResult>;
  clientName: string;
  supportOwner: string;
  contact: string;
  reviewDate: string;
  deviceA: string;
  deviceB: string;
  printer: string;
  mainDoubt: string;
  correctionPlan: string;
  notes: string;
  approvedBy: string;
  approvedAt: string;
  updatedAt: string;
}

interface DayTwoFollowUpSummary {
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  total: number;
  percent: number;
  criticalOpen: number;
  decision: DayTwoFollowUpDecision;
  title: string;
  subtitle: string;
  score: number;
  stars: string;
  blockers: string[];
  warnings: string[];
}



type FirstClientCloseoutResult = 'pending' | 'passed' | 'failed' | 'blocked';
type FirstClientCloseoutPriority = 'P0' | 'P1' | 'P2';
type FirstClientCloseoutDecision = 'blocked' | 'attention' | 'replicable';

interface FirstClientCloseoutStep {
  id: string;
  phase: string;
  title: string;
  action: string;
  expected: string;
  evidence: string;
  priority: FirstClientCloseoutPriority;
}

interface FirstClientCloseoutState {
  results: Record<string, FirstClientCloseoutResult>;
  clientName: string;
  closeOwner: string;
  contact: string;
  closeDate: string;
  referencePermission: string;
  replicationPlan: string;
  nextClientChecklist: string;
  evidenceNote: string;
  notes: string;
  approvedBy: string;
  approvedAt: string;
  updatedAt: string;
}

interface FirstClientCloseoutSummary {
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  total: number;
  percent: number;
  criticalOpen: number;
  decision: FirstClientCloseoutDecision;
  title: string;
  subtitle: string;
  score: number;
  stars: string;
  blockers: string[];
  warnings: string[];
}



const REGRESSION_AUDIT_KEY = 'smart-loja:regression-audit-v140';
const LEGACY_REGRESSION_AUDIT_KEYS = ['smart-loja:regression-audit-v139'];

const REGRESSION_AUDIT_STEPS: RegressionAuditStep[] = [
  {
    id: 'regression-login-session',
    group: '1. Entrada e sessão',
    title: 'Login, sessão e troca de aparelho',
    action: 'Entrar, sair, recarregar o PWA instalado e confirmar que o usuário volta para a loja correta sem travar.',
    expected: 'Login, sessão e logout funcionam sem tela branca, loop ou loja errada.',
    evidence: 'Print do Diagnóstico Web com usuário, papel, loja e versão v142.',
    priority: 'P0',
  },
  {
    id: 'regression-dashboard-mobile',
    group: '2. Mobile principal',
    title: 'Painel e navegação mobile sem corte',
    action: 'Abrir no celular, navegar pelo menu inferior e conferir se nenhum botão fica escondido ou espremido.',
    expected: 'Painel, cards, alertas e bottom nav ficam legíveis em Android/iPhone.',
    evidence: 'Print do dashboard no celular instalado.',
    priority: 'P1',
  },
  {
    id: 'regression-products-customers',
    group: '3. Cadastros críticos',
    title: 'Clientes e produtos preservados',
    action: 'Criar/editar um cliente e um produto TESTE, recarregar e conferir no segundo aparelho.',
    expected: 'Nada some, nada duplica, estoque e dados básicos permanecem corretos.',
    evidence: 'Nome do cliente/produto TESTE conferido nos dois aparelhos.',
    priority: 'P0',
  },
  {
    id: 'regression-sale-stock-receipt',
    group: '4. Venda / PDV',
    title: 'Venda controlada, estoque e comprovante',
    action: 'Fazer venda pequena com produto TESTE, conferir baixa de estoque e abrir/reimprimir comprovante.',
    expected: 'Venda grava uma vez, estoque não fica negativo por erro e comprovante abre sem quebrar.',
    evidence: 'Número/horário da venda TESTE e comprovante conferido.',
    priority: 'P0',
  },
  {
    id: 'regression-cash-flow',
    group: '5. Caixa',
    title: 'Abrir, movimentar e fechar caixa',
    action: 'Abrir caixa, lançar entrada/saída de teste, fechar e conferir saldo esperado.',
    expected: 'Caixa não trava, não duplica movimento e mostra saldo claro para usuário leigo.',
    evidence: 'Saldo inicial/final e movimento TESTE anotados.',
    priority: 'P0',
  },
  {
    id: 'regression-orders-cycle',
    group: '6. Pedidos',
    title: 'Pedido criado e concluído/cancelado',
    action: 'Criar pedido com cliente/produto TESTE, mudar status e conferir no segundo aparelho.',
    expected: 'Pedido aparece igual nos aparelhos e status não fica preso.',
    evidence: 'Status final do pedido TESTE registrado.',
    priority: 'P1',
  },
  {
    id: 'regression-credit-payment',
    group: '7. Crediário',
    title: 'Parcela, pagamento e restante claro',
    action: 'Criar venda/crediário controlado ou usar parcela teste, receber pagamento e conferir valor original/pago/restante.',
    expected: 'Usuário entende quanto era, quanto pagou e quanto falta sem apagar valor original.',
    evidence: 'Parcela TESTE com pago/restante conferido.',
    priority: 'P1',
  },
  {
    id: 'regression-receipts-print',
    group: '8. Comprovantes e impressão',
    title: 'Impressão 58mm/80mm/A4 real',
    action: 'Rodar amostras e testar uma impressão real controlada em 58mm, 80mm ou A4 disponível.',
    expected: 'Comprovante não corta dados importantes e não confunde amostra com venda real.',
    evidence: 'Foto ou confirmação do papel impresso.',
    priority: 'P1',
  },
  {
    id: 'regression-backup-restore-safe',
    group: '9. Backup',
    title: 'Backup baixa e restauração é protegida',
    action: 'Criar/baixar backup e validar restauração só em ambiente vazio/teste, nunca direto em loja real sem cópia.',
    expected: 'Backup existe, restauração exige confirmação forte e não apaga dados por engano.',
    evidence: 'Arquivo de backup controlado e ambiente de teste anotados.',
    priority: 'P1',
  },
  {
    id: 'regression-permissions-roles',
    group: '10. Permissões',
    title: 'Dono, admin, operador e leitor conferidos',
    action: 'Testar cada papel: dono controla, admin opera, operador não mexe em config crítica e leitor não salva.',
    expected: 'Botões e permissões da nuvem bloqueiam o que cada papel não pode fazer.',
    evidence: 'Lista dos e-mails/papéis testados sem expor senha.',
    priority: 'P0',
  },
  {
    id: 'regression-sync-offline',
    group: '11. Sync e offline',
    title: 'Dois aparelhos e pendências sem duplicar',
    action: 'Alterar dado no aparelho 1, conferir no aparelho 2, simular internet fraca e reenviar pendência segura.',
    expected: 'Alteração aparece no outro aparelho e pendência enviada não duplica dados.',
    evidence: 'Horário da sync e pendência zerada no Diagnóstico.',
    priority: 'P0',
  },
  {
    id: 'regression-pwa-cache-deploy',
    group: '12. PWA/deploy',
    title: 'PWA instalado recebeu v142',
    action: 'Depois do deploy, abrir o app instalado, conferir versão/cache v142 e limpar cache antigo se necessário.',
    expected: 'Diagnóstico mostra v142 e as telas novas aparecem no celular instalado.',
    evidence: 'Print de versão/cache v142 no PWA instalado.',
    priority: 'P1',
  },
];


const DAY_ONE_IMPLANT_KEY = 'smart-loja:day-one-implantation-v141';

const DAY_ONE_IMPLANT_STEPS: DayOneImplantStep[] = [
  {
    id: 'day1-schedule-internet',
    phase: '1. Chegada e preparo',
    title: 'Horário, responsável, internet e aparelho definidos',
    action: 'Confirmar horário da implantação, responsável da loja, aparelho principal carregado e internet estável antes de qualquer venda real.',
    expected: 'Cliente sabe quem acompanha, qual aparelho será usado e o app não começa offline ou em celular errado.',
    evidence: 'Nome do responsável, aparelho e tipo de internet anotados no checklist.',
    priority: 'P1',
  },
  {
    id: 'day1-supabase-role',
    phase: '2. Login e nuvem',
    title: 'Login, loja e papel conferidos',
    action: 'Entrar no PWA, abrir Diagnóstico Web, conferir loja correta, e-mail logado, papel e conexão com a nuvem.',
    expected: 'Dono/admin autorizado aparece na loja correta e sem erro vermelho no teste comercial.',
    evidence: 'Print do Diagnóstico com loja, papel, versão e teste comercial rodado.',
    priority: 'P0',
  },
  {
    id: 'day1-pwa-installed-cache',
    phase: '2. Login e nuvem',
    title: 'PWA instalado recebeu v142',
    action: 'Abrir o app instalado no celular, conferir versão/cache v142 e limpar cache antigo se necessário.',
    expected: 'PWA mostra v142, abas novas aparecem e o app não fica preso em versão antiga.',
    evidence: 'Print de versão/cache v142 no celular instalado.',
    priority: 'P1',
  },
  {
    id: 'day1-printer-confirmed',
    phase: '3. Equipamentos',
    title: 'Impressora e comprovante testados',
    action: 'Rodar teste 58mm/80mm/A4 disponível e confirmar se o cliente vai imprimir ou compartilhar pelo WhatsApp/PDF.',
    expected: 'Comprovante não corta dados importantes e o formato de entrega fica combinado antes da venda real.',
    evidence: 'Foto do papel impresso ou confirmação de PDF/WhatsApp testado.',
    priority: 'P1',
  },
  {
    id: 'day1-backup-before-real',
    phase: '3. Equipamentos',
    title: 'Backup/diagnóstico antes da operação real',
    action: 'Copiar diagnóstico e, se houver dados reais, criar backup controlado antes de teste que mexa em venda, caixa ou estoque.',
    expected: 'Existe caminho de volta e suporte tem informação para resolver problema sem chute.',
    evidence: 'Diagnóstico copiado e backup controlado anotado.',
    priority: 'P1',
  },
  {
    id: 'day1-test-customer-product',
    phase: '4. Teste controlado',
    title: 'Cliente e produto TESTE conferidos',
    action: 'Criar ou conferir um cliente TESTE e produto TESTE, recarregar e checar se não duplica nem some.',
    expected: 'Cadastros ficam salvos, legíveis no mobile e aparecem no segundo aparelho quando sincronizado.',
    evidence: 'Nome do cliente/produto TESTE e horário anotados.',
    priority: 'P0',
  },
  {
    id: 'day1-test-sale-receipt',
    phase: '4. Teste controlado',
    title: 'Venda teste com estoque e comprovante',
    action: 'Fazer uma venda pequena de teste, conferir baixa de estoque e abrir/reimprimir comprovante.',
    expected: 'Venda grava uma vez, estoque fica correto e comprovante abre sem erro.',
    evidence: 'Número/horário da venda teste, estoque antes/depois e comprovante conferido.',
    priority: 'P0',
  },
  {
    id: 'day1-cash-real-control',
    phase: '4. Teste controlado',
    title: 'Caixa abriu, movimentou e fechou corretamente',
    action: 'Abrir caixa, registrar movimento controlado, conferir saldo e fechar apenas se o fluxo do cliente exigir.',
    expected: 'Saldo fica claro, sem duplicidade e sem confundir teste com dinheiro real.',
    evidence: 'Saldo inicial/final e movimento TESTE anotados.',
    priority: 'P0',
  },
  {
    id: 'day1-second-device-sync',
    phase: '5. Dois aparelhos',
    title: 'Segundo aparelho viu os mesmos dados',
    action: 'Abrir no aparelho 2 e conferir cliente, produto, venda, caixa/pedido/crediário criados no aparelho 1.',
    expected: 'Dados aparecem iguais, sem duplicidade, atraso confuso ou pendência escondida.',
    evidence: 'Print/horário da conferência no aparelho 2.',
    priority: 'P0',
  },
  {
    id: 'day1-role-permissions',
    phase: '5. Dois aparelhos',
    title: 'Permissões mínimas conferidas',
    action: 'Testar dono/admin/operador/leitor quando houver contas: leitor não salva, operador não mexe em configurações críticas, dono mantém controle.',
    expected: 'Botões e nuvem respeitam papel do usuário sem abrir brecha para alteração indevida.',
    evidence: 'E-mails/papéis testados anotados sem expor senha.',
    priority: 'P0',
  },
  {
    id: 'day1-first-real-sale',
    phase: '6. Primeira operação real',
    title: 'Primeira venda real acompanhada',
    action: 'Depois de sair da demo/treinamento, acompanhar uma venda real do cliente e conferir caixa, estoque e comprovante.',
    expected: 'Cliente consegue vender com suporte presente e entende o que fazer se aparecer erro.',
    evidence: 'Horário da primeira venda real, forma de pagamento e comprovante confirmado.',
    priority: 'P0',
  },
  {
    id: 'day1-client-acceptance',
    phase: '7. Aceite e suporte',
    title: 'Cliente aceitou Dia 1 e pós-venda ficou combinado',
    action: 'Registrar aceite, canal de suporte, horário da revisão e qualquer ajuste P0/P1/P2 encontrado no primeiro uso.',
    expected: 'Cliente não fica sozinho sem suporte e falhas reais viram chamado com responsável e prazo.',
    evidence: 'Aceite, canal de suporte e próxima revisão anotados/copiadados.',
    priority: 'P1',
  },
];


const DAY_TWO_FOLLOW_UP_KEY = 'smart-loja:day-two-follow-up-v142';
const LEGACY_DAY_TWO_FOLLOW_UP_KEYS = ['smart-loja:day-two-follow-up-v142'];

const DAY_TWO_FOLLOW_UP_STEPS: DayTwoFollowUpStep[] = [
  {
    id: 'day2-client-opened-store',
    phase: '1. Abertura do segundo dia',
    title: 'Cliente abriu o sistema sem ajuda pesada',
    action: 'Confirmar se o cliente conseguiu abrir o PWA, entrar na loja certa e entender a tela inicial no início do segundo dia.',
    expected: 'App abre rápido, mostra a loja certa e o cliente não fica perdido antes de vender.',
    evidence: 'Horário de abertura, aparelho usado e print/relato do cliente.',
    priority: 'P1',
  },
  {
    id: 'day2-first-real-sale-after-day1',
    phase: '2. Operação real',
    title: 'Primeira venda do Dia 2 conferida',
    action: 'Acompanhar ou revisar uma venda real do Dia 2 com produto, pagamento, estoque e comprovante.',
    expected: 'Venda grava uma vez, estoque fica correto e o comprovante pode ser aberto/impresso/compartilhado.',
    evidence: 'Número/horário da venda real conferida, sem expor dados sensíveis.',
    priority: 'P0',
  },
  {
    id: 'day2-cash-open-close-review',
    phase: '2. Operação real',
    title: 'Caixa do Dia 2 conferido',
    action: 'Revisar abertura, entrada/saída, saldo esperado e fechamento ou conferência parcial do caixa.',
    expected: 'Caixa não duplica movimento, não perde lançamento e o saldo fica explicado para usuário leigo.',
    evidence: 'Saldo inicial/final ou movimento controlado anotado.',
    priority: 'P0',
  },
  {
    id: 'day2-second-device-sync',
    phase: '3. Multiaparelho',
    title: 'Segundo aparelho viu as alterações do Dia 2',
    action: 'Criar/alterar dado real controlado no aparelho principal e conferir no segundo aparelho após puxar dados.',
    expected: 'Venda, cliente, produto, caixa ou pedido aparece igual nos dois aparelhos sem duplicar.',
    evidence: 'Aparelhos usados, horário da conferência e pendências zeradas.',
    priority: 'P0',
  },
  {
    id: 'day2-printer-adjustment',
    phase: '4. Impressão/comprovante',
    title: 'Impressão ou compartilhamento ajustado',
    action: 'Conferir se o cliente conseguiu imprimir 58/80mm, gerar PDF/A4 ou enviar comprovante por WhatsApp conforme combinado.',
    expected: 'Comprovante legível, sem corte importante e com caminho claro para reimprimir/compartilhar.',
    evidence: 'Foto do papel, PDF gerado ou confirmação de envio.',
    priority: 'P1',
  },
  {
    id: 'day2-order-credit-real-doubt',
    phase: '5. Pedidos e crediário',
    title: 'Pedidos/crediário sem dúvida crítica',
    action: 'Perguntar e testar se pedido, crediário, pagamento parcial e restante estão claros para o cliente.',
    expected: 'Cliente entende valor original, pago, restante, status de pedido e próxima ação.',
    evidence: 'Dúvida principal e resposta combinada registradas.',
    priority: 'P1',
  },
  {
    id: 'day2-stock-products-review',
    phase: '6. Produtos/estoque',
    title: 'Estoque e produtos revisados após uso real',
    action: 'Conferir produto vendido, baixa de estoque, ajuste manual permitido e alerta de estoque baixo.',
    expected: 'Estoque não ficou negativo por erro e o cliente entende quando precisa ajustar.',
    evidence: 'Produto conferido, estoque antes/depois ou alerta observado.',
    priority: 'P1',
  },
  {
    id: 'day2-permissions-users-review',
    phase: '7. Usuários/permissões',
    title: 'Papéis usados no Dia 2 não furaram permissão',
    action: 'Revisar se operador/leitor/admin fizeram apenas o que podiam, sem acessar configuração crítica indevida.',
    expected: 'Permissões continuam coerentes e sem risco de leitor/operador alterar o que não deve.',
    evidence: 'Papéis testados e ação bloqueada/liberada registrada.',
    priority: 'P0',
  },
  {
    id: 'day2-backup-support-path',
    phase: '8. Segurança e suporte',
    title: 'Backup e caminho de suporte combinados',
    action: 'Confirmar se backup/diagnóstico foram copiados e se o cliente sabe onde chamar suporte.',
    expected: 'Existe caminho de suporte claro e evidência antes de mexer em dados sensíveis.',
    evidence: 'Canal de suporte, responsável e backup/diagnóstico anotados.',
    priority: 'P1',
  },
  {
    id: 'day2-open-issues-prioritized',
    phase: '9. Correções pós-implantação',
    title: 'Falhas e dúvidas viraram plano P0/P1/P2',
    action: 'Registrar tudo que apareceu no Dia 2: erro, dúvida, impressão, sync, caixa, estoque, crediário ou melhoria visual.',
    expected: 'Nada fica solto no WhatsApp; cada item tem prioridade, responsável, prazo e evidência esperada.',
    evidence: 'Plano de correção preenchido com prioridade e próxima ação.',
    priority: 'P0',
  },
  {
    id: 'day2-client-confidence',
    phase: '10. Cliente estabilizado',
    title: 'Cliente consegue continuar com suporte combinado',
    action: 'Confirmar se o cliente aceita continuar usando com acompanhamento ou se precisa pausar até corrigir P0/P1.',
    expected: 'Sem P0/P1 aberto para operação sozinha; se houver, não considerar estabilizado.',
    evidence: 'Aceite do cliente, observação e próxima revisão combinada.',
    priority: 'P1',
  },
  {
    id: 'day2-final-evidence-copy',
    phase: '11. Evidência final Dia 2',
    title: 'Relatório do Dia 2 copiado e guardado',
    action: 'Copiar o relatório do Dia 2 e guardar junto do termo, proposta, auditoria final e pós-venda.',
    expected: 'Suporte tem histórico claro do que passou, falhou, ficou pendente e qual é o próximo lote.',
    evidence: 'Relatório copiado sem senha/chave privada.',
    priority: 'P2',
  },
];

const FIRST_CLIENT_CLOSEOUT_KEY = 'smart-loja:first-client-closeout-v144';
const LEGACY_FIRST_CLIENT_CLOSEOUT_KEYS = ['smart-loja:first-client-closeout-v143'];

const FIRST_CLIENT_CLOSEOUT_STEPS: FirstClientCloseoutStep[] = [
  {
    id: 'closeout-proof-package-complete',
    phase: '1. Evidência final',
    title: 'Pasta de evidências do primeiro cliente completa',
    action: 'Juntar proposta, termo, auditoria final, Dia 1, Dia 2, prints de PWA/cache, impressão e relatório de suporte.',
    expected: 'Existe histórico suficiente para explicar o que foi vendido, testado, aceito e acompanhado.',
    evidence: 'Links, prints ou arquivos anotados sem senha/chave privada.',
    priority: 'P1',
  },
  {
    id: 'closeout-day1-day2-accepted',
    phase: '1. Evidência final',
    title: 'Dia 1 e Dia 2 fechados sem bloqueio crítico',
    action: 'Conferir se implantação Dia 1 e correção Dia 2 foram aprovadas com venda, caixa, sync, comprovante e suporte.',
    expected: 'Não existe P0/P1 aberto que impeça o cliente de operar com acompanhamento combinado.',
    evidence: 'Relatórios Dia 1 e Dia 2 copiados e guardados.',
    priority: 'P0',
  },
  {
    id: 'closeout-operation-stable',
    phase: '2. Operação estável',
    title: 'Venda, caixa, estoque e comprovante ficaram estáveis',
    action: 'Confirmar que as rotinas principais usadas pelo cliente funcionaram no uso real, não apenas em demo.',
    expected: 'Cliente vende, confere caixa, vê estoque e acessa comprovantes sem depender de suporte a cada clique.',
    evidence: 'Resumo das operações reais conferidas.',
    priority: 'P0',
  },
  {
    id: 'closeout-support-feedback-clean',
    phase: '2. Operação estável',
    title: 'Pós-venda e feedback sem P0/P1 aberto',
    action: 'Revisar chamados, feedback/NPS e melhorias abertas antes de usar o cliente como modelo comercial.',
    expected: 'Nenhum P0/P1 fica solto em WhatsApp; tudo tem responsável, prazo ou está resolvido.',
    evidence: 'Resumo de chamados/melhorias e status final.',
    priority: 'P0',
  },
  {
    id: 'closeout-client-reference-permission',
    phase: '3. Uso como modelo',
    title: 'Permissão para usar como referência definida',
    action: 'Combinar se pode usar nome, print borrado, depoimento ou apenas caso anônimo em novas vendas.',
    expected: 'Não expor dados do cliente sem autorização; se não autorizar, usar apenas aprendizado interno.',
    evidence: 'Permissão anotada: autorizou, anônimo ou não autorizado.',
    priority: 'P1',
  },
  {
    id: 'closeout-replication-package-ready',
    phase: '3. Uso como modelo',
    title: 'Pacote para replicar em novo cliente pronto',
    action: 'Separar roteiro de venda, checklist Dia 1, Dia 2, treinamento, demo, termo, proposta e suporte em ordem de uso.',
    expected: 'Próximo cliente recebe processo mais rápido, com menos improviso e menos risco.',
    evidence: 'Lista do pacote replicável e onde está guardado.',
    priority: 'P1',
  },
  {
    id: 'closeout-pricing-terms-final',
    phase: '4. Comercial',
    title: 'Preço, plano, suporte e limites ficaram claros',
    action: 'Revisar se mensalidade, implantação, suporte, impressão, backup e limites honestos ficaram alinhados.',
    expected: 'Não vender para o próximo cliente prometendo algo fora do que foi testado.',
    evidence: 'Plano comercial final e limites anotados.',
    priority: 'P1',
  },
  {
    id: 'closeout-training-ready',
    phase: '4. Comercial',
    title: 'Treinamento do próximo cliente ficou pronto',
    action: 'Ajustar fala, tour e modo demo com base nas dúvidas reais do primeiro cliente.',
    expected: 'Demonstração fica mais simples para usuário leigo e evita confundir demo com venda real.',
    evidence: 'Dúvidas frequentes e resposta curta registradas.',
    priority: 'P2',
  },
  {
    id: 'closeout-risk-register-zero',
    phase: '5. Risco antes de escalar',
    title: 'Riscos conhecidos foram classificados',
    action: 'Listar qualquer pendência restante como P0/P1/P2 antes de buscar o próximo cliente.',
    expected: 'Nada crítico fica escondido; se houver risco, ele entra no próximo lote antes de escalar.',
    evidence: 'Plano de risco/pendência final preenchido.',
    priority: 'P0',
  },
  {
    id: 'closeout-next-client-checklist',
    phase: '5. Risco antes de escalar',
    title: 'Checklist do próximo cliente definido',
    action: 'Registrar o passo a passo que será repetido no próximo cliente: venda, implantação, Dia 1, Dia 2 e pós-venda.',
    expected: 'O processo deixa de ser improvisado e vira método comercial repetível.',
    evidence: 'Checklist do próximo cliente copiado e guardado.',
    priority: 'P1',
  },
];


const DEMO_MODE_STEPS: DemoModeStep[] = [
  { id: 'demo-dashboard', title: 'Apresentar dashboard bonito', detail: 'Mostrar métricas, vendas recentes, estoque baixo, crediário e pedidos usando dados fictícios.', area: 'Painel' },
  { id: 'demo-products', title: 'Mostrar produtos sem expor estoque real', detail: 'Produtos, categorias, preços e estoque são de exemplo. Nada é puxado da loja real enquanto a demo estiver ativa.', area: 'Produtos' },
  { id: 'demo-sales', title: 'Simular venda sem finalizar', detail: 'Cliente entende o fluxo de PDV usando clientes/produtos demo. Finalizar venda real continua bloqueado.', area: 'Vendas' },
  { id: 'demo-receipts', title: 'Mostrar comprovantes de amostra', detail: 'Comprovantes demo podem ser abertos/impresso como modelo visual sem mexer no caixa.', area: 'Comprovantes' },
  { id: 'demo-exit', title: 'Sair da demo antes da operação real', detail: 'Antes da primeira venda verdadeira, desative a demo, confira login na nuvem e rode o teste comercial.', area: 'Segurança' },
];


const COMMERCIAL_TOUR_KEY = 'smart-loja:commercial-tour-v139';
const LEGACY_COMMERCIAL_TOUR_KEYS = ['smart-loja:commercial-tour-v138', 'smart-loja:commercial-tour-v137', 'smart-loja:commercial-tour-v136', 'smart-loja:commercial-tour-v135', 'smart-loja:commercial-tour-v134', 'smart-loja:commercial-tour-v133'];

const COMMERCIAL_TOUR_STEPS: CommercialTourStep[] = [
  {
    id: 'tour-start-demo-safe',
    order: 1,
    title: 'Preparar demonstração segura',
    page: 'diagnostics',
    pageLabel: 'Diagnóstico Web',
    goal: 'Começar sem expor dados reais e sem risco de gravar venda de teste.',
    script: 'Antes de mostrar o sistema, eu ativo o ambiente demo. Assim você vê uma loja pronta, mas nada mexe nos seus dados reais.',
    show: 'Ativar Tour comercial guiado, confirmar banner DEMO/Treinamento e abrir o resumo do tour.',
    close: 'Cliente entende que a apresentação é segura e separada da operação verdadeira.',
    proof: 'Print do banner de demo ativa ou resumo copiado do tour.',
    priority: 'P1',
  },
  {
    id: 'tour-dashboard-value',
    order: 2,
    title: 'Mostrar visão geral da loja',
    page: 'dashboard',
    pageLabel: 'Painel',
    goal: 'Mostrar valor rápido: vendas, estoque baixo, pedidos, crediário e alertas em uma tela.',
    script: 'Aqui o dono enxerga a loja do dia sem ficar procurando em várias abas. O importante aparece primeiro.',
    show: 'Cards principais, vendas recentes, alertas e atalhos. Destacar leitura no celular.',
    close: 'Cliente percebe controle diário e facilidade no mobile.',
    proof: 'Cliente confirma que entendeu onde ver resumo do dia.',
    priority: 'P1',
  },
  {
    id: 'tour-pdv-flow',
    order: 3,
    title: 'Apresentar venda/PDV sem finalizar real',
    page: 'sales',
    pageLabel: 'Vendas / PDV',
    goal: 'Demonstrar carrinho, cliente, desconto, pagamento e crediário sem baixar estoque real.',
    script: 'A venda é feita em poucos toques. No treinamento, eu mostro o fluxo e paro antes da operação real.',
    show: 'Busca de produto, carrinho, cliente, forma de pagamento e aviso de demo/treinamento.',
    close: 'Cliente entende como vender no balcão pelo celular.',
    proof: 'Cliente aponta onde finalizaria a venda real depois de sair da demo.',
    priority: 'P1',
  },
  {
    id: 'tour-products-customers',
    order: 4,
    title: 'Produtos e clientes organizados',
    page: 'products',
    pageLabel: 'Produtos',
    goal: 'Mostrar cadastro simples, estoque, preço, busca e ficha do cliente como base da operação.',
    script: 'Produto e cliente ficam fáceis de achar. Isso reduz erro de preço, estoque e cobrança.',
    show: 'Produtos demo, estoque baixo, preço, filtros; depois orientar abrir Clientes se o cliente pedir.',
    close: 'Cliente entende que dados principais ficam padronizados.',
    proof: 'Cliente escolhe um produto demo e entende preço/estoque.',
    priority: 'P1',
  },
  {
    id: 'tour-cash-credit-orders',
    order: 5,
    title: 'Caixa, pedidos e crediário no controle',
    page: 'cash',
    pageLabel: 'Caixa',
    goal: 'Mostrar que a loja controla dinheiro, encomendas e pagamentos pendentes.',
    script: 'Depois de vender, o sistema ajuda a conferir caixa, pedidos e contas a receber sem planilha solta.',
    show: 'Caixa demo, movimentos, atalhos para Pedidos e Crediário, alertas de vencimento.',
    close: 'Cliente entende diferença entre venda, pedido, caixa e crediário.',
    proof: 'Cliente confirma onde veria dinheiro do dia e pendências.',
    priority: 'P1',
  },
  {
    id: 'tour-receipts-print',
    order: 6,
    title: 'Comprovantes e impressão',
    page: 'receipts',
    pageLabel: 'Comprovantes',
    goal: 'Mostrar reimpressão, compartilhamento e modelos 58mm/80mm/A4 sem venda real.',
    script: 'O comprovante pode ser impresso ou compartilhado. Na demo usamos amostra segura sem mexer no caixa.',
    show: 'Lista de comprovantes demo, prévia, WhatsApp/PDF e botões de teste 58/80/A4 no Diagnóstico.',
    close: 'Cliente sabe como entregar comprovante para o consumidor.',
    proof: 'Amostra aberta ou print da prévia sem dados reais.',
    priority: 'P2',
  },
  {
    id: 'tour-reports-backup',
    order: 7,
    title: 'Relatórios, backup e segurança',
    page: 'reports',
    pageLabel: 'Relatórios',
    goal: 'Mostrar que a loja tem visão de resultado e caminhos seguros de diagnóstico/backup.',
    script: 'Relatórios ajudam a decidir. Backup e diagnóstico ajudam a resolver problema sem perder dados.',
    show: 'Relatórios demo, depois explicar Backup e Diagnóstico Web sem restaurar dados reais.',
    close: 'Cliente entende que suporte e segurança fazem parte do produto.',
    proof: 'Cliente sabe copiar diagnóstico se precisar de suporte.',
    priority: 'P2',
  },
  {
    id: 'tour-close-real-next-step',
    order: 8,
    title: 'Fechar apresentação com próximo passo real',
    page: 'diagnostics',
    pageLabel: 'Diagnóstico Web',
    goal: 'Encerrar sem deixar demo ligada para venda verdadeira por engano.',
    script: 'Para usar de verdade, saímos da demo, conferimos login, rodamos teste comercial e só então fazemos a primeira venda acompanhada.',
    show: 'Copiar roteiro do tour, explicar Fechamento comercial e Kit do primeiro cliente.',
    close: 'Cliente entende o caminho: demo → instalação → teste real → venda assistida.',
    proof: 'Resumo do tour copiado e combinado de primeiro uso.',
    priority: 'P1',
  },
];


const COMMERCIAL_PROPOSAL_KEY = 'smart-loja:commercial-proposal-v139';
const LEGACY_COMMERCIAL_PROPOSAL_KEYS = ['smart-loja:commercial-proposal-v138', 'smart-loja:commercial-proposal-v137', 'smart-loja:commercial-proposal-v136', 'smart-loja:commercial-proposal-v135', 'smart-loja:commercial-proposal-v134'];

const COMMERCIAL_PROPOSAL_PLANS: CommercialProposalPlan[] = [
  {
    id: 'starter',
    name: 'Essencial',
    tag: 'Entrada segura',
    monthly: 'R$ 79 a R$ 99/mês',
    setup: 'R$ 149 a R$ 299 implantação',
    idealFor: 'Loja pequena começando a controlar vendas, produtos e clientes pelo celular.',
    promise: 'Começar organizado sem planilha solta e com comprovante simples.',
    benefits: ['PDV mobile', 'Produtos e clientes', 'Comprovantes', 'Backup orientado', 'Suporte inicial'],
    delivery: ['Instalação PWA', 'Configuração da loja', 'Treino do primeiro caixa', 'Checklist do primeiro dia'],
    support: 'Suporte assistido na implantação e ajustes pequenos combinados.',
  },
  {
    id: 'standard',
    name: 'Profissional',
    tag: 'Mais vendido',
    monthly: 'R$ 119 a R$ 159/mês',
    setup: 'R$ 299 a R$ 499 implantação',
    idealFor: 'Loja que já vende todo dia e precisa de caixa, crediário, pedidos e relatórios.',
    promise: 'Controlar operação diária com menos erro de venda, caixa e cobrança.',
    benefits: ['PDV + caixa', 'Crediário', 'Pedidos', 'Relatórios', 'Multiaparelho guiado'],
    delivery: ['Tour comercial', 'Migração inicial manual', 'Treino com dono/operador', 'Validação em 2 aparelhos'],
    support: 'Suporte de implantação + acompanhamento no primeiro dia real.',
  },
  {
    id: 'premium',
    name: 'Premium Assistido',
    tag: 'Venda assistida',
    monthly: 'R$ 179 a R$ 249/mês',
    setup: 'R$ 499 a R$ 899 implantação',
    idealFor: 'Loja que quer acompanhamento mais próximo, impressão, backup e validação comercial completa.',
    promise: 'Entrar em operação com teste real, evidência, aceite e suporte mais próximo.',
    benefits: ['Tudo do Profissional', 'Impressão 58/80/A4', 'Aceite final', 'Roteiro multiaparelho', 'Suporte prioritário inicial'],
    delivery: ['Demo separada', 'Teste comercial', 'Permissões por papel', 'Evidência final', 'Plano pós-teste'],
    support: 'Suporte assistido com revisão pós-primeiro dia e correções prioritárias combinadas.',
  },
];

const COMMERCIAL_PROPOSAL_CHECKLIST = [
  { id: 'proposal-client', label: 'Cliente/loja preenchido', detail: 'Nome do cliente ou loja aparece na proposta.' },
  { id: 'proposal-plan', label: 'Plano escolhido', detail: 'Plano, mensalidade e implantação definidos sem promessa vaga.' },
  { id: 'proposal-benefits', label: 'Benefícios explicados', detail: 'Cliente entendeu PDV, caixa, crediário, comprovante, backup e suporte.' },
  { id: 'proposal-setup', label: 'Implantação combinada', detail: 'Ficou claro quem instala, treina, testa impressão e acompanha primeiro dia.' },
  { id: 'proposal-limits', label: 'Limites honestos falados', detail: 'Foi explicado que precisa internet, teste em 2 aparelhos e validação de impressora.' },
  { id: 'proposal-next-step', label: 'Próximo passo definido', detail: 'Cliente sabe se vai testar, fechar piloto, enviar dados ou agendar instalação.' },
  { id: 'proposal-copy', label: 'Proposta copiada/enviada', detail: 'Texto copiado sem senha, sem chave privada e sem dados técnicos crus.' },
];


const IMPLEMENTATION_TERM_KEY = 'smart-loja:implementation-term-v139';
const LEGACY_IMPLEMENTATION_TERM_KEYS = ['smart-loja:implementation-term-v138', 'smart-loja:implementation-term-v137', 'smart-loja:implementation-term-v136', 'smart-loja:implementation-term-v135'];

const IMPLEMENTATION_TERM_ITEMS: ImplementationTermItem[] = [
  { id: 'term-proposal-approved', title: 'Proposta e plano conferidos', detail: 'Cliente sabe plano, mensalidade, implantação, validade e próximo passo combinado.', risk: 'P1' },
  { id: 'term-setup-scope', title: 'Escopo de implantação definido', detail: 'Ficou claro o que será configurado: loja, produtos iniciais, clientes, caixa, impressão e treinamento.', risk: 'P1' },
  { id: 'term-client-responsibility', title: 'Responsabilidades do cliente explicadas', detail: 'Cliente entende que precisa internet, aparelho funcionando, dados corretos e teste em dois aparelhos.', risk: 'P1' },
  { id: 'term-printing-limits', title: 'Impressão e equipamentos validados', detail: 'Impressora, navegador, celular e formato 58/80/A4 foram combinados sem promessa impossível.', risk: 'P1' },
  { id: 'term-backup-support', title: 'Backup, restauração e suporte combinados', detail: 'Restauração só com cuidado, suporte com canal claro e diagnóstico copiável.', risk: 'P1' },
  { id: 'term-first-day', title: 'Primeiro dia assistido planejado', detail: 'Primeira venda, caixa, crediário, pedido e comprovante serão acompanhados antes de operar sozinho.', risk: 'P2' },
  { id: 'term-limits-honest', title: 'Limites honestos registrados', detail: 'Cliente entende que venda final depende de teste real, nuvem, permissões, impressão e cache no aparelho.', risk: 'P1' },
  { id: 'term-acceptance-copy', title: 'Termo copiado/aceito', detail: 'Texto foi copiado ou aceito pelo responsável sem senha, sem chave privada e sem dados sensíveis.', risk: 'P1' },
];


const POST_SALE_SUPPORT_KEY = 'smart-loja:post-sale-support-v139';
const LEGACY_POST_SALE_SUPPORT_KEYS = ['smart-loja:post-sale-support-v138', 'smart-loja:post-sale-support-v137', 'smart-loja:post-sale-support-v136'];

const POST_SALE_SUPPORT_ITEMS: PostSaleSupportItem[] = [
  { id: 'support-channel', title: 'Canal de suporte combinado', detail: 'Registrar WhatsApp, horário, responsável e como o cliente deve enviar print/diagnóstico.', expected: 'Cliente sabe onde pedir ajuda e não manda senha ou chave privada.', priority: 'P1' },
  { id: 'first-day-review-support', title: 'Revisão do primeiro dia agendada', detail: 'Combinar horário para conferir caixa, vendas, comprovantes, pendências e dúvidas depois do primeiro uso.', expected: 'Revisão tem data, responsável e evidência copiada.', priority: 'P1' },
  { id: 'critical-ticket-rule', title: 'Regra para chamado crítico definida', detail: 'Falha em login, venda, caixa, sync, permissão ou impressão real vira P0/P1 com prazo claro.', expected: 'Nenhum problema crítico fica só em conversa solta.', priority: 'P1' },
  { id: 'client-evidence-rule', title: 'Evidência simples combinada', detail: 'Cliente sabe mandar print, aparelho usado, papel logado e texto do erro antes do suporte mexer.', expected: 'Chamado chega com informação suficiente para corrigir sem chute.', priority: 'P2' },
  { id: 'backup-before-risk', title: 'Backup antes de ação arriscada', detail: 'Antes de restaurar backup, limpar cache em massa ou alterar permissão, copiar diagnóstico e fazer backup controlado.', expected: 'Sem perda de dados por tentativa de suporte apressada.', priority: 'P1' },
  { id: 'post-sale-copy', title: 'Plano de pós-venda copiado', detail: 'Copiar o plano completo de suporte/SLA e guardar junto da proposta, termo e aceite final.', expected: 'Cliente e suporte têm o mesmo combinado.', priority: 'P2' },
];

const POST_SALE_STATUS_LABEL: Record<PostSaleTicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_client: 'Aguardando cliente',
  solved: 'Resolvido',
};


const CLIENT_FEEDBACK_KEY = 'smart-loja:client-feedback-nps-v139';
const LEGACY_CLIENT_FEEDBACK_KEYS = ['smart-loja:client-feedback-nps-v138', 'smart-loja:client-feedback-nps-v137'];


const EXECUTIVE_HEALTH_KEY = 'smart-loja:executive-health-v139';
const LEGACY_EXECUTIVE_HEALTH_KEYS = ['smart-loja:executive-health-v138'];

const CLIENT_FEEDBACK_ITEMS: ClientFeedbackItem[] = [
  { id: 'feedback-client-identified', title: 'Cliente e responsável identificados', detail: 'Registrar loja, contato e pessoa que deu a opinião depois do primeiro uso.', expected: 'Feedback não fica anônimo ou solto.', priority: 'P2' },
  { id: 'feedback-nps-score', title: 'Nota NPS coletada', detail: 'Perguntar de 0 a 10 quanto o cliente indicaria o sistema para outra loja.', expected: 'Nota registrada sem pressionar cliente.', priority: 'P2' },
  { id: 'feedback-main-pain', title: 'Dor principal registrada', detail: 'Anotar o que mais incomodou, confundiu ou atrasou o cliente no primeiro dia.', expected: 'Melhoria nasce de dor real, não de chute.', priority: 'P1' },
  { id: 'feedback-improvement-prioritized', title: 'Melhoria prioritária criada', detail: 'Transformar dor/sugestão em melhoria P0/P1/P2 com responsável, prazo e evidência.', expected: 'Existe pelo menos uma ação clara quando houver reclamação.', priority: 'P1' },
  { id: 'feedback-next-action', title: 'Próximo contato combinado', detail: 'Combinar retorno, correção ou revisão do cliente sem deixar promessa solta.', expected: 'Cliente sabe o próximo passo e prazo aproximado.', priority: 'P1' },
  { id: 'feedback-copy-report', title: 'Relatório de feedback copiado', detail: 'Copiar o resumo sem senha, sem chave privada e sem dados técnicos crus.', expected: 'Feedback fica guardado junto do pós-venda.', priority: 'P2' },
];

const CLIENT_FEEDBACK_STATUS_LABEL: Record<ClientFeedbackStatus, string> = {
  new: 'Novo',
  planned: 'Planejado',
  in_progress: 'Em execução',
  done: 'Resolvido',
};

const CLIENT_SATISFACTION_LABEL: Record<ClientSatisfaction, string> = {
  nao_informado: 'Não informado',
  ruim: 'Ruim',
  regular: 'Regular',
  bom: 'Bom',
  excelente: 'Excelente',
};

const TRAINING_DEMO_STEPS: TrainingDemoStep[] = [
  { id: 'explain-scope', title: 'Explicar modo treinamento', detail: 'Mostrar que o modo bloqueia gravações reais e serve para o cliente aprender sem mexer no caixa/estoque.', protectedArea: 'Dados reais' },
  { id: 'open-navigation', title: 'Navegar pelas abas', detail: 'Abrir Painel, Vendas, Produtos, Clientes, Caixa, Pedidos e Diagnóstico sem salvar nada.', protectedArea: 'Interface' },
  { id: 'simulate-sale', title: 'Simular venda sem finalizar', detail: 'Montar carrinho de exemplo e parar antes de Finalizar venda. A venda real fica bloqueada pelo modo treinamento.', protectedArea: 'Vendas/estoque' },
  { id: 'print-sample', title: 'Imprimir amostra segura', detail: 'Usar Teste 58mm, Teste 80mm ou A4/PDF. A amostra não baixa estoque e não abre caixa.', protectedArea: 'Impressão' },
  { id: 'disable-before-real', title: 'Desativar antes do uso real', detail: 'Antes da primeira venda verdadeira, desativar o modo e copiar a evidência do treinamento.', protectedArea: 'Operação real' },
];


const FINAL_ACCEPTANCE_KEY = 'smart-loja:final-commercial-acceptance-v139';
const LEGACY_FINAL_ACCEPTANCE_KEYS = ['smart-loja:final-commercial-acceptance-v138', 'smart-loja:final-commercial-acceptance-v137', 'smart-loja:final-commercial-acceptance-v136', 'smart-loja:final-commercial-acceptance-v135', 'smart-loja:final-commercial-acceptance-v134', 'smart-loja:final-commercial-acceptance-v133', 'smart-loja:final-commercial-acceptance-v131', 'smart-loja:final-commercial-acceptance-v130', 'smart-loja:final-commercial-acceptance-v129'];

const ASSISTED_RUN_KEY = 'smart-loja:assisted-commercial-run-v139';
const LEGACY_ASSISTED_RUN_KEYS = ['smart-loja:assisted-commercial-run-v138', 'smart-loja:assisted-commercial-run-v137', 'smart-loja:assisted-commercial-run-v136', 'smart-loja:assisted-commercial-run-v135', 'smart-loja:assisted-commercial-run-v134', 'smart-loja:assisted-commercial-run-v133', 'smart-loja:assisted-commercial-run-v131', 'smart-loja:assisted-commercial-run-v130', 'smart-loja:assisted-commercial-run-v129', 'smart-loja:assisted-commercial-run-v128', 'smart-loja:assisted-commercial-run-v127'];

const FIRST_CLIENT_ONBOARDING_KEY = 'smart-loja:first-client-onboarding-v139';
const LEGACY_FIRST_CLIENT_ONBOARDING_KEYS = ['smart-loja:first-client-onboarding-v137', 'smart-loja:first-client-onboarding-v136', 'smart-loja:first-client-onboarding-v135', 'smart-loja:first-client-onboarding-v134', 'smart-loja:first-client-onboarding-v133', 'smart-loja:first-client-onboarding-v131'];

const FIRST_CLIENT_ONBOARDING_STEPS: FirstClientOnboardingStep[] = [
  { id: 'client-briefing', phase: '1. Antes de entregar', title: 'Cliente entendeu o que o app faz', action: 'Explicar que o PWA roda no celular e no PC, sincroniza pela nuvem e precisa de internet para enviar pendências.', expected: 'Cliente sabe abrir o app, entende pendências e não confunde teste com venda real.', owner: 'Você / suporte', priority: 'P1' },
  { id: 'install-pwa-phone', phase: '2. Instalação', title: 'PWA instalado no celular principal', action: 'Abrir o link no Chrome/Android, tocar em instalar/adicionar à tela inicial e abrir pelo ícone.', expected: 'App abre em tela cheia, mostra v139 no Diagnóstico e não fica preso em cache antigo.', owner: 'Cliente com suporte', priority: 'P1' },
  { id: 'store-settings', phase: '3. Configuração da loja', title: 'Dados da loja conferidos', action: 'Conferir nome, telefone, WhatsApp, endereço, mensagem do comprovante e limite de estoque.', expected: 'Comprovante e telas mostram dados corretos da loja, sem texto de teste esquecido.', owner: 'Dono/admin', priority: 'P1' },
  { id: 'first-products-customers', phase: '4. Cadastros iniciais', title: 'Primeiros clientes e produtos cadastrados', action: 'Cadastrar 3 produtos reais e 2 clientes reais simples, com preço, estoque e telefone quando existir.', expected: 'Dados aparecem em outro aparelho e não duplicam.', owner: 'Operador com suporte', priority: 'P1' },
  { id: 'first-sale-cash', phase: '5. Primeiro dia', title: 'Primeira venda e caixa conferidos', action: 'Abrir caixa, fazer uma venda pequena, conferir estoque, comprovante e fechamento do caixa.', expected: 'Venda entra no relatório, estoque baixa certo e caixa mostra saldo explicado.', owner: 'Dono/operador', priority: 'P1' },
  { id: 'credit-order-practice', phase: '6. Treino guiado', title: 'Crediário e pedido treinados sem risco', action: 'Fazer um teste controlado de crediário/pedido e apagar/cancelar conforme regra da loja.', expected: 'Cliente entende diferença entre venda, pedido, crediário e comprovante.', owner: 'Suporte', priority: 'P2' },
  { id: 'receipt-print-share', phase: '7. Comprovante', title: 'Comprovante impresso ou compartilhado', action: 'Testar 80mm/A4/PDF/WhatsApp conforme equipamento real do cliente.', expected: 'Nome, total, forma de pagamento e dados da loja ficam visíveis.', owner: 'Cliente com suporte', priority: 'P1' },
  { id: 'backup-support', phase: '8. Segurança', title: 'Backup e suporte combinados', action: 'Explicar backup, restauração com cuidado, quem chamar no suporte e como copiar diagnóstico.', expected: 'Cliente sabe copiar diagnóstico e não restaura backup real sem orientação.', owner: 'Você / suporte', priority: 'P1' },
  { id: 'first-day-review', phase: '9. Fechamento do primeiro dia', title: 'Revisão do primeiro dia feita', action: 'Conferir vendas, caixa, clientes, produtos, pendências, relatório e dúvidas do cliente.', expected: 'Sem P0/P1 aberto e com lista curta do que ajustar no próximo lote.', owner: 'Você / cliente', priority: 'P1' },
];

const ASSISTED_REAL_STEPS: AssistedRealStep[] = [
  {
    id: 'deploy-cache-v139-real',
    phase: '1. Deploy e atualização',
    title: 'Deploy aplicado e PWA abriu v139',
    whatToDo: 'Depois do deploy, abrir o app instalado no celular, entrar em Diagnóstico Web e conferir versão/cache v139.',
    expected: 'O celular mostra a versão nova, sem tela antiga presa e sem menu cortado.',
    evidence: 'Print do Diagnóstico Web com versão/cache v139.',
    critical: true,
  },
  {
    id: 'owner-auto-test-no-danger',
    phase: '2. Dono e teste automático',
    title: 'Dono rodou teste comercial sem alerta vermelho',
    whatToDo: 'Entrar como dono, tocar em Rodar teste comercial e revisar segurança, permissões da nuvem, sincronização e atualização do app.',
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
    const normalizedId = id === 'deploy-cache-v128-real' || id === 'deploy-cache-v129-real' || id === 'deploy-cache-v130-real' || id === 'deploy-cache-v131-real' || id === 'deploy-cache-v134-real' || id === 'deploy-cache-v136-real' || id === 'deploy-cache-v137-real' ? 'deploy-cache-v139-real' : id;
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


function emptyFinalAcceptanceState(): FinalAcceptanceState {
  return { responsible: '', storeOrClient: '', note: '', acceptedAt: '', acceptedBy: '' };
}

function normalizeFinalAcceptanceState(value: unknown): FinalAcceptanceState {
  const source = value && typeof value === 'object' ? value as Partial<FinalAcceptanceState> : {};
  return {
    responsible: typeof source.responsible === 'string' ? source.responsible.slice(0, 80) : '',
    storeOrClient: typeof source.storeOrClient === 'string' ? source.storeOrClient.slice(0, 120) : '',
    note: typeof source.note === 'string' ? source.note.slice(0, 1200) : '',
    acceptedAt: typeof source.acceptedAt === 'string' ? source.acceptedAt : '',
    acceptedBy: typeof source.acceptedBy === 'string' ? source.acceptedBy.slice(0, 80) : '',
  };
}

function readFinalAcceptanceState(): FinalAcceptanceState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyFinalAcceptanceState();
  try {
    const current = normalizeFinalAcceptanceState(JSON.parse(window.localStorage.getItem(FINAL_ACCEPTANCE_KEY) || '{}'));
    if (current.acceptedAt || current.responsible || current.storeOrClient || current.note) return current;
    for (const key of LEGACY_FINAL_ACCEPTANCE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeFinalAcceptanceState(JSON.parse(raw));
      if (legacy.acceptedAt || legacy.responsible || legacy.storeOrClient || legacy.note) {
        window.localStorage.setItem(FINAL_ACCEPTANCE_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyFinalAcceptanceState();
  }
  return emptyFinalAcceptanceState();
}

function saveFinalAcceptanceState(state: FinalAcceptanceState): FinalAcceptanceState {
  const normalized = normalizeFinalAcceptanceState(state);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(FINAL_ACCEPTANCE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function starRating(score: number): string {
  if (score >= 9.5) return '★★★★★';
  if (score >= 9) return '★★★★½';
  if (score >= 8) return '★★★★☆';
  if (score >= 7) return '★★★½☆';
  return '★★★☆☆';
}

function buildFinalSellGate(params: {
  report: WebCommercialValidationReport | null;
  triage: ReturnType<typeof summarizeTriage>;
  assisted: ReturnType<typeof summarizeAssistedState>;
  guidedDone: number;
  guidedTotal: number;
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
  acceptance: FinalAcceptanceState;
}): FinalSellGate {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!params.report) blockers.push('Rodar o teste comercial automático no Diagnóstico Web.');
  else {
    if (params.report.readyLabel !== 'piloto') blockers.push(`Teste comercial ainda não liberou piloto: ${params.report.score}/10 — ${readyText(params.report)}.`);
    if (params.report.score < 8.8) blockers.push('Nota automática abaixo de 8,8/10.');
  }
  if (params.triage.p0 > 0) blockers.push(`Existem ${params.triage.p0} itens P0 críticos na correção pós-teste.`);
  if (params.triage.p1 > 0) blockers.push(`Existem ${params.triage.p1} itens P1 alto(s) antes de vender em escala.`);
  if (params.assisted.criticalProblems > 0 || params.assisted.failed > 0 || params.assisted.blocked > 0) blockers.push('Execução assistida tem Falhou/Bloqueado.');
  if (params.assisted.passed < params.assisted.total) blockers.push(`Execução assistida incompleta: ${params.assisted.passed}/${params.assisted.total}.`);
  if (params.guidedDone < params.guidedTotal) blockers.push(`Roteiro guiado incompleto: ${params.guidedDone}/${params.guidedTotal}.`);
  if (params.outbox.total > 0) blockers.push(`Ainda há ${params.outbox.total} pendência(s) neste aparelho.`);
  if (!params.online) blockers.push('Aparelho está offline agora.');
  if (params.roleState.role === 'viewer' || params.roleState.role === 'sem login') blockers.push('Aceite final precisa ser feito por dono/admin/operador autorizado, não por leitor ou sem login.');
  if (!params.acceptance.responsible.trim()) warnings.push('Informar responsável pelo aceite.');
  if (!params.acceptance.storeOrClient.trim()) warnings.push('Informar loja/cliente ou ambiente testado.');
  if (!params.acceptance.note.trim()) warnings.push('Anotar evidência curta: aparelhos, data, impressão e papel testado.');
  if (params.triage.p2 > 0) warnings.push(`Restam ${params.triage.p2} ajuste(s) P2 de acabamento/validação.`);

  const baseScore = params.report?.score ?? 0;
  const penalty = Math.min(1.8, blockers.length * 0.35 + warnings.length * 0.08);
  const score = Number(Math.max(0, Math.min(9.7, baseScore - penalty)).toFixed(1));
  if (blockers.length) {
    return {
      decision: 'blocked',
      title: 'Não vender ainda',
      subtitle: 'Existe bloqueio real. Corrija P0/P1, finalize os testes e gere nova evidência.',
      score,
      stars: starRating(score),
      tone: 'danger',
      blockers,
      warnings,
    };
  }
  if (!params.acceptance.acceptedAt) {
    return {
      decision: 'pending',
      title: 'Liberável após aceite',
      subtitle: warnings.length ? 'Sem P0/P1, mas preencha os campos e registre o aceite responsável.' : 'Sem P0/P1. Registre o aceite final para liberar venda assistida.',
      score: Number(Math.min(9.5, Math.max(score, 9.1)).toFixed(1)),
      stars: starRating(Math.min(9.5, Math.max(score, 9.1))),
      tone: warnings.length ? 'warn' : 'ok',
      blockers,
      warnings,
    };
  }
  return {
    decision: 'ready',
    title: 'Liberado para venda assistida',
    subtitle: 'Aceite final registrado. Ainda mantenha suporte próximo no primeiro cliente real.',
    score: Number(Math.min(9.6, Math.max(score, 9.3)).toFixed(1)),
    stars: starRating(Math.min(9.6, Math.max(score, 9.3))),
    tone: warnings.length ? 'warn' : 'ok',
    blockers,
    warnings,
  };
}

function buildFinalAcceptanceText(params: {
  gate: FinalSellGate;
  acceptance: FinalAcceptanceState;
  report: WebCommercialValidationReport | null;
  triage: ReturnType<typeof summarizeTriage>;
  assisted: ReturnType<typeof summarizeAssistedState>;
  guidedDone: number;
  guidedTotal: number;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const blockers = params.gate.blockers.length ? params.gate.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio P0/P1 registrado no aparelho atual.'];
  const warnings = params.gate.warnings.length ? params.gate.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso relevante registrado.'];
  return [
    'Jaque Confecções e Presentes — fechamento comercial / aceite final v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.gate.title}`,
    `Nota final: ${params.gate.score}/10 ${params.gate.stars}`,
    `Aceite registrado: ${params.acceptance.acceptedAt ? new Date(params.acceptance.acceptedAt).toLocaleString('pt-BR') : 'não registrado'}`,
    `Responsável: ${params.acceptance.responsible || params.acceptance.acceptedBy || 'não informado'}`,
    `Loja/cliente testado: ${params.acceptance.storeOrClient || params.report?.storeName || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Correção pós-teste: P0=${params.triage.p0}; P1=${params.triage.p1}; P2=${params.triage.p2}`,
    `Execução assistida: ${params.assisted.passed}/${params.assisted.total} passou; falhou=${params.assisted.failed}; bloqueado=${params.assisted.blocked}`,
    `Roteiro guiado: ${params.guidedDone}/${params.guidedTotal}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.acceptance.note ? `Observação/evidência: ${params.acceptance.note}` : 'Observação/evidência: não preenchida',
    '',
    'Bloqueios:',
    ...blockers,
    '',
    'Avisos:',
    ...warnings,
    '',
    'Observação honesta: este aceite não promete 100%. Ele registra que os testes comerciais exigidos neste aparelho foram conferidos e que não há P0/P1 aberto no momento.',
  ].join('\n');
}


function emptyOnboardingState(): FirstClientOnboardingState {
  return { doneIds: [], clientName: '', contactName: '', supportNote: '', updatedAt: '' };
}

function normalizeOnboardingState(value: unknown): FirstClientOnboardingState {
  const source = value && typeof value === 'object' ? value as Partial<FirstClientOnboardingState> : {};
  const allowed = new Set(FIRST_CLIENT_ONBOARDING_STEPS.map((step) => step.id));
  const rawDone = Array.isArray(source.doneIds) ? source.doneIds : [];
  const doneIds = Array.from(new Set(rawDone.filter((id): id is string => typeof id === 'string' && allowed.has(id))));
  return {
    doneIds,
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 120) : '',
    contactName: typeof source.contactName === 'string' ? source.contactName.slice(0, 100) : '',
    supportNote: typeof source.supportNote === 'string' ? source.supportNote.slice(0, 1200) : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readOnboardingState(): FirstClientOnboardingState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyOnboardingState();
  try {
    const current = normalizeOnboardingState(JSON.parse(window.localStorage.getItem(FIRST_CLIENT_ONBOARDING_KEY) || '{}'));
    if (current.doneIds.length || current.clientName || current.contactName || current.supportNote) return current;
    for (const key of LEGACY_FIRST_CLIENT_ONBOARDING_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeOnboardingState(JSON.parse(raw));
      if (legacy.doneIds.length || legacy.clientName || legacy.contactName || legacy.supportNote) {
        window.localStorage.setItem(FIRST_CLIENT_ONBOARDING_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyOnboardingState();
  }
  return emptyOnboardingState();
}

function saveOnboardingState(state: FirstClientOnboardingState): FirstClientOnboardingState {
  const normalized = normalizeOnboardingState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(FIRST_CLIENT_ONBOARDING_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function buildFirstClientOnboardingText(params: {
  state: FirstClientOnboardingState;
  gate: FinalSellGate;
  roleState: RoleState;
  report: WebCommercialValidationReport | null;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const total = FIRST_CLIENT_ONBOARDING_STEPS.length;
  const doneCount = params.state.doneIds.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const rows = FIRST_CLIENT_ONBOARDING_STEPS.map((step) => [
    done.has(step.id) ? '[OK]' : '[PENDENTE]',
    step.priority,
    step.phase,
    step.title,
    `Responsável: ${step.owner}`,
    `Esperado: ${step.expected}`,
  ].join(' · '));
  return [
    'Jaque Confecções e Presentes — kit de venda / onboarding do primeiro cliente v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Cliente/loja: ${params.state.clientName || params.report?.storeName || params.roleState.storeName || 'não informado'}`,
    `Contato/responsável: ${params.state.contactName || 'não informado'}`,
    `Progresso onboarding: ${doneCount}/${total} (${percent}%)`,
    `Fechamento comercial: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.supportNote ? `Observações de suporte: ${params.state.supportNote}` : 'Observações de suporte: nenhuma',
    '',
    'Passos de entrega:',
    ...rows,
    '',
    'Mensagem curta para o cliente:',
    `Olá! Seu Jaque Confecções e Presentes foi preparado para ${params.state.clientName || 'sua loja'}. No primeiro dia, use o app com acompanhamento: cadastre produtos/clientes, faça uma venda pequena, confira caixa/comprovante e me envie o diagnóstico se aparecer qualquer aviso.`,
  ].join('\n');
}


function emptyCommercialTourState(): CommercialTourState {
  return { doneIds: [], currentId: COMMERCIAL_TOUR_STEPS[0]?.id ?? '', presenter: '', audience: '', objective: '', note: '', updatedAt: '' };
}

function normalizeCommercialTourState(value: unknown): CommercialTourState {
  const source = value && typeof value === 'object' ? value as Partial<CommercialTourState> : {};
  const allowed = new Set(COMMERCIAL_TOUR_STEPS.map((step) => step.id));
  const rawDone = Array.isArray(source.doneIds) ? source.doneIds : [];
  const doneIds = Array.from(new Set(rawDone.filter((id): id is string => typeof id === 'string' && allowed.has(id))));
  const currentId = typeof source.currentId === 'string' && allowed.has(source.currentId) ? source.currentId : (COMMERCIAL_TOUR_STEPS[0]?.id ?? '');
  return {
    doneIds,
    currentId,
    presenter: typeof source.presenter === 'string' ? source.presenter.slice(0, 80) : '',
    audience: typeof source.audience === 'string' ? source.audience.slice(0, 120) : '',
    objective: typeof source.objective === 'string' ? source.objective.slice(0, 180) : '',
    note: typeof source.note === 'string' ? source.note.slice(0, 1200) : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readCommercialTourState(): CommercialTourState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyCommercialTourState();
  try {
    const current = normalizeCommercialTourState(JSON.parse(window.localStorage.getItem(COMMERCIAL_TOUR_KEY) || '{}'));
    if (current.doneIds.length || current.presenter || current.audience || current.objective || current.note) return current;
    for (const key of LEGACY_COMMERCIAL_TOUR_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeCommercialTourState(JSON.parse(raw));
      if (legacy.doneIds.length || legacy.presenter || legacy.audience || legacy.objective || legacy.note) {
        window.localStorage.setItem(COMMERCIAL_TOUR_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyCommercialTourState();
  }
  return emptyCommercialTourState();
}

function saveCommercialTourState(state: CommercialTourState): CommercialTourState {
  const normalized = normalizeCommercialTourState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(COMMERCIAL_TOUR_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function buildCommercialTourText(params: {
  state: CommercialTourState;
  demoMode: WebDemoModeState;
  trainingMode: WebTrainingModeState;
  roleState: RoleState;
  report: WebCommercialValidationReport | null;
  gate: FinalSellGate;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const total = COMMERCIAL_TOUR_STEPS.length;
  const doneCount = params.state.doneIds.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const rows = COMMERCIAL_TOUR_STEPS.map((step) => [
    done.has(step.id) ? '[OK]' : step.id === params.state.currentId ? '[ATUAL]' : '[PENDENTE]',
    `${step.order}. ${step.pageLabel}`,
    step.title,
    `Objetivo: ${step.goal}`,
    `Fala: ${step.script}`,
    `Prova: ${step.proof}`,
  ].join(' · '));
  return [
    'Jaque Confecções e Presentes — tour de apresentação comercial v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Apresentador: ${params.state.presenter || params.roleState.email || 'não informado'}`,
    `Cliente/público: ${params.state.audience || 'não informado'}`,
    `Objetivo: ${params.state.objective || 'demonstração comercial segura'}`,
    `Progresso tour: ${doneCount}/${total} (${percent}%)`,
    `Ambiente demo: ${params.demoMode.enabled ? 'ativo com dados fictícios' : 'desativado'}`,
    `Modo treinamento: ${params.trainingMode.enabled ? 'ativo com gravações reais bloqueadas' : 'desativado'}`,
    `Fechamento comercial: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.note ? `Observações: ${params.state.note}` : 'Observações: nenhuma',
    '',
    'Roteiro de apresentação:',
    ...rows,
    '',
    'Fechamento seguro: se o cliente quiser usar de verdade, desative a demo, rode teste comercial, valide dois aparelhos e registre o aceite final.',
  ].join('\n');
}


function emptyCommercialProposalState(): CommercialProposalState {
  return {
    selectedPlanId: 'standard',
    clientName: '',
    monthlyPrice: COMMERCIAL_PROPOSAL_PLANS.find((plan) => plan.id === 'standard')?.monthly ?? '',
    setupPrice: COMMERCIAL_PROPOSAL_PLANS.find((plan) => plan.id === 'standard')?.setup ?? '',
    validUntil: '',
    nextStep: 'Agendar instalação assistida e teste em dois aparelhos.',
    discountNote: '',
    notes: '',
    doneIds: [],
    updatedAt: '',
  };
}

function normalizeCommercialProposalState(value: unknown): CommercialProposalState {
  const source = value && typeof value === 'object' ? value as Partial<CommercialProposalState> : {};
  const allowedPlanIds = new Set(COMMERCIAL_PROPOSAL_PLANS.map((plan) => plan.id));
  const selectedPlanId = typeof source.selectedPlanId === 'string' && allowedPlanIds.has(source.selectedPlanId as CommercialProposalPlan['id'])
    ? source.selectedPlanId as CommercialProposalPlan['id']
    : 'standard';
  const plan = COMMERCIAL_PROPOSAL_PLANS.find((item) => item.id === selectedPlanId) ?? COMMERCIAL_PROPOSAL_PLANS[1];
  const allowedDone = new Set(COMMERCIAL_PROPOSAL_CHECKLIST.map((item) => item.id));
  const doneIds = Array.from(new Set((Array.isArray(source.doneIds) ? source.doneIds : []).filter((id): id is string => typeof id === 'string' && allowedDone.has(id))));
  return {
    selectedPlanId,
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 120) : '',
    monthlyPrice: typeof source.monthlyPrice === 'string' && source.monthlyPrice.trim() ? source.monthlyPrice.slice(0, 80) : plan.monthly,
    setupPrice: typeof source.setupPrice === 'string' && source.setupPrice.trim() ? source.setupPrice.slice(0, 80) : plan.setup,
    validUntil: typeof source.validUntil === 'string' ? source.validUntil.slice(0, 80) : '',
    nextStep: typeof source.nextStep === 'string' && source.nextStep.trim() ? source.nextStep.slice(0, 180) : 'Agendar instalação assistida e teste em dois aparelhos.',
    discountNote: typeof source.discountNote === 'string' ? source.discountNote.slice(0, 220) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1200) : '',
    doneIds,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readCommercialProposalState(): CommercialProposalState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyCommercialProposalState();
  try {
    const current = normalizeCommercialProposalState(JSON.parse(window.localStorage.getItem(COMMERCIAL_PROPOSAL_KEY) || '{}'));
    if (current.clientName || current.notes || current.doneIds.length || current.updatedAt) return current;
    for (const key of LEGACY_COMMERCIAL_PROPOSAL_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeCommercialProposalState(JSON.parse(raw));
      if (legacy.clientName || legacy.notes || legacy.doneIds.length || legacy.updatedAt) {
        window.localStorage.setItem(COMMERCIAL_PROPOSAL_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyCommercialProposalState();
  }
  return emptyCommercialProposalState();
}

function saveCommercialProposalState(state: CommercialProposalState): CommercialProposalState {
  const normalized = normalizeCommercialProposalState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(COMMERCIAL_PROPOSAL_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function buildCommercialProposalText(params: {
  state: CommercialProposalState;
  plan: CommercialProposalPlan;
  gate: FinalSellGate;
  tourPercent: number;
  onboardingPercent: number;
  report: WebCommercialValidationReport | null;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const rows = COMMERCIAL_PROPOSAL_CHECKLIST.map((item) => `${done.has(item.id) ? '[OK]' : '[PENDENTE]'} ${item.label} — ${item.detail}`);
  return [
    'Jaque Confecções e Presentes — proposta comercial / planos e benefícios v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Cliente/loja: ${params.state.clientName || params.roleState.storeName || 'não informado'}`,
    `Plano sugerido: ${params.plan.name} (${params.plan.tag})`,
    `Mensalidade: ${params.state.monthlyPrice}`,
    `Implantação: ${params.state.setupPrice}`,
    params.state.validUntil ? `Validade da proposta: ${params.state.validUntil}` : 'Validade da proposta: combinar antes de enviar',
    params.state.discountNote ? `Condição/observação comercial: ${params.state.discountNote}` : 'Condição/observação comercial: sem desconto especial registrado',
    `Indicado para: ${params.plan.idealFor}`,
    `Promessa principal: ${params.plan.promise}`,
    `Suporte: ${params.plan.support}`,
    `Fechamento técnico: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Tour comercial: ${params.tourPercent}%`,
    `Onboarding primeiro cliente: ${params.onboardingPercent}%`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    '',
    'Benefícios incluídos:',
    ...params.plan.benefits.map((item) => `- ${item}`),
    '',
    'Implantação combinada:',
    ...params.plan.delivery.map((item) => `- ${item}`),
    '',
    'Checklist comercial:',
    ...rows,
    '',
    'Próximo passo:',
    params.state.nextStep || 'Agendar instalação assistida e teste em dois aparelhos.',
    params.state.notes ? `\nObservações: ${params.state.notes}` : '',
    '',
    'Aviso honesto: proposta não substitui teste real. Antes de venda final, validar nuvem, dois aparelhos, permissões, impressão e aceite final.',
  ].filter(Boolean).join('\n');
}


function emptyImplementationTermState(): ImplementationTermState {
  return {
    clientName: '',
    responsibleName: '',
    contact: '',
    chosenPlan: 'Profissional',
    startDate: '',
    paymentSummary: '',
    supportScope: 'Implantação assistida, treinamento inicial, validação em dois aparelhos e revisão do primeiro dia.',
    clientResponsibilities: 'Informar dados corretos da loja, manter internet, testar no celular real, conferir impressão e avisar falhas antes de vender em escala.',
    limitations: 'Sistema depende de nuvem configurada, internet para sincronizar, cache atualizado no app instalado e impressora compatível/configurada no aparelho do cliente.',
    notes: '',
    acceptedBy: '',
    acceptedAt: '',
    doneIds: [],
    updatedAt: '',
  };
}

function normalizeImplementationTermState(value: unknown): ImplementationTermState {
  const source = value && typeof value === 'object' ? value as Partial<ImplementationTermState> : {};
  const allowedDone = new Set(IMPLEMENTATION_TERM_ITEMS.map((item) => item.id));
  const doneIds = Array.from(new Set((Array.isArray(source.doneIds) ? source.doneIds : []).filter((id): id is string => typeof id === 'string' && allowedDone.has(id))));
  return {
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 140) : '',
    responsibleName: typeof source.responsibleName === 'string' ? source.responsibleName.slice(0, 120) : '',
    contact: typeof source.contact === 'string' ? source.contact.slice(0, 120) : '',
    chosenPlan: typeof source.chosenPlan === 'string' && source.chosenPlan.trim() ? source.chosenPlan.slice(0, 100) : 'Profissional',
    startDate: typeof source.startDate === 'string' ? source.startDate.slice(0, 80) : '',
    paymentSummary: typeof source.paymentSummary === 'string' ? source.paymentSummary.slice(0, 220) : '',
    supportScope: typeof source.supportScope === 'string' && source.supportScope.trim() ? source.supportScope.slice(0, 520) : 'Implantação assistida, treinamento inicial, validação em dois aparelhos e revisão do primeiro dia.',
    clientResponsibilities: typeof source.clientResponsibilities === 'string' && source.clientResponsibilities.trim() ? source.clientResponsibilities.slice(0, 620) : 'Informar dados corretos da loja, manter internet, testar no celular real, conferir impressão e avisar falhas antes de vender em escala.',
    limitations: typeof source.limitations === 'string' && source.limitations.trim() ? source.limitations.slice(0, 620) : 'Sistema depende de nuvem configurada, internet para sincronizar, cache atualizado no app instalado e impressora compatível/configurada no aparelho do cliente.',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1400) : '',
    acceptedBy: typeof source.acceptedBy === 'string' ? source.acceptedBy.slice(0, 120) : '',
    acceptedAt: typeof source.acceptedAt === 'string' ? source.acceptedAt : '',
    doneIds,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readImplementationTermState(): ImplementationTermState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyImplementationTermState();
  try {
    const current = normalizeImplementationTermState(JSON.parse(window.localStorage.getItem(IMPLEMENTATION_TERM_KEY) || '{}'));
    if (current.clientName || current.responsibleName || current.notes || current.acceptedAt || current.doneIds.length || current.updatedAt) return current;
    for (const key of LEGACY_IMPLEMENTATION_TERM_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeImplementationTermState(JSON.parse(raw));
      if (legacy.clientName || legacy.responsibleName || legacy.notes || legacy.acceptedAt || legacy.doneIds.length || legacy.updatedAt) {
        window.localStorage.setItem(IMPLEMENTATION_TERM_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyImplementationTermState();
  }
  return emptyImplementationTermState();
}

function saveImplementationTermState(state: ImplementationTermState): ImplementationTermState {
  const normalized = normalizeImplementationTermState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(IMPLEMENTATION_TERM_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function buildImplementationTermText(params: {
  state: ImplementationTermState;
  proposal: CommercialProposalState;
  plan: CommercialProposalPlan;
  gate: FinalSellGate;
  termPercent: number;
  proposalPercent: number;
  onboardingPercent: number;
  report: WebCommercialValidationReport | null;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const rows = IMPLEMENTATION_TERM_ITEMS.map((item) => `${done.has(item.id) ? '[OK]' : '[PENDENTE]'} [${item.risk}] ${item.title} — ${item.detail}`);
  return [
    'Jaque Confecções e Presentes — termo simples de implantação e aceite v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Cliente/loja: ${params.state.clientName || params.proposal.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável do cliente: ${params.state.responsibleName || 'não informado'}`,
    `Contato: ${params.state.contact || 'não informado'}`,
    `Plano/condição: ${params.state.chosenPlan || params.plan.name}`,
    `Mensalidade proposta: ${params.proposal.monthlyPrice || params.plan.monthly}`,
    `Implantação proposta: ${params.proposal.setupPrice || params.plan.setup}`,
    params.state.startDate ? `Data combinada de início: ${params.state.startDate}` : 'Data combinada de início: ainda não definida',
    params.state.paymentSummary ? `Pagamento/condição: ${params.state.paymentSummary}` : 'Pagamento/condição: confirmar antes da implantação',
    '',
    'Escopo combinado:',
    params.state.supportScope,
    '',
    'Responsabilidades do cliente:',
    params.state.clientResponsibilities,
    '',
    'Limites honestos:',
    params.state.limitations,
    '',
    'Checklist do termo:',
    ...rows,
    '',
    `Progresso termo: ${params.termPercent}%`,
    `Proposta comercial: ${params.proposalPercent}%`,
    `Onboarding primeiro cliente: ${params.onboardingPercent}%`,
    `Fechamento técnico: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.acceptedAt ? `Aceite registrado por ${params.state.acceptedBy || 'responsável não informado'} em ${new Date(params.state.acceptedAt).toLocaleString('pt-BR')}` : 'Aceite: ainda não registrado',
    params.state.notes ? `\nObservações: ${params.state.notes}` : '',
    '',
    'Aviso: este é um termo operacional simples para implantação e suporte. Para contrato jurídico formal, revisar com profissional responsável antes de assinar.',
  ].filter(Boolean).join('\n');
}


function emptyPostSaleSupportState(): PostSaleSupportState {
  return {
    clientName: '',
    supportOwner: '',
    supportChannel: 'WhatsApp com horário combinado e diagnóstico copiado pelo app.',
    firstReviewDate: '',
    slaNote: 'P0: parar venda até corrigir. P1: corrigir antes de operar sozinho. P2: ajustar sem bloquear operação.',
    doneIds: [],
    tickets: [],
    updatedAt: '',
  };
}

function emptyTicketDraft(): PostSaleTicketDraft {
  return { title: '', category: 'Suporte inicial', priority: 'P1', due: '', owner: '' };
}

function normalizeTicketStatus(value: unknown): PostSaleTicketStatus {
  return value === 'in_progress' || value === 'waiting_client' || value === 'solved' ? value : 'open';
}

function normalizePostSalePriority(value: unknown): PostSalePriority {
  return value === 'P0' || value === 'P2' ? value : 'P1';
}

function normalizePostSaleSupportState(value: unknown): PostSaleSupportState {
  const source = value && typeof value === 'object' ? value as Partial<PostSaleSupportState> : {};
  const allowedDone = new Set(POST_SALE_SUPPORT_ITEMS.map((item) => item.id));
  const doneIds = Array.from(new Set((Array.isArray(source.doneIds) ? source.doneIds : []).filter((id): id is string => typeof id === 'string' && allowedDone.has(id))));
  const rawTickets = Array.isArray(source.tickets) ? source.tickets : [];
  const tickets = rawTickets
    .map((item): PostSaleSupportTicket | null => {
      const row = item && typeof item === 'object' ? item as Partial<PostSaleSupportTicket> : {};
      const title = typeof row.title === 'string' ? row.title.trim().slice(0, 160) : '';
      if (!title) return null;
      const now = new Date().toISOString();
      return {
        id: typeof row.id === 'string' && row.id ? row.id : `support-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        category: typeof row.category === 'string' ? row.category.slice(0, 80) : 'Suporte inicial',
        priority: normalizePostSalePriority(row.priority),
        status: normalizeTicketStatus(row.status),
        due: typeof row.due === 'string' ? row.due.slice(0, 80) : '',
        owner: typeof row.owner === 'string' ? row.owner.slice(0, 100) : '',
        evidence: typeof row.evidence === 'string' ? row.evidence.slice(0, 600) : '',
        notes: typeof row.notes === 'string' ? row.notes.slice(0, 900) : '',
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : now,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : now,
      };
    })
    .filter((item): item is PostSaleSupportTicket => Boolean(item));
  return {
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 140) : '',
    supportOwner: typeof source.supportOwner === 'string' ? source.supportOwner.slice(0, 120) : '',
    supportChannel: typeof source.supportChannel === 'string' && source.supportChannel.trim() ? source.supportChannel.slice(0, 260) : 'WhatsApp com horário combinado e diagnóstico copiado pelo app.',
    firstReviewDate: typeof source.firstReviewDate === 'string' ? source.firstReviewDate.slice(0, 100) : '',
    slaNote: typeof source.slaNote === 'string' && source.slaNote.trim() ? source.slaNote.slice(0, 620) : 'P0: parar venda até corrigir. P1: corrigir antes de operar sozinho. P2: ajustar sem bloquear operação.',
    doneIds,
    tickets,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readPostSaleSupportState(): PostSaleSupportState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyPostSaleSupportState();
  try {
    const current = normalizePostSaleSupportState(JSON.parse(window.localStorage.getItem(POST_SALE_SUPPORT_KEY) || '{}'));
    if (current.doneIds.length || current.tickets.length || current.clientName || current.supportOwner || current.updatedAt) return current;
    for (const key of LEGACY_POST_SALE_SUPPORT_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizePostSaleSupportState(JSON.parse(raw));
      if (legacy.doneIds.length || legacy.tickets.length || legacy.clientName || legacy.supportOwner || legacy.updatedAt) {
        window.localStorage.setItem(POST_SALE_SUPPORT_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyPostSaleSupportState();
  }
  return emptyPostSaleSupportState();
}

function savePostSaleSupportState(state: PostSaleSupportState): PostSaleSupportState {
  const normalized = normalizePostSaleSupportState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(POST_SALE_SUPPORT_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function summarizePostSaleSupport(state: PostSaleSupportState): { total: number; open: number; solved: number; criticalOpen: number; percent: number } {
  const total = state.tickets.length;
  const solved = state.tickets.filter((ticket) => ticket.status === 'solved').length;
  const open = total - solved;
  const criticalOpen = state.tickets.filter((ticket) => ticket.status !== 'solved' && (ticket.priority === 'P0' || ticket.priority === 'P1')).length;
  const checklistWeight = POST_SALE_SUPPORT_ITEMS.length;
  const ticketWeight = total || 1;
  const percent = Math.round(((state.doneIds.length + solved) / (checklistWeight + ticketWeight)) * 100);
  return { total, open, solved, criticalOpen, percent: Math.min(100, percent) };
}

function buildPostSaleSupportText(params: {
  state: PostSaleSupportState;
  summary: ReturnType<typeof summarizePostSaleSupport>;
  term: ImplementationTermState;
  proposal: CommercialProposalState;
  gate: FinalSellGate;
  report: WebCommercialValidationReport | null;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const checklistRows = POST_SALE_SUPPORT_ITEMS.map((item) => `${done.has(item.id) ? '[OK]' : '[PENDENTE]'} [${item.priority}] ${item.title} — ${item.detail}`);
  const ticketRows = params.state.tickets.length
    ? params.state.tickets.map((ticket) => [
      `[${ticket.priority}]`,
      POST_SALE_STATUS_LABEL[ticket.status],
      ticket.category,
      ticket.title,
      `Responsável: ${ticket.owner || 'não informado'}`,
      `Prazo: ${ticket.due || 'combinar'}`,
      ticket.evidence ? `Evidência: ${ticket.evidence}` : 'Evidência: pendente',
      ticket.notes ? `Nota: ${ticket.notes}` : '',
    ].filter(Boolean).join(' · '))
    : ['Nenhum chamado registrado ainda. Registre qualquer falha ou ajuste combinado no primeiro cliente.'];
  return [
    'Jaque Confecções e Presentes — pós-venda / suporte e SLA do primeiro cliente v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Cliente/loja: ${params.state.clientName || params.term.clientName || params.proposal.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável suporte: ${params.state.supportOwner || params.term.responsibleName || 'não informado'}`,
    `Canal de suporte: ${params.state.supportChannel || 'não informado'}`,
    `Revisão do primeiro dia: ${params.state.firstReviewDate || 'não agendada'}`,
    `SLA combinado: ${params.state.slaNote}`,
    `Resumo chamados: total=${params.summary.total}; abertos=${params.summary.open}; resolvidos=${params.summary.solved}; críticos abertos=${params.summary.criticalOpen}`,
    `Progresso pós-venda: ${params.summary.percent}%`,
    `Fechamento comercial: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    '',
    'Checklist do pós-venda:',
    ...checklistRows,
    '',
    'Chamados / ajustes combinados:',
    ...ticketRows,
    '',
    'Regra honesta: P0/P1 aberto não deve ficar sem responsável, prazo e evidência. Não prometa correção sem validar aparelho, papel do usuário, internet, cache e nuvem.',
  ].join('\n');
}


function emptyClientFeedbackState(): ClientFeedbackState {
  return {
    clientName: '',
    contactName: '',
    npsScore: 0,
    satisfaction: 'nao_informado',
    mainPain: '',
    suggestedImprovement: '',
    priorityFocus: '',
    testimonial: '',
    nextAction: '',
    doneIds: [],
    improvements: [],
    updatedAt: '',
  };
}

function emptyClientImprovementDraft(): ClientImprovementDraft {
  return { title: '', area: 'Experiência do cliente', priority: 'P1', impact: '', owner: '', due: '' };
}

function normalizeClientFeedbackPriority(value: unknown): ClientFeedbackPriority {
  return value === 'P0' || value === 'P2' ? value : 'P1';
}

function normalizeClientFeedbackStatus(value: unknown): ClientFeedbackStatus {
  return value === 'planned' || value === 'in_progress' || value === 'done' ? value : 'new';
}

function normalizeClientSatisfaction(value: unknown): ClientSatisfaction {
  return value === 'ruim' || value === 'regular' || value === 'bom' || value === 'excelente' ? value : 'nao_informado';
}

function normalizeNpsScore(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

function normalizeClientFeedbackState(value: unknown): ClientFeedbackState {
  const source = value && typeof value === 'object' ? value as Partial<ClientFeedbackState> : {};
  const allowedDone = new Set(CLIENT_FEEDBACK_ITEMS.map((item) => item.id));
  const doneIds = Array.from(new Set((Array.isArray(source.doneIds) ? source.doneIds : []).filter((id): id is string => typeof id === 'string' && allowedDone.has(id))));
  const rawImprovements = Array.isArray(source.improvements) ? source.improvements : [];
  const improvements = rawImprovements
    .map((item): ClientImprovementItem | null => {
      const row = item && typeof item === 'object' ? item as Partial<ClientImprovementItem> : {};
      const title = typeof row.title === 'string' ? row.title.trim().slice(0, 180) : '';
      if (!title) return null;
      const now = new Date().toISOString();
      return {
        id: typeof row.id === 'string' && row.id ? row.id : `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        area: typeof row.area === 'string' ? row.area.slice(0, 90) : 'Experiência do cliente',
        priority: normalizeClientFeedbackPriority(row.priority),
        status: normalizeClientFeedbackStatus(row.status),
        impact: typeof row.impact === 'string' ? row.impact.slice(0, 420) : '',
        owner: typeof row.owner === 'string' ? row.owner.slice(0, 120) : '',
        due: typeof row.due === 'string' ? row.due.slice(0, 100) : '',
        evidence: typeof row.evidence === 'string' ? row.evidence.slice(0, 700) : '',
        notes: typeof row.notes === 'string' ? row.notes.slice(0, 900) : '',
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : now,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : now,
      };
    })
    .filter((item): item is ClientImprovementItem => Boolean(item));
  return {
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 140) : '',
    contactName: typeof source.contactName === 'string' ? source.contactName.slice(0, 140) : '',
    npsScore: normalizeNpsScore(source.npsScore),
    satisfaction: normalizeClientSatisfaction(source.satisfaction),
    mainPain: typeof source.mainPain === 'string' ? source.mainPain.slice(0, 900) : '',
    suggestedImprovement: typeof source.suggestedImprovement === 'string' ? source.suggestedImprovement.slice(0, 900) : '',
    priorityFocus: typeof source.priorityFocus === 'string' ? source.priorityFocus.slice(0, 520) : '',
    testimonial: typeof source.testimonial === 'string' ? source.testimonial.slice(0, 900) : '',
    nextAction: typeof source.nextAction === 'string' ? source.nextAction.slice(0, 520) : '',
    doneIds,
    improvements,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readClientFeedbackState(): ClientFeedbackState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyClientFeedbackState();
  try {
    const current = normalizeClientFeedbackState(JSON.parse(window.localStorage.getItem(CLIENT_FEEDBACK_KEY) || '{}'));
    if (current.doneIds.length || current.improvements.length || current.clientName || current.mainPain || current.updatedAt) return current;
    for (const key of LEGACY_CLIENT_FEEDBACK_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeClientFeedbackState(JSON.parse(raw));
      if (legacy.doneIds.length || legacy.improvements.length || legacy.clientName || legacy.mainPain || legacy.updatedAt) {
        window.localStorage.setItem(CLIENT_FEEDBACK_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyClientFeedbackState();
  }
  return emptyClientFeedbackState();
}

function saveClientFeedbackState(state: ClientFeedbackState): ClientFeedbackState {
  const normalized = normalizeClientFeedbackState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(CLIENT_FEEDBACK_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function summarizeClientFeedback(state: ClientFeedbackState): { total: number; open: number; done: number; openP0P1: number; percent: number; npsLabel: string; tone: 'danger' | 'warn' | 'ok' } {
  const total = state.improvements.length;
  const done = state.improvements.filter((item) => item.status === 'done').length;
  const open = total - done;
  const openP0P1 = state.improvements.filter((item) => item.status !== 'done' && (item.priority === 'P0' || item.priority === 'P1')).length;
  const checklistWeight = CLIENT_FEEDBACK_ITEMS.length;
  const improvementWeight = total || 1;
  const percent = Math.min(100, Math.round(((state.doneIds.length + done) / (checklistWeight + improvementWeight)) * 100));
  const npsLabel = state.npsScore >= 9 ? 'Promotor' : state.npsScore >= 7 ? 'Neutro' : state.npsScore > 0 ? 'Detrator' : 'Sem nota';
  const tone = openP0P1 || (state.npsScore > 0 && state.npsScore <= 6) ? 'danger' : open || state.npsScore < 9 ? 'warn' : 'ok';
  return { total, open, done, openP0P1, percent, npsLabel, tone };
}

function buildClientFeedbackText(params: {
  state: ClientFeedbackState;
  summary: ReturnType<typeof summarizeClientFeedback>;
  postSale: PostSaleSupportState;
  term: ImplementationTermState;
  proposal: CommercialProposalState;
  gate: FinalSellGate;
  report: WebCommercialValidationReport | null;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const done = new Set(params.state.doneIds);
  const checklistRows = CLIENT_FEEDBACK_ITEMS.map((item) => `${done.has(item.id) ? '[OK]' : '[PENDENTE]'} [${item.priority}] ${item.title} — ${item.detail}`);
  const improvementRows = params.state.improvements.length
    ? params.state.improvements.map((item) => [
      `[${item.priority}]`,
      CLIENT_FEEDBACK_STATUS_LABEL[item.status],
      item.area,
      item.title,
      `Impacto: ${item.impact || 'não informado'}`,
      `Responsável: ${item.owner || 'não informado'}`,
      `Prazo: ${item.due || 'combinar'}`,
      item.evidence ? `Evidência: ${item.evidence}` : 'Evidência: pendente',
      item.notes ? `Nota: ${item.notes}` : '',
    ].filter(Boolean).join(' · '))
    : ['Nenhuma melhoria registrada ainda. Depois do primeiro dia, transforme dor real em ação P0/P1/P2.'];
  return [
    'Jaque Confecções e Presentes — feedback do cliente / NPS e melhorias prioritárias v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Cliente/loja: ${params.state.clientName || params.postSale.clientName || params.term.clientName || params.proposal.clientName || params.roleState.storeName || 'não informado'}`,
    `Contato/responsável: ${params.state.contactName || params.postSale.supportOwner || 'não informado'}`,
    `NPS: ${params.state.npsScore}/10 — ${params.summary.npsLabel}`,
    `Satisfação declarada: ${CLIENT_SATISFACTION_LABEL[params.state.satisfaction]}`,
    `Dor principal: ${params.state.mainPain || 'não registrada'}`,
    `Sugestão do cliente: ${params.state.suggestedImprovement || 'não registrada'}`,
    `Foco prioritário: ${params.state.priorityFocus || 'não definido'}`,
    `Próximo contato/ação: ${params.state.nextAction || 'não combinado'}`,
    `Depoimento autorizado: ${params.state.testimonial || 'não informado'}`,
    `Resumo melhorias: total=${params.summary.total}; abertas=${params.summary.open}; resolvidas=${params.summary.done}; P0/P1 abertas=${params.summary.openP0P1}`,
    `Progresso feedback: ${params.summary.percent}%`,
    `Fechamento comercial: ${params.gate.title} — ${params.gate.score}/10 ${params.gate.stars}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    '',
    'Checklist de feedback:',
    ...checklistRows,
    '',
    'Melhorias priorizadas:',
    ...improvementRows,
    '',
    'Aviso honesto: NPS e feedback não substituem teste real. P0/P1 aberto deve entrar no próximo lote antes de prometer estabilidade total ao cliente.',
  ].join('\n');
}


function emptyExecutiveHealthState(): ExecutiveHealthState {
  return {
    sponsor: '',
    clientName: '',
    scaleGoal: 'Liberar primeiro cliente assistido e decidir se pode escalar para mais lojas.',
    nextReview: '',
    notes: '',
    approvedBy: '',
    approvedAt: '',
    updatedAt: '',
  };
}

function normalizeExecutiveHealthState(value: unknown): ExecutiveHealthState {
  const source = value && typeof value === 'object' ? value as Partial<ExecutiveHealthState> : {};
  return {
    sponsor: typeof source.sponsor === 'string' ? source.sponsor.slice(0, 140) : '',
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 160) : '',
    scaleGoal: typeof source.scaleGoal === 'string' && source.scaleGoal.trim() ? source.scaleGoal.slice(0, 520) : 'Liberar primeiro cliente assistido e decidir se pode escalar para mais lojas.',
    nextReview: typeof source.nextReview === 'string' ? source.nextReview.slice(0, 120) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 900) : '',
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy.slice(0, 140) : '',
    approvedAt: typeof source.approvedAt === 'string' ? source.approvedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readExecutiveHealthState(): ExecutiveHealthState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyExecutiveHealthState();
  try {
    const current = normalizeExecutiveHealthState(JSON.parse(window.localStorage.getItem(EXECUTIVE_HEALTH_KEY) || '{}'));
    if (current.sponsor || current.clientName || current.notes || current.approvedAt || current.updatedAt) return current;
    for (const key of LEGACY_EXECUTIVE_HEALTH_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeExecutiveHealthState(JSON.parse(raw));
      if (legacy.sponsor || legacy.clientName || legacy.notes || legacy.approvedAt || legacy.updatedAt) {
        window.localStorage.setItem(EXECUTIVE_HEALTH_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyExecutiveHealthState();
  }
  return emptyExecutiveHealthState();
}

function saveExecutiveHealthState(state: ExecutiveHealthState): ExecutiveHealthState {
  const normalized = normalizeExecutiveHealthState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(EXECUTIVE_HEALTH_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function clampExecutiveScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function executiveStars(score: number): string {
  if (score >= 96) return '★★★★★';
  if (score >= 86) return '★★★★½';
  if (score >= 76) return '★★★★☆';
  if (score >= 66) return '★★★½☆';
  if (score >= 50) return '★★★☆☆';
  return '★★☆☆☆';
}

function buildExecutiveHealthSummary(params: {
  report: WebCommercialValidationReport | null;
  finalGate: FinalSellGate;
  triage: ReturnType<typeof summarizeTriage>;
  assisted: ReturnType<typeof summarizeAssistedState>;
  guidedDone: number;
  guidedTotal: number;
  tourPercent: number;
  proposalPercent: number;
  termPercent: number;
  termAccepted: boolean;
  onboardingPercent: number;
  postSale: ReturnType<typeof summarizePostSaleSupport>;
  feedback: ReturnType<typeof summarizeClientFeedback>;
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
  acceptance: FinalAcceptanceState;
  executive: ExecutiveHealthState;
}): ExecutiveHealthSummary {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const addBlocker = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  const addWarning = (condition: boolean, message: string) => { if (condition && !blockers.includes(message)) warnings.push(message); };

  addBlocker(params.triage.p0 > 0, `${params.triage.p0} itens P0 abertos na correção pós-teste.`);
  addBlocker(params.finalGate.decision === 'blocked', 'Fechamento comercial ainda bloqueado.');
  addBlocker(params.assisted.failed > 0 || params.assisted.blocked > 0, 'Execução real assistida tem Falhou/Bloqueado.');
  addBlocker(params.outbox.total > 0, `${params.outbox.total} pendência(s) local(is) ainda não enviada(s).`);
  addBlocker(!params.online, 'Este aparelho está offline agora.');
  addBlocker(params.roleState.role === 'sem login', 'Usuário sem login neste aparelho.');
  addBlocker(params.roleState.role === 'viewer', 'Leitor não deve liberar escala comercial.');

  addWarning(!params.report, 'Teste comercial automático ainda não foi rodado neste aparelho.');
  addWarning(Boolean(params.report && params.report.score < 9), 'Teste comercial automático abaixo de 9/10.');
  addWarning(params.guidedDone < params.guidedTotal, 'Roteiro guiado multiaparelho incompleto.');
  addWarning(params.tourPercent < 100, 'Tour comercial ainda não foi apresentado por completo.');
  addWarning(params.proposalPercent < 100, 'Proposta comercial ainda não está totalmente preenchida.');
  addWarning(params.termPercent < 100 || !params.termAccepted, 'Termo de implantação incompleto ou sem aceite.');
  addWarning(params.onboardingPercent < 100, 'Kit do primeiro cliente incompleto.');
  addWarning(params.postSale.criticalOpen > 0, 'Pós-venda tem chamado P0/P1 aberto.');
  addWarning(params.feedback.openP0P1 > 0, 'Feedback/NPS tem melhoria P0/P1 aberta.');
  addWarning(params.feedback.npsLabel === 'Detrator' || params.feedback.npsLabel === 'Sem nota', 'NPS baixo ou ainda sem nota do cliente.');
  addWarning(!params.acceptance.acceptedAt, 'Aceite final de venda ainda não foi registrado.');
  addWarning(!params.executive.sponsor.trim(), 'Responsável executivo pela escala ainda não informado.');

  const areas: ExecutiveHealthArea[] = [
    {
      id: 'technical-validation',
      title: 'Validação técnica',
      score: clampExecutiveScore(((params.report?.score ?? 0) * 10 + (params.finalGate.score * 10)) / 2),
      tone: params.finalGate.decision === 'blocked' || params.triage.p0 ? 'danger' : params.report && params.report.score >= 9 ? 'ok' : 'warn',
      status: params.report ? `${params.report.score}/10 no teste comercial · fechamento ${params.finalGate.score}/10` : 'Teste comercial pendente',
      evidence: params.acceptance.acceptedAt ? `Aceite final em ${formatDateTime(params.acceptance.acceptedAt)}` : 'Aceite final pendente',
      risk: params.finalGate.decision === 'blocked' ? 'Não liberar venda/escala com bloqueio.' : 'Manter evidência em dois aparelhos.',
    },
    {
      id: 'real-execution',
      title: 'Execução real e multiaparelho',
      score: clampExecutiveScore(((params.guidedDone / Math.max(1, params.guidedTotal)) * 50) + ((params.assisted.passed / Math.max(1, params.assisted.total)) * 50)),
      tone: params.assisted.failed || params.assisted.blocked || params.guidedDone < params.guidedTotal ? 'danger' : 'ok',
      status: `Roteiro ${params.guidedDone}/${params.guidedTotal} · execução passou=${params.assisted.passed}, falhou=${params.assisted.failed}, bloqueado=${params.assisted.blocked}`,
      evidence: 'Precisa de aparelho 1 + aparelho 2, owner/admin/operator/viewer e impressão real.',
      risk: 'Falha aqui vira P0/P1 antes de cliente operar sozinho.',
    },
    {
      id: 'commercial-closing',
      title: 'Fechamento comercial',
      score: clampExecutiveScore((params.tourPercent + params.proposalPercent + params.termPercent + (params.termAccepted ? 100 : 0)) / 4),
      tone: params.proposalPercent === 100 && params.termPercent === 100 && params.termAccepted ? 'ok' : 'warn',
      status: `Tour ${params.tourPercent}% · proposta ${params.proposalPercent}% · termo ${params.termPercent}% ${params.termAccepted ? 'aceito' : 'sem aceite'}`,
      evidence: 'Proposta, termo e aceite devem ficar copiados junto do cliente.',
      risk: 'Sem proposta/termo, o combinado pode ficar confuso.',
    },
    {
      id: 'customer-success',
      title: 'Cliente e pós-venda',
      score: clampExecutiveScore((params.onboardingPercent + params.postSale.percent + params.feedback.percent + (params.feedback.npsLabel === 'Promotor' ? 100 : params.feedback.npsLabel === 'Neutro' ? 75 : params.feedback.npsLabel === 'Detrator' ? 35 : 45)) / 4),
      tone: params.postSale.criticalOpen || params.feedback.openP0P1 || params.feedback.npsLabel === 'Detrator' ? 'danger' : params.onboardingPercent >= 90 && params.feedback.npsLabel === 'Promotor' ? 'ok' : 'warn',
      status: `Onboarding ${params.onboardingPercent}% · pós-venda ${params.postSale.percent}% · NPS ${params.feedback.npsLabel}`,
      evidence: `Chamados críticos abertos=${params.postSale.criticalOpen}; melhorias P0/P1 abertas=${params.feedback.openP0P1}`,
      risk: 'Sem pós-venda e NPS, escalar pode repetir falhas em novos clientes.',
    },
  ];

  const scorePenalty = blockers.length ? 18 : warnings.length ? 6 : 0;
  const score = clampExecutiveScore((areas.reduce((sum, area) => sum + area.score, 0) / areas.length) - scorePenalty);
  const decision: ExecutiveHealthDecision = blockers.length ? 'blocked' : warnings.length ? 'attention' : 'ready';
  const title = decision === 'blocked' ? 'Não escalar ainda' : decision === 'attention' ? 'Escalar só com acompanhamento' : 'Pronto para escalar com controle';
  const subtitle = decision === 'blocked'
    ? 'Existe bloqueio crítico ou operacional. Corrija antes de vender para mais clientes.'
    : decision === 'attention'
      ? 'Pode seguir com venda assistida, mas ainda há pontos para acompanhar de perto.'
      : 'Sem bloqueio crítico neste aparelho. Mantenha evidência real e suporte próximo.';
  return { score, stars: executiveStars(score), decision, title, subtitle, blockers, warnings, areas };
}

function buildExecutiveHealthText(params: {
  state: ExecutiveHealthState;
  summary: ExecutiveHealthSummary;
  proposal: CommercialProposalState;
  term: ImplementationTermState;
  postSale: PostSaleSupportState;
  feedback: ClientFeedbackState;
  report: WebCommercialValidationReport | null;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
}): string {
  const areaRows = params.summary.areas.map((area) => `[${area.tone.toUpperCase()}] ${area.title}: ${area.score}/100 — ${area.status} | Evidência: ${area.evidence} | Risco: ${area.risk}`);
  return [
    'Jaque Confecções e Presentes — painel executivo de saúde comercial v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.summary.title}`,
    `Nota executiva: ${params.summary.score}/100 ${params.summary.stars}`,
    `Cliente/loja: ${params.state.clientName || params.feedback.clientName || params.postSale.clientName || params.term.clientName || params.proposal.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável executivo: ${params.state.sponsor || 'não informado'}`,
    `Objetivo de escala: ${params.state.scaleGoal}`,
    `Próxima revisão: ${params.state.nextReview || 'não agendada'}`,
    `Aprovado por: ${params.state.approvedBy || 'não aprovado'}${params.state.approvedAt ? ` em ${formatDateTime(params.state.approvedAt)}` : ''}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.state.notes ? `Observações: ${params.state.notes}` : 'Observações: nenhuma',
    '',
    'Áreas executivas:',
    ...areaRows,
    '',
    'Bloqueios:',
    ...(params.summary.blockers.length ? params.summary.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio crítico registrado neste aparelho.']),
    '',
    'Avisos:',
    ...(params.summary.warnings.length ? params.summary.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso pendente registrado neste aparelho.']),
    '',
    'Regra honesta: este painel não substitui teste físico real. Para escalar, valide nuvem de produção, dois aparelhos, papéis, impressão, app instalado, backup e primeiro cliente acompanhado.',
  ].join('\n');
}



function emptyRegressionAuditState(): RegressionAuditState {
  return {
    results: {},
    auditor: '',
    storeOrClient: '',
    deviceA: '',
    deviceB: '',
    notes: '',
    approvedBy: '',
    approvedAt: '',
    updatedAt: '',
  };
}

function normalizeRegressionAuditResult(value: unknown): RegressionAuditResult {
  return value === 'passed' || value === 'failed' || value === 'blocked' ? value : 'pending';
}

function normalizeRegressionAuditState(value: unknown): RegressionAuditState {
  const source = value && typeof value === 'object' ? value as Partial<RegressionAuditState> : {};
  const allowed = new Set(REGRESSION_AUDIT_STEPS.map((step) => step.id));
  const rawResults = source.results && typeof source.results === 'object' ? source.results as Record<string, unknown> : {};
  const results: Record<string, RegressionAuditResult> = {};
  for (const [id, result] of Object.entries(rawResults)) {
    if (allowed.has(id)) results[id] = normalizeRegressionAuditResult(result);
  }
  return {
    results,
    auditor: typeof source.auditor === 'string' ? source.auditor.slice(0, 140) : '',
    storeOrClient: typeof source.storeOrClient === 'string' ? source.storeOrClient.slice(0, 160) : '',
    deviceA: typeof source.deviceA === 'string' ? source.deviceA.slice(0, 160) : '',
    deviceB: typeof source.deviceB === 'string' ? source.deviceB.slice(0, 160) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1400) : '',
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy.slice(0, 140) : '',
    approvedAt: typeof source.approvedAt === 'string' ? source.approvedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readRegressionAuditState(): RegressionAuditState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyRegressionAuditState();
  try {
    const current = normalizeRegressionAuditState(JSON.parse(window.localStorage.getItem(REGRESSION_AUDIT_KEY) || '{}'));
    if (Object.keys(current.results).length || current.auditor || current.storeOrClient || current.updatedAt) return current;
    for (const key of LEGACY_REGRESSION_AUDIT_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeRegressionAuditState(JSON.parse(raw));
      if (Object.keys(legacy.results).length || legacy.auditor || legacy.storeOrClient || legacy.updatedAt) {
        window.localStorage.setItem(REGRESSION_AUDIT_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyRegressionAuditState();
  }
  return emptyRegressionAuditState();
}

function saveRegressionAuditState(state: RegressionAuditState): RegressionAuditState {
  const normalized = normalizeRegressionAuditState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(REGRESSION_AUDIT_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function regressionResultLabel(result: RegressionAuditResult): string {
  if (result === 'passed') return 'Passou';
  if (result === 'failed') return 'Falhou';
  if (result === 'blocked') return 'Bloqueado';
  return 'Pendente';
}

function buildRegressionAuditSummary(params: {
  state: RegressionAuditState;
  report: WebCommercialValidationReport | null;
  finalGate: FinalSellGate;
  triage: ReturnType<typeof summarizeTriage>;
  assisted: ReturnType<typeof summarizeAssistedState>;
  executive: ExecutiveHealthSummary;
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
}): RegressionAuditSummary {
  const results = params.state.results;
  const total = REGRESSION_AUDIT_STEPS.length;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let criticalOpen = 0;
  for (const step of REGRESSION_AUDIT_STEPS) {
    const result = normalizeRegressionAuditResult(results[step.id]);
    if (result === 'passed') passed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'blocked') blocked += 1;
    if ((step.priority === 'P0' || step.priority === 'P1') && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
  }
  const pending = total - passed - failed - blocked;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const addBlocker = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  const addWarning = (condition: boolean, message: string) => { if (condition && !blockers.includes(message)) warnings.push(message); };
  addBlocker(criticalOpen > 0, `${criticalOpen} regressão(ões) P0/P1 com Falhou/Bloqueado.`);
  addBlocker(params.triage.p0 > 0, `${params.triage.p0} itens P0 ainda abertos na correção pós-teste.`);
  addBlocker(params.finalGate.decision === 'blocked', 'Fechamento comercial ainda bloqueado.');
  addBlocker(params.assisted.failed > 0 || params.assisted.blocked > 0, 'Execução real assistida tem Falhou/Bloqueado.');
  addBlocker(params.executive.decision === 'blocked', 'Painel executivo ainda não permite escalar.');
  addBlocker(params.outbox.total > 0, `${params.outbox.total} pendência(s) local(is) antes da pré-venda.`);
  addBlocker(!params.online, 'Aparelho está offline agora.');
  addBlocker(params.roleState.role === 'sem login', 'Usuário sem login confirmado.');
  addWarning(pending > 0, `${pending} itens de regressão ainda pendentes.`);
  addWarning(!params.report, 'Teste comercial automático ainda não foi rodado nesta sessão.');
  addWarning(params.roleState.role === 'viewer', 'Leitor não deve aprovar auditoria final.');
  addWarning(!params.state.auditor.trim(), 'Responsável pela auditoria ainda não informado.');
  addWarning(!params.state.deviceA.trim() || !params.state.deviceB.trim(), 'Aparelho 1 e aparelho 2 ainda não foram identificados.');
  const percent = Math.round((passed / total) * 100);
  const penalty = blockers.length * 16 + warnings.length * 3 + failed * 8 + blocked * 10 + pending * 3;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const decision: RegressionAuditDecision = blockers.length ? 'blocked' : pending || warnings.length ? 'attention' : 'ready';
  const title = decision === 'ready' ? 'Pré-venda real liberada com evidência' : decision === 'attention' ? 'Quase pronto: faltam conferências' : 'Não liberar pré-venda ainda';
  const subtitle = decision === 'ready'
    ? 'Checklist final completo neste aparelho. Ainda mantenha acompanhamento no primeiro cliente.'
    : decision === 'attention'
      ? 'Sem bloqueio crítico, mas existem pendências ou avisos antes de chamar de final.'
      : 'Existe falha crítica, bloqueio ou risco que precisa correção antes do cliente real.';
  return { passed, failed, blocked, pending, total, percent, criticalOpen, decision, title, subtitle, score, stars: executiveStars(score), blockers, warnings };
}

function buildRegressionAuditText(params: {
  state: RegressionAuditState;
  summary: RegressionAuditSummary;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const rows = REGRESSION_AUDIT_STEPS.map((step) => {
    const result = normalizeRegressionAuditResult(params.state.results[step.id]);
    return `[${regressionResultLabel(result)}] [${step.priority}] ${step.group} — ${step.title}\nAção: ${step.action}\nEsperado: ${step.expected}\nEvidência: ${step.evidence}`;
  });
  return [
    'Jaque Confecções e Presentes — auditoria final de regressão / pré-venda real v142',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.summary.title}`,
    `Nota: ${params.summary.score}/100 ${params.summary.stars}`,
    `Progresso: ${params.summary.passed}/${params.summary.total} passou; ${params.summary.failed} falhou; ${params.summary.blocked} bloqueado; ${params.summary.pending} pendente`,
    `Cliente/loja: ${params.state.storeOrClient || params.roleState.storeName || 'não informado'}`,
    `Auditor/responsável: ${params.state.auditor || 'não informado'}`,
    `Aparelho 1: ${params.state.deviceA || 'não informado'}`,
    `Aparelho 2: ${params.state.deviceB || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    `Aprovado por: ${params.state.approvedBy || 'não aprovado'}${params.state.approvedAt ? ` em ${formatDateTime(params.state.approvedAt)}` : ''}`,
    params.state.notes ? `Observações: ${params.state.notes}` : 'Observações: nenhuma',
    '',
    'Bloqueios:',
    ...(params.summary.blockers.length ? params.summary.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio crítico registrado neste aparelho.']),
    '',
    'Avisos:',
    ...(params.summary.warnings.length ? params.summary.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso pendente registrado neste aparelho.']),
    '',
    'Checklist final:',
    ...rows,
    '',
    'Regra honesta: esta auditoria não substitui teste físico real. Só marque Passou quando tiver evidência em celular, nuvem de produção, papéis, impressão, backup e dois aparelhos.',
  ].join('\n');
}

function emptyDayOneImplantState(): DayOneImplantState {
  return {
    results: {},
    clientName: '',
    implantor: '',
    storeContact: '',
    schedule: '',
    deviceA: '',
    deviceB: '',
    printer: '',
    internet: '',
    notes: '',
    acceptedBy: '',
    acceptedAt: '',
    updatedAt: '',
  };
}

function normalizeDayOneImplantResult(value: unknown): DayOneImplantResult {
  return value === 'passed' || value === 'failed' || value === 'blocked' ? value : 'pending';
}

function normalizeDayOneImplantState(value: unknown): DayOneImplantState {
  const source = value && typeof value === 'object' ? value as Partial<DayOneImplantState> : {};
  const allowed = new Set(DAY_ONE_IMPLANT_STEPS.map((step) => step.id));
  const rawResults = source.results && typeof source.results === 'object' ? source.results as Record<string, unknown> : {};
  const results: Record<string, DayOneImplantResult> = {};
  for (const [id, result] of Object.entries(rawResults)) {
    if (allowed.has(id)) results[id] = normalizeDayOneImplantResult(result);
  }
  return {
    results,
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 160) : '',
    implantor: typeof source.implantor === 'string' ? source.implantor.slice(0, 140) : '',
    storeContact: typeof source.storeContact === 'string' ? source.storeContact.slice(0, 160) : '',
    schedule: typeof source.schedule === 'string' ? source.schedule.slice(0, 160) : '',
    deviceA: typeof source.deviceA === 'string' ? source.deviceA.slice(0, 160) : '',
    deviceB: typeof source.deviceB === 'string' ? source.deviceB.slice(0, 160) : '',
    printer: typeof source.printer === 'string' ? source.printer.slice(0, 180) : '',
    internet: typeof source.internet === 'string' ? source.internet.slice(0, 180) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1600) : '',
    acceptedBy: typeof source.acceptedBy === 'string' ? source.acceptedBy.slice(0, 140) : '',
    acceptedAt: typeof source.acceptedAt === 'string' ? source.acceptedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readDayOneImplantState(): DayOneImplantState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyDayOneImplantState();
  try {
    return normalizeDayOneImplantState(JSON.parse(window.localStorage.getItem(DAY_ONE_IMPLANT_KEY) || '{}'));
  } catch {
    return emptyDayOneImplantState();
  }
}

function saveDayOneImplantState(state: DayOneImplantState): DayOneImplantState {
  const normalized = normalizeDayOneImplantState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(DAY_ONE_IMPLANT_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function dayOneResultLabel(result: DayOneImplantResult): string {
  if (result === 'passed') return 'Passou';
  if (result === 'failed') return 'Falhou';
  if (result === 'blocked') return 'Bloqueado';
  return 'Pendente';
}

function buildDayOneImplantSummary(params: {
  state: DayOneImplantState;
  report: WebCommercialValidationReport | null;
  finalGate: FinalSellGate;
  regression: RegressionAuditSummary;
  executive: ExecutiveHealthSummary;
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
}): DayOneImplantSummary {
  const total = DAY_ONE_IMPLANT_STEPS.length;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let criticalOpen = 0;
  for (const step of DAY_ONE_IMPLANT_STEPS) {
    const result = normalizeDayOneImplantResult(params.state.results[step.id]);
    if (result === 'passed') passed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'blocked') blocked += 1;
    if ((step.priority === 'P0' || step.priority === 'P1') && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
  }
  const pending = total - passed - failed - blocked;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const addBlocker = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  const addWarning = (condition: boolean, message: string) => { if (condition && !blockers.includes(message)) warnings.push(message); };
  addBlocker(criticalOpen > 0, `${criticalOpen} itens P0/P1 do Dia 1 com Falhou/Bloqueado.`);
  addBlocker(params.regression.decision === 'blocked', 'Auditoria final de regressão ainda está bloqueada.');
  addBlocker(params.finalGate.decision === 'blocked', 'Fechamento comercial ainda não liberou venda assistida.');
  addBlocker(params.executive.decision === 'blocked', 'Painel executivo ainda bloqueia escala/controlada.');
  addBlocker(params.outbox.total > 0, `${params.outbox.total} pendência(s) local(is) antes do Dia 1.`);
  addBlocker(!params.online, 'Aparelho está offline agora.');
  addBlocker(params.roleState.role === 'sem login', 'Usuário sem login confirmado.');
  addWarning(pending > 0, `${pending} itens do Dia 1 ainda pendentes.`);
  addWarning(!params.report, 'Teste comercial automático ainda não foi rodado nesta sessão.');
  addWarning(params.roleState.role === 'viewer', 'Leitor não deve aceitar implantação real.');
  addWarning(!params.state.clientName.trim(), 'Informe cliente/loja da implantação.');
  addWarning(!params.state.implantor.trim(), 'Informe responsável pela implantação.');
  addWarning(!params.state.deviceA.trim(), 'Informe aparelho principal.');
  addWarning(!params.state.printer.trim(), 'Informe impressora/formato de comprovante combinado.');
  const percent = Math.round((passed / total) * 100);
  const penalty = blockers.length * 15 + warnings.length * 3 + failed * 8 + blocked * 10 + pending * 3;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const decision: DayOneImplantDecision = blockers.length ? 'blocked' : pending || warnings.length || !params.state.acceptedAt ? 'attention' : 'ready';
  const title = decision === 'ready' ? 'Dia 1 aceito com evidência' : decision === 'attention' ? 'Dia 1 quase pronto' : 'Não iniciar cliente sozinho';
  const subtitle = decision === 'ready'
    ? 'Implantação real marcada como concluída neste aparelho. Mantenha pós-venda ativo.'
    : decision === 'attention'
      ? 'Sem bloqueio crítico, mas faltam marcações, campos ou aceite final do Dia 1.'
      : 'Existe risco operacional antes de deixar o cliente vender sozinho.';
  return { passed, failed, blocked, pending, total, percent, criticalOpen, decision, title, subtitle, score, stars: executiveStars(score), blockers, warnings };
}

function buildDayOneImplantText(params: {
  state: DayOneImplantState;
  summary: DayOneImplantSummary;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
}): string {
  const rows = DAY_ONE_IMPLANT_STEPS.map((step) => {
    const result = normalizeDayOneImplantResult(params.state.results[step.id]);
    return `[${dayOneResultLabel(result)}] [${step.priority}] ${step.phase} — ${step.title}\nAção: ${step.action}\nEsperado: ${step.expected}\nEvidência: ${step.evidence}`;
  });
  return [
    'Jaque Confecções e Presentes — checklist de implantação em cliente real / Dia 1 v141',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.summary.title}`,
    `Nota: ${params.summary.score}/100 ${params.summary.stars}`,
    `Progresso: ${params.summary.passed}/${params.summary.total} passou; ${params.summary.failed} falhou; ${params.summary.blocked} bloqueado; ${params.summary.pending} pendente`,
    `Cliente/loja: ${params.state.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável implantação: ${params.state.implantor || 'não informado'}`,
    `Contato da loja: ${params.state.storeContact || 'não informado'}`,
    `Horário combinado: ${params.state.schedule || 'não informado'}`,
    `Aparelho principal: ${params.state.deviceA || 'não informado'}`,
    `Segundo aparelho: ${params.state.deviceB || 'não informado'}`,
    `Impressora/comprovante: ${params.state.printer || 'não informado'}`,
    `Internet: ${params.state.internet || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    `Aceito por: ${params.state.acceptedBy || 'não aceito'}${params.state.acceptedAt ? ` em ${formatDateTime(params.state.acceptedAt)}` : ''}`,
    params.state.notes ? `Observações: ${params.state.notes}` : 'Observações: nenhuma',
    '',
    'Bloqueios:',
    ...(params.summary.blockers.length ? params.summary.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio crítico registrado neste aparelho.']),
    '',
    'Avisos:',
    ...(params.summary.warnings.length ? params.summary.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso pendente registrado neste aparelho.']),
    '',
    'Checklist Dia 1:',
    ...rows,
    '',
    'Regra honesta: implantação real só deve ser aceita com teste em aparelho do cliente, internet, PWA atualizado, impressão/comprovante, venda teste, sync e primeira venda acompanhada.',
  ].join('\n');
}



function emptyDayTwoFollowUpState(): DayTwoFollowUpState {
  return {
    results: {},
    clientName: '',
    supportOwner: '',
    contact: '',
    reviewDate: '',
    deviceA: '',
    deviceB: '',
    printer: '',
    mainDoubt: '',
    correctionPlan: '',
    notes: '',
    approvedBy: '',
    approvedAt: '',
    updatedAt: '',
  };
}

function normalizeDayTwoFollowUpResult(value: unknown): DayTwoFollowUpResult {
  return value === 'passed' || value === 'failed' || value === 'blocked' ? value : 'pending';
}

function normalizeDayTwoFollowUpState(value: unknown): DayTwoFollowUpState {
  const source = value && typeof value === 'object' ? value as Partial<DayTwoFollowUpState> : {};
  const allowed = new Set(DAY_TWO_FOLLOW_UP_STEPS.map((step) => step.id));
  const rawResults = source.results && typeof source.results === 'object' ? source.results as Record<string, unknown> : {};
  const results: Record<string, DayTwoFollowUpResult> = {};
  for (const [id, result] of Object.entries(rawResults)) {
    if (allowed.has(id)) results[id] = normalizeDayTwoFollowUpResult(result);
  }
  return {
    results,
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 160) : '',
    supportOwner: typeof source.supportOwner === 'string' ? source.supportOwner.slice(0, 140) : '',
    contact: typeof source.contact === 'string' ? source.contact.slice(0, 160) : '',
    reviewDate: typeof source.reviewDate === 'string' ? source.reviewDate.slice(0, 160) : '',
    deviceA: typeof source.deviceA === 'string' ? source.deviceA.slice(0, 160) : '',
    deviceB: typeof source.deviceB === 'string' ? source.deviceB.slice(0, 160) : '',
    printer: typeof source.printer === 'string' ? source.printer.slice(0, 180) : '',
    mainDoubt: typeof source.mainDoubt === 'string' ? source.mainDoubt.slice(0, 700) : '',
    correctionPlan: typeof source.correctionPlan === 'string' ? source.correctionPlan.slice(0, 1000) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1600) : '',
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy.slice(0, 140) : '',
    approvedAt: typeof source.approvedAt === 'string' ? source.approvedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readDayTwoFollowUpState(): DayTwoFollowUpState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyDayTwoFollowUpState();
  try {
    for (const key of [DAY_TWO_FOLLOW_UP_KEY, ...LEGACY_DAY_TWO_FOLLOW_UP_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (raw) return normalizeDayTwoFollowUpState(JSON.parse(raw));
    }
    return emptyDayTwoFollowUpState();
  } catch {
    return emptyDayTwoFollowUpState();
  }
}

function saveDayTwoFollowUpState(state: DayTwoFollowUpState): DayTwoFollowUpState {
  const normalized = normalizeDayTwoFollowUpState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(DAY_TWO_FOLLOW_UP_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function dayTwoResultLabel(result: DayTwoFollowUpResult): string {
  if (result === 'passed') return 'Passou';
  if (result === 'failed') return 'Falhou';
  if (result === 'blocked') return 'Bloqueado';
  return 'Pendente';
}

function buildDayTwoFollowUpSummary(params: {
  state: DayTwoFollowUpState;
  report: WebCommercialValidationReport | null;
  dayOne: DayOneImplantSummary;
  postSale: { total: number; open: number; solved: number; criticalOpen: number; percent: number };
  feedback: { total: number; open: number; done: number; openP0P1: number; percent: number; npsLabel: string; tone: 'danger' | 'warn' | 'ok' };
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
}): DayTwoFollowUpSummary {
  const total = DAY_TWO_FOLLOW_UP_STEPS.length;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let criticalOpen = 0;
  for (const step of DAY_TWO_FOLLOW_UP_STEPS) {
    const result = normalizeDayTwoFollowUpResult(params.state.results[step.id]);
    if (result === 'passed') passed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'blocked') blocked += 1;
    if ((step.priority === 'P0' || step.priority === 'P1') && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
  }
  const pending = total - passed - failed - blocked;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const addBlocker = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  const addWarning = (condition: boolean, message: string) => { if (condition && !blockers.includes(message)) warnings.push(message); };
  addBlocker(criticalOpen > 0, `${criticalOpen} itens P0/P1 do Dia 2 com Falhou/Bloqueado.`);
  addBlocker(params.dayOne.decision === 'blocked', 'Dia 1 ainda está bloqueado; não trate Dia 2 como estabilizado.');
  addBlocker(params.outbox.total > 0, `${params.outbox.total} pendência(s) local(is) antes de fechar Dia 2.`);
  addBlocker(!params.online, 'Aparelho está offline agora.');
  addBlocker(params.roleState.role === 'sem login', 'Usuário sem login confirmado.');
  addBlocker(params.postSale.criticalOpen > 0, `${params.postSale.criticalOpen} chamado(s) P0/P1 abertos no pós-venda.`);
  addBlocker(params.feedback.openP0P1 > 0, `${params.feedback.openP0P1} melhoria(s) P0/P1 aberta(s) no feedback.`);
  addWarning(pending > 0, `${pending} itens do Dia 2 ainda pendentes.`);
  addWarning(!params.report, 'Teste comercial automático ainda não foi rodado nesta sessão.');
  addWarning(params.dayOne.decision !== 'ready', 'Dia 1 não está aceito como pronto neste aparelho.');
  addWarning(params.roleState.role === 'viewer', 'Leitor não deve aprovar acompanhamento do Dia 2.');
  addWarning(!params.state.clientName.trim(), 'Informe cliente/loja acompanhado no Dia 2.');
  addWarning(!params.state.supportOwner.trim(), 'Informe responsável pelo suporte no Dia 2.');
  addWarning(!params.state.correctionPlan.trim(), 'Registre plano de correção/continuidade do Dia 2.');
  const percent = Math.round((passed / total) * 100);
  const penalty = blockers.length * 14 + warnings.length * 3 + failed * 8 + blocked * 10 + pending * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const decision: DayTwoFollowUpDecision = blockers.length ? 'blocked' : pending || warnings.length || !params.state.approvedAt ? 'attention' : 'stable';
  const title = decision === 'stable' ? 'Dia 2 estabilizado com evidência' : decision === 'attention' ? 'Dia 2 quase estabilizado' : 'Corrigir antes de deixar sozinho';
  const subtitle = decision === 'stable'
    ? 'Segundo dia acompanhado e registrado. Cliente pode continuar com suporte combinado.'
    : decision === 'attention'
      ? 'Sem bloqueio crítico, mas ainda falta marcação, evidência, plano ou aceite do Dia 2.'
      : 'Existe falha, pendência, P0/P1 aberto ou risco operacional no segundo dia.';
  return { passed, failed, blocked, pending, total, percent, criticalOpen, decision, title, subtitle, score, stars: executiveStars(score), blockers, warnings };
}

function buildDayTwoFollowUpText(params: {
  state: DayTwoFollowUpState;
  summary: DayTwoFollowUpSummary;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
  dayOne: DayOneImplantSummary;
}): string {
  const rows = DAY_TWO_FOLLOW_UP_STEPS.map((step) => {
    const result = normalizeDayTwoFollowUpResult(params.state.results[step.id]);
    return `[${dayTwoResultLabel(result)}] [${step.priority}] ${step.phase} — ${step.title}\nAção: ${step.action}\nEsperado: ${step.expected}\nEvidência: ${step.evidence}`;
  });
  return [
    'Jaque Confecções e Presentes — correção pós-implantação real / Dia 2 v142',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.summary.title}`,
    `Nota: ${params.summary.score}/100 ${params.summary.stars}`,
    `Progresso: ${params.summary.passed}/${params.summary.total} passou; ${params.summary.failed} falhou; ${params.summary.blocked} bloqueado; ${params.summary.pending} pendente`,
    `Cliente/loja: ${params.state.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável suporte: ${params.state.supportOwner || 'não informado'}`,
    `Contato: ${params.state.contact || 'não informado'}`,
    `Data/revisão: ${params.state.reviewDate || 'não informado'}`,
    `Aparelho principal: ${params.state.deviceA || 'não informado'}`,
    `Segundo aparelho: ${params.state.deviceB || 'não informado'}`,
    `Impressora/comprovante: ${params.state.printer || 'não informado'}`,
    `Dúvida principal: ${params.state.mainDoubt || 'nenhuma registrada'}`,
    `Plano de correção/continuidade: ${params.state.correctionPlan || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Dia 1: ${params.dayOne.score}/100 — ${params.dayOne.title}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    `Aprovado por: ${params.state.approvedBy || 'não aprovado'}${params.state.approvedAt ? ` em ${formatDateTime(params.state.approvedAt)}` : ''}`,
    params.state.notes ? `Observações: ${params.state.notes}` : 'Observações: nenhuma',
    '',
    'Bloqueios:',
    ...(params.summary.blockers.length ? params.summary.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio crítico registrado neste aparelho.']),
    '',
    'Avisos:',
    ...(params.summary.warnings.length ? params.summary.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso pendente registrado neste aparelho.']),
    '',
    'Checklist Dia 2:',
    ...rows,
    '',
    'Regra honesta: Dia 2 só estabiliza quando venda real, caixa, impressão, sync, permissões, dúvidas e plano de correção estiverem conferidos com evidência.',
  ].join('\n');
}

function emptyFirstClientCloseoutState(): FirstClientCloseoutState {
  return {
    results: {},
    clientName: '',
    closeOwner: '',
    contact: '',
    closeDate: '',
    referencePermission: '',
    replicationPlan: '',
    nextClientChecklist: '',
    evidenceNote: '',
    notes: '',
    approvedBy: '',
    approvedAt: '',
    updatedAt: '',
  };
}

function normalizeFirstClientCloseoutResult(value: unknown): FirstClientCloseoutResult {
  return value === 'passed' || value === 'failed' || value === 'blocked' ? value : 'pending';
}

function normalizeFirstClientCloseoutState(value: unknown): FirstClientCloseoutState {
  const source = value && typeof value === 'object' ? value as Partial<FirstClientCloseoutState> : {};
  const allowed = new Set(FIRST_CLIENT_CLOSEOUT_STEPS.map((step) => step.id));
  const rawResults = source.results && typeof source.results === 'object' ? source.results as Record<string, unknown> : {};
  const results: Record<string, FirstClientCloseoutResult> = {};
  for (const [id, result] of Object.entries(rawResults)) {
    if (allowed.has(id)) results[id] = normalizeFirstClientCloseoutResult(result);
  }
  return {
    results,
    clientName: typeof source.clientName === 'string' ? source.clientName.slice(0, 180) : '',
    closeOwner: typeof source.closeOwner === 'string' ? source.closeOwner.slice(0, 160) : '',
    contact: typeof source.contact === 'string' ? source.contact.slice(0, 160) : '',
    closeDate: typeof source.closeDate === 'string' ? source.closeDate.slice(0, 160) : '',
    referencePermission: typeof source.referencePermission === 'string' ? source.referencePermission.slice(0, 240) : '',
    replicationPlan: typeof source.replicationPlan === 'string' ? source.replicationPlan.slice(0, 1800) : '',
    nextClientChecklist: typeof source.nextClientChecklist === 'string' ? source.nextClientChecklist.slice(0, 1800) : '',
    evidenceNote: typeof source.evidenceNote === 'string' ? source.evidenceNote.slice(0, 1800) : '',
    notes: typeof source.notes === 'string' ? source.notes.slice(0, 1800) : '',
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy.slice(0, 160) : '',
    approvedAt: typeof source.approvedAt === 'string' ? source.approvedAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

function readFirstClientCloseoutState(): FirstClientCloseoutState {
  if (typeof window === 'undefined' || !window.localStorage) return emptyFirstClientCloseoutState();
  try {
    const current = normalizeFirstClientCloseoutState(JSON.parse(window.localStorage.getItem(FIRST_CLIENT_CLOSEOUT_KEY) || '{}'));
    if (current.updatedAt || current.approvedAt || current.clientName || Object.keys(current.results).length) return current;
    for (const key of LEGACY_FIRST_CLIENT_CLOSEOUT_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const legacy = normalizeFirstClientCloseoutState(JSON.parse(raw));
      if (legacy.updatedAt || legacy.approvedAt || legacy.clientName || Object.keys(legacy.results).length) {
        window.localStorage.setItem(FIRST_CLIENT_CLOSEOUT_KEY, JSON.stringify(legacy));
        return legacy;
      }
    }
  } catch {
    return emptyFirstClientCloseoutState();
  }
  return emptyFirstClientCloseoutState();
}

function saveFirstClientCloseoutState(state: FirstClientCloseoutState): FirstClientCloseoutState {
  const normalized = normalizeFirstClientCloseoutState({ ...state, updatedAt: new Date().toISOString() });
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(FIRST_CLIENT_CLOSEOUT_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function firstClientCloseoutLabel(result: FirstClientCloseoutResult): string {
  if (result === 'passed') return 'Passou';
  if (result === 'failed') return 'Falhou';
  if (result === 'blocked') return 'Bloqueado';
  return 'Pendente';
}

function buildFirstClientCloseoutSummary(params: {
  state: FirstClientCloseoutState;
  report: WebCommercialValidationReport | null;
  dayOne: DayOneImplantSummary;
  dayTwo: DayTwoFollowUpSummary;
  dayTwoState: DayTwoFollowUpState;
  regression: RegressionAuditSummary;
  executive: ExecutiveHealthSummary;
  postSale: { total: number; open: number; solved: number; criticalOpen: number; percent: number };
  feedback: { total: number; open: number; done: number; openP0P1: number; percent: number; npsLabel: string; tone: 'danger' | 'warn' | 'ok' };
  outbox: WebOutboxStats;
  online: boolean;
  roleState: RoleState;
}): FirstClientCloseoutSummary {
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let criticalOpen = 0;
  for (const step of FIRST_CLIENT_CLOSEOUT_STEPS) {
    const result = normalizeFirstClientCloseoutResult(params.state.results[step.id]);
    if (result === 'passed') passed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'blocked') blocked += 1;
    if ((step.priority === 'P0' || step.priority === 'P1') && (result === 'failed' || result === 'blocked')) criticalOpen += 1;
  }
  const total = FIRST_CLIENT_CLOSEOUT_STEPS.length;
  const pending = Math.max(0, total - passed - failed - blocked);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const addBlocker = (condition: boolean, text: string) => { if (condition) blockers.push(text); };
  const addWarning = (condition: boolean, text: string) => { if (condition) warnings.push(text); };
  addBlocker(criticalOpen > 0, `${criticalOpen} itens P0/P1 do encerramento com Falhou/Bloqueado.`);
  addBlocker(params.dayOne.decision === 'blocked', 'Dia 1 ainda está bloqueado.');
  addBlocker(params.dayTwo.decision === 'blocked', 'Dia 2 ainda está bloqueado.');
  addBlocker(!params.dayTwoState.approvedAt, 'Dia 2 ainda não foi aprovado com evidência neste aparelho.');
  addBlocker(params.regression.blockers.length > 0, 'Auditoria final ainda possui bloqueio.');
  addBlocker(params.executive.blockers.length > 0, 'Painel executivo ainda possui bloqueio.');
  addBlocker(params.postSale.criticalOpen > 0, `${params.postSale.criticalOpen} chamado(s) P0/P1 abertos no pós-venda.`);
  addBlocker(params.feedback.openP0P1 > 0, `${params.feedback.openP0P1} melhoria(s) P0/P1 aberta(s) no feedback/NPS.`);
  addBlocker(params.outbox.total > 0, `${params.outbox.total} pendência(s) local(is) antes de replicar para outro cliente.`);
  addBlocker(!params.online, 'Aparelho está offline agora.');
  addBlocker(params.roleState.role === 'sem login', 'Usuário sem login confirmado.');
  addWarning(pending > 0, `${pending} itens do encerramento ainda pendentes.`);
  addWarning(!params.report, 'Teste comercial automático ainda não foi rodado nesta sessão.');
  addWarning(params.dayOne.decision !== 'ready', 'Dia 1 não está marcado como pronto neste aparelho.');
  addWarning(params.dayTwo.decision !== 'stable', 'Dia 2 ainda não está marcado como estabilizado.');
  addWarning(params.roleState.role === 'viewer', 'Leitor não deve aprovar encerramento/replicação.');
  addWarning(!params.state.clientName.trim(), 'Informe cliente/loja do primeiro cliente.');
  addWarning(!params.state.closeOwner.trim(), 'Informe responsável pelo encerramento.');
  addWarning(!params.state.referencePermission.trim(), 'Informe se o cliente autorizou uso como referência, caso anônimo ou apenas aprendizado interno.');
  addWarning(!params.state.replicationPlan.trim(), 'Registre o plano para replicar no próximo cliente.');
  addWarning(!params.state.nextClientChecklist.trim(), 'Registre checklist do próximo cliente.');
  addWarning(!params.state.evidenceNote.trim(), 'Registre onde as evidências estão guardadas.');
  const percent = Math.round((passed / total) * 100);
  const penalty = blockers.length * 14 + warnings.length * 3 + failed * 9 + blocked * 11 + pending * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const decision: FirstClientCloseoutDecision = blockers.length ? 'blocked' : pending || warnings.length || !params.state.approvedAt ? 'attention' : 'replicable';
  const title = decision === 'replicable' ? 'Primeiro cliente encerrado e pronto para replicar' : decision === 'attention' ? 'Quase pronto para replicar' : 'Não replicar ainda';
  const subtitle = decision === 'replicable'
    ? 'Implantação, pós-venda e aprendizado foram fechados com evidência. O processo pode virar modelo para o próximo cliente.'
    : decision === 'attention'
      ? 'Sem bloqueio crítico, mas ainda falta marcação, evidência, responsável, plano ou aceite final.'
      : 'Existe bloqueio, P0/P1, pendência, offline ou risco antes de usar como modelo comercial.';
  return { passed, failed, blocked, pending, total, percent, criticalOpen, decision, title, subtitle, score, stars: executiveStars(score), blockers, warnings };
}

function buildFirstClientCloseoutText(params: {
  state: FirstClientCloseoutState;
  summary: FirstClientCloseoutSummary;
  report: WebCommercialValidationReport | null;
  snapshot: WebSyncSnapshot;
  roleState: RoleState;
  online: boolean;
  dayOne: DayOneImplantSummary;
  dayTwo: DayTwoFollowUpSummary;
  executive: ExecutiveHealthSummary;
  regression: RegressionAuditSummary;
}): string {
  const rows = FIRST_CLIENT_CLOSEOUT_STEPS.map((step) => {
    const result = normalizeFirstClientCloseoutResult(params.state.results[step.id]);
    return `[${firstClientCloseoutLabel(result)}] [${step.priority}] ${step.phase} — ${step.title}\nAção: ${step.action}\nEsperado: ${step.expected}\nEvidência: ${step.evidence}`;
  });
  return [
    'Jaque Confecções e Presentes — encerramento do primeiro cliente / pronto para replicar v144',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Decisão: ${params.summary.title}`,
    `Nota: ${params.summary.score}/100 ${params.summary.stars}`,
    `Progresso: ${params.summary.passed}/${params.summary.total} passou; ${params.summary.failed} falhou; ${params.summary.blocked} bloqueado; ${params.summary.pending} pendente`,
    `Cliente/loja: ${params.state.clientName || params.roleState.storeName || 'não informado'}`,
    `Responsável encerramento: ${params.state.closeOwner || 'não informado'}`,
    `Contato: ${params.state.contact || 'não informado'}`,
    `Data/fechamento: ${params.state.closeDate || 'não informado'}`,
    `Permissão de referência: ${params.state.referencePermission || 'não informado'}`,
    `Plano de replicação: ${params.state.replicationPlan || 'não informado'}`,
    `Checklist próximo cliente: ${params.state.nextClientChecklist || 'não informado'}`,
    `Evidências guardadas: ${params.state.evidenceNote || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Dia 1: ${params.dayOne.score}/100 — ${params.dayOne.title}`,
    `Dia 2: ${params.dayTwo.score}/100 — ${params.dayTwo.title}`,
    `Auditoria final: ${params.regression.score}/100 — ${params.regression.title}`,
    `Painel executivo: ${params.executive.score}/100 — ${params.executive.title}`,
    `Teste automático: ${params.report ? `${params.report.score}/10 — ${readyText(params.report)}` : 'ainda não rodado'}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    `Aprovado por: ${params.state.approvedBy || 'não aprovado'}${params.state.approvedAt ? ` em ${formatDateTime(params.state.approvedAt)}` : ''}`,
    params.state.notes ? `Observações: ${params.state.notes}` : 'Observações: nenhuma',
    '',
    'Bloqueios:',
    ...(params.summary.blockers.length ? params.summary.blockers.map((item) => `- ${item}`) : ['- Nenhum bloqueio crítico registrado neste aparelho.']),
    '',
    'Avisos:',
    ...(params.summary.warnings.length ? params.summary.warnings.map((item) => `- ${item}`) : ['- Nenhum aviso pendente registrado neste aparelho.']),
    '',
    'Checklist de encerramento:',
    ...rows,
    '',
    'Regra honesta: só use o primeiro cliente como modelo quando Dia 1, Dia 2, suporte, feedback, evidências e riscos estiverem fechados sem P0/P1 aberto.',
  ].join('\n');
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
    'Jaque Confecções e Presentes — plano de correção aceite v139',
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
    'Jaque Confecções e Presentes — execução real assistida v139',
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
    'Jaque Confecções e Presentes — roteiro guiado comercial v139',
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


function buildTrainingModeText(params: {
  training: WebTrainingModeState;
  roleState: RoleState;
  online: boolean;
  snapshot: WebSyncSnapshot;
  outbox: WebOutboxStats;
}): string {
  return [
    'Jaque Confecções e Presentes — modo treinamento seguro v139',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Status: ${params.training.enabled ? 'ATIVO — gravações reais bloqueadas' : 'DESATIVADO — operação real liberada conforme permissões'}`,
    `Responsável: ${params.training.responsible || 'não informado'}`,
    `Cenário: ${params.training.scenario || 'não informado'}`,
    `Papel atual: ${webRoleLabel(params.roleState.role)}`,
    `Conexão: ${params.online ? 'online' : 'offline'}`,
    `Pendências reais existentes: ${params.outbox.total}`,
    `Última sincronização: ${params.snapshot.module} — ${params.snapshot.detail}`,
    params.training.startedAt ? `Iniciado em: ${formatDateTime(params.training.startedAt)}` : 'Iniciado em: não registrado',
    params.training.note ? `Observação: ${params.training.note}` : 'Observação: não preenchida',
    '',
    'Proteção ativada quando o modo está ligado:',
    '- Bloqueia salvar cliente/produto real.',
    '- Bloqueia finalizar/cancelar venda real.',
    '- Bloqueia abrir/fechar caixa e lançar movimento real.',
    '- Bloqueia criar/alterar/cancelar pedido real.',
    '- Bloqueia receber crediário real.',
    '- Bloqueia alteração de configuração, backup/restauração e reenvio de pendências reais.',
    '- Permite navegação, leitura, diagnóstico e amostras de impressão.',
    '',
    'Para vender de verdade: desative o modo treinamento, rode Diagnóstico Web e confirme que não há P0/P1 aberto.',
  ].join('\n');
}

function reportToText(report: WebCommercialValidationReport, snapshot: WebSyncSnapshot): string {
  const lines = [
    'Jaque Confecções e Presentes — teste comercial v139',
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

export function DiagnosticsScreen({ status, onRefresh, onNavigate }: DiagnosticsScreenProps): JSX.Element {
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
  const [finalAcceptance, setFinalAcceptance] = useState<FinalAcceptanceState>(() => readFinalAcceptanceState());
  const [onboardingState, setOnboardingState] = useState<FirstClientOnboardingState>(() => readOnboardingState());
  const [trainingMode, setTrainingMode] = useState<WebTrainingModeState>(() => readWebTrainingMode());
  const [demoMode, setDemoMode] = useState<WebDemoModeState>(() => readWebDemoMode());
  const [tourState, setTourState] = useState<CommercialTourState>(() => readCommercialTourState());
  const [proposalState, setProposalState] = useState<CommercialProposalState>(() => readCommercialProposalState());
  const [termState, setTermState] = useState<ImplementationTermState>(() => readImplementationTermState());
  const [postSaleState, setPostSaleState] = useState<PostSaleSupportState>(() => readPostSaleSupportState());
  const [ticketDraft, setTicketDraft] = useState<PostSaleTicketDraft>(() => emptyTicketDraft());
  const [clientFeedbackState, setClientFeedbackState] = useState<ClientFeedbackState>(() => readClientFeedbackState());
  const [clientImprovementDraft, setClientImprovementDraft] = useState<ClientImprovementDraft>(() => emptyClientImprovementDraft());
  const [executiveHealthState, setExecutiveHealthState] = useState<ExecutiveHealthState>(() => readExecutiveHealthState());
  const [regressionAuditState, setRegressionAuditState] = useState<RegressionAuditState>(() => readRegressionAuditState());
  const [dayOneImplantState, setDayOneImplantState] = useState<DayOneImplantState>(() => readDayOneImplantState());
  const [dayTwoFollowUpState, setDayTwoFollowUpState] = useState<DayTwoFollowUpState>(() => readDayTwoFollowUpState());
  const [firstClientCloseoutState, setFirstClientCloseoutState] = useState<FirstClientCloseoutState>(() => readFirstClientCloseoutState());

  const refreshLocal = () => {
    setSnapshot(readWebSyncSnapshot());
    setOutbox(getWebOutboxStats());
    setTrainingMode(readWebTrainingMode());
    setDemoMode(readWebDemoMode());
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
    window.addEventListener('smart-loja:web-demo-mode-change', handler);
    window.addEventListener('smart-loja:web-training-mode-change', handler);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('smart-loja:web-sync-status', handler);
      window.removeEventListener('smart-loja:web-outbox-change', handler);
      window.removeEventListener('smart-loja:web-demo-mode-change', handler);
      window.removeEventListener('smart-loja:web-training-mode-change', handler);
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const capabilities = useMemo(() => getWebRoleCapabilities(roleState.role), [roleState.role]);
  const pendingItems = useMemo(() => readWebOutbox().slice(0, 6), [outbox.total]);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const demoActive = demoMode.enabled;
  const demoStatusLabel = demoActive ? 'Demo separada' : 'Dados reais';
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
  const finalGate = useMemo(() => buildFinalSellGate({ report, triage: triageSummary, assisted: assistedSummary, guidedDone: guidedDoneCount, guidedTotal: GUIDED_COMMERCIAL_STEPS.length, outbox, online, roleState, acceptance: finalAcceptance }), [report, triageSummary, assistedSummary, guidedDoneCount, outbox, online, roleState, finalAcceptance]);

  const onboardingDoneSet = useMemo(() => new Set(onboardingState.doneIds), [onboardingState.doneIds]);
  const onboardingDoneCount = onboardingState.doneIds.length;
  const onboardingPercent = Math.round((onboardingDoneCount / FIRST_CLIENT_ONBOARDING_STEPS.length) * 100);
  const onboardingGroups = useMemo(() => {
    const groups = new Map<string, FirstClientOnboardingStep[]>();
    for (const step of FIRST_CLIENT_ONBOARDING_STEPS) {
      const rows = groups.get(step.phase) ?? [];
      rows.push(step);
      groups.set(step.phase, rows);
    }
    return Array.from(groups.entries());
  }, []);

  const trainingActive = trainingMode.enabled;
  const trainingProtectionLabel = trainingActive ? 'Treinamento ativo: gravações reais bloqueadas' : 'Treinamento desligado: operação real liberada conforme permissão';
  const trainingBlockedAreas = ['Clientes', 'Produtos', 'Vendas', 'Caixa', 'Pedidos', 'Crediário', 'Configurações', 'Backup/Restauração', 'Reenvio de pendências'];
  const tourDoneSet = useMemo(() => new Set(tourState.doneIds), [tourState.doneIds]);
  const tourDoneCount = tourState.doneIds.length;
  const tourPercent = Math.round((tourDoneCount / COMMERCIAL_TOUR_STEPS.length) * 100);
  const currentTourStep = useMemo(() => COMMERCIAL_TOUR_STEPS.find((step) => step.id === tourState.currentId) ?? COMMERCIAL_TOUR_STEPS[0], [tourState.currentId]);
  const currentProposalPlan = useMemo(() => COMMERCIAL_PROPOSAL_PLANS.find((plan) => plan.id === proposalState.selectedPlanId) ?? COMMERCIAL_PROPOSAL_PLANS[1], [proposalState.selectedPlanId]);
  const proposalDoneSet = useMemo(() => new Set(proposalState.doneIds), [proposalState.doneIds]);
  const proposalDoneCount = proposalState.doneIds.length;
  const proposalPercent = Math.round((proposalDoneCount / COMMERCIAL_PROPOSAL_CHECKLIST.length) * 100);
  const termDoneSet = useMemo(() => new Set(termState.doneIds), [termState.doneIds]);
  const termDoneCount = termState.doneIds.length;
  const termPercent = Math.round((termDoneCount / IMPLEMENTATION_TERM_ITEMS.length) * 100);
  const termAccepted = Boolean(termState.acceptedAt);
  const postSaleDoneSet = useMemo(() => new Set(postSaleState.doneIds), [postSaleState.doneIds]);
  const postSaleSummary = useMemo(() => summarizePostSaleSupport(postSaleState), [postSaleState]);
  const clientFeedbackDoneSet = useMemo(() => new Set(clientFeedbackState.doneIds), [clientFeedbackState.doneIds]);
  const clientFeedbackSummary = useMemo(() => summarizeClientFeedback(clientFeedbackState), [clientFeedbackState]);
  const executiveHealthSummary = useMemo(() => buildExecutiveHealthSummary({ report, finalGate, triage: triageSummary, assisted: assistedSummary, guidedDone: guidedDoneCount, guidedTotal: GUIDED_COMMERCIAL_STEPS.length, tourPercent, proposalPercent, termPercent, termAccepted, onboardingPercent, postSale: postSaleSummary, feedback: clientFeedbackSummary, outbox, online, roleState, acceptance: finalAcceptance, executive: executiveHealthState }), [report, finalGate, triageSummary, assistedSummary, guidedDoneCount, tourPercent, proposalPercent, termPercent, termAccepted, onboardingPercent, postSaleSummary, clientFeedbackSummary, outbox, online, roleState, finalAcceptance, executiveHealthState]);
  const regressionAuditSummary = useMemo(() => buildRegressionAuditSummary({ state: regressionAuditState, report, finalGate, triage: triageSummary, assisted: assistedSummary, executive: executiveHealthSummary, outbox, online, roleState }), [regressionAuditState, report, finalGate, triageSummary, assistedSummary, executiveHealthSummary, outbox, online, roleState]);
  const dayOneImplantSummary = useMemo(() => buildDayOneImplantSummary({ state: dayOneImplantState, report, finalGate, regression: regressionAuditSummary, executive: executiveHealthSummary, outbox, online, roleState }), [dayOneImplantState, report, finalGate, regressionAuditSummary, executiveHealthSummary, outbox, online, roleState]);
  const dayTwoFollowUpSummary = useMemo(() => buildDayTwoFollowUpSummary({ state: dayTwoFollowUpState, report, dayOne: dayOneImplantSummary, postSale: postSaleSummary, feedback: clientFeedbackSummary, outbox, online, roleState }), [dayTwoFollowUpState, report, dayOneImplantSummary, postSaleSummary, clientFeedbackSummary, outbox, online, roleState]);
  const firstClientCloseoutSummary = useMemo(() => buildFirstClientCloseoutSummary({ state: firstClientCloseoutState, report, dayOne: dayOneImplantSummary, dayTwo: dayTwoFollowUpSummary, dayTwoState: dayTwoFollowUpState, regression: regressionAuditSummary, executive: executiveHealthSummary, postSale: postSaleSummary, feedback: clientFeedbackSummary, outbox, online, roleState }), [firstClientCloseoutState, report, dayOneImplantSummary, dayTwoFollowUpSummary, dayTwoFollowUpState, regressionAuditSummary, executiveHealthSummary, postSaleSummary, clientFeedbackSummary, outbox, online, roleState]);

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
    setFeedback({ tone: triageSummary.p0 ? 'error' : triageSummary.p1 ? 'info' : 'success', text: 'Plano de correção aceite copiado sem senha e sem chave privada.' });
  }

  function patchFinalAcceptance(patch: Partial<FinalAcceptanceState>): void {
    setFinalAcceptance((current) => saveFinalAcceptanceState({ ...current, ...patch }));
  }

  function registerFinalAcceptance(): void {
    if (finalGate.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Aceite bloqueado: ainda existe P0/P1, teste incompleto, pendência ou falha marcada.' });
      return;
    }
    const responsible = finalAcceptance.responsible.trim() || roleState.email || 'responsável não informado';
    const next = saveFinalAcceptanceState({ ...finalAcceptance, responsible, acceptedBy: roleState.email || responsible, acceptedAt: new Date().toISOString() });
    setFinalAcceptance(next);
    setFeedback({ tone: 'success', text: 'Aceite final registrado neste aparelho. Copie o parecer e guarde com as evidências.' });
  }

  function clearFinalAcceptance(): void {
    const ok = window.confirm('Limpar o aceite final salvo neste aparelho? Isso não apaga dados da loja.');
    if (!ok) return;
    setFinalAcceptance(saveFinalAcceptanceState(emptyFinalAcceptanceState()));
    setFeedback({ tone: 'info', text: 'Aceite final limpo neste aparelho. Dados da loja preservados.' });
  }

  async function copyFinalAcceptance(): Promise<void> {
    const text = buildFinalAcceptanceText({ gate: finalGate, acceptance: finalAcceptance, report, triage: triageSummary, assisted: assistedSummary, guidedDone: guidedDoneCount, guidedTotal: GUIDED_COMMERCIAL_STEPS.length, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: finalGate.decision === 'blocked' ? 'error' : 'success', text: 'Parecer final copiado sem senha e sem chave privada.' });
  }

  function toggleOnboardingStep(id: string): void {
    const done = new Set(onboardingState.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setOnboardingState((current) => saveOnboardingState({ ...current, doneIds: Array.from(done) }));
  }

  function patchOnboardingState(patch: Partial<FirstClientOnboardingState>): void {
    setOnboardingState((current) => saveOnboardingState({ ...current, ...patch }));
  }

  function resetOnboarding(): void {
    const ok = window.confirm('Zerar o checklist de onboarding deste aparelho? Isso não apaga clientes, vendas ou produtos.');
    if (!ok) return;
    setOnboardingState(saveOnboardingState(emptyOnboardingState()));
    setFeedback({ tone: 'info', text: 'Checklist de onboarding zerado neste aparelho. Dados da loja preservados.' });
  }

  async function copyOnboardingKit(): Promise<void> {
    const text = buildFirstClientOnboardingText({ state: onboardingState, gate: finalGate, roleState, report, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Kit do primeiro cliente copiado. Pode enviar para instalação, treinamento e suporte.' });
  }

  function patchTrainingMode(patch: Partial<WebTrainingModeState>): void {
    setTrainingMode(saveWebTrainingMode({ ...trainingMode, ...patch }));
  }

  function activateTrainingMode(): void {
    const next = setWebTrainingModeEnabled(true, {
      scenario: trainingMode.scenario || 'Treinamento com cliente / demonstração segura',
      responsible: trainingMode.responsible || roleState.email || '',
      note: trainingMode.note,
    });
    setTrainingMode(next);
    setFeedback({ tone: 'info', text: 'Modo treinamento ativado. Gravações reais ficam bloqueadas até desativar.' });
  }

  function deactivateTrainingMode(): void {
    const ok = window.confirm('Desativar o modo treinamento e liberar gravações reais conforme permissão do usuário?');
    if (!ok) return;
    const next = setWebTrainingModeEnabled(false, { note: trainingMode.note });
    setTrainingMode(next);
    setFeedback({ tone: 'success', text: 'Modo treinamento desativado. Antes de vender de verdade, rode o teste comercial e confira P0/P1.' });
  }

  async function copyTrainingMode(): Promise<void> {
    const text = buildTrainingModeText({ training: trainingMode, roleState, online, snapshot, outbox });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Orientação do modo treinamento copiada sem senha e sem chave privada.' });
  }

  function patchDemoMode(patch: Partial<WebDemoModeState>): void {
    setDemoMode(saveWebDemoMode({ ...demoMode, ...patch }));
  }

  function activateDemoMode(): void {
    const next = setWebDemoModeEnabled(true, {
      scenario: demoMode.scenario || 'Demonstração comercial com dados fictícios',
      storeName: demoMode.storeName || 'Loja Demonstração Fácil',
      responsible: demoMode.responsible || roleState.email || '',
      note: demoMode.note || 'Use este ambiente para apresentar telas sem expor clientes, vendas, caixa ou estoque real.',
    });
    setDemoMode(next);
    setTrainingMode(readWebTrainingMode());
    setFeedback({ tone: 'info', text: 'Ambiente demo ativado. O app usa dados fictícios e bloqueia gravações reais.' });
    onRefresh();
  }

  function deactivateDemoMode(): void {
    const ok = window.confirm('Sair do ambiente demo e voltar a ler os dados reais da loja? O modo treinamento pode continuar ativo para proteger gravações.');
    if (!ok) return;
    const next = setWebDemoModeEnabled(false, { note: demoMode.note });
    setDemoMode(next);
    setFeedback({ tone: 'success', text: 'Ambiente demo desativado. Toque em Puxar dados para carregar a loja real e confirme a nuvem antes de vender.' });
    onRefresh();
  }

  async function copyDemoMode(): Promise<void> {
    const lines = [
      'Jaque Confecções e Presentes — tour comercial guiado v139',
      `Status: ${demoMode.enabled ? 'ativo' : 'desativado'}`,
      `Loja demo: ${demoMode.storeName || 'Loja Demonstração Fácil'}`,
      `Cenário: ${demoMode.scenario || 'demonstração comercial'}`,
      `Responsável: ${demoMode.responsible || roleState.email || 'não informado'}`,
      `Modo treinamento: ${trainingMode.enabled ? 'ativo' : 'desativado'}`,
      `Dados reais: ${demoMode.enabled ? 'não usados nas listas enquanto a demo estiver ativa' : 'visíveis conforme login/permissão'}`,
      `Pendências locais: ${outbox.total}`,
      `Observação: ${demoMode.note || 'sem observação'}`,
      '',
      'Regra de segurança:',
      '- Demo ativa mostra clientes, produtos, vendas, caixa e comprovantes fictícios.',
      '- Demo ativa bloqueia gravações reais e não altera estoque/caixa/crediário.',
      '- Para venda verdadeira, desative a demo, confira login na nuvem e rode o teste comercial.',
    ];
    await navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Resumo do ambiente demo copiado sem dados reais, senha ou chave privada.' });
  }


  function patchTourState(patch: Partial<CommercialTourState>): void {
    setTourState((current) => saveCommercialTourState({ ...current, ...patch }));
  }

  function openTourStep(step: CommercialTourStep): void {
    const next = saveCommercialTourState({ ...tourState, currentId: step.id });
    setTourState(next);
    setFeedback({ tone: 'info', text: `Tour: ${step.title}. Abra a tela, siga a fala sugerida e marque como apresentado.` });
    onNavigate(step.page);
  }

  function toggleTourStep(id: string): void {
    const done = new Set(tourState.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    const nextId = done.has(id)
      ? (COMMERCIAL_TOUR_STEPS.find((step) => !done.has(step.id))?.id ?? id)
      : tourState.currentId;
    setTourState((current) => saveCommercialTourState({ ...current, doneIds: Array.from(done), currentId: nextId }));
  }

  function resetCommercialTour(): void {
    const ok = window.confirm('Zerar o tour comercial deste aparelho? Isso não apaga dados da loja, demo, clientes, vendas ou produtos.');
    if (!ok) return;
    setTourState(saveCommercialTourState(emptyCommercialTourState()));
    setFeedback({ tone: 'info', text: 'Tour comercial zerado neste aparelho. Dados da loja preservados.' });
  }

  function activateDemoForTour(): void {
    const next = setWebDemoModeEnabled(true, {
      scenario: 'Tour comercial guiado com dados fictícios',
      storeName: demoMode.storeName || tourState.audience || 'Loja Demonstração Fácil',
      responsible: tourState.presenter || demoMode.responsible || roleState.email || '',
      note: 'Tour guiado ativo: apresentar telas com dados fictícios, sem gravar venda, caixa, estoque ou crediário real.',
    });
    setDemoMode(next);
    setTrainingMode(readWebTrainingMode());
    setFeedback({ tone: 'info', text: 'Demo preparada para o tour. Dados fictícios ativos e gravações reais bloqueadas.' });
    onRefresh();
  }

  async function copyCommercialTour(): Promise<void> {
    const text = buildCommercialTourText({ state: tourState, demoMode, trainingMode, roleState, report, gate: finalGate, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Tour comercial copiado sem senha, sem chave privada e sem dados reais.' });
  }


  function patchProposalState(patch: Partial<CommercialProposalState>): void {
    setProposalState((current) => saveCommercialProposalState({ ...current, ...patch }));
  }

  function selectProposalPlan(plan: CommercialProposalPlan): void {
    setProposalState((current) => saveCommercialProposalState({
      ...current,
      selectedPlanId: plan.id,
      monthlyPrice: current.monthlyPrice && current.selectedPlanId === plan.id ? current.monthlyPrice : plan.monthly,
      setupPrice: current.setupPrice && current.selectedPlanId === plan.id ? current.setupPrice : plan.setup,
    }));
    setFeedback({ tone: 'info', text: `Plano ${plan.name} selecionado. Ajuste preço, implantação e próximo passo antes de copiar.` });
  }

  function toggleProposalItem(id: string): void {
    const done = new Set(proposalState.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setProposalState((current) => saveCommercialProposalState({ ...current, doneIds: Array.from(done) }));
  }

  function resetCommercialProposal(): void {
    const ok = window.confirm('Zerar a proposta comercial deste aparelho? Isso não apaga dados da loja, demo, tour ou aceite.');
    if (!ok) return;
    setProposalState(saveCommercialProposalState(emptyCommercialProposalState()));
    setFeedback({ tone: 'info', text: 'Proposta comercial zerada neste aparelho. Dados da loja preservados.' });
  }

  async function copyCommercialProposal(): Promise<void> {
    const text = buildCommercialProposalText({ state: proposalState, plan: currentProposalPlan, gate: finalGate, tourPercent, onboardingPercent, report, roleState, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Proposta comercial copiada sem senha, sem chave privada e sem termos técnicos crus.' });
  }

  function prepareProposalDemo(): void {
    const next = setWebDemoModeEnabled(true, {
      scenario: 'Proposta comercial com dados fictícios e tour guiado',
      storeName: demoMode.storeName || proposalState.clientName || tourState.audience || 'Loja Demonstração Fácil',
      responsible: tourState.presenter || proposalState.clientName || roleState.email || '',
      note: 'Demo preparada para proposta comercial: mostrar benefícios e planos sem gravar venda, caixa, estoque ou crediário real.',
    });
    setDemoMode(next);
    setTrainingMode(readWebTrainingMode());
    setFeedback({ tone: 'info', text: 'Demo preparada para apresentar a proposta. Dados fictícios ativos e gravações reais bloqueadas.' });
    onRefresh();
  }


  function patchImplementationTerm(patch: Partial<ImplementationTermState>): void {
    setTermState((current) => saveImplementationTermState({ ...current, ...patch }));
  }

  function toggleImplementationTermItem(id: string): void {
    const done = new Set(termState.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setTermState((current) => saveImplementationTermState({ ...current, doneIds: Array.from(done) }));
  }

  function registerImplementationTermAcceptance(): void {
    if (termPercent < 100) {
      setFeedback({ tone: 'error', text: 'Conclua todos os itens do termo antes de registrar aceite.' });
      return;
    }
    if (!termState.responsibleName.trim() && !termState.acceptedBy.trim()) {
      setFeedback({ tone: 'error', text: 'Informe o responsável do cliente ou quem aceitou o termo.' });
      return;
    }
    const next = saveImplementationTermState({
      ...termState,
      acceptedBy: termState.acceptedBy.trim() || termState.responsibleName.trim(),
      acceptedAt: new Date().toISOString(),
    });
    setTermState(next);
    setFeedback({ tone: 'success', text: 'Aceite do termo registrado neste aparelho. Copie o termo e guarde junto da proposta.' });
  }

  function resetImplementationTerm(): void {
    const ok = window.confirm('Zerar o termo de implantação deste aparelho? Isso não apaga proposta, loja, venda, caixa ou dados reais.');
    if (!ok) return;
    setTermState(saveImplementationTermState(emptyImplementationTermState()));
    setFeedback({ tone: 'info', text: 'Termo de implantação zerado neste aparelho. Dados da loja preservados.' });
  }

  async function copyImplementationTerm(): Promise<void> {
    const text = buildImplementationTermText({ state: termState, proposal: proposalState, plan: currentProposalPlan, gate: finalGate, termPercent, proposalPercent, onboardingPercent, report, roleState, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Termo de implantação copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }


  function patchPostSaleSupport(patch: Partial<PostSaleSupportState>): void {
    setPostSaleState((current) => savePostSaleSupportState({ ...current, ...patch }));
  }

  function togglePostSaleSupportItem(id: string): void {
    const done = new Set(postSaleState.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setPostSaleState((current) => savePostSaleSupportState({ ...current, doneIds: Array.from(done) }));
  }

  function addPostSaleTicket(): void {
    const title = ticketDraft.title.trim();
    if (!title) {
      setFeedback({ tone: 'error', text: 'Informe o título do chamado ou ajuste combinado.' });
      return;
    }
    const now = new Date().toISOString();
    const ticket: PostSaleSupportTicket = {
      id: `support-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      category: ticketDraft.category.trim() || 'Suporte inicial',
      priority: ticketDraft.priority,
      status: 'open',
      due: ticketDraft.due.trim(),
      owner: ticketDraft.owner.trim() || postSaleState.supportOwner.trim(),
      evidence: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    setPostSaleState((current) => savePostSaleSupportState({ ...current, tickets: [ticket, ...current.tickets] }));
    setTicketDraft(emptyTicketDraft());
    setFeedback({ tone: ticket.priority === 'P0' ? 'error' : 'success', text: ticket.priority === 'P0' ? 'Chamado P0 registrado. Oriente parar operação afetada até corrigir.' : 'Chamado registrado no pós-venda.' });
  }

  function updatePostSaleTicket(id: string, patch: Partial<PostSaleSupportTicket>): void {
    setPostSaleState((current) => savePostSaleSupportState({
      ...current,
      tickets: current.tickets.map((ticket) => ticket.id === id ? { ...ticket, ...patch, updatedAt: new Date().toISOString() } : ticket),
    }));
  }

  function deletePostSaleTicket(id: string): void {
    const ok = window.confirm('Remover este chamado do pós-venda neste aparelho? Use somente se foi criado por engano.');
    if (!ok) return;
    setPostSaleState((current) => savePostSaleSupportState({ ...current, tickets: current.tickets.filter((ticket) => ticket.id !== id) }));
    setFeedback({ tone: 'info', text: 'Chamado removido deste aparelho. Dados reais da loja não foram alterados.' });
  }

  function resetPostSaleSupport(): void {
    const ok = window.confirm('Zerar pós-venda/suporte deste aparelho? Isso não apaga loja, venda, caixa, termo, proposta ou dados reais.');
    if (!ok) return;
    setPostSaleState(savePostSaleSupportState(emptyPostSaleSupportState()));
    setTicketDraft(emptyTicketDraft());
    setFeedback({ tone: 'info', text: 'Pós-venda zerado neste aparelho. Dados reais preservados.' });
  }

  async function copyPostSaleSupport(): Promise<void> {
    const text = buildPostSaleSupportText({ state: postSaleState, summary: postSaleSummary, term: termState, proposal: proposalState, gate: finalGate, report, roleState, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Plano de pós-venda copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }


  function patchClientFeedback(patch: Partial<ClientFeedbackState>): void {
    setClientFeedbackState((current) => saveClientFeedbackState({ ...current, ...patch }));
  }

  function toggleClientFeedbackItem(id: string): void {
    setClientFeedbackState((current) => {
      const done = new Set(current.doneIds);
      if (done.has(id)) done.delete(id); else done.add(id);
      return saveClientFeedbackState({ ...current, doneIds: Array.from(done) });
    });
  }

  function addClientImprovement(): void {
    const title = clientImprovementDraft.title.trim();
    if (!title) {
      setFeedback({ tone: 'error', text: 'Informe o título da melhoria antes de adicionar.' });
      return;
    }
    const now = new Date().toISOString();
    const item: ClientImprovementItem = {
      id: `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      area: clientImprovementDraft.area.trim() || 'Experiência do cliente',
      priority: clientImprovementDraft.priority,
      status: 'new',
      impact: clientImprovementDraft.impact.trim(),
      owner: clientImprovementDraft.owner.trim(),
      due: clientImprovementDraft.due.trim(),
      evidence: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    setClientFeedbackState((current) => saveClientFeedbackState({ ...current, improvements: [item, ...current.improvements] }));
    setClientImprovementDraft(emptyClientImprovementDraft());
    setFeedback({ tone: 'success', text: 'Melhoria do cliente registrada com prioridade. Dados reais da loja não foram alterados.' });
  }

  function updateClientImprovement(id: string, patch: Partial<ClientImprovementItem>): void {
    setClientFeedbackState((current) => saveClientFeedbackState({
      ...current,
      improvements: current.improvements.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item),
    }));
  }

  function deleteClientImprovement(id: string): void {
    setClientFeedbackState((current) => saveClientFeedbackState({ ...current, improvements: current.improvements.filter((item) => item.id !== id) }));
    setFeedback({ tone: 'info', text: 'Melhoria removida deste aparelho. Dados reais da loja não foram alterados.' });
  }

  function resetClientFeedback(): void {
    const ok = window.confirm('Zerar feedback/NPS deste aparelho? Isso não apaga loja, venda, pós-venda, proposta, termo ou dados reais.');
    if (!ok) return;
    setClientFeedbackState(saveClientFeedbackState(emptyClientFeedbackState()));
    setClientImprovementDraft(emptyClientImprovementDraft());
    setFeedback({ tone: 'info', text: 'Feedback do cliente zerado neste aparelho. Dados reais preservados.' });
  }

  async function copyClientFeedback(): Promise<void> {
    const text = buildClientFeedbackText({ state: clientFeedbackState, summary: clientFeedbackSummary, postSale: postSaleState, term: termState, proposal: proposalState, gate: finalGate, report, roleState, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Feedback/NPS copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }


  function patchExecutiveHealth(patch: Partial<ExecutiveHealthState>): void {
    setExecutiveHealthState((current) => saveExecutiveHealthState({ ...current, ...patch }));
  }

  function approveExecutiveHealth(): void {
    if (executiveHealthSummary.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Não é seguro aprovar escala com bloqueio aberto. Corrija P0/P1, pendências, execução real ou login antes.' });
      return;
    }
    if (!executiveHealthState.sponsor.trim()) {
      setFeedback({ tone: 'error', text: 'Informe o responsável executivo antes de aprovar escala.' });
      return;
    }
    const now = new Date().toISOString();
    setExecutiveHealthState((current) => saveExecutiveHealthState({ ...current, approvedAt: now, approvedBy: current.sponsor.trim() }));
    setFeedback({ tone: executiveHealthSummary.decision === 'ready' ? 'success' : 'info', text: executiveHealthSummary.decision === 'ready' ? 'Saúde comercial aprovada para escalar com controle e evidência.' : 'Aprovado apenas com acompanhamento. Revise os avisos antes de vender para mais clientes.' });
  }

  function resetExecutiveHealth(): void {
    const ok = window.confirm('Zerar painel executivo deste aparelho? Isso não apaga proposta, termo, pós-venda, feedback, venda, caixa, estoque ou dados reais.');
    if (!ok) return;
    setExecutiveHealthState(saveExecutiveHealthState(emptyExecutiveHealthState()));
    setFeedback({ tone: 'info', text: 'Painel executivo zerado neste aparelho. Dados reais preservados.' });
  }

  async function copyExecutiveHealth(): Promise<void> {
    const text = buildExecutiveHealthText({ state: executiveHealthState, summary: executiveHealthSummary, proposal: proposalState, term: termState, postSale: postSaleState, feedback: clientFeedbackState, report, roleState, online, snapshot });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Painel executivo copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }



  function patchRegressionAudit(patch: Partial<RegressionAuditState>): void {
    setRegressionAuditState((current) => saveRegressionAuditState({ ...current, ...patch }));
  }

  function setRegressionAuditResult(id: string, result: RegressionAuditResult): void {
    setRegressionAuditState((current) => {
      const nextResults = { ...current.results };
      if (result === 'pending') delete nextResults[id];
      else nextResults[id] = result;
      return saveRegressionAuditState({ ...current, results: nextResults, approvedAt: '', approvedBy: '' });
    });
  }

  function approveRegressionAudit(): void {
    if (regressionAuditSummary.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Não dá para aprovar pré-venda com P0/P1 falhou, bloqueio, pendência local, offline ou fechamento bloqueado.' });
      return;
    }
    if (regressionAuditSummary.pending > 0) {
      setFeedback({ tone: 'info', text: 'Ainda existe item pendente. Marque Passou/Falhou/Bloqueado com evidência antes de aprovar final.' });
      return;
    }
    if (roleState.role === 'viewer') {
      setFeedback({ tone: 'error', text: 'Leitor não deve aprovar auditoria final. Use dono ou admin responsável.' });
      return;
    }
    if (!regressionAuditState.auditor.trim()) {
      setFeedback({ tone: 'info', text: 'Informe o responsável pela auditoria antes de aprovar.' });
      return;
    }
    const next = saveRegressionAuditState({ ...regressionAuditState, approvedBy: regressionAuditState.auditor.trim(), approvedAt: new Date().toISOString() });
    setRegressionAuditState(next);
    setFeedback({ tone: regressionAuditSummary.decision === 'ready' ? 'success' : 'info', text: regressionAuditSummary.decision === 'ready' ? 'Auditoria final aprovada para pré-venda real com evidência.' : 'Auditoria aprovada com avisos. Mantenha acompanhamento no primeiro cliente.' });
  }

  function resetRegressionAudit(): void {
    const ok = window.confirm('Zerar auditoria final deste aparelho? Isso não apaga venda, caixa, clientes, produtos, proposta, termo, suporte ou dados reais.');
    if (!ok) return;
    const next = saveRegressionAuditState(emptyRegressionAuditState());
    setRegressionAuditState(next);
    setFeedback({ tone: 'info', text: 'Auditoria final zerada neste aparelho. Dados reais preservados.' });
  }

  async function copyRegressionAudit(): Promise<void> {
    const text = buildRegressionAuditText({ state: regressionAuditState, summary: regressionAuditSummary, report, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text);
    setFeedback({ tone: 'success', text: 'Auditoria final copiada sem senha, sem chave privada e sem dados técnicos crus.' });
  }


  function patchDayOneImplant(patch: Partial<DayOneImplantState>): void {
    setDayOneImplantState((current) => saveDayOneImplantState({ ...current, ...patch }));
  }

  function setDayOneImplantResult(id: string, result: DayOneImplantResult): void {
    setDayOneImplantState((current) => {
      const nextResults = { ...current.results };
      if (result === 'pending') delete nextResults[id];
      else nextResults[id] = result;
      return saveDayOneImplantState({ ...current, results: nextResults, acceptedAt: '', acceptedBy: '' });
    });
  }

  function approveDayOneImplant(): void {
    if (dayOneImplantSummary.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Não dá para aceitar Dia 1 com falha crítica, pendência local, offline, fechamento bloqueado ou auditoria bloqueada.' });
      return;
    }
    if (dayOneImplantSummary.pending > 0) {
      setFeedback({ tone: 'info', text: 'Ainda existe item pendente no Dia 1. Marque Passou/Falhou/Bloqueado com evidência antes do aceite.' });
      return;
    }
    if (roleState.role === 'viewer') {
      setFeedback({ tone: 'error', text: 'Leitor não deve aceitar implantação real. Use dono/admin/responsável autorizado.' });
      return;
    }
    const acceptedBy = dayOneImplantState.implantor.trim() || dayOneImplantState.storeContact.trim();
    if (!acceptedBy) {
      setFeedback({ tone: 'info', text: 'Informe responsável pela implantação ou contato da loja antes de aceitar Dia 1.' });
      return;
    }
    const next = saveDayOneImplantState({ ...dayOneImplantState, acceptedBy, acceptedAt: new Date().toISOString() });
    setDayOneImplantState(next);
    setFeedback({ tone: dayOneImplantSummary.decision === 'ready' ? 'success' : 'info', text: 'Dia 1 aceito com evidência neste aparelho. Mantenha pós-venda e revisão do primeiro dia.' });
  }

  function resetDayOneImplant(): void {
    const ok = window.confirm('Zerar checklist Dia 1 deste aparelho? Isso não apaga venda, caixa, clientes, produtos, proposta, termo, suporte ou dados reais.');
    if (!ok) return;
    const next = saveDayOneImplantState(emptyDayOneImplantState());
    setDayOneImplantState(next);
    setFeedback({ tone: 'info', text: 'Checklist Dia 1 zerado neste aparelho. Dados reais preservados.' });
  }

  async function copyDayOneImplant(): Promise<void> {
    const text = buildDayOneImplantText({ state: dayOneImplantState, summary: dayOneImplantSummary, report, snapshot, roleState, online });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Checklist Dia 1 copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }

  function patchDayTwoFollowUp(patch: Partial<DayTwoFollowUpState>): void {
    setDayTwoFollowUpState((current) => saveDayTwoFollowUpState({ ...current, ...patch }));
  }

  function setDayTwoFollowUpResult(id: string, result: DayTwoFollowUpResult): void {
    setDayTwoFollowUpState((current) => {
      const nextResults = { ...current.results };
      if (result === 'pending') delete nextResults[id];
      else nextResults[id] = result;
      return saveDayTwoFollowUpState({ ...current, results: nextResults, approvedAt: '', approvedBy: '' });
    });
  }

  function approveDayTwoFollowUp(): void {
    if (dayTwoFollowUpSummary.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Dia 2 ainda tem bloqueio P0/P1, pendência local, offline ou risco de suporte. Corrija antes de aprovar.' });
      return;
    }
    if (dayTwoFollowUpSummary.pending > 0) {
      const ok = window.confirm('Ainda existe item pendente no Dia 2. Registrar mesmo assim como acompanhamento com atenção?');
      if (!ok) return;
    }
    const approvedBy = dayTwoFollowUpState.supportOwner.trim() || dayTwoFollowUpState.contact.trim();
    if (!approvedBy) {
      setFeedback({ tone: 'error', text: 'Informe o responsável pelo suporte ou contato antes de aprovar o Dia 2.' });
      return;
    }
    const next = saveDayTwoFollowUpState({ ...dayTwoFollowUpState, approvedBy, approvedAt: new Date().toISOString() });
    setDayTwoFollowUpState(next);
    setFeedback({ tone: dayTwoFollowUpSummary.decision === 'stable' ? 'success' : 'info', text: 'Dia 2 registrado com evidência neste aparelho. Guarde o relatório junto do pós-venda.' });
  }

  function resetDayTwoFollowUp(): void {
    const ok = window.confirm('Zerar apenas o checklist do Dia 2 neste aparelho? Isso não apaga venda, caixa, estoque nem dados da loja.');
    if (!ok) return;
    const next = saveDayTwoFollowUpState(emptyDayTwoFollowUpState());
    setDayTwoFollowUpState(next);
    setFeedback({ tone: 'info', text: 'Checklist do Dia 2 zerado neste aparelho.' });
  }

  async function copyDayTwoFollowUp(): Promise<void> {
    const text = buildDayTwoFollowUpText({ state: dayTwoFollowUpState, summary: dayTwoFollowUpSummary, report, snapshot, roleState, online, dayOne: dayOneImplantSummary });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Relatório do Dia 2 copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }

  function patchFirstClientCloseout(patch: Partial<FirstClientCloseoutState>): void {
    setFirstClientCloseoutState((current) => saveFirstClientCloseoutState({ ...current, ...patch }));
  }

  function setFirstClientCloseoutResult(id: string, result: FirstClientCloseoutResult): void {
    setFirstClientCloseoutState((current) => {
      const nextResults = { ...current.results };
      if (result === 'pending') delete nextResults[id];
      else nextResults[id] = result;
      return saveFirstClientCloseoutState({ ...current, results: nextResults, approvedAt: '', approvedBy: '' });
    });
  }

  function approveFirstClientCloseout(): void {
    if (firstClientCloseoutSummary.decision === 'blocked') {
      setFeedback({ tone: 'error', text: 'Não dá para encerrar e replicar com P0/P1, Dia 2 bloqueado, pendência local, offline ou risco aberto.' });
      return;
    }
    if (firstClientCloseoutSummary.pending > 0) {
      setFeedback({ tone: 'info', text: 'Ainda existe item pendente no encerramento. Marque Passou/Falhou/Bloqueado com evidência antes de aprovar.' });
      return;
    }
    if (roleState.role === 'viewer') {
      setFeedback({ tone: 'error', text: 'Leitor não deve aprovar encerramento comercial. Use dono/admin/responsável autorizado.' });
      return;
    }
    const approvedBy = firstClientCloseoutState.closeOwner.trim() || firstClientCloseoutState.contact.trim();
    if (!approvedBy) {
      setFeedback({ tone: 'info', text: 'Informe responsável pelo encerramento ou contato da loja antes de aprovar.' });
      return;
    }
    const next = saveFirstClientCloseoutState({ ...firstClientCloseoutState, approvedBy, approvedAt: new Date().toISOString() });
    setFirstClientCloseoutState(next);
    setFeedback({ tone: firstClientCloseoutSummary.decision === 'replicable' ? 'success' : 'info', text: 'Encerramento do primeiro cliente registrado. Copie o relatório e use como modelo para o próximo cliente.' });
  }

  function resetFirstClientCloseout(): void {
    const ok = window.confirm('Zerar encerramento do primeiro cliente neste aparelho? Isso não apaga venda, caixa, estoque, proposta, termo, Dia 1, Dia 2 ou dados reais.');
    if (!ok) return;
    const next = saveFirstClientCloseoutState(emptyFirstClientCloseoutState());
    setFirstClientCloseoutState(next);
    setFeedback({ tone: 'info', text: 'Encerramento do primeiro cliente zerado neste aparelho. Dados reais preservados.' });
  }

  async function copyFirstClientCloseout(): Promise<void> {
    const text = buildFirstClientCloseoutText({ state: firstClientCloseoutState, summary: firstClientCloseoutSummary, report, snapshot, roleState, online, dayOne: dayOneImplantSummary, dayTwo: dayTwoFollowUpSummary, executive: executiveHealthSummary, regression: regressionAuditSummary });
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'success', text: 'Encerramento do primeiro cliente copiado sem senha, sem chave privada e sem dados técnicos crus.' });
  }

  async function copyDiagnostic(): Promise<void> {
    const text = report
      ? `${reportToText(report, snapshot)}\n\n${buildGuidedTestText({ doneIds: guidedDoneIds, report, snapshot, roleState, online })}\n\n${buildAssistedExecutionText({ state: assistedState, report, snapshot, roleState, online })}\n\n${buildTriageText({ items: triageItems, state: assistedState, report, snapshot, roleState, online })}

${buildFinalAcceptanceText({ gate: finalGate, acceptance: finalAcceptance, report, triage: triageSummary, assisted: assistedSummary, guidedDone: guidedDoneCount, guidedTotal: GUIDED_COMMERCIAL_STEPS.length, snapshot, roleState, online })}

${buildFirstClientOnboardingText({ state: onboardingState, gate: finalGate, roleState, report, online, snapshot })}

${buildCommercialTourText({ state: tourState, demoMode, trainingMode, roleState, report, gate: finalGate, online, snapshot })}

${buildCommercialProposalText({ state: proposalState, plan: currentProposalPlan, gate: finalGate, tourPercent, onboardingPercent, report, roleState, online, snapshot })}

${buildImplementationTermText({ state: termState, proposal: proposalState, plan: currentProposalPlan, gate: finalGate, termPercent, proposalPercent, onboardingPercent, report, roleState, online, snapshot })}

${buildPostSaleSupportText({ state: postSaleState, summary: postSaleSummary, term: termState, proposal: proposalState, gate: finalGate, report, roleState, online, snapshot })}

${buildClientFeedbackText({ state: clientFeedbackState, summary: clientFeedbackSummary, postSale: postSaleState, term: termState, proposal: proposalState, gate: finalGate, report, roleState, online, snapshot })}

${buildExecutiveHealthText({ state: executiveHealthState, summary: executiveHealthSummary, proposal: proposalState, term: termState, postSale: postSaleState, feedback: clientFeedbackState, report, roleState, online, snapshot })}

${buildRegressionAuditText({ state: regressionAuditState, summary: regressionAuditSummary, report, snapshot, roleState, online })}

${buildDayOneImplantText({ state: dayOneImplantState, summary: dayOneImplantSummary, report, snapshot, roleState, online })}

${buildDayTwoFollowUpText({ state: dayTwoFollowUpState, summary: dayTwoFollowUpSummary, report, snapshot, roleState, online, dayOne: dayOneImplantSummary })}

${buildFirstClientCloseoutText({ state: firstClientCloseoutState, summary: firstClientCloseoutSummary, report, snapshot, roleState, online, dayOne: dayOneImplantSummary, dayTwo: dayTwoFollowUpSummary, executive: executiveHealthSummary, regression: regressionAuditSummary })}

${buildTrainingModeText({ training: trainingMode, roleState, online, snapshot, outbox })}

Ambiente demo: ${demoMode.enabled ? 'ativo - dados fictícios separados' : 'desativado'}`
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
          `Modo treinamento: ${trainingMode.enabled ? 'ativo - gravações reais bloqueadas' : 'desativado'}`,
          `Ambiente demo: ${demoMode.enabled ? 'ativo - dados fictícios separados' : 'desativado'}`,
          `Tour comercial: ${tourDoneCount}/${COMMERCIAL_TOUR_STEPS.length} (${tourPercent}%)`,
          `Proposta comercial: ${proposalDoneCount}/${COMMERCIAL_PROPOSAL_CHECKLIST.length} (${proposalPercent}%)`,
          `Termo implantação: ${termDoneCount}/${IMPLEMENTATION_TERM_ITEMS.length} (${termPercent}%)${termAccepted ? ' aceito' : ''}`,
          `Pós-venda/SLA: ${postSaleSummary.solved}/${postSaleSummary.total} chamados resolvidos; críticos abertos=${postSaleSummary.criticalOpen}`,
          `Feedback/NPS: ${clientFeedbackState.npsScore}/10 (${clientFeedbackSummary.npsLabel}); melhorias abertas=${clientFeedbackSummary.open}; P0/P1 abertas=${clientFeedbackSummary.openP0P1}`,
          `Saúde executiva: ${executiveHealthSummary.score}/100 ${executiveHealthSummary.title}; bloqueios=${executiveHealthSummary.blockers.length}; avisos=${executiveHealthSummary.warnings.length}`,
          `Auditoria final: ${regressionAuditSummary.score}/100 ${regressionAuditSummary.title}; pendente=${regressionAuditSummary.pending}; bloqueios=${regressionAuditSummary.blockers.length}`,
          `Implantação Dia 1: ${dayOneImplantSummary.score}/100 ${dayOneImplantSummary.title}; pendente=${dayOneImplantSummary.pending}; bloqueios=${dayOneImplantSummary.blockers.length}`,
          `Pós-implantação Dia 2: ${dayTwoFollowUpSummary.score}/100 ${dayTwoFollowUpSummary.title}; pendente=${dayTwoFollowUpSummary.pending}; bloqueios=${dayTwoFollowUpSummary.blockers.length}`,
          `Encerramento primeiro cliente: ${firstClientCloseoutSummary.score}/100 ${firstClientCloseoutSummary.title}; pendente=${firstClientCloseoutSummary.pending}; bloqueios=${firstClientCloseoutSummary.blockers.length}`,
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
        <StatCard label="Ambiente" value={demoStatusLabel} detail={demoActive ? 'dados fictícios' : 'loja real'} icon="bloqueio_seguro" tone={demoActive ? 'purple' : 'blue'} />
      </section>

      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className={`mapp-section-block mapp-demo-panel ${demoActive ? 'is-active' : ''}`}>
        <div className="mapp-section-title"><h2>Ambiente demo separado</h2><button type="button" onClick={() => void copyDemoMode()}>Copiar resumo</button></div>
        <div className="mapp-demo-hero">
          <div>
            <span>{demoActive ? 'Dados fictícios ativos' : 'Usando loja real'}</span>
            <strong>{demoActive ? 'Seguro para apresentar cliente' : 'Ative antes de demonstrar'}</strong>
            <p>Quando ativo, as listas usam clientes, produtos, vendas, caixa e comprovantes fictícios. A loja real não é lida nas telas e gravações reais ficam bloqueadas.</p>
          </div>
          <b className={demoActive ? 'ok' : 'warn'}>{demoActive ? 'DEMO' : 'REAL'}</b>
        </div>
        <div className="mapp-final-release-grid">
          <label>Nome da loja demo<input value={demoMode.storeName} onChange={(event) => patchDemoMode({ storeName: event.target.value })} placeholder="Ex.: Loja Demonstração Fácil" /></label>
          <label>Responsável pela apresentação<input value={demoMode.responsible} onChange={(event) => patchDemoMode({ responsible: event.target.value })} placeholder="Ex.: João / suporte" /></label>
          <label>Cenário da demonstração<input value={demoMode.scenario} onChange={(event) => patchDemoMode({ scenario: event.target.value })} placeholder="Ex.: Apresentação para cliente novo" /></label>
          <label>Observação<textarea value={demoMode.note} onChange={(event) => patchDemoMode({ note: event.target.value })} placeholder="Anote o cliente, aparelho usado e o que precisa confirmar depois na loja real." rows={3} /></label>
        </div>
        <div className="mapp-demo-steps">
          {DEMO_MODE_STEPS.map((step) => (
            <article key={step.id}>
              <span>{step.area}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={activateDemoMode} disabled={demoActive}>Ativar demo segura</button>
          <button type="button" className="mapp-secondary-button" onClick={deactivateDemoMode} disabled={!demoActive}>Voltar para loja real</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDemoMode()}>Copiar resumo</button>
        </div>
        <small className="mapp-final-honesty">Demo ativa não substitui teste real. Antes de vender de verdade, saia da demo, confira login na nuvem, rode o teste comercial e valide dois aparelhos.</small>
      </section>


      <section className={`mapp-section-block mapp-tour-panel ${demoActive ? 'is-demo-ready' : ''}`}>
        <div className="mapp-section-title"><h2>Tour de apresentação comercial</h2><button type="button" onClick={() => void copyCommercialTour()}>Copiar tour</button></div>
        <div className="mapp-tour-hero">
          <div>
            <span>Roteiro para vender melhor</span>
            <strong>{tourDoneCount}/{COMMERCIAL_TOUR_STEPS.length} telas apresentadas</strong>
            <p>Mostre as abas na ordem certa, com fala pronta, valor para o cliente e prova do que foi demonstrado.</p>
          </div>
          <b className={tourPercent >= 90 ? 'ok' : tourPercent >= 50 ? 'warn' : 'danger'}>{tourPercent}%</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do tour comercial ${tourPercent}%`}><span style={{ width: `${tourPercent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Apresentador<input value={tourState.presenter} onChange={(event) => patchTourState({ presenter: event.target.value })} placeholder="Ex.: João / suporte" /></label>
          <label>Cliente ou público<input value={tourState.audience} onChange={(event) => patchTourState({ audience: event.target.value })} placeholder="Ex.: Jaque Confecções / dona da loja" /></label>
          <label>Objetivo da apresentação<input value={tourState.objective} onChange={(event) => patchTourState({ objective: event.target.value })} placeholder="Ex.: Mostrar PDV mobile e fechar piloto" /></label>
          <label>Observações do tour<textarea value={tourState.note} onChange={(event) => patchTourState({ note: event.target.value })} placeholder="Anote dúvidas, objeções, pedido de preço, impressora e próximo passo combinado." rows={3} /></label>
        </div>
        <div className="mapp-tour-current">
          <span>Etapa atual</span>
          <strong>{currentTourStep.order}. {currentTourStep.title}</strong>
          <p>{currentTourStep.script}</p>
          <small>Mostrar: {currentTourStep.show}</small>
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={activateDemoForTour} disabled={demoActive}>Preparar demo para tour</button>
          <button type="button" className="mapp-secondary-button" onClick={() => openTourStep(currentTourStep)}>Abrir etapa atual</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyCommercialTour()}>Copiar roteiro</button>
          <button type="button" className="mapp-secondary-button" onClick={resetCommercialTour}>Zerar tour</button>
        </div>
        <div className="mapp-tour-list">
          {COMMERCIAL_TOUR_STEPS.map((step) => {
            const done = tourDoneSet.has(step.id);
            const active = step.id === tourState.currentId;
            return (
              <article key={step.id} className={`mapp-tour-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                <button type="button" className="mapp-tour-open" onClick={() => openTourStep(step)}>
                  <b>{step.order}</b>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.goal}</p>
                    <small>{step.pageLabel} · {step.priority} · Prova: {step.proof}</small>
                  </div>
                </button>
                <div className="mapp-tour-script">
                  <span>Fala sugerida</span>
                  <p>{step.script}</p>
                  <small>Fechamento: {step.close}</small>
                </div>
                <button type="button" className={`mapp-tour-check ${done ? 'done' : ''}`} onClick={() => toggleTourStep(step.id)}>{done ? 'Apresentado ✓' : 'Marcar apresentado'}</button>
              </article>
            );
          })}
        </div>
        <small className="mapp-final-honesty">Tour não substitui teste real. Para vender de verdade: saia da demo, rode teste comercial, valide dois aparelhos, permissões, impressão e aceite final.</small>
      </section>


      <section className="mapp-section-block mapp-proposal-panel">
        <div className="mapp-section-title"><h2>Proposta comercial / planos</h2><button type="button" onClick={() => void copyCommercialProposal()}>Copiar proposta</button></div>
        <div className="mapp-proposal-hero">
          <div>
            <span>Fechamento de venda</span>
            <strong>{currentProposalPlan.name} · {proposalPercent}% pronto</strong>
            <p>Monte uma proposta clara com plano, benefícios, implantação, suporte e próximo passo para o cliente não ficar perdido depois do tour.</p>
          </div>
          <b className={proposalPercent >= 85 ? 'ok' : proposalPercent >= 50 ? 'warn' : 'danger'}>{currentProposalPlan.tag}</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso da proposta comercial ${proposalPercent}%`}><span style={{ width: `${proposalPercent}%` }} /></div>
        <div className="mapp-proposal-plans">
          {COMMERCIAL_PROPOSAL_PLANS.map((plan) => {
            const active = plan.id === proposalState.selectedPlanId;
            return (
              <article key={plan.id} className={`mapp-proposal-plan ${active ? 'active' : ''}`}>
                <button type="button" onClick={() => selectProposalPlan(plan)}>
                  <span>{plan.tag}</span>
                  <strong>{plan.name}</strong>
                  <p>{plan.idealFor}</p>
                  <small>{plan.monthly} · {plan.setup}</small>
                </button>
              </article>
            );
          })}
        </div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja da proposta<input value={proposalState.clientName} onChange={(event) => patchProposalState({ clientName: event.target.value })} placeholder="Ex.: Jaque Confecções" /></label>
          <label>Mensalidade<input value={proposalState.monthlyPrice} onChange={(event) => patchProposalState({ monthlyPrice: event.target.value })} placeholder="Ex.: R$ 129/mês" /></label>
          <label>Implantação<input value={proposalState.setupPrice} onChange={(event) => patchProposalState({ setupPrice: event.target.value })} placeholder="Ex.: R$ 399 implantação" /></label>
          <label>Validade da proposta<input value={proposalState.validUntil} onChange={(event) => patchProposalState({ validUntil: event.target.value })} placeholder="Ex.: válida até 15/06/2026" /></label>
          <label>Próximo passo<input value={proposalState.nextStep} onChange={(event) => patchProposalState({ nextStep: event.target.value })} placeholder="Ex.: agendar instalação amanhã às 14h" /></label>
          <label>Condição/observação comercial<input value={proposalState.discountNote} onChange={(event) => patchProposalState({ discountNote: event.target.value })} placeholder="Ex.: primeira mensalidade após implantação" /></label>
          <label>Observações da negociação<textarea value={proposalState.notes} onChange={(event) => patchProposalState({ notes: event.target.value })} placeholder="Anote dúvidas, objeções, preço combinado, impressora do cliente e suporte prometido." rows={3} /></label>
        </div>
        <div className="mapp-proposal-benefits">
          <article>
            <span>Benefícios</span>
            {currentProposalPlan.benefits.map((item) => <p key={item}>✓ {item}</p>)}
          </article>
          <article>
            <span>Implantação</span>
            {currentProposalPlan.delivery.map((item) => <p key={item}>✓ {item}</p>)}
          </article>
          <article>
            <span>Promessa honesta</span>
            <p>{currentProposalPlan.promise}</p>
            <small>{currentProposalPlan.support}</small>
          </article>
        </div>
        <div className="mapp-proposal-checklist">
          {COMMERCIAL_PROPOSAL_CHECKLIST.map((item) => {
            const done = proposalDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={done ? 'done' : ''} onClick={() => toggleProposalItem(item.id)}>
                <span>{done ? '✓' : ''}</span>
                <div><strong>{item.label}</strong><p>{item.detail}</p></div>
              </button>
            );
          })}
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={() => void copyCommercialProposal()}>Copiar proposta</button>
          <button type="button" className="mapp-secondary-button" onClick={prepareProposalDemo}>Preparar demo da proposta</button>
          <button type="button" className="mapp-secondary-button" onClick={resetCommercialProposal}>Zerar proposta</button>
        </div>
        <small className="mapp-final-honesty">Proposta é apoio comercial, não contrato automático. Antes de vender como final, valide dois aparelhos, permissões, impressão, nuvem e aceite final.</small>
      </section>

      <section className={`mapp-section-block mapp-term-panel ${termAccepted ? 'is-accepted' : ''}`}>
        <div className="mapp-section-title"><h2>Contrato / termo de implantação</h2><button type="button" onClick={() => void copyImplementationTerm()}>Copiar termo</button></div>
        <div className="mapp-term-hero">
          <div>
            <span>{termAccepted ? 'Aceite registrado' : 'Termo operacional'}</span>
            <strong>{termAccepted ? 'Implantação com aceite documentado' : `Checklist do termo ${termPercent}% pronto`}</strong>
            <p>Registre escopo, responsabilidade, suporte, limites e aceite do cliente antes de iniciar a operação real. É simples para usuário leigo e não mexe nos dados da loja.</p>
          </div>
          <b className={termAccepted ? 'ok' : termPercent >= 75 ? 'warn' : 'danger'}>{termAccepted ? 'ACEITO' : 'PENDENTE'}</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do termo de implantação ${termPercent}%`}><span style={{ width: `${termPercent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={termState.clientName} onChange={(event) => patchImplementationTerm({ clientName: event.target.value })} placeholder={proposalState.clientName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável do cliente<input value={termState.responsibleName} onChange={(event) => patchImplementationTerm({ responsibleName: event.target.value })} placeholder="Ex.: Jaqueline / gerente" /></label>
          <label>Contato do responsável<input value={termState.contact} onChange={(event) => patchImplementationTerm({ contact: event.target.value })} placeholder="Ex.: WhatsApp comercial" /></label>
          <label>Plano/condição<input value={termState.chosenPlan} onChange={(event) => patchImplementationTerm({ chosenPlan: event.target.value })} placeholder={currentProposalPlan.name} /></label>
          <label>Data combinada<input value={termState.startDate} onChange={(event) => patchImplementationTerm({ startDate: event.target.value })} placeholder="Ex.: instalar dia 10/06/2026 às 14h" /></label>
          <label>Pagamento/condição<input value={termState.paymentSummary} onChange={(event) => patchImplementationTerm({ paymentSummary: event.target.value })} placeholder="Ex.: implantação na instalação + mensalidade após teste" /></label>
          <label>Escopo de suporte<textarea value={termState.supportScope} onChange={(event) => patchImplementationTerm({ supportScope: event.target.value })} rows={3} /></label>
          <label>Responsabilidades do cliente<textarea value={termState.clientResponsibilities} onChange={(event) => patchImplementationTerm({ clientResponsibilities: event.target.value })} rows={3} /></label>
          <label>Limites honestos<textarea value={termState.limitations} onChange={(event) => patchImplementationTerm({ limitations: event.target.value })} rows={3} /></label>
          <label>Observações do termo<textarea value={termState.notes} onChange={(event) => patchImplementationTerm({ notes: event.target.value })} placeholder="Anote exceções, equipamento do cliente, horário de suporte, impressora e pendências antes de aceitar." rows={3} /></label>
          <label>Quem aceitou<input value={termState.acceptedBy} onChange={(event) => patchImplementationTerm({ acceptedBy: event.target.value })} placeholder={termState.responsibleName || 'Nome do responsável'} /></label>
          <label>Registro<input value={termState.acceptedAt ? new Date(termState.acceptedAt).toLocaleString('pt-BR') : 'Ainda sem aceite'} readOnly /></label>
        </div>
        <div className="mapp-term-checklist">
          {IMPLEMENTATION_TERM_ITEMS.map((item) => {
            const done = termDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={done ? 'done' : ''} onClick={() => toggleImplementationTermItem(item.id)}>
                <span>{done ? '✓' : item.risk}</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              </button>
            );
          })}
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={registerImplementationTermAcceptance} disabled={termPercent < 100 || termAccepted}>{termAccepted ? 'Aceite registrado' : 'Registrar aceite do termo'}</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyImplementationTerm()}>Copiar termo</button>
          <button type="button" className="mapp-secondary-button" onClick={resetImplementationTerm}>Zerar termo</button>
        </div>
        <small className="mapp-final-honesty">Termo simples de implantação não substitui contrato jurídico formal. Use para clarear escopo, suporte, limites e aceite; revise com profissional responsável quando necessário.</small>
      </section>

      <section className={`mapp-section-block mapp-postsale-panel ${postSaleSummary.criticalOpen ? 'has-critical' : postSaleSummary.open ? 'has-open' : 'is-clear'}`}>
        <div className="mapp-section-title"><h2>Pós-venda / suporte e SLA</h2><button type="button" onClick={() => void copyPostSaleSupport()}>Copiar suporte</button></div>
        <div className="mapp-postsale-hero">
          <div>
            <span>{postSaleSummary.criticalOpen ? 'Atenção no suporte' : postSaleSummary.open ? 'Acompanhamento ativo' : 'Suporte organizado'}</span>
            <strong>{postSaleSummary.open} abertos · {postSaleSummary.solved} resolvido(s)</strong>
            <p>Use esta área depois da implantação para registrar chamados, prioridade, prazo, responsável e evidência do primeiro cliente. Não mexe em venda, caixa, estoque ou nuvem.</p>
          </div>
          <b className={postSaleSummary.criticalOpen ? 'danger' : postSaleSummary.open ? 'warn' : 'ok'}>{postSaleSummary.percent}%</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do pós-venda ${postSaleSummary.percent}%`}><span style={{ width: `${postSaleSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={postSaleState.clientName} onChange={(event) => patchPostSaleSupport({ clientName: event.target.value })} placeholder={termState.clientName || proposalState.clientName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável suporte<input value={postSaleState.supportOwner} onChange={(event) => patchPostSaleSupport({ supportOwner: event.target.value })} placeholder="Ex.: João / suporte técnico" /></label>
          <label>Canal de suporte<input value={postSaleState.supportChannel} onChange={(event) => patchPostSaleSupport({ supportChannel: event.target.value })} placeholder="Ex.: WhatsApp, horário comercial" /></label>
          <label>Revisão do primeiro dia<input value={postSaleState.firstReviewDate} onChange={(event) => patchPostSaleSupport({ firstReviewDate: event.target.value })} placeholder="Ex.: hoje às 18h ou amanhã 09h" /></label>
          <label>SLA combinado<textarea value={postSaleState.slaNote} onChange={(event) => patchPostSaleSupport({ slaNote: event.target.value })} rows={3} /></label>
        </div>
        <div className="mapp-postsale-checklist">
          {POST_SALE_SUPPORT_ITEMS.map((item) => {
            const done = postSaleDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={done ? 'done' : ''} onClick={() => togglePostSaleSupportItem(item.id)}>
                <span>{done ? '✓' : item.priority}</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p><small>Esperado: {item.expected}</small></div>
              </button>
            );
          })}
        </div>
        <div className="mapp-postsale-new-ticket">
          <strong>Novo chamado / ajuste combinado</strong>
          <div className="mapp-final-release-grid">
            <label>Título<input value={ticketDraft.title} onChange={(event) => setTicketDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Impressão 80mm cortou telefone" /></label>
            <label>Área<input value={ticketDraft.category} onChange={(event) => setTicketDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Impressão / Caixa / Login" /></label>
            <label>Prioridade<select value={ticketDraft.priority} onChange={(event) => setTicketDraft((current) => ({ ...current, priority: event.target.value as PostSalePriority }))}><option value="P0">P0 crítico</option><option value="P1">P1 alto</option><option value="P2">P2 ajuste</option></select></label>
            <label>Prazo<input value={ticketDraft.due} onChange={(event) => setTicketDraft((current) => ({ ...current, due: event.target.value }))} placeholder="Ex.: corrigir antes de abrir amanhã" /></label>
            <label>Responsável<input value={ticketDraft.owner} onChange={(event) => setTicketDraft((current) => ({ ...current, owner: event.target.value }))} placeholder={postSaleState.supportOwner || 'Ex.: suporte'} /></label>
          </div>
          <button type="button" className="mapp-primary-button" onClick={addPostSaleTicket}>Adicionar chamado</button>
        </div>
        <div className="mapp-postsale-ticket-list">
          {postSaleState.tickets.length ? postSaleState.tickets.map((ticket) => (
            <article key={ticket.id} className={`mapp-postsale-ticket priority-${ticket.priority.toLowerCase()} status-${ticket.status}`}>
              <header><span>{ticket.priority}</span><strong>{ticket.title}</strong><select value={ticket.status} onChange={(event) => updatePostSaleTicket(ticket.id, { status: event.target.value as PostSaleTicketStatus })}><option value="open">Aberto</option><option value="in_progress">Em atendimento</option><option value="waiting_client">Aguardando cliente</option><option value="solved">Resolvido</option></select></header>
              <div className="mapp-final-release-grid">
                <label>Área<input value={ticket.category} onChange={(event) => updatePostSaleTicket(ticket.id, { category: event.target.value })} /></label>
                <label>Prazo<input value={ticket.due} onChange={(event) => updatePostSaleTicket(ticket.id, { due: event.target.value })} /></label>
                <label>Responsável<input value={ticket.owner} onChange={(event) => updatePostSaleTicket(ticket.id, { owner: event.target.value })} /></label>
                <label>Evidência<textarea value={ticket.evidence} onChange={(event) => updatePostSaleTicket(ticket.id, { evidence: event.target.value })} placeholder="Print, aparelho, papel logado e texto do erro." rows={2} /></label>
                <label>Observação<textarea value={ticket.notes} onChange={(event) => updatePostSaleTicket(ticket.id, { notes: event.target.value })} placeholder="O que já foi tentado e próximo passo." rows={2} /></label>
              </div>
              <button type="button" className="mapp-secondary-button" onClick={() => deletePostSaleTicket(ticket.id)}>Remover chamado</button>
            </article>
          )) : <div className="mapp-success-card"><strong>Nenhum chamado aberto</strong><p>Quando o primeiro cliente relatar algo, registre aqui com prioridade, prazo e evidência.</p></div>}
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => void copyPostSaleSupport()}>Copiar plano de suporte</button>
          <button type="button" className="mapp-secondary-button" onClick={resetPostSaleSupport}>Zerar pós-venda</button>
        </div>
        <small className="mapp-final-honesty">P0/P1 aberto não impede navegar, mas impede dizer que o cliente está estável. Registre evidência antes de prometer correção.</small>
      </section>


      <section className={`mapp-section-block mapp-client-feedback-panel tone-${clientFeedbackSummary.tone}`}>
        <div className="mapp-section-title"><h2>Feedback do cliente / NPS</h2><button type="button" onClick={() => void copyClientFeedback()}>Copiar feedback</button></div>
        <div className="mapp-client-feedback-hero">
          <div>
            <span>{clientFeedbackSummary.npsLabel}</span>
            <strong>NPS {clientFeedbackState.npsScore}/10 · {clientFeedbackSummary.open} melhoria(s) aberta(s)</strong>
            <p>Depois do primeiro dia, registre a nota do cliente, dor principal, sugestões e transforme tudo em melhoria P0/P1/P2 com responsável, prazo e evidência.</p>
          </div>
          <b className={clientFeedbackSummary.tone}>{clientFeedbackSummary.percent}%</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do feedback do cliente ${clientFeedbackSummary.percent}%`}><span style={{ width: `${clientFeedbackSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={clientFeedbackState.clientName} onChange={(event) => patchClientFeedback({ clientName: event.target.value })} placeholder={postSaleState.clientName || termState.clientName || proposalState.clientName || 'Ex.: Jaque Confecções'} /></label>
          <label>Contato que avaliou<input value={clientFeedbackState.contactName} onChange={(event) => patchClientFeedback({ contactName: event.target.value })} placeholder="Ex.: Dona Jaque / operador do caixa" /></label>
          <label>Nota NPS 0 a 10<input type="number" min={0} max={10} value={clientFeedbackState.npsScore} onChange={(event) => patchClientFeedback({ npsScore: normalizeNpsScore(event.target.value) })} /></label>
          <label>Satisfação<select value={clientFeedbackState.satisfaction} onChange={(event) => patchClientFeedback({ satisfaction: event.target.value as ClientSatisfaction })}><option value="nao_informado">Não informado</option><option value="ruim">Ruim</option><option value="regular">Regular</option><option value="bom">Bom</option><option value="excelente">Excelente</option></select></label>
          <label>Dor principal<textarea value={clientFeedbackState.mainPain} onChange={(event) => patchClientFeedback({ mainPain: event.target.value })} placeholder="Ex.: Cliente achou difícil localizar comprovante / impressão cortou / caixa confundiu." rows={3} /></label>
          <label>Sugestão do cliente<textarea value={clientFeedbackState.suggestedImprovement} onChange={(event) => patchClientFeedback({ suggestedImprovement: event.target.value })} placeholder="Ex.: Queria botão maior, tutorial, relatório diferente, mensagem mais clara." rows={3} /></label>
          <label>Foco prioritário<input value={clientFeedbackState.priorityFocus} onChange={(event) => patchClientFeedback({ priorityFocus: event.target.value })} placeholder="Ex.: impressão 80mm e treinamento do caixa" /></label>
          <label>Próxima ação<input value={clientFeedbackState.nextAction} onChange={(event) => patchClientFeedback({ nextAction: event.target.value })} placeholder="Ex.: retornar amanhã às 18h com ajuste/teste" /></label>
          <label>Depoimento autorizado<textarea value={clientFeedbackState.testimonial} onChange={(event) => patchClientFeedback({ testimonial: event.target.value })} placeholder="Opcional: frase do cliente autorizada para venda futura." rows={2} /></label>
        </div>
        <div className="mapp-feedback-checklist">
          {CLIENT_FEEDBACK_ITEMS.map((item) => {
            const done = clientFeedbackDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={done ? 'done' : ''} onClick={() => toggleClientFeedbackItem(item.id)}>
                <span>{done ? '✓' : item.priority}</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p><small>Esperado: {item.expected}</small></div>
              </button>
            );
          })}
        </div>
        <div className="mapp-feedback-new-item">
          <strong>Nova melhoria prioritária</strong>
          <div className="mapp-final-release-grid">
            <label>Título<input value={clientImprovementDraft.title} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Deixar botão imprimir mais visível" /></label>
            <label>Área<input value={clientImprovementDraft.area} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Comprovantes / Caixa / Treinamento" /></label>
            <label>Prioridade<select value={clientImprovementDraft.priority} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, priority: event.target.value as ClientFeedbackPriority }))}><option value="P0">P0 crítico</option><option value="P1">P1 alto</option><option value="P2">P2 melhoria</option></select></label>
            <label>Impacto<input value={clientImprovementDraft.impact} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, impact: event.target.value }))} placeholder="Ex.: cliente não consegue fechar caixa sozinho" /></label>
            <label>Responsável<input value={clientImprovementDraft.owner} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, owner: event.target.value }))} placeholder={postSaleState.supportOwner || 'Ex.: suporte'} /></label>
            <label>Prazo<input value={clientImprovementDraft.due} onChange={(event) => setClientImprovementDraft((current) => ({ ...current, due: event.target.value }))} placeholder="Ex.: próximo lote / amanhã / 7 dias" /></label>
          </div>
          <button type="button" className="mapp-primary-button" onClick={addClientImprovement}>Adicionar melhoria</button>
        </div>
        <div className="mapp-feedback-list">
          {clientFeedbackState.improvements.length ? clientFeedbackState.improvements.map((item) => (
            <article key={item.id} className={`mapp-feedback-item priority-${item.priority.toLowerCase()} status-${item.status}`}>
              <header><span>{item.priority}</span><strong>{item.title}</strong><select value={item.status} onChange={(event) => updateClientImprovement(item.id, { status: event.target.value as ClientFeedbackStatus })}><option value="new">Novo</option><option value="planned">Planejado</option><option value="in_progress">Em execução</option><option value="done">Resolvido</option></select></header>
              <div className="mapp-final-release-grid">
                <label>Área<input value={item.area} onChange={(event) => updateClientImprovement(item.id, { area: event.target.value })} /></label>
                <label>Prazo<input value={item.due} onChange={(event) => updateClientImprovement(item.id, { due: event.target.value })} /></label>
                <label>Responsável<input value={item.owner} onChange={(event) => updateClientImprovement(item.id, { owner: event.target.value })} /></label>
                <label>Impacto<textarea value={item.impact} onChange={(event) => updateClientImprovement(item.id, { impact: event.target.value })} rows={2} /></label>
                <label>Evidência<textarea value={item.evidence} onChange={(event) => updateClientImprovement(item.id, { evidence: event.target.value })} placeholder="Print, áudio/resumo do cliente, aparelho e tela afetada." rows={2} /></label>
                <label>Observação<textarea value={item.notes} onChange={(event) => updateClientImprovement(item.id, { notes: event.target.value })} placeholder="O que foi combinado e próximo passo." rows={2} /></label>
              </div>
              <button type="button" className="mapp-secondary-button" onClick={() => deleteClientImprovement(item.id)}>Remover melhoria</button>
            </article>
          )) : <div className="mapp-success-card"><strong>Nenhuma melhoria registrada</strong><p>Depois de ouvir o cliente, registre aqui a dor, prioridade, responsável e evidência.</p></div>}
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => void copyClientFeedback()}>Copiar relatório de feedback</button>
          <button type="button" className="mapp-secondary-button" onClick={resetClientFeedback}>Zerar feedback</button>
        </div>
        <small className="mapp-final-honesty">NPS baixo ou melhoria P0/P1 aberta não bloqueia navegar, mas deve virar próximo lote antes de prometer estabilidade total ao cliente.</small>
      </section>


      <section className={`mapp-section-block mapp-executive-health-panel tone-${executiveHealthSummary.decision}`}>
        <div className="mapp-section-title"><h2>Painel executivo / pronto para escalar</h2><button type="button" onClick={() => void copyExecutiveHealth()}>Copiar painel</button></div>
        <div className="mapp-executive-hero">
          <div>
            <span>{executiveHealthSummary.title}</span>
            <strong>{executiveHealthSummary.score}/100 · {executiveHealthSummary.stars}</strong>
            <p>{executiveHealthSummary.subtitle}</p>
          </div>
          <b className={executiveHealthSummary.decision}>{executiveHealthSummary.decision === 'blocked' ? 'NÃO ESCALAR' : executiveHealthSummary.decision === 'attention' ? 'ASSISTIDO' : 'ESCALAR'}</b>
        </div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={executiveHealthState.clientName} onChange={(event) => patchExecutiveHealth({ clientName: event.target.value })} placeholder={clientFeedbackState.clientName || postSaleState.clientName || termState.clientName || proposalState.clientName || roleState.storeName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável executivo<input value={executiveHealthState.sponsor} onChange={(event) => patchExecutiveHealth({ sponsor: event.target.value })} placeholder="Ex.: dono / implantador / suporte" /></label>
          <label>Próxima revisão<input value={executiveHealthState.nextReview} onChange={(event) => patchExecutiveHealth({ nextReview: event.target.value })} placeholder="Ex.: amanhã 18h / 7 dias / após primeiro fechamento" /></label>
          <label>Objetivo de escala<textarea value={executiveHealthState.scaleGoal} onChange={(event) => patchExecutiveHealth({ scaleGoal: event.target.value })} rows={2} /></label>
          <label>Observações executivas<textarea value={executiveHealthState.notes} onChange={(event) => patchExecutiveHealth({ notes: event.target.value })} placeholder="Anote decisão, riscos aceitos, aparelhos testados, impressora, cliente piloto e próximos clientes." rows={3} /></label>
        </div>
        <div className="mapp-executive-area-grid">
          {executiveHealthSummary.areas.map((area) => (
            <article key={area.id} className={`mapp-executive-area tone-${area.tone}`}>
              <header><span>{area.score}</span><strong>{area.title}</strong></header>
              <p>{area.status}</p>
              <small><b>Evidência:</b> {area.evidence}</small>
              <small><b>Risco:</b> {area.risk}</small>
            </article>
          ))}
        </div>
        {executiveHealthSummary.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios para escalar</strong>{executiveHealthSummary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : <div className="mapp-final-alert-list"><strong>Sem bloqueio crítico neste aparelho</strong><p>Mesmo assim, mantenha teste físico real e suporte próximo antes de vender para muitos clientes.</p></div>}
        {executiveHealthSummary.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos antes de escalar</strong>{executiveHealthSummary.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={approveExecutiveHealth} disabled={executiveHealthSummary.decision === 'blocked'}>Aprovar escala controlada</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyExecutiveHealth()}>Copiar painel executivo</button>
          <button type="button" className="mapp-secondary-button" onClick={resetExecutiveHealth}>Zerar painel</button>
        </div>
        <small className="mapp-final-honesty">Aprovado: {executiveHealthState.approvedAt ? `${executiveHealthState.approvedBy || 'responsável'} em ${formatDateTime(executiveHealthState.approvedAt)}` : 'não aprovado'}. Este painel não substitui teste real em celular, nuvem, impressão, backup e papéis.</small>
      </section>


      <section className={`mapp-section-block mapp-regression-audit-panel tone-${regressionAuditSummary.decision}`}>
        <div className="mapp-section-title"><h2>Auditoria final de regressão / pré-venda real</h2><button type="button" onClick={() => void copyRegressionAudit()}>Copiar auditoria</button></div>
        <div className="mapp-regression-hero">
          <div>
            <span>{regressionAuditSummary.title}</span>
            <strong>{regressionAuditSummary.score}/100 · {regressionAuditSummary.stars}</strong>
            <p>{regressionAuditSummary.subtitle}</p>
          </div>
          <b className={regressionAuditSummary.decision}>{regressionAuditSummary.decision === 'blocked' ? 'NÃO LIBERAR' : regressionAuditSummary.decision === 'attention' ? 'REVISAR' : 'LIBERAR'}</b>
        </div>
        <div className="mapp-regression-summary-grid">
          <span><b>{regressionAuditSummary.passed}</b> Passou</span>
          <span><b>{regressionAuditSummary.failed}</b> Falhou</span>
          <span><b>{regressionAuditSummary.blocked}</b> Bloqueado</span>
          <span><b>{regressionAuditSummary.pending}</b> Pendente</span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso da auditoria final ${regressionAuditSummary.percent}%`}><span style={{ width: `${regressionAuditSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={regressionAuditState.storeOrClient} onChange={(event) => patchRegressionAudit({ storeOrClient: event.target.value })} placeholder={executiveHealthState.clientName || roleState.storeName || 'Ex.: Jaque Confecções'} /></label>
          <label>Auditor/responsável<input value={regressionAuditState.auditor} onChange={(event) => patchRegressionAudit({ auditor: event.target.value })} placeholder="Ex.: implantador / suporte / dono" /></label>
          <label>Aparelho 1<input value={regressionAuditState.deviceA} onChange={(event) => patchRegressionAudit({ deviceA: event.target.value })} placeholder="Ex.: PC da loja / celular do dono" /></label>
          <label>Aparelho 2<input value={regressionAuditState.deviceB} onChange={(event) => patchRegressionAudit({ deviceB: event.target.value })} placeholder="Ex.: Android instalado / notebook" /></label>
          <label>Observações da regressão<textarea value={regressionAuditState.notes} onChange={(event) => patchRegressionAudit({ notes: event.target.value })} placeholder="Anote falhas reais, prints, aparelhos, impressora, usuário/papel e decisão antes do cliente real." rows={3} /></label>
        </div>
        <div className="mapp-regression-step-list">
          {REGRESSION_AUDIT_STEPS.map((step) => {
            const result = normalizeRegressionAuditResult(regressionAuditState.results[step.id]);
            return (
              <article key={step.id} className={`mapp-regression-step priority-${step.priority.toLowerCase()} result-${result}`}>
                <header><span>{step.priority}</span><strong>{step.group}</strong></header>
                <h3>{step.title}</h3>
                <p><b>Fazer:</b> {step.action}</p>
                <p><b>Esperado:</b> {step.expected}</p>
                <small><b>Evidência:</b> {step.evidence}</small>
                <div className="mapp-regression-buttons">
                  {(['passed', 'failed', 'blocked', 'pending'] as RegressionAuditResult[]).map((option) => (
                    <button key={option} type="button" className={result === option ? 'is-active' : ''} onClick={() => setRegressionAuditResult(step.id, option)}>{regressionResultLabel(option)}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {regressionAuditSummary.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios antes da pré-venda real</strong>{regressionAuditSummary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : <div className="mapp-final-alert-list"><strong>Sem bloqueio crítico nesta auditoria</strong><p>Continue com evidência real em dois aparelhos antes de deixar o cliente operar sozinho.</p></div>}
        {regressionAuditSummary.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos finais</strong>{regressionAuditSummary.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={approveRegressionAudit} disabled={regressionAuditSummary.decision === 'blocked'}>Aprovar pré-venda real</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyRegressionAudit()}>Copiar auditoria final</button>
          <button type="button" className="mapp-secondary-button" onClick={resetRegressionAudit}>Zerar auditoria</button>
        </div>
        <small className="mapp-final-honesty">Aprovado: {regressionAuditState.approvedAt ? `${regressionAuditState.approvedBy || 'responsável'} em ${formatDateTime(regressionAuditState.approvedAt)}` : 'não aprovado'}. Não marque Passou sem evidência real.</small>
      </section>

      <section className={`mapp-section-block mapp-day-one-panel tone-${dayOneImplantSummary.decision}`}>
        <div className="mapp-section-title"><h2>Implantação cliente real / Dia 1</h2><button type="button" onClick={() => void copyDayOneImplant()}>Copiar Dia 1</button></div>
        <div className="mapp-regression-hero">
          <div>
            <span>{dayOneImplantSummary.title}</span>
            <strong>{dayOneImplantSummary.score}/100 · {dayOneImplantSummary.stars}</strong>
            <p>{dayOneImplantSummary.subtitle}</p>
          </div>
          <b className={dayOneImplantSummary.decision}>{dayOneImplantSummary.decision === 'blocked' ? 'NÃO INICIAR' : dayOneImplantSummary.decision === 'attention' ? 'REVISAR' : 'ACEITO'}</b>
        </div>
        <div className="mapp-regression-summary-grid">
          <span><b>{dayOneImplantSummary.passed}</b> Passou</span>
          <span><b>{dayOneImplantSummary.failed}</b> Falhou</span>
          <span><b>{dayOneImplantSummary.blocked}</b> Bloqueado</span>
          <span><b>{dayOneImplantSummary.pending}</b> Pendente</span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso da implantação Dia 1 ${dayOneImplantSummary.percent}%`}><span style={{ width: `${dayOneImplantSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={dayOneImplantState.clientName} onChange={(event) => patchDayOneImplant({ clientName: event.target.value })} placeholder={regressionAuditState.storeOrClient || executiveHealthState.clientName || roleState.storeName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável implantação<input value={dayOneImplantState.implantor} onChange={(event) => patchDayOneImplant({ implantor: event.target.value })} placeholder="Ex.: suporte / implantador / dono" /></label>
          <label>Contato da loja<input value={dayOneImplantState.storeContact} onChange={(event) => patchDayOneImplant({ storeContact: event.target.value })} placeholder="Ex.: responsável no balcão / WhatsApp" /></label>
          <label>Horário combinado<input value={dayOneImplantState.schedule} onChange={(event) => patchDayOneImplant({ schedule: event.target.value })} placeholder="Ex.: 03/06 às 14h / primeiro dia assistido" /></label>
          <label>Aparelho principal<input value={dayOneImplantState.deviceA} onChange={(event) => patchDayOneImplant({ deviceA: event.target.value })} placeholder="Ex.: celular do dono / PC caixa" /></label>
          <label>Segundo aparelho<input value={dayOneImplantState.deviceB} onChange={(event) => patchDayOneImplant({ deviceB: event.target.value })} placeholder="Ex.: Android instalado / notebook" /></label>
          <label>Impressora/comprovante<input value={dayOneImplantState.printer} onChange={(event) => patchDayOneImplant({ printer: event.target.value })} placeholder="Ex.: Epson 80mm / PDF / WhatsApp" /></label>
          <label>Internet usada<input value={dayOneImplantState.internet} onChange={(event) => patchDayOneImplant({ internet: event.target.value })} placeholder="Ex.: Wi-Fi da loja / 4G reserva" /></label>
          <label>Observações Dia 1<textarea value={dayOneImplantState.notes} onChange={(event) => patchDayOneImplant({ notes: event.target.value })} placeholder="Anote venda teste, venda real, aparelho, impressora, cliente, falhas encontradas e próximos ajustes." rows={3} /></label>
        </div>
        <div className="mapp-regression-step-list">
          {DAY_ONE_IMPLANT_STEPS.map((step) => {
            const result = normalizeDayOneImplantResult(dayOneImplantState.results[step.id]);
            return (
              <article key={step.id} className={`mapp-regression-step priority-${step.priority.toLowerCase()} result-${result}`}>
                <header><span>{step.priority}</span><strong>{step.phase}</strong></header>
                <h3>{step.title}</h3>
                <p><b>Fazer:</b> {step.action}</p>
                <p><b>Esperado:</b> {step.expected}</p>
                <small><b>Evidência:</b> {step.evidence}</small>
                <div className="mapp-regression-buttons">
                  {(['passed', 'failed', 'blocked', 'pending'] as DayOneImplantResult[]).map((option) => (
                    <button key={option} type="button" className={result === option ? 'is-active' : ''} onClick={() => setDayOneImplantResult(step.id, option)}>{dayOneResultLabel(option)}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {dayOneImplantSummary.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios do Dia 1</strong>{dayOneImplantSummary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : <div className="mapp-final-alert-list"><strong>Sem bloqueio crítico no Dia 1</strong><p>Mesmo assim, só aceite com evidência real em celular, internet, impressão/comprovante, sync e primeira venda acompanhada.</p></div>}
        {dayOneImplantSummary.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos do Dia 1</strong>{dayOneImplantSummary.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={approveDayOneImplant} disabled={dayOneImplantSummary.decision === 'blocked'}>Aceitar Dia 1</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDayOneImplant()}>Copiar checklist Dia 1</button>
          <button type="button" className="mapp-secondary-button" onClick={resetDayOneImplant}>Zerar Dia 1</button>
        </div>
        <small className="mapp-final-honesty">Aceito: {dayOneImplantState.acceptedAt ? `${dayOneImplantState.acceptedBy || 'responsável'} em ${formatDateTime(dayOneImplantState.acceptedAt)}` : 'não aceito'}. Não deixe cliente operar sozinho com P0/P1 aberto, pendência, offline ou comprovante não validado.</small>
      </section>


      <section className={`mapp-section-block mapp-day-one-panel tone-${dayTwoFollowUpSummary.decision}`}>
        <div className="mapp-section-title"><h2>Correção pós-implantação / Dia 2</h2><button type="button" onClick={() => void copyDayTwoFollowUp()}>Copiar Dia 2</button></div>
        <div className="mapp-regression-hero">
          <div>
            <span>{dayTwoFollowUpSummary.title}</span>
            <strong>{dayTwoFollowUpSummary.score}/100 · {dayTwoFollowUpSummary.stars}</strong>
            <p>{dayTwoFollowUpSummary.subtitle}</p>
          </div>
          <b className={dayTwoFollowUpSummary.decision}>{dayTwoFollowUpSummary.decision === 'blocked' ? 'CORRIGIR' : dayTwoFollowUpSummary.decision === 'attention' ? 'ACOMPANHAR' : 'ESTÁVEL'}</b>
        </div>
        <div className="mapp-regression-summary-grid">
          <span><b>{dayTwoFollowUpSummary.passed}</b> Passou</span>
          <span><b>{dayTwoFollowUpSummary.failed}</b> Falhou</span>
          <span><b>{dayTwoFollowUpSummary.blocked}</b> Bloqueado</span>
          <span><b>{dayTwoFollowUpSummary.pending}</b> Pendente</span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso da correção Dia 2 ${dayTwoFollowUpSummary.percent}%`}><span style={{ width: `${dayTwoFollowUpSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={dayTwoFollowUpState.clientName} onChange={(event) => patchDayTwoFollowUp({ clientName: event.target.value })} placeholder={dayOneImplantState.clientName || roleState.storeName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável suporte<input value={dayTwoFollowUpState.supportOwner} onChange={(event) => patchDayTwoFollowUp({ supportOwner: event.target.value })} placeholder="Ex.: suporte / implantador / dono" /></label>
          <label>Contato da loja<input value={dayTwoFollowUpState.contact} onChange={(event) => patchDayTwoFollowUp({ contact: event.target.value })} placeholder={dayOneImplantState.storeContact || 'Ex.: responsável no balcão / WhatsApp'} /></label>
          <label>Data/revisão<input value={dayTwoFollowUpState.reviewDate} onChange={(event) => patchDayTwoFollowUp({ reviewDate: event.target.value })} placeholder="Ex.: Dia 2 às 9h / revisão depois do almoço" /></label>
          <label>Aparelho principal<input value={dayTwoFollowUpState.deviceA} onChange={(event) => patchDayTwoFollowUp({ deviceA: event.target.value })} placeholder={dayOneImplantState.deviceA || 'Ex.: celular do dono / PC caixa'} /></label>
          <label>Segundo aparelho<input value={dayTwoFollowUpState.deviceB} onChange={(event) => patchDayTwoFollowUp({ deviceB: event.target.value })} placeholder={dayOneImplantState.deviceB || 'Ex.: Android instalado / notebook'} /></label>
          <label>Impressora/comprovante<input value={dayTwoFollowUpState.printer} onChange={(event) => patchDayTwoFollowUp({ printer: event.target.value })} placeholder={dayOneImplantState.printer || 'Ex.: Epson 80mm / PDF / WhatsApp'} /></label>
          <label>Dúvida principal<textarea value={dayTwoFollowUpState.mainDoubt} onChange={(event) => patchDayTwoFollowUp({ mainDoubt: event.target.value })} placeholder="Qual foi a maior dúvida do cliente no segundo dia?" rows={2} /></label>
          <label>Plano de correção/continuidade<textarea value={dayTwoFollowUpState.correctionPlan} onChange={(event) => patchDayTwoFollowUp({ correctionPlan: event.target.value })} placeholder="Liste P0/P1/P2, responsável, prazo e próxima revisão." rows={3} /></label>
          <label>Observações Dia 2<textarea value={dayTwoFollowUpState.notes} onChange={(event) => patchDayTwoFollowUp({ notes: event.target.value })} placeholder="Anote venda real, caixa, sync, impressão, dúvidas, erros e acordos de suporte." rows={3} /></label>
        </div>
        <div className="mapp-regression-step-list">
          {DAY_TWO_FOLLOW_UP_STEPS.map((step) => {
            const result = normalizeDayTwoFollowUpResult(dayTwoFollowUpState.results[step.id]);
            return (
              <article key={step.id} className={`mapp-regression-step priority-${step.priority.toLowerCase()} result-${result}`}>
                <header><span>{step.priority}</span><strong>{step.phase}</strong></header>
                <h3>{step.title}</h3>
                <p><b>Fazer:</b> {step.action}</p>
                <p><b>Esperado:</b> {step.expected}</p>
                <small><b>Evidência:</b> {step.evidence}</small>
                <div className="mapp-regression-buttons">
                  {(['passed', 'failed', 'blocked', 'pending'] as DayTwoFollowUpResult[]).map((option) => (
                    <button key={option} type="button" className={result === option ? 'is-active' : ''} onClick={() => setDayTwoFollowUpResult(step.id, option)}>{dayTwoResultLabel(option)}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {dayTwoFollowUpSummary.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios do Dia 2</strong>{dayTwoFollowUpSummary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : <div className="mapp-final-alert-list"><strong>Sem bloqueio crítico no Dia 2</strong><p>Mesmo assim, só aprove com evidência de venda real, caixa, sync, impressão, dúvidas respondidas e plano de suporte.</p></div>}
        {dayTwoFollowUpSummary.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos do Dia 2</strong>{dayTwoFollowUpSummary.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={approveDayTwoFollowUp} disabled={dayTwoFollowUpSummary.decision === 'blocked'}>Aprovar Dia 2</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyDayTwoFollowUp()}>Copiar relatório Dia 2</button>
          <button type="button" className="mapp-secondary-button" onClick={resetDayTwoFollowUp}>Zerar Dia 2</button>
        </div>
        <small className="mapp-final-honesty">Aprovado: {dayTwoFollowUpState.approvedAt ? `${dayTwoFollowUpState.approvedBy || 'responsável'} em ${formatDateTime(dayTwoFollowUpState.approvedAt)}` : 'não aprovado'}. Não trate cliente como estável com P0/P1 aberto, sync pendente, offline, caixa/impressão sem conferência ou dúvida crítica solta.</small>
      </section>


      <section className={`mapp-section-block mapp-day-one-panel tone-${firstClientCloseoutSummary.decision}`}>
        <div className="mapp-section-title"><h2>Encerramento do primeiro cliente / pronto para replicar</h2><button type="button" onClick={() => void copyFirstClientCloseout()}>Copiar encerramento</button></div>
        <div className="mapp-regression-hero">
          <div>
            <span>{firstClientCloseoutSummary.title}</span>
            <strong>{firstClientCloseoutSummary.score}/100 · {firstClientCloseoutSummary.stars}</strong>
            <p>{firstClientCloseoutSummary.subtitle}</p>
          </div>
          <b className={firstClientCloseoutSummary.decision}>{firstClientCloseoutSummary.decision === 'blocked' ? 'NÃO REPLICAR' : firstClientCloseoutSummary.decision === 'attention' ? 'REVISAR' : 'REPLICÁVEL'}</b>
        </div>
        <div className="mapp-regression-summary-grid">
          <span><b>{firstClientCloseoutSummary.passed}</b> Passou</span>
          <span><b>{firstClientCloseoutSummary.failed}</b> Falhou</span>
          <span><b>{firstClientCloseoutSummary.blocked}</b> Bloqueado</span>
          <span><b>{firstClientCloseoutSummary.pending}</b> Pendente</span>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do encerramento ${firstClientCloseoutSummary.percent}%`}><span style={{ width: `${firstClientCloseoutSummary.percent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Cliente/loja<input value={firstClientCloseoutState.clientName} onChange={(event) => patchFirstClientCloseout({ clientName: event.target.value })} placeholder={dayTwoFollowUpState.clientName || dayOneImplantState.clientName || roleState.storeName || 'Ex.: Jaque Confecções'} /></label>
          <label>Responsável encerramento<input value={firstClientCloseoutState.closeOwner} onChange={(event) => patchFirstClientCloseout({ closeOwner: event.target.value })} placeholder="Ex.: suporte / implantador / dono" /></label>
          <label>Contato da loja<input value={firstClientCloseoutState.contact} onChange={(event) => patchFirstClientCloseout({ contact: event.target.value })} placeholder={dayTwoFollowUpState.contact || dayOneImplantState.storeContact || 'Ex.: responsável no balcão / WhatsApp'} /></label>
          <label>Data/fechamento<input value={firstClientCloseoutState.closeDate} onChange={(event) => patchFirstClientCloseout({ closeDate: event.target.value })} placeholder="Ex.: após Dia 2 / revisão final" /></label>
          <label>Permissão para usar como referência<input value={firstClientCloseoutState.referencePermission} onChange={(event) => patchFirstClientCloseout({ referencePermission: event.target.value })} placeholder="Ex.: autorizado com nome / somente anônimo / não autorizado" /></label>
          <label>Plano para replicar<textarea value={firstClientCloseoutState.replicationPlan} onChange={(event) => patchFirstClientCloseout({ replicationPlan: event.target.value })} placeholder="Liste o que vira padrão para o próximo cliente: demo, proposta, termo, Dia 1, Dia 2, suporte e limites." rows={3} /></label>
          <label>Checklist do próximo cliente<textarea value={firstClientCloseoutState.nextClientChecklist} onChange={(event) => patchFirstClientCloseout({ nextClientChecklist: event.target.value })} placeholder="Escreva o passo a passo que será repetido na próxima implantação." rows={3} /></label>
          <label>Onde ficaram as evidências<textarea value={firstClientCloseoutState.evidenceNote} onChange={(event) => patchFirstClientCloseout({ evidenceNote: event.target.value })} placeholder="Ex.: pasta, Drive, WhatsApp, prints, relatório copiado. Não cole senha/chave privada." rows={3} /></label>
          <label>Observações finais<textarea value={firstClientCloseoutState.notes} onChange={(event) => patchFirstClientCloseout({ notes: event.target.value })} placeholder="Pendências P2, aprendizados, melhorias futuras e cuidado antes de vender para o próximo cliente." rows={3} /></label>
        </div>
        <div className="mapp-regression-step-list">
          {FIRST_CLIENT_CLOSEOUT_STEPS.map((step) => {
            const result = normalizeFirstClientCloseoutResult(firstClientCloseoutState.results[step.id]);
            return (
              <article key={step.id} className={`mapp-regression-step priority-${step.priority.toLowerCase()} result-${result}`}>
                <header><span>{step.priority}</span><strong>{step.phase}</strong></header>
                <h3>{step.title}</h3>
                <p><b>Fazer:</b> {step.action}</p>
                <p><b>Esperado:</b> {step.expected}</p>
                <small><b>Evidência:</b> {step.evidence}</small>
                <div className="mapp-regression-buttons">
                  {(['passed', 'failed', 'blocked', 'pending'] as FirstClientCloseoutResult[]).map((option) => (
                    <button key={option} type="button" className={result === option ? 'is-active' : ''} onClick={() => setFirstClientCloseoutResult(step.id, option)}>{firstClientCloseoutLabel(option)}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {firstClientCloseoutSummary.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios para replicar</strong>{firstClientCloseoutSummary.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : <div className="mapp-final-alert-list"><strong>Sem bloqueio crítico para replicar</strong><p>Mesmo assim, só aprove com evidência guardada, autorização de referência definida e processo do próximo cliente documentado.</p></div>}
        {firstClientCloseoutSummary.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos antes de replicar</strong>{firstClientCloseoutSummary.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-primary-button" onClick={approveFirstClientCloseout} disabled={firstClientCloseoutSummary.decision === 'blocked'}>Aprovar para replicar</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyFirstClientCloseout()}>Copiar encerramento</button>
          <button type="button" className="mapp-secondary-button" onClick={resetFirstClientCloseout}>Zerar encerramento</button>
        </div>
        <small className="mapp-final-honesty">Aprovado: {firstClientCloseoutState.approvedAt ? `${firstClientCloseoutState.approvedBy || 'responsável'} em ${formatDateTime(firstClientCloseoutState.approvedAt)}` : 'não aprovado'}. Não use cliente como modelo se houver P0/P1 aberto, Dia 2 sem aceite, evidência solta, pendência local ou autorização de referência indefinida.</small>
      </section>


      <section className={`mapp-section-block mapp-training-panel ${trainingActive ? 'is-active' : ''}`}>
        <div className="mapp-section-title"><h2>Modo treinamento seguro</h2><button type="button" onClick={() => void copyTrainingMode()}>Copiar orientação</button></div>
        <div className="mapp-training-hero">
          <div>
            <span>{trainingActive ? 'Ativo e protegido' : 'Desativado'}</span>
            <strong>{trainingProtectionLabel}</strong>
            <p>Use para demonstrar o sistema para cliente leigo sem misturar teste com venda, caixa, estoque, crediário ou backup real.</p>
          </div>
          <b className={trainingActive ? 'ok' : 'warn'}>{trainingActive ? 'SEGURO' : 'REAL'}</b>
        </div>
        <div className="mapp-final-release-grid">
          <label>Responsável pelo treino<input value={trainingMode.responsible} onChange={(event) => patchTrainingMode({ responsible: event.target.value })} placeholder="Ex.: João / suporte" /></label>
          <label>Cenário do treinamento<input value={trainingMode.scenario} onChange={(event) => patchTrainingMode({ scenario: event.target.value })} placeholder="Ex.: Demonstração para primeiro cliente" /></label>
          <label>Observação<textarea value={trainingMode.note} onChange={(event) => patchTrainingMode({ note: event.target.value })} placeholder="Anote aparelho usado, cliente treinado e o que ainda precisa testar de verdade." rows={3} /></label>
        </div>
        <div className="mapp-training-chip-list" aria-label="Áreas protegidas no modo treinamento">
          {trainingBlockedAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
        <div className="mapp-training-steps">
          {TRAINING_DEMO_STEPS.map((step) => (
            <article key={step.id}>
              <span>{step.protectedArea}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={activateTrainingMode} disabled={trainingActive}>Ativar treinamento</button>
          <button type="button" className="mapp-secondary-button" onClick={deactivateTrainingMode} disabled={!trainingActive}>Desativar para uso real</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyTrainingMode()}>Copiar orientação</button>
        </div>
        <small className="mapp-final-honesty">Quando ativo, o app bloqueia gravações reais. Para vender de verdade, desative o treinamento, rode o teste comercial e confirme que não existe P0/P1.</small>
      </section>

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
                <header><strong>{area}</strong><small>{checks.length} itens</small></header>
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
        <div className="mapp-section-title"><h2>Correção aceite</h2><button type="button" onClick={() => void copyTriagePlan()}>Copiar plano</button></div>
        <div className="mapp-triage-summary">
          <div>
            <strong>{triageSummary.decision}</strong>
            <p>Transforma Falhou/Bloqueado em prioridade real para corrigir sem chute.</p>
          </div>
          <span className={triageSummary.p0 ? 'danger' : triageSummary.p1 ? 'warn' : 'ok'}>{triageSummary.total ? `${triageSummary.total} itens` : 'limpo'}</span>
        </div>
        <div className="mapp-assisted-counters" aria-label="Resumo das correções aceite">
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

      <section className={`mapp-section-block mapp-final-release-panel ${finalGate.tone}`}>
        <div className="mapp-section-title"><h2>Fechamento comercial</h2><button type="button" onClick={() => void copyFinalAcceptance()}>Copiar parecer</button></div>
        <div className="mapp-final-release-hero">
          <div>
            <span>{finalGate.decision === 'ready' ? 'Venda assistida' : finalGate.decision === 'pending' ? 'Aceite pendente' : 'Bloqueado'}</span>
            <strong>{finalGate.title}</strong>
            <p>{finalGate.subtitle}</p>
          </div>
          <div className="mapp-final-release-score"><strong>{finalGate.score}/10</strong><small>{finalGate.stars}</small></div>
        </div>
        <div className="mapp-final-release-grid">
          <label>Responsável pelo aceite<input value={finalAcceptance.responsible} onChange={(event) => patchFinalAcceptance({ responsible: event.target.value })} placeholder="Ex.: João / suporte / dono" /></label>
          <label>Loja ou cliente testado<input value={finalAcceptance.storeOrClient} onChange={(event) => patchFinalAcceptance({ storeOrClient: event.target.value })} placeholder="Ex.: Jaque Confecções — piloto" /></label>
          <label>Evidência curta<textarea value={finalAcceptance.note} onChange={(event) => patchFinalAcceptance({ note: event.target.value })} placeholder="Ex.: 2 aparelhos, impressão 80mm, owner/admin/operator/viewer, backup controlado." rows={3} /></label>
        </div>
        {finalGate.blockers.length ? (
          <div className="mapp-final-alert-list danger"><strong>Bloqueios antes de vender</strong>{finalGate.blockers.map((item) => <p key={item}>• {item}</p>)}</div>
        ) : (
          <div className="mapp-final-alert-list"><strong>Sem bloqueio P0/P1 neste aparelho</strong><p>Ainda mantenha suporte próximo no primeiro cliente real.</p></div>
        )}
        {finalGate.warnings.length ? <div className="mapp-final-alert-list warn"><strong>Avisos para revisar</strong>{finalGate.warnings.map((item) => <p key={item}>• {item}</p>)}</div> : null}
        <div className="mapp-button-grid">
          <button type="button" className="mapp-primary-button" onClick={registerFinalAcceptance} disabled={finalGate.decision === 'blocked'}>Registrar aceite final</button>
          <button type="button" className="mapp-secondary-button" onClick={() => void copyFinalAcceptance()}>Copiar parecer final</button>
          <button type="button" className="mapp-secondary-button" onClick={clearFinalAcceptance}>Limpar aceite</button>
        </div>
        <small className="mapp-final-honesty">Aceite registrado: {finalAcceptance.acceptedAt ? formatDateTime(finalAcceptance.acceptedAt) : 'não registrado'}. Isso não promete 100%; apenas documenta a conferência feita neste aparelho.</small>
      </section>

      <section className="mapp-section-block mapp-onboarding-panel">
        <div className="mapp-section-title"><h2>Kit do primeiro cliente</h2><button type="button" onClick={() => void copyOnboardingKit()}>Copiar kit</button></div>
        <div className="mapp-onboarding-hero">
          <div>
            <span>Entrega guiada</span>
            <strong>{onboardingDoneCount}/{FIRST_CLIENT_ONBOARDING_STEPS.length} etapas feitas</strong>
            <p>Use este checklist para instalar, treinar e acompanhar o primeiro dia do cliente sem pular passos importantes.</p>
          </div>
          <b className={onboardingPercent >= 90 ? 'ok' : onboardingPercent >= 60 ? 'warn' : 'danger'}>{onboardingPercent}%</b>
        </div>
        <div className="mapp-guided-progress" aria-label={`Progresso do onboarding ${onboardingPercent}%`}><span style={{ width: `${onboardingPercent}%` }} /></div>
        <div className="mapp-final-release-grid">
          <label>Nome do cliente/loja<input value={onboardingState.clientName} onChange={(event) => patchOnboardingState({ clientName: event.target.value })} placeholder="Ex.: Jaque Confecções" /></label>
          <label>Contato responsável<input value={onboardingState.contactName} onChange={(event) => patchOnboardingState({ contactName: event.target.value })} placeholder="Ex.: Jaqueline / WhatsApp" /></label>
          <label>Observações de suporte<textarea value={onboardingState.supportNote} onChange={(event) => patchOnboardingState({ supportNote: event.target.value })} placeholder="Anote pendências pequenas, impressora usada, aparelho do cliente e dúvidas do primeiro dia." rows={3} /></label>
        </div>
        <div className="mapp-button-grid mapp-guided-actions">
          <button type="button" className="mapp-secondary-button" onClick={() => void copyOnboardingKit()}>Copiar mensagem/checklist</button>
          <button type="button" className="mapp-secondary-button" onClick={resetOnboarding}>Zerar onboarding</button>
        </div>
        <div className="mapp-onboarding-groups">
          {onboardingGroups.map(([phase, steps]) => (
            <article key={phase} className="mapp-onboarding-group">
              <header><strong>{phase}</strong><small>{steps.filter((step) => onboardingDoneSet.has(step.id)).length}/{steps.length}</small></header>
              {steps.map((step) => {
                const done = onboardingDoneSet.has(step.id);
                return (
                  <button key={step.id} type="button" className={`mapp-onboarding-step ${done ? 'done' : ''} priority-${step.priority.toLowerCase()}`} onClick={() => toggleOnboardingStep(step.id)}>
                    <span>{done ? '✓' : ''}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.action}</p>
                      <small>{step.owner} · {step.priority} · Esperado: {step.expected}</small>
                    </div>
                  </button>
                );
              })}
            </article>
          ))}
        </div>
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
          <span><b>Cache</b><strong>v139 suporte</strong></span>
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
          <p>Use feedback/NPS v139, proposta comercial, execução real assistida e Kit do primeiro cliente em dois aparelhos. Marque Passou/Falhou/Bloqueado, copie a evidência e só venda quando não houver falha crítica.</p>
        </div>
        <button type="button" onClick={() => void copyDiagnostic()}>Copiar</button>
      </section>
    </div>
  );
}

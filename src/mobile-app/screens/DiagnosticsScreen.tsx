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

const GUIDED_TEST_KEY = 'smart-loja:guided-commercial-test-v135';
const LEGACY_GUIDED_TEST_KEYS = ['smart-loja:guided-commercial-test-v134', 'smart-loja:guided-commercial-test-v133', 'smart-loja:guided-commercial-test-v131', 'smart-loja:guided-commercial-test-v129', 'smart-loja:guided-commercial-test-v128', 'smart-loja:guided-commercial-test-v127', 'smart-loja:guided-commercial-test-v126'];

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
    expected: 'Aparece v135 no app/cache e as telas novas continuam funcionando no celular.',
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

const DEMO_MODE_STEPS: DemoModeStep[] = [
  { id: 'demo-dashboard', title: 'Apresentar dashboard bonito', detail: 'Mostrar métricas, vendas recentes, estoque baixo, crediário e pedidos usando dados fictícios.', area: 'Dashboard' },
  { id: 'demo-products', title: 'Mostrar produtos sem expor estoque real', detail: 'Produtos, categorias, preços e estoque são de exemplo. Nada é puxado da loja real enquanto a demo estiver ativa.', area: 'Produtos' },
  { id: 'demo-sales', title: 'Simular venda sem finalizar', detail: 'Cliente entende o fluxo de PDV usando clientes/produtos demo. Finalizar venda real continua bloqueado.', area: 'Vendas' },
  { id: 'demo-receipts', title: 'Mostrar comprovantes de amostra', detail: 'Comprovantes demo podem ser abertos/impresso como modelo visual sem mexer no caixa.', area: 'Comprovantes' },
  { id: 'demo-exit', title: 'Sair da demo antes da operação real', detail: 'Antes da primeira venda verdadeira, desative a demo, confira login/Supabase e rode o teste comercial.', area: 'Segurança' },
];


const COMMERCIAL_TOUR_KEY = 'smart-loja:commercial-tour-v135';
const LEGACY_COMMERCIAL_TOUR_KEYS = ['smart-loja:commercial-tour-v134', 'smart-loja:commercial-tour-v133'];

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
    pageLabel: 'Dashboard',
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


const COMMERCIAL_PROPOSAL_KEY = 'smart-loja:commercial-proposal-v135';
const LEGACY_COMMERCIAL_PROPOSAL_KEYS = ['smart-loja:commercial-proposal-v134'];

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

const TRAINING_DEMO_STEPS: TrainingDemoStep[] = [
  { id: 'explain-scope', title: 'Explicar modo treinamento', detail: 'Mostrar que o modo bloqueia gravações reais e serve para o cliente aprender sem mexer no caixa/estoque.', protectedArea: 'Dados reais' },
  { id: 'open-navigation', title: 'Navegar pelas abas', detail: 'Abrir Dashboard, Vendas, Produtos, Clientes, Caixa, Pedidos e Diagnóstico sem salvar nada.', protectedArea: 'Interface' },
  { id: 'simulate-sale', title: 'Simular venda sem finalizar', detail: 'Montar carrinho de exemplo e parar antes de Finalizar venda. A venda real fica bloqueada pelo modo treinamento.', protectedArea: 'Vendas/estoque' },
  { id: 'print-sample', title: 'Imprimir amostra segura', detail: 'Usar Teste 58mm, Teste 80mm ou A4/PDF. A amostra não baixa estoque e não abre caixa.', protectedArea: 'Impressão' },
  { id: 'disable-before-real', title: 'Desativar antes do uso real', detail: 'Antes da primeira venda verdadeira, desativar o modo e copiar a evidência do treinamento.', protectedArea: 'Operação real' },
];


const FINAL_ACCEPTANCE_KEY = 'smart-loja:final-commercial-acceptance-v135';
const LEGACY_FINAL_ACCEPTANCE_KEYS = ['smart-loja:final-commercial-acceptance-v134', 'smart-loja:final-commercial-acceptance-v133', 'smart-loja:final-commercial-acceptance-v131', 'smart-loja:final-commercial-acceptance-v130', 'smart-loja:final-commercial-acceptance-v129'];

const ASSISTED_RUN_KEY = 'smart-loja:assisted-commercial-run-v135';
const LEGACY_ASSISTED_RUN_KEYS = ['smart-loja:assisted-commercial-run-v134', 'smart-loja:assisted-commercial-run-v133', 'smart-loja:assisted-commercial-run-v131', 'smart-loja:assisted-commercial-run-v130', 'smart-loja:assisted-commercial-run-v129', 'smart-loja:assisted-commercial-run-v128', 'smart-loja:assisted-commercial-run-v127'];

const FIRST_CLIENT_ONBOARDING_KEY = 'smart-loja:first-client-onboarding-v135';
const LEGACY_FIRST_CLIENT_ONBOARDING_KEYS = ['smart-loja:first-client-onboarding-v134', 'smart-loja:first-client-onboarding-v133', 'smart-loja:first-client-onboarding-v131'];

const FIRST_CLIENT_ONBOARDING_STEPS: FirstClientOnboardingStep[] = [
  { id: 'client-briefing', phase: '1. Antes de entregar', title: 'Cliente entendeu o que o app faz', action: 'Explicar que o PWA roda no celular e no PC, sincroniza pela nuvem e precisa de internet para enviar pendências.', expected: 'Cliente sabe abrir o app, entende pendências e não confunde teste com venda real.', owner: 'Você / suporte', priority: 'P1' },
  { id: 'install-pwa-phone', phase: '2. Instalação', title: 'PWA instalado no celular principal', action: 'Abrir o link no Chrome/Android, tocar em instalar/adicionar à tela inicial e abrir pelo ícone.', expected: 'App abre em tela cheia, mostra v135 no Diagnóstico e não fica preso em cache antigo.', owner: 'Cliente com suporte', priority: 'P1' },
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
    id: 'deploy-cache-v135-real',
    phase: '1. Deploy e atualização',
    title: 'Deploy aplicado e PWA abriu v135',
    whatToDo: 'Depois do deploy, abrir o app instalado no celular, entrar em Diagnóstico Web e conferir versão/cache v135.',
    expected: 'O celular mostra a versão nova, sem tela antiga presa e sem menu cortado.',
    evidence: 'Print do Diagnóstico Web com versão/cache v135.',
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
    const normalizedId = id === 'deploy-cache-v128-real' || id === 'deploy-cache-v129-real' || id === 'deploy-cache-v130-real' || id === 'deploy-cache-v131-real' || id === 'deploy-cache-v134-real' ? 'deploy-cache-v135-real' : id;
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
  if (params.triage.p0 > 0) blockers.push(`Existem ${params.triage.p0} item(ns) P0 crítico(s) na correção pós-teste.`);
  if (params.triage.p1 > 0) blockers.push(`Existem ${params.triage.p1} item(ns) P1 alto(s) antes de vender em escala.`);
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
    'Smart Loja Fácil — fechamento comercial / aceite final v135',
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
    'Smart Loja Fácil — kit de venda / onboarding do primeiro cliente v135',
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
    `Olá! Seu Smart Loja Fácil foi preparado para ${params.state.clientName || 'sua loja'}. No primeiro dia, use o app com acompanhamento: cadastre produtos/clientes, faça uma venda pequena, confira caixa/comprovante e me envie o diagnóstico se aparecer qualquer aviso.`,
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
    'Smart Loja Fácil — tour de apresentação comercial v135',
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
    'Smart Loja Fácil — proposta comercial / planos e benefícios v135',
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
    'Aviso honesto: proposta não substitui teste real. Antes de venda final, validar Supabase, dois aparelhos, permissões, impressão e aceite final.',
  ].filter(Boolean).join('\n');
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
    'Smart Loja Fácil — plano de correção aceite v135',
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
    'Smart Loja Fácil — execução real assistida v135',
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
    'Smart Loja Fácil — roteiro guiado comercial v135',
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
    'Smart Loja Fácil — modo treinamento seguro v135',
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
    'Smart Loja Fácil — teste comercial v135',
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
    setFeedback({ tone: 'success', text: 'Ambiente demo desativado. Toque em Puxar dados para carregar a loja real e confirme Supabase antes de vender.' });
    onRefresh();
  }

  async function copyDemoMode(): Promise<void> {
    const lines = [
      'Smart Loja Fácil — tour comercial guiado v135',
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
      '- Para venda verdadeira, desative a demo, confira login/Supabase e rode o teste comercial.',
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

  async function copyDiagnostic(): Promise<void> {
    const text = report
      ? `${reportToText(report, snapshot)}\n\n${buildGuidedTestText({ doneIds: guidedDoneIds, report, snapshot, roleState, online })}\n\n${buildAssistedExecutionText({ state: assistedState, report, snapshot, roleState, online })}\n\n${buildTriageText({ items: triageItems, state: assistedState, report, snapshot, roleState, online })}

${buildFinalAcceptanceText({ gate: finalGate, acceptance: finalAcceptance, report, triage: triageSummary, assisted: assistedSummary, guidedDone: guidedDoneCount, guidedTotal: GUIDED_COMMERCIAL_STEPS.length, snapshot, roleState, online })}

${buildFirstClientOnboardingText({ state: onboardingState, gate: finalGate, roleState, report, online, snapshot })}

${buildCommercialTourText({ state: tourState, demoMode, trainingMode, roleState, report, gate: finalGate, online, snapshot })}

${buildCommercialProposalText({ state: proposalState, plan: currentProposalPlan, gate: finalGate, tourPercent, onboardingPercent, report, roleState, online, snapshot })}

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
        <small className="mapp-final-honesty">Demo ativa não substitui teste real. Antes de vender de verdade, saia da demo, confira login/Supabase, rode o teste comercial e valide dois aparelhos.</small>
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
        <small className="mapp-final-honesty">Proposta é apoio comercial, não contrato automático. Antes de vender como final, valide dois aparelhos, permissões, impressão, Supabase e aceite final.</small>
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
        <div className="mapp-section-title"><h2>Correção aceite</h2><button type="button" onClick={() => void copyTriagePlan()}>Copiar plano</button></div>
        <div className="mapp-triage-summary">
          <div>
            <strong>{triageSummary.decision}</strong>
            <p>Transforma Falhou/Bloqueado em prioridade real para corrigir sem chute.</p>
          </div>
          <span className={triageSummary.p0 ? 'danger' : triageSummary.p1 ? 'warn' : 'ok'}>{triageSummary.total ? `${triageSummary.total} item(ns)` : 'limpo'}</span>
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
          <span><b>Cache</b><strong>v135 proposta</strong></span>
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
          <p>Use a proposta comercial v135, a execução real assistida e o Kit do primeiro cliente em dois aparelhos. Marque Passou/Falhou/Bloqueado, copie a evidência e só venda quando não houver falha crítica.</p>
        </div>
        <button type="button" onClick={() => void copyDiagnostic()}>Copiar</button>
      </section>
    </div>
  );
}

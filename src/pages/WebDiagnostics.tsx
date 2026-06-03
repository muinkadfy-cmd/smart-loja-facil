import React, { useEffect, useMemo, useState } from 'react';
import { WebAuthPanel } from '../components/WebAuthPanel';
import { getPublicWebEnv } from '../lib/env';
import { getRuntimeInfo } from '../lib/runtime';
import { buildProductionChecklistText, getProductionCheckSummary, PRODUCTION_CHECKLIST, readProductionCheckState, saveProductionCheckState, type ProductionCheckState } from '../lib/productionChecklist';
import { buildDesignReadinessText, getDesignReadinessReport, type DesignReadinessReport } from '../lib/designSystemReadiness';
import { buildCssInventoryText, getCssInventoryReport, type CssInventoryReport } from '../lib/cssInventoryReadiness';
import { buildModuleVisualChecklistText, getModuleVisualSummary, MODULE_VISUAL_CHECKLIST, readModuleVisualState, saveModuleVisualState, type ModuleVisualState } from '../lib/moduleVisualChecklist';
import { buildNeoFamilyText, getNeoFamilyReport, type NeoFamilyReport } from '../lib/neoFamilyReadiness';
import { buildNeoShellSidebarText, getNeoShellSidebarReport, type NeoShellSidebarReport } from '../lib/neoShellSidebarReadiness';
import { buildNeoImportantText, getNeoImportantReport, type NeoImportantReport } from '../lib/neoImportantReadiness';
import { flushWebOutbox, getWebOutboxStats, getWebRoleCapabilities, getWebStoreContext, readWebSyncSnapshot, WEB_APP_VERSION, WEB_CACHE_VERSION, WEB_REALTIME_TABLES, webRoleLabel, type WebOutboxStats, type WebStoreRole, type WebSyncSnapshot } from '../lib/webApi';
import type { PageKey } from '../types';

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

interface SyncModuleCheck {
  title: string;
  detail: string;
}

interface LayoutViewportState {
  width: number;
  height: number;
  mode: 'mobile' | 'tablet' | 'desktop';
  mainScrollOk: boolean;
  bottomNavOk: boolean;
  sidebarOk: boolean;
}

interface LayoutAuditPage {
  key: PageKey;
  label: string;
  visual: 'OK' | 'Atenção' | 'Precisa revisar';
  scroll: 'OK' | 'Atenção' | 'Precisa revisar';
  mobile: 'OK' | 'Atenção' | 'Precisa revisar';
  web: 'OK' | 'Atenção' | 'Precisa revisar';
  note: string;
}

const LAYOUT_AUDIT_PAGES: LayoutAuditPage[] = [
  { key: 'dashboard', label: 'Dashboard', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Tela principal com cards e alertas; validar em 360/390/412px após deploy.' },
  { key: 'sales', label: 'Vendas / PDV', visual: 'Atenção', scroll: 'Atenção', mobile: 'Atenção', web: 'OK', note: 'Tela mais densa: conferir pagamento, resumo, cliente e últimas vendas no celular.' },
  { key: 'orders', label: 'Pedidos', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Verificar filtros e estados vazios em tela pequena.' },
  { key: 'products', label: 'Produtos', visual: 'Atenção', scroll: 'OK', mobile: 'Atenção', web: 'OK', note: 'Conferir cards/tabela e campos de cadastro com teclado aberto.' },
  { key: 'customers', label: 'Clientes', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Conferir formulário e botões principais sem bottom nav cobrir.' },
  { key: 'reports', label: 'Relatórios', visual: 'OK', scroll: 'OK', mobile: 'Atenção', web: 'OK', note: 'Gráficos e tabelas precisam de scroll interno seguro.' },
  { key: 'cash', label: 'Caixa', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Validar abertura/fechamento e botões no fim da página.' },
  { key: 'credits', label: 'Crediário', visual: 'Atenção', scroll: 'OK', mobile: 'Atenção', web: 'OK', note: 'Tabela densa; conferir parcelas e valores no mobile.' },
  { key: 'receipts', label: 'Comprovantes', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Conferir visualização e ações de impressão/compartilhar.' },
  { key: 'backup', label: 'Backup', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Conferir botões sem corte em celular pequeno.' },
  { key: 'settings', label: 'Configurações', visual: 'Atenção', scroll: 'OK', mobile: 'Atenção', web: 'OK', note: 'Muitos campos; validar teclado, select e botão salvar.' },
  { key: 'audit', label: 'Logs / Diagnóstico', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Checklist visual e logs devem rolar internamente.' },
  { key: 'diagnostics', label: 'Diagnóstico Web', visual: 'OK', scroll: 'OK', mobile: 'OK', web: 'OK', note: 'Painel principal de suporte, cache, layout e checklist.' },
];

function readLayoutViewportState(): LayoutViewportState {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, mode: 'desktop', mainScrollOk: false, bottomNavOk: false, sidebarOk: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const main = document.querySelector<HTMLElement>('.neo-page-shell');
  const bottomNav = document.querySelector<HTMLElement>('.neo-mobile-dock');
  const sidebar = document.querySelector<HTMLElement>('.neo-sidebar');
  return {
    width,
    height,
    mode: width <= 860 ? 'mobile' : width <= 1180 ? 'tablet' : 'desktop',
    mainScrollOk: Boolean(main && main.scrollHeight >= main.clientHeight),
    bottomNavOk: width > 860 || Boolean(bottomNav && getComputedStyle(bottomNav).position === 'fixed'),
    sidebarOk: Boolean(sidebar && ['auto', 'scroll', 'hidden'].includes(getComputedStyle(sidebar).overflowY || getComputedStyle(sidebar).overflow)),
  };
}

const SYNC_MODULE_CHECKS: SyncModuleCheck[] = [
  { title: 'Clientes', detail: 'Criar/editar no PC, conferir no celular e depois testar o caminho inverso.' },
  { title: 'Produtos', detail: 'Cadastrar produto, alterar estoque e confirmar nos dois aparelhos.' },
  { title: 'Vendas / PDV', detail: 'Finalizar venda simples e conferir histórico, recibo e indicadores.' },
  { title: 'Caixa', detail: 'Confirmar entrada da venda e recebimentos sem duplicar valores.' },
  { title: 'Crediário', detail: 'Gerar parcela, receber e verificar status nos dois aparelhos.' },
  { title: 'Pedidos', detail: 'Criar pedido e alterar status com atualização em web/mobile.' },
  { title: 'Relatórios', detail: 'Conferir se Dashboard e relatórios leem os mesmos totais da nuvem.' },
  { title: 'Permissões', detail: 'Testar dono/admin/operador/leitor sem botão indevido liberado.' },
  { title: 'Cache / PWA', detail: 'Fechar, abrir, atualizar versão e confirmar que não ficou preso no cache antigo.' },
];


interface WebDiagnosticsPageProps {
  onNavigate?: (page: PageKey) => void;
}

export function WebDiagnosticsPage({ onNavigate }: WebDiagnosticsPageProps): JSX.Element {
  const runtime = useMemo(() => getRuntimeInfo(), []);
  const env = useMemo(() => getPublicWebEnv(), []);
  const [context, setContext] = useState<WebContextState>({
    storeName: 'Aguardando login',
    role: 'sem login',
    email: 'Entre para sincronizar',
    detail: 'Login Supabase ainda não carregado neste aparelho.',
  });
  const [copyMessage, setCopyMessage] = useState('');
  const [syncSnapshot, setSyncSnapshot] = useState<WebSyncSnapshot>(() => readWebSyncSnapshot());
  const [outboxStats, setOutboxStats] = useState<WebOutboxStats>(() => getWebOutboxStats());
  const [outboxBusy, setOutboxBusy] = useState(false);
  const [syncGuideMessage, setSyncGuideMessage] = useState('Escolha uma área para ver o teste web/mobile recomendado.');
  const [productionChecks, setProductionChecks] = useState<ProductionCheckState>(() => readProductionCheckState());
  const [designReadiness, setDesignReadiness] = useState<DesignReadinessReport>(() => getDesignReadinessReport());
  const [cssInventory, setCssInventory] = useState<CssInventoryReport>(() => getCssInventoryReport());
  const [moduleVisualChecks, setModuleVisualChecks] = useState<ModuleVisualState>(() => readModuleVisualState());
  const [neoFamily, setNeoFamily] = useState<NeoFamilyReport>(() => getNeoFamilyReport());
  const [neoShellSidebar, setNeoShellSidebar] = useState<NeoShellSidebarReport>(() => getNeoShellSidebarReport());
  const [neoImportant, setNeoImportant] = useState<NeoImportantReport>(() => getNeoImportantReport());
  const [layoutViewport, setLayoutViewport] = useState<LayoutViewportState>(() => readLayoutViewportState());

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
          detail: `Loja ${payload.store.id.slice(0, 8)} com papel ${webRoleLabel(payload.role).toLowerCase()}.`,
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

  useEffect(() => {
    const sync = () => setSyncSnapshot(readWebSyncSnapshot());
    window.addEventListener('smart-loja:web-sync-status', sync);
    window.addEventListener('storage', sync);
    sync();
    return () => {
      window.removeEventListener('smart-loja:web-sync-status', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const syncProductionChecks = () => setProductionChecks(readProductionCheckState());
    window.addEventListener('smart-loja:production-checklist-change', syncProductionChecks);
    window.addEventListener('storage', syncProductionChecks);
    syncProductionChecks();
    return () => {
      window.removeEventListener('smart-loja:production-checklist-change', syncProductionChecks);
      window.removeEventListener('storage', syncProductionChecks);
    };
  }, []);

  useEffect(() => {
    const syncModuleVisualChecks = () => setModuleVisualChecks(readModuleVisualState());
    window.addEventListener('smart-loja:module-visual-change', syncModuleVisualChecks);
    window.addEventListener('storage', syncModuleVisualChecks);
    syncModuleVisualChecks();
    return () => {
      window.removeEventListener('smart-loja:module-visual-change', syncModuleVisualChecks);
      window.removeEventListener('storage', syncModuleVisualChecks);
    };
  }, []);

  useEffect(() => {
    const updateVisualReadiness = () => {
      setDesignReadiness(getDesignReadinessReport());
      setCssInventory(getCssInventoryReport());
      setNeoFamily(getNeoFamilyReport());
      setNeoShellSidebar(getNeoShellSidebarReport());
      setNeoImportant(getNeoImportantReport());
    };
    updateVisualReadiness();
    window.setTimeout(updateVisualReadiness, 250);
    window.addEventListener('resize', updateVisualReadiness);
    window.addEventListener('orientationchange', updateVisualReadiness);
    return () => {
      window.removeEventListener('resize', updateVisualReadiness);
      window.removeEventListener('orientationchange', updateVisualReadiness);
    };
  }, []);



  useEffect(() => {
    const syncLayoutViewport = () => setLayoutViewport(readLayoutViewportState());
    syncLayoutViewport();
    window.setTimeout(syncLayoutViewport, 300);
    window.addEventListener('resize', syncLayoutViewport);
    window.addEventListener('orientationchange', syncLayoutViewport);
    return () => {
      window.removeEventListener('resize', syncLayoutViewport);
      window.removeEventListener('orientationchange', syncLayoutViewport);
    };
  }, []);

  useEffect(() => {
    const syncOutbox = () => setOutboxStats(getWebOutboxStats());
    window.addEventListener('smart-loja:web-outbox-change', syncOutbox);
    window.addEventListener('storage', syncOutbox);
    syncOutbox();
    return () => {
      window.removeEventListener('smart-loja:web-outbox-change', syncOutbox);
      window.removeEventListener('storage', syncOutbox);
    };
  }, []);

  const capabilities = getWebRoleCapabilities(context.role);
  const productionSummary = getProductionCheckSummary(productionChecks);
  const productionDoneSet = new Set(productionChecks.doneIds);
  const moduleVisualSummary = getModuleVisualSummary(moduleVisualChecks);
  const moduleVisualDoneSet = new Set(moduleVisualChecks.doneIds);
  const onlineLabel = typeof navigator === 'undefined' || navigator.onLine ? 'Online' : 'Sem internet';
  const swLabel = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker.controller ? 'Controlando cache' : 'Registrável'
    : 'Indisponível';
  const supabaseScore = [
    env.hasSupabaseUrl,
    env.hasSupabaseAnonKey,
    env.isConfigured && context.role !== 'sem login',
    capabilities.canRead,
    syncSnapshot.status === 'synced',
  ].filter(Boolean).length;
  const supabaseLevel = !env.isConfigured
    ? `${supabaseScore}/5 · faltam variáveis públicas ou há chave proibida`
    : context.role === 'sem login'
      ? `${supabaseScore}/5 · ambiente configurado, login pendente`
      : `${supabaseScore}/5 · login, loja, permissão e sync auditados`;
  const supabaseLevelDetail = !env.isConfigured
    ? 'Configure URL e chave pública no Cloudflare para liberar login e sincronização.'
    : context.role === 'sem login'
      ? 'A conexão pública foi encontrada; falta entrar com usuário Supabase.'
      : 'Leitura da loja e papel funcionando. Próximo nível: testes reais de CRUD, RLS e sync em dois aparelhos.';

  const diagnosticText = [
    `Versão: ${WEB_APP_VERSION}`,
    `Ambiente: ${runtime.platformLabel}`,
    `Host: ${runtime.appHost}`,
    `Loja: ${context.storeName}`,
    `Usuário: ${context.email}`,
    `Papel: ${webRoleLabel(context.role)}`,
    `Permissão: ${capabilities.writeLabel}`,
    `Nível Supabase: ${supabaseLevel}`,
    `Supabase URL: ${env.hasSupabaseUrl ? 'ok' : 'faltando'}`,
    `Supabase anon key: ${env.hasSupabaseAnonKey ? `ok (${env.supabaseAnonKeyName})` : 'faltando'}`,
    `Service role no frontend: ${env.hasUnsafeServiceRoleKey ? 'REMOVER' : 'não detectado'}`,
    `Rede: ${onlineLabel}`,
    `Service worker: ${swLabel}`,
    `Cache: ${WEB_CACHE_VERSION}`,
    `Tela: ${layoutViewport.width}x${layoutViewport.height} · ${layoutViewport.mode}`,
    `Rolagem principal: ${layoutViewport.mainScrollOk ? 'OK' : 'atenção'}`,
    `Bottom nav: ${layoutViewport.bottomNavOk ? 'OK' : 'atenção'}`,
    `Sidebar: ${layoutViewport.sidebarOk ? 'OK' : 'atenção'}`,
    `Checklist abas: ${LAYOUT_AUDIT_PAGES.map((item) => `${item.label}=${item.visual}/${item.scroll}`).join('; ')}`,
    `Cache: ${WEB_CACHE_VERSION}`,
    `Atualização multiaparelhos: ${WEB_REALTIME_TABLES.length} áreas monitoradas`,
    `Última sincronização: ${syncSnapshot.at ? new Date(syncSnapshot.at).toLocaleString('pt-BR') : 'sem registro'} · ${syncSnapshot.module} · ${syncSnapshot.detail}`,
    `Pendências neste aparelho: ${outboxStats.total}`,
    `Último erro pendente: ${outboxStats.lastError || 'nenhum'}`,
    `Checklist comercial: ${productionSummary.done}/${productionSummary.total} (${productionSummary.percent}%)`,
    `Checklist visual por tela: ${moduleVisualSummary.done}/${moduleVisualSummary.total} (${moduleVisualSummary.percent}%)`,
    `Checklist manual de sync v99: ${SYNC_MODULE_CHECKS.map((item) => item.title).join(', ')}`,
    buildDesignReadinessText(designReadiness),
    buildCssInventoryText(cssInventory),
    buildNeoFamilyText(neoFamily),
    buildNeoShellSidebarText(neoShellSidebar),
    buildNeoImportantText(neoImportant),
    buildModuleVisualChecklistText(moduleVisualChecks),
  ].join('\n');

  async function copyDiagnostic(): Promise<void> {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopyMessage('Diagnóstico copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar automaticamente. Selecione os dados na tela.');
    }
  }

  function toggleProductionCheck(id: string): void {
    const done = new Set(productionChecks.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setProductionChecks(saveProductionCheckState(Array.from(done)));
  }

  function toggleModuleVisualCheck(id: string): void {
    const done = new Set(moduleVisualChecks.doneIds);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setModuleVisualChecks(saveModuleVisualState(Array.from(done)));
  }

  async function copyModuleVisualChecklist(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildModuleVisualChecklistText(moduleVisualChecks));
      setCopyMessage('Checklist visual por tela copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar o checklist visual automaticamente.');
    }
  }

  async function copyProductionChecklist(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildProductionChecklistText(productionChecks));
      setCopyMessage('Checklist comercial copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar o checklist automaticamente.');
    }
  }

  async function copyLayoutChecklist(): Promise<void> {
    const text = LAYOUT_AUDIT_PAGES.map((item) => `${item.label}: visual ${item.visual}, scroll ${item.scroll}, mobile ${item.mobile}, web ${item.web}. ${item.note}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Checklist de abas copiado para enviar no suporte.');
    } catch {
      setCopyMessage('Não foi possível copiar o checklist de abas automaticamente.');
    }
  }

  function openAuditPage(page: PageKey): void {
    if (onNavigate) {
      onNavigate(page);
      window.setTimeout(() => document.querySelector('.neo-page-shell')?.scrollTo({ top: 0, behavior: 'smooth' }), 80);
      return;
    }
    setCopyMessage('Abra esta aba pelo menu lateral ou bottom nav para conferir o visual.');
  }

  function refreshScreen(): void {
    window.location.reload();
  }

  async function clearPwaCache(): Promise<void> {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      setCopyMessage('Cache limpo. Atualize a tela para baixar a versão nova.');
    } catch {
      setCopyMessage('Não foi possível limpar o cache automaticamente neste navegador.');
    }
  }

  async function retryPendingSync(): Promise<void> {
    if (outboxBusy) return;
    setOutboxBusy(true);
    try {
      const stats = await flushWebOutbox();
      setOutboxStats(stats);
      setCopyMessage(stats.total === 0 ? 'Pendências reenviadas para a nuvem.' : 'Ainda existem pendências. Verifique conexão, login e permissão.');
    } catch {
      setOutboxStats(getWebOutboxStats());
      setCopyMessage('Não foi possível reenviar agora. Confira internet, login e permissão.');
    } finally {
      setOutboxBusy(false);
    }
  }

  function showSyncTestGuide(area: 'clientes' | 'produtos' | 'vendas'): void {
    const labels = {
      clientes: 'Clientes',
      produtos: 'Produtos',
      vendas: 'Vendas/PDV',
    } as const;
    const action = area === 'clientes'
      ? 'cadastre ou edite um cliente no web e confirme no celular; depois faça o inverso.'
      : area === 'produtos'
        ? 'cadastre ou ajuste estoque de um produto no celular e confirme no web; depois faça o inverso.'
        : 'monte uma venda pequena no PDV web, finalize e confira Dashboard/Caixa no celular.';
    setSyncGuideMessage(`${labels[area]}: ${action} Aguarde alguns segundos, recarregue somente se necessário e copie este diagnóstico se algo não aparecer.`);
  }

  const items: HealthItem[] = [
    {
      label: 'Ambiente',
      value: runtime.isWeb ? 'PWA / Navegador' : 'Aplicativo local',
      tone: runtime.isWeb ? 'ok' : 'info',
      detail: runtime.isWeb ? 'Rodando no navegador com foco web/mobile.' : 'Rodando no desktop local.',
    },
    {
      label: 'Host atual',
      value: runtime.appHost,
      tone: 'info',
      detail: runtime.platformLabel,
    },
    {
      label: 'Loja ativa',
      value: context.storeName,
      tone: context.role === 'sem login' ? 'warn' : 'ok',
      detail: context.detail,
    },
    {
      label: 'Usuário e papel',
      value: `${webRoleLabel(context.role)} · ${context.email}`,
      tone: context.role === 'sem login' ? 'warn' : 'ok',
      detail: 'Permissões reforçadas no app e pela RLS do Supabase.',
    },
    {
      label: 'Permissão de escrita',
      value: capabilities.canOperate ? 'Liberada' : 'Somente leitura',
      tone: capabilities.canOperate ? 'ok' : 'warn',
      detail: capabilities.writeLabel,
    },
    {
      label: 'Rede do aparelho',
      value: onlineLabel,
      tone: onlineLabel === 'Online' ? 'ok' : 'warn',
      detail: onlineLabel === 'Online' ? 'Sincronização pode comunicar com Supabase.' : 'O app abre do cache, mas não salva na nuvem até a conexão voltar.',
    },
    {
      label: 'Layout atual',
      value: `${layoutViewport.width}×${layoutViewport.height} · ${layoutViewport.mode}`,
      tone: layoutViewport.mainScrollOk && layoutViewport.bottomNavOk ? 'ok' : 'warn',
      detail: `Rolagem ${layoutViewport.mainScrollOk ? 'OK' : 'atenção'} · bottom nav ${layoutViewport.bottomNavOk ? 'OK' : 'atenção'} · sidebar ${layoutViewport.sidebarOk ? 'OK' : 'atenção'}.`,
    },
    {
      label: 'Service worker',
      value: swLabel,
      tone: swLabel === 'Indisponível' ? 'warn' : 'ok',
      detail: 'Cache versionado com limpeza de versões antigas.',
    },
    {
      label: 'Nível Supabase',
      value: supabaseLevel,
      tone: context.role === 'sem login' ? 'warn' : env.isConfigured ? 'ok' : 'warn',
      detail: supabaseLevelDetail,
    },
    {
      label: 'Service role',
      value: env.hasUnsafeServiceRoleKey ? 'Remover agora' : 'Não detectado',
      tone: env.hasUnsafeServiceRoleKey ? 'warn' : 'ok',
      detail: env.hasUnsafeServiceRoleKey ? env.securityWarnings.join(' ') : 'Nenhuma variável service_role foi exposta ao frontend.',
    },
    {
      label: 'URL Supabase',
      value: env.hasSupabaseUrl ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseUrl ? 'ok' : 'warn',
      detail: env.hasSupabaseUrl ? 'Variável pública encontrada.' : 'Adicione VITE_SUPABASE_URL no Cloudflare.',
    },
    {
      label: 'Chave pública',
      value: env.hasSupabaseAnonKey ? 'Configurada' : 'Faltando',
      tone: env.hasSupabaseAnonKey ? 'ok' : 'warn',
      detail: env.hasSupabaseAnonKey ? `Carregada por ${env.supabaseAnonKeyName}.` : 'Adicione VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY no Cloudflare.',
    },
    {
      label: 'Pendências do aparelho',
      value: outboxStats.total > 0 ? `${outboxStats.total} aguardando envio` : 'Nenhuma',
      tone: outboxStats.total > 0 ? 'warn' : 'ok',
      detail: outboxStats.total > 0 ? (outboxStats.lastError || 'Há alterações guardadas neste celular aguardando reenvio para a nuvem.') : 'Nada pendente na fila local deste aparelho.',
    },
    {
      label: 'Checklist comercial',
      value: `${productionSummary.done}/${productionSummary.total} ok`,
      tone: productionSummary.pending === 0 ? 'ok' : 'warn',
      detail: productionSummary.pending === 0 ? 'Todos os testes manuais foram marcados neste aparelho.' : `${productionSummary.pending} testes reais ainda precisam ser marcados depois de validar Supabase, RLS, mobile e cache.`,
    },
    {
      label: 'Design/mobile',
      value: `${designReadiness.okCount}/${designReadiness.total} ok`,
      tone: designReadiness.score >= 84 ? 'ok' : 'warn',
      detail: `Tela atual: ${designReadiness.viewport}. Use o checklist abaixo para validar toque, safe-area e tokens visuais.`,
    },
    {
      label: 'CSS modular',
      value: `${cssInventory.okCount}/${cssInventory.total} ok`,
      tone: cssInventory.score >= 84 ? 'ok' : 'warn',
      detail: `Regras lidas: ${cssInventory.ruleCount}. Fundação limpa 118, componentes 120 e alertas limpos 121 precisam aparecer como ativos.`,
    },
    {
      label: 'Família neo-*',
      value: `${neoFamily.okCount}/${neoFamily.total} ok`,
      tone: neoFamily.score >= 84 ? 'ok' : 'warn',
      detail: `Famílias detectadas: ${neoFamily.familyCount}. Valida shell, topbar, sidebar, ribbon e dock mobile.`,
    },
    {
      label: 'Shell/sidebar limpo',
      value: `${neoShellSidebar.okCount}/${neoShellSidebar.total} ok`,
      tone: neoShellSidebar.score >= 84 ? 'ok' : 'warn',
      detail: `Shell ${neoShellSidebar.shellWidth}px · sidebar ${neoShellSidebar.sidebarWidth}px · página ${neoShellSidebar.pageShellWidth}px.`,
    },
    {
      label: 'Visual por tela',
      value: `${moduleVisualSummary.done}/${moduleVisualSummary.total} ok`,
      tone: moduleVisualSummary.pending === 0 ? 'ok' : 'warn',
      detail: moduleVisualSummary.pending === 0 ? 'Telas críticas marcadas como conferidas neste aparelho.' : `${moduleVisualSummary.pending} telas críticas ainda precisam de conferência visual real.`,
    },
    {
      label: 'Atualização multiaparelhos',
      value: `${WEB_REALTIME_TABLES.length} áreas`,
      tone: context.role === 'sem login' ? 'warn' : syncSnapshot.status === 'pending' || syncSnapshot.status === 'error' ? 'warn' : 'ok',
      detail: context.role === 'sem login' ? 'Entre para ativar escuta em tempo real.' : 'Clientes, produtos, vendas, caixa, crediário, pedidos, comprovantes, backup e permissões escutam mudanças da nuvem.',
    },
    {
      label: 'Versão app',
      value: WEB_APP_VERSION,
      tone: 'ok',
      detail: 'Versão lógica informada pelo app web.',
    },
    {
      label: 'Versão cache',
      value: WEB_CACHE_VERSION,
      tone: 'ok',
      detail: 'Service Worker versionado e aviso de nova versão ativo.',
    },
    {
      label: 'Última tentativa de sync',
      value: syncSnapshot.at ? new Date(syncSnapshot.at).toLocaleString('pt-BR') : 'Sem registro',
      tone: syncSnapshot.status === 'error' || syncSnapshot.status === 'pending' ? 'warn' : syncSnapshot.status === 'synced' ? 'ok' : 'info',
      detail: `${syncSnapshot.module}: ${syncSnapshot.detail}`,
    },
  ];

  return (
    <div className="stack web-stack webdiagnostics-light-v65 webdiagnostics-safe-v66">
      <section className="web-hero-card">
        <span className="web-kicker">Diagnóstico de produção</span>
        <h1>PWA web/mobile com Supabase como foco principal</h1>
        <p>Esta tela valida login, loja ativa, papel do usuário, cache, conexão e nível Supabase. Os detalhes técnicos ficam aqui para o dashboard continuar limpo para usuário leigo.</p>
        <div className={`web-sync-banner web-sync-${syncSnapshot.status}`}>
          <strong>{syncSnapshot.status === 'synced' ? 'Sincronizado na nuvem' : syncSnapshot.status === 'syncing' ? 'Sincronizando com a nuvem' : syncSnapshot.status === 'pending' ? 'Dados pendentes neste aparelho' : syncSnapshot.status === 'error' ? 'Não foi possível sincronizar' : 'Aguardando sincronização'}</strong>
          <span>{syncSnapshot.detail}</span>
        </div>
        <div className="web-diagnostics-actions">
          <button type="button" className="primary-btn web-copy-diagnostic-btn" onClick={copyDiagnostic}>Copiar diagnóstico</button>
          <button type="button" className="secondary-btn web-copy-diagnostic-btn" onClick={() => void retryPendingSync()} disabled={outboxBusy || outboxStats.total === 0}>{outboxBusy ? 'Enviando...' : 'Reenviar pendências'}</button>
          {copyMessage ? <span className="web-message">{copyMessage}</span> : null}
        </div>
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


      <section className="layout-audit-card" aria-label="Diagnóstico visual de layout e rolagem">
        <div className="layout-audit-head">
          <div>
            <span className="web-kicker">Auditoria visual v111</span>
            <h2>Rolagem, abas e tamanho da tela</h2>
            <p>Use este painel para conferir se a tela rola, se o menu não cobre conteúdo e se cada aba abre com leitura segura no PC e no celular.</p>
          </div>
          <strong className={`neo-mini-chip ${layoutViewport.mainScrollOk && layoutViewport.bottomNavOk ? 'ok' : 'warn'}`}>{layoutViewport.mode}</strong>
        </div>

        <div className="layout-audit-metrics">
          <span><strong>{layoutViewport.width}px</strong><small>Largura</small></span>
          <span><strong>{layoutViewport.height}px</strong><small>Altura</small></span>
          <span><strong>{layoutViewport.mainScrollOk ? 'OK' : 'Atenção'}</strong><small>Rolagem</small></span>
          <span><strong>{layoutViewport.bottomNavOk ? 'OK' : 'Atenção'}</strong><small>Bottom nav</small></span>
          <span><strong>{layoutViewport.sidebarOk ? 'OK' : 'Atenção'}</strong><small>Sidebar</small></span>
        </div>

        <div className="layout-audit-actions">
          <button type="button" onClick={refreshScreen}>Recarregar tela</button>
          <button type="button" onClick={() => void clearPwaCache()}>Atualizar cache</button>
          <button type="button" onClick={copyLayoutChecklist}>Copiar checklist</button>
        </div>

        <div className="layout-audit-table" role="table" aria-label="Checklist de abas">
          <div className="layout-audit-row layout-audit-row-head" role="row">
            <span>Aba</span><span>Visual</span><span>Scroll</span><span>Mobile</span><span>Web</span><span>Ação</span>
          </div>
          {LAYOUT_AUDIT_PAGES.map((item) => (
            <div key={item.key} className="layout-audit-row" role="row">
              <span><strong>{item.label}</strong><small>{item.note}</small></span>
              <em className={`layout-audit-pill ${item.visual === 'OK' ? 'ok' : item.visual === 'Atenção' ? 'warn' : 'danger'}`}>{item.visual}</em>
              <em className={`layout-audit-pill ${item.scroll === 'OK' ? 'ok' : item.scroll === 'Atenção' ? 'warn' : 'danger'}`}>{item.scroll}</em>
              <em className={`layout-audit-pill ${item.mobile === 'OK' ? 'ok' : item.mobile === 'Atenção' ? 'warn' : 'danger'}`}>{item.mobile}</em>
              <em className={`layout-audit-pill ${item.web === 'OK' ? 'ok' : item.web === 'Atenção' ? 'warn' : 'danger'}`}>{item.web}</em>
              <button type="button" onClick={() => openAuditPage(item.key)}>Abrir</button>
            </div>
          ))}
        </div>
      </section>

      <section className="web-sync-test-card" aria-label="Teste guiado de sincronização web e celular">
        <div className="web-sync-test-head">
          <div>
            <span className="web-kicker">Teste web/mobile real</span>
            <h2>Valide a sincronização antes de vender</h2>
            <p>{syncGuideMessage}</p>
          </div>
          <strong className={`neo-mini-chip ${outboxStats.total === 0 && syncSnapshot.status !== 'error' ? 'ok' : 'warn'}`}>{outboxStats.total === 0 ? 'Sem pendências locais' : `${outboxStats.total} pendente(s)`}</strong>
        </div>
        <div className="web-sync-test-grid">
          <button type="button" onClick={() => showSyncTestGuide('clientes')}>Testar clientes</button>
          <button type="button" onClick={() => showSyncTestGuide('produtos')}>Testar produtos</button>
          <button type="button" onClick={() => showSyncTestGuide('vendas')}>Testar vendas</button>
          <button type="button" className="primary-sync-action" onClick={() => void retryPendingSync()} disabled={outboxBusy}>{outboxBusy ? 'Sincronizando...' : 'Forçar sincronização'}</button>
        </div>
      </section>

      <section className="web-sync-module-check-card" aria-label="Checklist manual de sincronização por módulo">
        <div className="web-sync-module-check-head">
          <span className="web-kicker">Checklist manual v99</span>
          <h2>O que conferir no PC e no celular</h2>
          <p>Marque como pronto para vender somente depois de testar estas áreas em dois aparelhos reais. O app mostra status de sync, mas a validação comercial precisa confirmar dados aparecendo nos dois lados.</p>
        </div>
        <div className="web-sync-module-grid">
          {SYNC_MODULE_CHECKS.map((item) => (
            <article key={item.title} className="web-sync-module-card">
              <i />
              <span><strong>{item.title}</strong><span>{item.detail}</span></span>
            </article>
          ))}
        </div>
        <div className="web-sync-module-steps">
          <strong>Roteiro rápido antes de vender</strong>
          <ol>
            <li>Abra o sistema no PC e no celular com o mesmo usuário.</li>
            <li>Crie cliente/produto em um aparelho e confira no outro sem limpar dados.</li>
            <li>Finalize uma venda simples e confira Dashboard, Caixa e Relatórios.</li>
            <li>Feche e abra o PWA no celular para confirmar cache novo e dados preservados.</li>
          </ol>
        </div>
      </section>

      <section className="mobile-readiness-card">
        <span className="web-kicker">Pronto para celular</span>
        <h2>PWA atualizado, cache novo e área segura</h2>
        <p>O app agora tem manifest, ícones PNG/maskable, service worker com cache versionado, aviso de atualização e fila local de pendências para o celular não perder alterações quando a internet oscilar.</p>
        <div className="mobile-readiness-grid">
          <span>Ícones 192/512</span>
          <span>Cache versionado</span>
          <span>Fila de pendências</span>
          <span>Aviso de nova versão</span>
          <span>Safe-area ativa</span>
        </div>
      </section>

      <section className="design-readiness-card" aria-label="Diagnóstico de design system e mobile">
        <div className="design-readiness-head">
          <div>
            <span className="web-kicker">Design system e tela atual</span>
            <h2>Tokens, toque, safe-area e renderização mobile</h2>
            <p>Este bloco não substitui teste visual real, mas ajuda a detectar rapidamente se o navegador atual está com base visual, toque e suporte mobile em nível seguro.</p>
          </div>
          <div className="design-readiness-score">
            <strong>{designReadiness.score}%</strong>
            <span>{designReadiness.okCount}/{designReadiness.total} ok</span>
          </div>
        </div>
        <div className="design-readiness-grid">
          {designReadiness.items.map((item) => (
            <article key={item.id} className={`design-readiness-item design-readiness-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="css-inventory-card" aria-label="Inventário CSS e performance visual">
        <div className="css-inventory-head">
          <div>
            <span className="web-kicker">Inventário CSS limpo v122</span>
            <h2>CSS modular, corte lateral e renderização segura</h2>
            <p>Este bloco confirma se a fundação limpa e a camada v122 foram carregadas, mostrando sinais de risco visual antes de vender: excesso de regras, corte lateral, toque mínimo e folhas carregadas.</p>
          </div>
          <div className="css-inventory-score">
            <strong>{cssInventory.score}%</strong>
            <span>{cssInventory.okCount}/{cssInventory.total} ok</span>
          </div>
        </div>
        <div className="css-inventory-grid">
          {cssInventory.items.map((item) => (
            <article key={item.id} className={`css-inventory-item css-inventory-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="neo-family-card" aria-label="Família visual neo shell topbar sidebar e dock">
        <div className="neo-family-head">
          <div>
            <span className="web-kicker">Família neo-* limpa + shell/sidebar v122</span>
            <h2>Shell, topbar, sidebar, página e dock mobile</h2>
            <p>Este bloco mede se a camada visual principal está carregada, se existe corte lateral na tela atual e se o dock mantém toque confortável. Ele ajuda a limpar CSS antigo sem quebrar telas prontas.</p>
          </div>
          <div className="neo-family-score">
            <strong>{neoFamily.score}%</strong>
            <span>{neoFamily.okCount}/{neoFamily.total} ok</span>
          </div>
        </div>
        <div className="neo-family-grid">
          {neoFamily.items.map((item) => (
            <article key={item.id} className={`neo-family-item neo-family-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="clean-shell-sidebar-card" aria-label="Consolidação visual shell e sidebar limpos">
        <div className="clean-shell-sidebar-head">
          <div>
            <span className="web-kicker">Shell/sidebar limpo</span>
            <h2>Consolidação da página principal e menu lateral</h2>
            <p>Este bloco verifica largura, corte lateral, rolagem, toque do menu e tokens novos sem depender de CSS antigo.</p>
          </div>
          <div className="clean-shell-sidebar-score">
            <strong>{neoShellSidebar.score}%</strong>
            <span>{neoShellSidebar.okCount}/{neoShellSidebar.total} ok</span>
          </div>
        </div>
        <div className="clean-shell-sidebar-grid">
          {neoShellSidebar.items.map((item) => (
            <article key={item.id} className={`clean-shell-sidebar-item clean-shell-sidebar-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="clean-important-card" aria-label="Redução controlada de important no shell e sidebar">
        <div className="clean-important-head">
          <div>
            <span className="web-kicker">Prioridade CSS limpa</span>
            <h2>Prioridades CSS do shell e menu lateral</h2>
            <p>Este bloco mede quantas prioridades forçadas ainda existem em .neo-page-shell e .neo-sidebar. A redução continua controlada para não quebrar telas prontas sem teste visual real.</p>
          </div>
          <div className="clean-important-score">
            <strong>{neoImportant.score}%</strong>
            <span>{neoImportant.okCount}/{neoImportant.total} ok</span>
          </div>
        </div>
        <div className="clean-important-grid">
          {neoImportant.items.map((item) => (
            <article key={item.id} className={`clean-important-item clean-important-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="module-visual-card" aria-label="Checklist visual por tela crítica">
        <div className="module-visual-head">
          <div>
            <span className="web-kicker">Validação visual por tela</span>
            <h2>Dashboard, produtos, vendas, caixa, crediário e diagnóstico</h2>
            <p>Marque somente depois de abrir a tela no web e no celular. Este checklist evita chamar de pronto uma tela que ainda estoura, corta botão ou fica confusa para usuário leigo.</p>
          </div>
          <div className="module-visual-score">
            <strong>{moduleVisualSummary.percent}%</strong>
            <span>{moduleVisualSummary.done}/{moduleVisualSummary.total} telas</span>
          </div>
        </div>
        <div className="production-progress" aria-label={`Progresso visual ${moduleVisualSummary.percent}%`}>
          <span style={{ width: `${moduleVisualSummary.percent}%` }} />
        </div>
        <div className="module-visual-grid">
          {MODULE_VISUAL_CHECKLIST.map((item) => {
            const checked = moduleVisualDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={`module-visual-row module-visual-${item.tone} ${checked ? 'done' : ''}`} onClick={() => toggleModuleVisualCheck(item.id)}>
                <span>{checked ? 'OK' : 'Pendente'} · {item.area}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
                <em>{item.expected}</em>
              </button>
            );
          })}
        </div>
        <div className="web-diagnostics-actions production-check-actions">
          <button type="button" className="secondary-btn web-copy-diagnostic-btn" onClick={copyModuleVisualChecklist}>Copiar checklist visual</button>
          {moduleVisualSummary.pending > 0 ? <span className="web-message">Ainda faltam {moduleVisualSummary.pending} telas críticas para conferência real em web e mobile.</span> : <span className="web-message">Todas as telas críticas foram marcadas como conferidas neste aparelho.</span>}
        </div>
      </section>

      <section className="production-check-card" aria-label="Checklist comercial Supabase RLS e mobile">
        <div className="production-check-head">
          <div>
            <span className="web-kicker">Teste real antes de vender</span>
            <h2>Checklist Supabase, RLS, multiaparelho e mobile</h2>
            <p>Marque somente depois de testar em aparelhos reais. Isso não substitui o Supabase: serve para o suporte saber o que já foi validado e o que ainda está pendente.</p>
          </div>
          <div className="production-check-score">
            <strong>{productionSummary.percent}%</strong>
            <span>{productionSummary.done}/{productionSummary.total} concluídos</span>
          </div>
        </div>
        <div className="production-progress" aria-label={`Progresso ${productionSummary.percent}%`}>
          <span style={{ width: `${productionSummary.percent}%` }} />
        </div>
        <div className="production-check-grid">
          {PRODUCTION_CHECKLIST.map((item) => {
            const checked = productionDoneSet.has(item.id);
            return (
              <button key={item.id} type="button" className={`production-check-row production-check-${item.tone} ${checked ? 'done' : ''}`} onClick={() => toggleProductionCheck(item.id)}>
                <span className="production-check-status">{checked ? 'OK' : 'Pendente'}</span>
                <strong>{item.title}</strong>
                <small>{item.group} · {item.detail}</small>
                <em>{item.expected}</em>
              </button>
            );
          })}
        </div>
        <div className="web-diagnostics-actions production-check-actions">
          <button type="button" className="secondary-btn web-copy-diagnostic-btn" onClick={copyProductionChecklist}>Copiar checklist</button>
          {productionSummary.pending > 0 ? <span className="web-message">Ainda faltam {productionSummary.pending} validações reais antes de chamar de pronto para cliente final.</span> : <span className="web-message">Checklist comercial marcado como completo neste aparelho.</span>}
        </div>
      </section>

      <section className="web-permission-grid" aria-label="Resumo de permissões web">
        <span className={capabilities.canRead ? 'ok' : 'warn'}>Leitura: {capabilities.canRead ? 'sim' : 'não'}</span>
        <span className={capabilities.canOperate ? 'ok' : 'warn'}>Operação: {capabilities.canOperate ? 'sim' : 'não'}</span>
        <span className={capabilities.canManageStore ? 'ok' : 'warn'}>Configurações: {capabilities.canManageStore ? 'sim' : 'não'}</span>
        <span className={capabilities.canManageMembers ? 'ok' : 'warn'}>Usuários: {capabilities.canManageMembers ? 'dono' : 'bloqueado'}</span>
      </section>

      <div className="web-two-col">
        <WebAuthPanel />
        <section className="web-card">
          <span className="web-kicker">Segurança</span>
          <h2>Regras de produção</h2>
          <ul className="web-check-list">
            <li>Frontend usa somente URL e anon key públicas.</li>
            <li>Service role e VAPID private key ficam fora do app.</li>
            <li>Loja ativa e papel do usuário são lidos pelo Supabase.</li>
            <li>Clientes, produtos, pedidos, vendas, caixa, crediário, comprovantes e relatórios passam pela camada web com filtro por loja.</li>
            <li>Antes de vender para cliente final, teste criação, edição, exclusão lógica e leitura em dois aparelhos com usuários de papéis diferentes.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

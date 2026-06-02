export type CssInventoryTone = 'ok' | 'warn' | 'info';

export interface CssInventoryItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: CssInventoryTone;
  ok: boolean;
}

export interface CssInventoryReport {
  score: number;
  okCount: number;
  total: number;
  ruleCount: number;
  sheetCount: number;
  items: CssInventoryItem[];
}

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getRootToken(name: string): string {
  if (!canUseDom()) return '';
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function countAccessibleRules(): { sheetCount: number; ruleCount: number; blockedCount: number } {
  if (!canUseDom()) return { sheetCount: 0, ruleCount: 0, blockedCount: 0 };
  let sheetCount = 0;
  let ruleCount = 0;
  let blockedCount = 0;
  Array.from(document.styleSheets).forEach((sheet) => {
    sheetCount += 1;
    try {
      ruleCount += sheet.cssRules.length;
    } catch {
      blockedCount += 1;
    }
  });
  return { sheetCount, ruleCount, blockedCount };
}

function getHorizontalOverflow(): number {
  if (!canUseDom()) return 0;
  return Math.max(0, Math.round(document.documentElement.scrollWidth - window.innerWidth));
}

function cssSupports(property: string, value: string): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);
}

export function getCssInventoryReport(): CssInventoryReport {
  const moduleToken = getRootToken('--lote77-css-module');
  const cleanupToken = getRootToken('--lote78-css-cleanup');
  const neoFamilyToken = getRootToken('--lote79-neo-family');
  const shellSidebarToken = getRootToken('--lote80-neo-shell-sidebar');
  const importantReductionToken = getRootToken('--lote81-neo-important-reduction');
  const loginPremiumToken = getRootToken('--lote82-login-premium');
  const dashboardPremiumToken = getRootToken('--lote83-dashboard-premium');
  const dashboardMobileRefineToken = getRootToken('--lote84-mobile-dashboard-refine');
  const salesPdvPremiumToken = getRootToken('--lote85-sales-pdv-premium');
  const ordersPremiumToken = getRootToken('--lote86-orders-premium');
  const productsPremiumToken = getRootToken('--lote87-products-premium');
  const productPhotosStorageToken = getRootToken('--lote88-product-photos-storage');
  const customersPremiumToken = getRootToken('--lote89-customers-premium');
  const cashPremiumToken = getRootToken('--lote90-cash-premium');
  const creditsPremiumToken = getRootToken('--lote91-credits-premium');
  const reportsPremiumToken = getRootToken('--lote92-reports-premium');
  const backupSettingsPremiumToken = getRootToken('--lote93-backup-settings-premium');
  const cssConsolidationToken = getRootToken('--lote95-css-consolidation');
  const commercialValidationToken = getRootToken('--lote96-commercial-validation');
  const realtimeSyncToken = getRootToken('--lote97-realtime-sync');
  const touchMin = getRootToken('--touch-target-min');
  const { sheetCount, ruleCount, blockedCount } = countAccessibleRules();
  const overflowPx = getHorizontalOverflow();
  const modularLoaded = moduleToken === 'active';
  const cleanupLoaded = cleanupToken === 'active';
  const neoFamilyLoaded = neoFamilyToken === 'active';
  const shellSidebarLoaded = shellSidebarToken === 'active';
  const importantReductionLoaded = importantReductionToken === 'active';
  const loginPremiumLoaded = loginPremiumToken === 'active';
  const dashboardPremiumLoaded = dashboardPremiumToken === 'active';
  const dashboardMobileRefineLoaded = dashboardMobileRefineToken === 'active';
  const salesPdvPremiumLoaded = salesPdvPremiumToken === 'active';
  const ordersPremiumLoaded = ordersPremiumToken === 'active';
  const productsPremiumLoaded = productsPremiumToken === 'active';
  const productPhotosStorageLoaded = productPhotosStorageToken === 'active';
  const customersPremiumLoaded = customersPremiumToken === 'active';
  const cashPremiumLoaded = cashPremiumToken === 'active';
  const creditsPremiumLoaded = creditsPremiumToken === 'active';
  const reportsPremiumLoaded = reportsPremiumToken === 'active';
  const backupSettingsPremiumLoaded = backupSettingsPremiumToken === 'active';
  const cssConsolidationLoaded = cssConsolidationToken === 'active';
  const commercialValidationLoaded = commercialValidationToken === 'active';
  const realtimeSyncLoaded = realtimeSyncToken === 'active';
  const hugeRuleWarning = ruleCount > 0 && ruleCount <= 4200;
  const overflowOk = overflowPx <= 1;

  const items: CssInventoryItem[] = [
    {
      id: 'lote77-module',
      label: 'CSS modular v77',
      value: modularLoaded ? 'Ativo' : 'Não detectado',
      detail: modularLoaded ? 'As regras novas seguem isoladas em src/styles/lote77-design-system.css.' : 'O módulo isolado não foi carregado; confira import no main.tsx.',
      tone: modularLoaded ? 'ok' : 'warn',
      ok: modularLoaded,
    },
    {
      id: 'lote78-cleanup',
      label: 'Limpeza CSS v78',
      value: cleanupLoaded ? 'Ativa' : 'Não detectada',
      detail: cleanupLoaded ? 'O módulo de limpeza controlada foi carregado e o CSS antigo passou por deduplicação segura.' : 'O módulo v78 não foi carregado; confira import no main.tsx.',
      tone: cleanupLoaded ? 'ok' : 'warn',
      ok: cleanupLoaded,
    },
    {
      id: 'lote79-neo-family',
      label: 'Família neo v79',
      value: neoFamilyLoaded ? 'Ativa' : 'Não detectada',
      detail: neoFamilyLoaded ? 'A camada final da família neo-* foi carregada para estabilizar shell, topbar, sidebar, ribbon e dock.' : 'O módulo v79 não foi carregado; confira import no main.tsx.',
      tone: neoFamilyLoaded ? 'ok' : 'warn',
      ok: neoFamilyLoaded,
    },
    {
      id: 'lote80-shell-sidebar',
      label: 'Shell/sidebar v80',
      value: shellSidebarLoaded ? 'Ativo' : 'Não detectado',
      detail: shellSidebarLoaded ? 'A camada v80 mede e estabiliza .neo-page-shell e .neo-sidebar antes de remover mais CSS antigo.' : 'O módulo v80 não foi carregado; confira import no main.tsx.',
      tone: shellSidebarLoaded ? 'ok' : 'warn',
      ok: shellSidebarLoaded,
    },
    {
      id: 'lote81-important-reduction',
      label: 'Redução !important v81',
      value: importantReductionLoaded ? 'Ativa' : 'Não detectada',
      detail: importantReductionLoaded ? 'A camada v81 reforça largura/scroll seguros e inicia remoção controlada de !important em shell/sidebar.' : 'O módulo v81 não foi carregado; confira import no main.tsx.',
      tone: importantReductionLoaded ? 'ok' : 'warn',
      ok: importantReductionLoaded,
    },

    {
      id: 'lote82-login-premium',
      label: 'Login premium v82',
      value: loginPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: loginPremiumLoaded ? 'A camada v82 corrige hierarquia, corte vertical, botão sem nuvem e leitura mobile/web da tela de entrada.' : 'O módulo v82 não foi carregado; confira import no main.tsx.',
      tone: loginPremiumLoaded ? 'ok' : 'warn',
      ok: loginPremiumLoaded,
    },
    {
      id: 'lote83-dashboard-premium',
      label: 'Dashboard premium v83',
      value: dashboardPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: dashboardPremiumLoaded ? 'A camada v83 compacta a header, melhora hierarquia do dashboard, respiro dos cards e leitura web/mobile do painel principal.' : 'O módulo v83 não foi carregado; confira import no main.tsx.',
      tone: dashboardPremiumLoaded ? 'ok' : 'warn',
      ok: dashboardPremiumLoaded,
    },
    {
      id: 'lote84-mobile-dashboard-refine',
      label: 'Dashboard mobile v84',
      value: dashboardMobileRefineLoaded ? 'Ativo' : 'Não detectado',
      detail: dashboardMobileRefineLoaded ? 'A camada v84 corrige empilhamento do hero, quebra dos botões, grade de operação rápida e chips de atalho no celular.' : 'O módulo v84 não foi carregado; confira import no main.tsx.',
      tone: dashboardMobileRefineLoaded ? 'ok' : 'warn',
      ok: dashboardMobileRefineLoaded,
    },
    {
      id: 'lote85-sales-pdv-premium',
      label: 'Vendas/PDV premium v85',
      value: salesPdvPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: salesPdvPremiumLoaded ? 'A camada v85 melhora formulários, resumo, pagamentos, tabela vazia, somente leitura e responsividade da aba Vendas/PDV.' : 'O módulo v85 não foi carregado; confira import no main.tsx.',
      tone: salesPdvPremiumLoaded ? 'ok' : 'warn',
      ok: salesPdvPremiumLoaded,
    },
    {
      id: 'lote86-orders-premium',
      label: 'Pedidos premium v86',
      value: ordersPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: ordersPremiumLoaded ? 'A camada v86 melhora montar pedido, filtros, tabela vazia, somente leitura e leitura mobile/web da aba Pedidos.' : 'O módulo v86 não foi carregado; confira import no main.tsx.',
      tone: ordersPremiumLoaded ? 'ok' : 'warn',
      ok: ordersPremiumLoaded,
    },
    {
      id: 'lote87-products-premium',
      label: 'Produtos premium v87',
      value: productsPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: productsPremiumLoaded ? 'A camada v87 refina KPIs, filtros, tabela, ações, cadastro, foto e ajuste de estoque da aba Produtos.' : 'O módulo v87 não foi carregado; confira import no main.tsx.',
      tone: productsPremiumLoaded ? 'ok' : 'warn',
      ok: productsPremiumLoaded,
    },
    {
      id: 'lote88-product-photos-storage',
      label: 'Fotos Storage v88',
      value: productPhotosStorageLoaded ? 'Ativo' : 'Não detectado',
      detail: productPhotosStorageLoaded ? 'A camada v88 prepara fotos de produtos para Supabase Storage com fallback seguro de compatibilidade.' : 'O módulo v88 não foi carregado; confira import no main.tsx.',
      tone: productPhotosStorageLoaded ? 'ok' : 'warn',
      ok: productPhotosStorageLoaded,
    },
    {
      id: 'lote89-customers-premium',
      label: 'Clientes premium v89',
      value: customersPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: customersPremiumLoaded ? 'A camada v89 melhora cadastro, filtros, lista, estados vazios, somente leitura e leitura mobile/web da aba Clientes.' : 'O módulo v89 não foi carregado; confira import no main.tsx.',
      tone: customersPremiumLoaded ? 'ok' : 'warn',
      ok: customersPremiumLoaded,
    },
    {
      id: 'lote90-cash-premium',
      label: 'Caixa premium v90',
      value: cashPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: cashPremiumLoaded ? 'A camada v90 melhora abertura, fechamento, lançamentos, resumo, movimentos e leitura mobile/web do Caixa.' : 'O módulo v90 não foi carregado; confira import no main.tsx.',
      tone: cashPremiumLoaded ? 'ok' : 'warn',
      ok: cashPremiumLoaded,
    },
    {
      id: 'lote91-credits-premium',
      label: 'Crediário premium v91',
      value: creditsPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: creditsPremiumLoaded ? 'A camada v91 melhora cards, cliente, parcelas, modal de recebimento, comprovante e leitura mobile/web do Crediário.' : 'O módulo v91 não foi carregado; confira import no main.tsx.',
      tone: creditsPremiumLoaded ? 'ok' : 'warn',
      ok: creditsPremiumLoaded,
    },
    {
      id: 'lote92-reports-premium',
      label: 'Relatórios premium v92',
      value: reportsPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: reportsPremiumLoaded ? 'A camada v92 melhora filtros, presets, métricas, tabela, exportação CSV, loading e estado vazio dos relatórios.' : 'O módulo v92 não foi carregado; confira import no main.tsx.',
      tone: reportsPremiumLoaded ? 'ok' : 'warn',
      ok: reportsPremiumLoaded,
    },
    {
      id: 'lote93-backup-settings-premium',
      label: 'Backup/Configurações premium v93',
      value: backupSettingsPremiumLoaded ? 'Ativo' : 'Não detectado',
      detail: backupSettingsPremiumLoaded ? 'A camada v93 melhora backup, restauração, configurações da loja, mensagens de risco e responsividade.' : 'O módulo v93 não foi carregado; confira import no main.tsx.',
      tone: backupSettingsPremiumLoaded ? 'ok' : 'warn',
      ok: backupSettingsPremiumLoaded,
    },
    {
      id: 'lote95-css-consolidation',
      label: 'Consolidação CSS v95',
      value: cssConsolidationLoaded ? 'Ativa' : 'Não detectada',
      detail: cssConsolidationLoaded ? 'A camada v95 reforça limites seguros e o CSS legado foi consolidado com remoção controlada de !important.' : 'O módulo v95 não foi carregado; confira import no main.tsx.',
      tone: cssConsolidationLoaded ? 'ok' : 'warn',
      ok: cssConsolidationLoaded,
    },
    {
      id: 'lote96-commercial-validation',
      label: 'Validação comercial v96',
      value: commercialValidationLoaded ? 'Ativa' : 'Não detectada',
      detail: commercialValidationLoaded ? 'A camada v96 marca pacote comercial limpo, checklist Supabase/PWA e preparação de release sem bancos de teste.' : 'O módulo v96 não foi carregado; confira import no main.tsx.',
      tone: commercialValidationLoaded ? 'ok' : 'warn',
      ok: commercialValidationLoaded,
    },
    {
      id: 'lote97-realtime-sync',
      label: 'Sync multiaparelhos v97',
      value: realtimeSyncLoaded ? 'Ativo' : 'Não detectado',
      detail: realtimeSyncLoaded ? 'A camada v97 reforça status de atualização ao vivo, chips de sync e leitura mobile dos alertas de nuvem.' : 'O módulo v97 não foi carregado; confira import no main.tsx.',
      tone: realtimeSyncLoaded ? 'ok' : 'warn',
      ok: realtimeSyncLoaded,
    },
    {
      id: 'css-rules',
      label: 'Inventário de regras',
      value: ruleCount > 0 ? `${ruleCount} regras` : 'Indisponível',
      detail: ruleCount > 4200 ? 'CSS ainda grande, mas os lotes 78–97 já isolaram camadas seguras, iniciaram consolidação do legado e adicionaram validação comercial.' : 'Quantidade lida pelo navegador está dentro do esperado para a base atual.',
      tone: ruleCount > 4200 ? 'warn' : 'info',
      ok: hugeRuleWarning || ruleCount === 0,
    },
    {
      id: 'stylesheets',
      label: 'Folhas carregadas',
      value: blockedCount > 0 ? `${sheetCount} folhas · ${blockedCount} bloqueada(s)` : `${sheetCount} folhas`,
      detail: blockedCount > 0 ? 'Alguma folha não pôde ser lida pelo navegador, geralmente por origem externa.' : 'Folhas carregadas no mesmo app e auditáveis pelo diagnóstico.',
      tone: blockedCount > 0 ? 'warn' : 'ok',
      ok: blockedCount === 0,
    },
    {
      id: 'horizontal-overflow',
      label: 'Corte lateral',
      value: overflowOk ? 'Sem corte' : `${overflowPx}px sobrando`,
      detail: overflowOk ? 'A tela atual não mostra estouro horizontal detectável.' : 'Existe largura sobrando; testar a tela atual no celular e revisar cards/tabelas.',
      tone: overflowOk ? 'ok' : 'warn',
      ok: overflowOk,
    },
    {
      id: 'touch-token',
      label: 'Toque mínimo',
      value: touchMin || 'não definido',
      detail: touchMin ? 'Token de toque mínimo do Lote 77 disponível para botões e formulários.' : 'Token de toque mínimo não carregado.',
      tone: touchMin ? 'ok' : 'warn',
      ok: Boolean(touchMin),
    },
    {
      id: 'containment',
      label: 'Renderização leve',
      value: cssSupports('content-visibility', 'auto') ? 'Suportada' : 'Fallback',
      detail: cssSupports('content-visibility', 'auto') ? 'O navegador suporta otimização de cards fora da tela.' : 'O app funciona, mas navegadores antigos renderizam mais elementos.',
      tone: cssSupports('content-visibility', 'auto') ? 'ok' : 'info',
      ok: true,
    },
  ];

  const okCount = items.filter((item) => item.ok).length;
  return {
    score: Math.round((okCount / items.length) * 100),
    okCount,
    total: items.length,
    ruleCount,
    sheetCount,
    items,
  };
}

export function buildCssInventoryText(report: CssInventoryReport): string {
  return [
    `CSS/design modular, limpeza v78, família neo v79, shell/sidebar v80, redução v81, login v82, dashboard v83, mobile v84, PDV v85, Pedidos v86, Produtos v87, Fotos v88, Clientes v89, Caixa v90, Crediário v91, Relatórios v92, Backup/Config v93 e CSS v95: ${report.okCount}/${report.total} (${report.score}%)`,
    `Folhas: ${report.sheetCount} · regras lidas: ${report.ruleCount}`,
    ...report.items.map((item) => `${item.ok ? '[OK]' : '[ATENÇÃO]'} ${item.label}: ${item.value} · ${item.detail}`),
  ].join('\n');
}

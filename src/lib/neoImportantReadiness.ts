export type NeoImportantTone = 'ok' | 'warn' | 'info';

export interface NeoImportantItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: NeoImportantTone;
  ok: boolean;
}

export interface NeoImportantReport {
  score: number;
  okCount: number;
  total: number;
  pageShellImportant: number;
  sidebarImportant: number;
  safeImportantBudget: number;
  items: NeoImportantItem[];
}

function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getRootVar(name: string): string {
  if (!hasDom()) return '';
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function countImportantForSelector(target: string): number {
  if (!hasDom()) return 0;
  let count = 0;
  Array.from(document.styleSheets).forEach((sheet) => {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }
    Array.from(rules).forEach((rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      if (!rule.selectorText.includes(target)) return;
      for (let index = 0; index < rule.style.length; index += 1) {
        const property = rule.style.item(index);
        if (rule.style.getPropertyPriority(property) === 'important') count += 1;
      }
    });
  });
  return count;
}

function horizontalOverflowPx(): number {
  if (!hasDom()) return 0;
  return Math.max(0, Math.round(document.documentElement.scrollWidth - window.innerWidth));
}

function pageShellHasClipFallback(): boolean {
  if (!hasDom()) return true;
  const pageShell = document.querySelector('.neo-page-shell');
  if (!(pageShell instanceof HTMLElement)) return true;
  const style = window.getComputedStyle(pageShell);
  return style.overflowX === 'clip' || style.overflowX === 'hidden' || style.maxWidth !== 'none';
}

export function getNeoImportantReport(): NeoImportantReport {
  if (!hasDom()) {
    const items: NeoImportantItem[] = [{
      id: 'dom',
      label: 'Navegador',
      value: 'Indisponível',
      detail: 'Diagnóstico visual disponível somente no navegador.',
      tone: 'info',
      ok: true,
    }];
    return { score: 100, okCount: 1, total: 1, pageShellImportant: 0, sidebarImportant: 0, safeImportantBudget: 420, items };
  }

  const tokenLoaded = getRootVar('--lote81-neo-important-reduction') === 'active';
  const pageBottomSafe = getRootVar('--lote81-page-bottom-safe');
  const shellInlineSafe = getRootVar('--lote81-shell-inline-safe');
  const pageShellImportant = countImportantForSelector('.neo-page-shell');
  const sidebarImportant = countImportantForSelector('.neo-sidebar');
  const totalImportant = pageShellImportant + sidebarImportant;
  const safeImportantBudget = 420;
  const overflowPx = horizontalOverflowPx();
  const clipSafe = pageShellHasClipFallback();

  const items: NeoImportantItem[] = [
    {
      id: 'token',
      label: 'Módulo v81',
      value: tokenLoaded ? 'Ativo' : 'Ausente',
      detail: tokenLoaded ? 'Camada de redução controlada de !important carregada depois do CSS legado.' : 'O CSS v81 não carregou; confira import no main.tsx.',
      tone: tokenLoaded ? 'ok' : 'warn',
      ok: tokenLoaded,
    },
    {
      id: 'important-budget',
      label: '!important shell/sidebar',
      value: `${totalImportant}`,
      detail: totalImportant <= safeImportantBudget ? 'Dentro do orçamento legado temporário. Próximo lote pode reduzir por tela.' : 'Ainda existe excesso legado; reduzir somente com validação visual real.',
      tone: totalImportant <= safeImportantBudget ? 'ok' : 'warn',
      ok: totalImportant <= safeImportantBudget,
    },
    {
      id: 'page-shell-important',
      label: '.neo-page-shell',
      value: `${pageShellImportant} !important`,
      detail: pageShellImportant <= 140 ? 'Página principal abaixo do limite inicial v81.' : 'A página principal ainda carrega muitas prioridades forçadas.',
      tone: pageShellImportant <= 140 ? 'ok' : 'warn',
      ok: pageShellImportant <= 140,
    },
    {
      id: 'sidebar-important',
      label: '.neo-sidebar',
      value: `${sidebarImportant} !important`,
      detail: sidebarImportant <= 280 ? 'Sidebar abaixo do limite inicial v81.' : 'Sidebar ainda precisa limpeza por bloco após abrir o app real.',
      tone: sidebarImportant <= 280 ? 'ok' : 'warn',
      ok: sidebarImportant <= 280,
    },
    {
      id: 'overflow',
      label: 'Corte lateral',
      value: overflowPx > 0 ? `${overflowPx}px` : 'Sem corte',
      detail: overflowPx > 2 ? 'Existe estouro lateral; valide cards/tabelas da tela atual.' : 'A tela atual não apresenta estouro lateral detectável.',
      tone: overflowPx > 2 ? 'warn' : 'ok',
      ok: overflowPx <= 2,
    },
    {
      id: 'clip-safe',
      label: 'Proteção de largura',
      value: clipSafe ? 'Ativa' : 'Revisar',
      detail: clipSafe ? 'A área principal tem proteção contra estouro horizontal.' : 'Abra uma tela interna e confirme overflow/max-width.',
      tone: clipSafe ? 'ok' : 'warn',
      ok: clipSafe,
    },
    {
      id: 'bottom-safe',
      label: 'Espaço mobile',
      value: pageBottomSafe || 'não definido',
      detail: pageBottomSafe ? 'Token v81 reserva área para dock/menu inferior em celular.' : 'Token de espaço inferior v81 não carregado.',
      tone: pageBottomSafe ? 'ok' : 'warn',
      ok: Boolean(pageBottomSafe),
    },
    {
      id: 'inline-safe',
      label: 'Largura segura',
      value: shellInlineSafe || 'não definida',
      detail: shellInlineSafe ? 'Token v81 limita shell principal ao viewport sem cortar conteúdo.' : 'Token de largura v81 não carregado.',
      tone: shellInlineSafe ? 'ok' : 'warn',
      ok: Boolean(shellInlineSafe),
    },
  ];

  const okCount = items.filter((item) => item.ok).length;
  return {
    score: Math.round((okCount / items.length) * 100),
    okCount,
    total: items.length,
    pageShellImportant,
    sidebarImportant,
    safeImportantBudget,
    items,
  };
}

export function buildNeoImportantText(report: NeoImportantReport): string {
  return [
    `Redução !important v81: ${report.okCount}/${report.total} (${report.score}%)`,
    `.neo-page-shell: ${report.pageShellImportant} !important · .neo-sidebar: ${report.sidebarImportant} !important · orçamento temporário: ${report.safeImportantBudget}`,
    ...report.items.map((item) => `- ${item.label}: ${item.value} — ${item.detail}`),
  ].join('\n');
}

export type NeoShellSidebarTone = 'ok' | 'warn' | 'info';

export interface NeoShellSidebarItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: NeoShellSidebarTone;
  ok: boolean;
}

export interface NeoShellSidebarReport {
  score: number;
  okCount: number;
  total: number;
  shellWidth: number;
  sidebarWidth: number;
  pageShellWidth: number;
  items: NeoShellSidebarItem[];
}

function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getRootVar(name: string): string {
  if (!hasDom()) return '';
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function pxValue(value: string): number {
  const parsed = Number.parseFloat(value.replace('px', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rectWidth(selector: string): number {
  if (!hasDom()) return 0;
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) return 0;
  return Math.round(node.getBoundingClientRect().width);
}

function minHeight(selector: string): number {
  if (!hasDom()) return 0;
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) return 0;
  return Math.round(node.getBoundingClientRect().height);
}

function cssSupports(prop: string, value: string): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(prop, value);
}

export function getNeoShellSidebarReport(): NeoShellSidebarReport {
  if (!hasDom()) {
    const items: NeoShellSidebarItem[] = [{
      id: 'dom',
      label: 'Navegador',
      value: 'Indisponível',
      detail: 'Diagnóstico visual disponível somente no navegador.',
      tone: 'info',
      ok: true,
    }];
    return { score: 100, okCount: 1, total: 1, shellWidth: 0, sidebarWidth: 0, pageShellWidth: 0, items };
  }

  const shellWidth = rectWidth('.neo-shell') || window.innerWidth;
  const sidebarWidth = rectWidth('.neo-sidebar');
  const pageShellWidth = rectWidth('.neo-page-shell');
  const navItemHeight = minHeight('.neo-sidebar .neo-nav-item');
  const root = document.documentElement;
  const tokenLoaded = getRootVar('--lote80-neo-shell-sidebar') === 'active';
  const safePadding = getRootVar('--lote80-page-safe-padding');
  const viewportWidth = Math.round(window.innerWidth);
  const bodyOverflow = Math.max(document.body.scrollWidth, root.scrollWidth) - viewportWidth;
  const hasHorizontalOverflow = bodyOverflow > 3;
  const pageShell = document.querySelector('.neo-page-shell');
  const sidebar = document.querySelector('.neo-sidebar');
  const pageShellStyle = pageShell instanceof HTMLElement ? window.getComputedStyle(pageShell) : null;
  const sidebarStyle = sidebar instanceof HTMLElement ? window.getComputedStyle(sidebar) : null;
  const pageCanScroll = pageShellStyle ? ['auto', 'scroll', 'overlay'].includes(pageShellStyle.overflowY) : false;
  const sidebarStableScroll = sidebarStyle ? sidebarStyle.scrollbarGutter.includes('stable') || cssSupports('scrollbar-gutter', 'stable') : cssSupports('scrollbar-gutter', 'stable');
  const desktopSidebarOk = viewportWidth < 920 || (sidebarWidth >= 220 && sidebarWidth <= 320);
  const mobileBottomSpace = getRootVar('--lote80-mobile-bottom-space');

  const items: NeoShellSidebarItem[] = [
    {
      id: 'token',
      label: 'Módulo v80',
      value: tokenLoaded ? 'Ativo' : 'Ausente',
      detail: tokenLoaded ? 'Camada de consolidação shell/sidebar carregada depois dos módulos antigos.' : 'O CSS v80 não carregou; confira import no main.tsx.',
      tone: tokenLoaded ? 'ok' : 'warn',
      ok: tokenLoaded,
    },
    {
      id: 'overflow',
      label: 'Corte lateral',
      value: hasHorizontalOverflow ? `${bodyOverflow}px` : 'Sem corte',
      detail: hasHorizontalOverflow ? 'Existe largura sobrando na página; valide a tela atual no celular.' : 'A tela atual não apresenta estouro lateral detectável.',
      tone: hasHorizontalOverflow ? 'warn' : 'ok',
      ok: !hasHorizontalOverflow,
    },
    {
      id: 'sidebar-width',
      label: 'Sidebar',
      value: sidebarWidth ? `${sidebarWidth}px` : 'não visível',
      detail: desktopSidebarOk ? 'Largura da barra lateral está dentro da faixa segura ou está oculta no mobile.' : 'Sidebar fora da faixa segura de desktop; revisar largura e grid.',
      tone: desktopSidebarOk ? 'ok' : 'warn',
      ok: desktopSidebarOk,
    },
    {
      id: 'page-shell-width',
      label: 'Área da página',
      value: pageShellWidth ? `${pageShellWidth}px` : 'não encontrada',
      detail: pageShellWidth > 0 ? 'Área principal detectada para validação de scroll, tabelas e cards.' : 'Abra uma tela interna para medir .neo-page-shell.',
      tone: pageShellWidth > 0 ? 'ok' : 'info',
      ok: pageShellWidth > 0,
    },
    {
      id: 'nav-touch',
      label: 'Toque do menu',
      value: navItemHeight ? `${navItemHeight}px` : 'não medido',
      detail: navItemHeight >= 44 || viewportWidth >= 920 ? 'Itens do menu estão em tamanho confortável para toque/desktop.' : 'Item do menu abaixo de 44px; aumentar altura no mobile.',
      tone: navItemHeight >= 44 || viewportWidth >= 920 ? 'ok' : 'warn',
      ok: navItemHeight >= 44 || viewportWidth >= 920,
    },
    {
      id: 'page-scroll',
      label: 'Rolagem da página',
      value: pageCanScroll ? 'controlada' : 'normal',
      detail: pageCanScroll ? 'A página interna controla rolagem sem depender do body inteiro.' : 'A página usa rolagem normal; validar se o bottom nav não cobre conteúdo.',
      tone: pageCanScroll ? 'ok' : 'info',
      ok: true,
    },
    {
      id: 'safe-padding',
      label: 'Respiro seguro',
      value: safePadding || 'não definido',
      detail: safePadding ? 'Token de padding seguro v80 disponível para telas web/mobile.' : 'Token de padding não carregado.',
      tone: safePadding ? 'ok' : 'warn',
      ok: Boolean(safePadding),
    },
    {
      id: 'bottom-space',
      label: 'Espaço mobile',
      value: mobileBottomSpace || 'não definido',
      detail: mobileBottomSpace ? 'Token reserva área para dock/bottom nav em celular.' : 'Token de espaço inferior não carregado.',
      tone: mobileBottomSpace ? 'ok' : 'warn',
      ok: Boolean(mobileBottomSpace),
    },
    {
      id: 'scrollbar-gutter',
      label: 'Scroll estável',
      value: sidebarStableScroll ? 'suportado' : 'fallback',
      detail: sidebarStableScroll ? 'Navegador suporta área de scrollbar estável, reduzindo salto visual.' : 'Sem suporte completo; app funciona, mas pode haver pequeno salto visual.',
      tone: sidebarStableScroll ? 'ok' : 'info',
      ok: true,
    },
  ];

  const okCount = items.filter((item) => item.ok).length;
  const total = items.length;
  return {
    score: Math.round((okCount / total) * 100),
    okCount,
    total,
    shellWidth,
    sidebarWidth,
    pageShellWidth,
    items,
  };
}

export function buildNeoShellSidebarText(report: NeoShellSidebarReport): string {
  return [
    `Shell/sidebar v80: ${report.okCount}/${report.total} (${report.score}%)`,
    `Shell: ${report.shellWidth}px · Sidebar: ${report.sidebarWidth}px · Página: ${report.pageShellWidth}px`,
    ...report.items.map((item) => `- ${item.label}: ${item.value} — ${item.detail}`),
  ].join('\n');
}

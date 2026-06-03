export type NeoFamilyTone = 'ok' | 'warn' | 'info';

export interface NeoFamilyItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: NeoFamilyTone;
  ok: boolean;
}

export interface NeoFamilyReport {
  score: number;
  okCount: number;
  total: number;
  familyCount: number;
  items: NeoFamilyItem[];
}

const NEO_SELECTORS = [
  '.neo-shell',
  '.neo-sidebar',
  '.neo-topbar',
  '.neo-header-grid',
  '.neo-page-shell',
  '.neo-page-content',
  '.neo-mobile-dock',
];

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getRootToken(name: string): string {
  if (!canUseDom()) return '';
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function countMatches(selector: string): number {
  if (!canUseDom()) return 0;
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function getHorizontalOverflow(): number {
  if (!canUseDom()) return 0;
  return Math.max(0, Math.round(document.documentElement.scrollWidth - window.innerWidth));
}

function getDockMinTouch(): number {
  if (!canUseDom()) return 0;
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('.neo-mobile-dock button'));
  if (buttons.length === 0) return 0;
  const heights = buttons.map((button) => button.getBoundingClientRect().height).filter((height) => height > 0);
  if (heights.length === 0) return 0;
  return Math.round(Math.min(...heights));
}

function getReadableMaxWidth(): number {
  if (!canUseDom()) return 0;
  const shell = document.querySelector<HTMLElement>('.neo-page-shell');
  if (!shell) return 0;
  return Math.round(shell.getBoundingClientRect().width);
}

export function getNeoFamilyReport(): NeoFamilyReport {
  const token = getRootToken('--lote122-clean-alerts');
  const safeGap = getRootToken('--neo-shell-safe-gap');
  const touchToken = getRootToken('--neo-touch-target-safe');
  const matchedFamilies = NEO_SELECTORS.filter((selector) => countMatches(selector) > 0);
  const overflowPx = getHorizontalOverflow();
  const dockMinTouch = getDockMinTouch();
  const readableWidth = getReadableMaxWidth();
  const isSmallViewport = canUseDom() && window.innerWidth <= 760;
  const minExpectedWidth = canUseDom() ? Math.min(window.innerWidth - 4, 320) : 0;

  const items: NeoFamilyItem[] = [
    {
      id: 'token',
      label: 'Alertas limpos v122',
      value: token === 'active' ? 'Ativa' : 'Não detectada',
      detail: token === 'active' ? 'A família neo-* está estabilizada pela camada limpa atual, sem depender dos lotes antigos.' : 'Confira o import de src/styles/lote122-clean-alerts.css no main.tsx.',
      tone: token === 'active' ? 'ok' : 'warn',
      ok: token === 'active',
    },
    {
      id: 'families',
      label: 'Famílias encontradas',
      value: `${matchedFamilies.length}/${NEO_SELECTORS.length}`,
      detail: matchedFamilies.length > 0 ? `Detectado: ${matchedFamilies.join(', ')}.` : 'Nenhuma família neo-* detectada nesta tela; abra Dashboard ou uma tela interna para conferir.',
      tone: matchedFamilies.length >= 4 ? 'ok' : 'info',
      ok: matchedFamilies.length >= 4 || matchedFamilies.length === 0,
    },
    {
      id: 'overflow',
      label: 'Estouro lateral',
      value: overflowPx <= 1 ? 'Sem corte' : `${overflowPx}px`,
      detail: overflowPx <= 1 ? 'A interface não gerou largura sobrando detectável nesta tela.' : 'Existe estouro horizontal; revisar header, tabela, card ou dock nesta tela.',
      tone: overflowPx <= 1 ? 'ok' : 'warn',
      ok: overflowPx <= 1,
    },
    {
      id: 'touch',
      label: 'Toque no dock',
      value: dockMinTouch > 0 ? `${dockMinTouch}px` : touchToken || 'sem dock',
      detail: dockMinTouch >= 42 ? 'Botões do dock estão confortáveis para toque.' : dockMinTouch > 0 ? 'Botões do dock estão menores que o ideal em celular.' : 'Dock não apareceu nesta tela ou viewport atual; token de toque permanece definido.',
      tone: dockMinTouch === 0 || dockMinTouch >= 42 ? 'ok' : 'warn',
      ok: dockMinTouch === 0 || dockMinTouch >= 42,
    },
    {
      id: 'readable-width',
      label: 'Largura útil',
      value: readableWidth > 0 ? `${readableWidth}px` : 'não detectada',
      detail: readableWidth > 0 ? 'Área principal medida para evitar web vazio demais ou mobile espremido.' : 'Abra uma tela interna com .neo-page-shell para medir largura útil.',
      tone: readableWidth > 0 || !isSmallViewport ? 'info' : 'warn',
      ok: readableWidth === 0 || readableWidth >= minExpectedWidth,
    },
    {
      id: 'safe-gap',
      label: 'Espaçamento seguro',
      value: safeGap || 'não definido',
      detail: safeGap ? 'Token de espaçamento atual disponível para header, cards e telas internas.' : 'Token de espaçamento atual não carregado.',
      tone: safeGap ? 'ok' : 'warn',
      ok: Boolean(safeGap),
    },
  ];

  const okCount = items.filter((item) => item.ok).length;
  return {
    score: Math.round((okCount / items.length) * 100),
    okCount,
    total: items.length,
    familyCount: matchedFamilies.length,
    items,
  };
}

export function buildNeoFamilyText(report: NeoFamilyReport): string {
  return [
    `Família neo-* limpa: ${report.okCount}/${report.total} (${report.score}%)`,
    `Famílias detectadas na tela: ${report.familyCount}`,
    ...report.items.map((item) => `${item.ok ? '[OK]' : '[ATENÇÃO]'} ${item.label}: ${item.value} · ${item.detail}`),
  ].join('\n');
}

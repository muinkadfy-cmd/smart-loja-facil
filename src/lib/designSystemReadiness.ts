export type DesignReadinessTone = 'ok' | 'warn' | 'info';

export interface DesignReadinessItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DesignReadinessTone;
  ok: boolean;
}

export interface DesignReadinessReport {
  score: number;
  okCount: number;
  total: number;
  viewport: string;
  items: DesignReadinessItem[];
}

const REQUIRED_TOKENS = ['--bg', '--panel', '--panel-2', '--line', '--text', '--muted', '--blue', '--green', '--red', '--radius'];

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function cssSupports(property: string, value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports(property, value);
}

function getRootToken(name: string): string {
  if (!hasWindow()) return '';
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildViewportLabel(width: number, height: number): string {
  const bucket = width <= 390 ? 'celular pequeno' : width <= 767 ? 'celular' : width <= 1024 ? 'tablet' : 'web/desktop';
  return `${bucket} · ${width}x${height}`;
}

export function getDesignReadinessReport(): DesignReadinessReport {
  if (!hasWindow()) {
    return {
      score: 0,
      okCount: 0,
      total: 0,
      viewport: 'sem navegador',
      items: [],
    };
  }

  const width = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const height = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  const missingTokens = REQUIRED_TOKENS.filter((token) => !getRootToken(token));
  const touchTargetProbe = document.createElement('button');
  touchTargetProbe.className = 'primary-btn design-readiness-probe';
  touchTargetProbe.textContent = 'teste';
  touchTargetProbe.style.position = 'fixed';
  touchTargetProbe.style.left = '-9999px';
  touchTargetProbe.style.top = '-9999px';
  document.body.appendChild(touchTargetProbe);
  const rect = touchTargetProbe.getBoundingClientRect();
  touchTargetProbe.remove();
  const touchTargetOk = rect.height >= 42;

  const items: DesignReadinessItem[] = [
    {
      id: 'tokens',
      label: 'Tokens visuais',
      value: missingTokens.length === 0 ? 'Completos' : `${missingTokens.length} faltando`,
      detail: missingTokens.length === 0 ? 'Cores, bordas e texto base estão disponíveis no :root.' : `Faltam tokens: ${missingTokens.join(', ')}.`,
      tone: missingTokens.length === 0 ? 'ok' : 'warn',
      ok: missingTokens.length === 0,
    },
    {
      id: 'dynamic-viewport',
      label: 'Altura mobile moderna',
      value: cssSupports('height', '100dvh') ? '100dvh ok' : 'Fallback necessário',
      detail: cssSupports('height', '100dvh') ? 'O navegador entende altura dinâmica, melhor para barra do Android/iPhone.' : 'O navegador pode depender de fallback 100vh.',
      tone: cssSupports('height', '100dvh') ? 'ok' : 'warn',
      ok: cssSupports('height', '100dvh'),
    },
    {
      id: 'content-visibility',
      label: 'Renderização leve',
      value: cssSupports('content-visibility', 'auto') ? 'Ativa' : 'Não suportada',
      detail: cssSupports('content-visibility', 'auto') ? 'Cards/listas fora da tela podem renderizar com menor custo.' : 'O app continua funcionando, mas celular fraco pode renderizar mais elementos.',
      tone: cssSupports('content-visibility', 'auto') ? 'ok' : 'info',
      ok: true,
    },
    {
      id: 'safe-area',
      label: 'Safe-area iPhone',
      value: cssSupports('padding-bottom', 'env(safe-area-inset-bottom)') ? 'Suportada' : 'Fallback',
      detail: cssSupports('padding-bottom', 'env(safe-area-inset-bottom)') ? 'O navegador entende área segura para não cobrir botões no iPhone.' : 'O app usa padding padrão quando o navegador não informa safe-area.',
      tone: 'ok',
      ok: true,
    },
    {
      id: 'touch-target',
      label: 'Toque confortável',
      value: touchTargetOk ? `${Math.round(rect.height)}px` : `${Math.round(rect.height)}px baixo`,
      detail: touchTargetOk ? 'Botão primário base está dentro de uma faixa confortável para toque.' : 'Botão primário base ficou baixo; revisar CSS global.',
      tone: touchTargetOk ? 'ok' : 'warn',
      ok: touchTargetOk,
    },
    {
      id: 'viewport',
      label: 'Tela atual',
      value: buildViewportLabel(width, height),
      detail: width <= 390 ? 'Atenção máxima para não cortar texto, tabelas e botões.' : 'Use também um celular pequeno real antes de vender.',
      tone: width <= 390 ? 'warn' : 'info',
      ok: width > 0,
    },
  ];

  const okCount = items.filter((item) => item.ok).length;
  const total = items.length;
  return {
    score: total === 0 ? 0 : Math.round((okCount / total) * 100),
    okCount,
    total,
    viewport: buildViewportLabel(width, height),
    items,
  };
}

export function buildDesignReadinessText(report: DesignReadinessReport): string {
  return [
    `Design system/mobile: ${report.okCount}/${report.total} (${report.score}%)`,
    `Tela atual: ${report.viewport}`,
    ...report.items.map((item) => `${item.ok ? '[OK]' : '[ATENÇÃO]'} ${item.label}: ${item.value} · ${item.detail}`),
  ].join('\n');
}

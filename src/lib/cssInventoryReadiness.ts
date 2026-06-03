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

function countImportantRules(): number {
  if (!canUseDom()) return 0;
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
      for (let index = 0; index < rule.style.length; index += 1) {
        const property = rule.style.item(index);
        if (rule.style.getPropertyPriority(property) === 'important') count += 1;
      }
    });
  });
  return count;
}

function getHorizontalOverflow(): number {
  if (!canUseDom()) return 0;
  return Math.max(0, Math.round(document.documentElement.scrollWidth - window.innerWidth));
}

function cssSupports(property: string, value: string): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);
}

export function getCssInventoryReport(): CssInventoryReport {
  const foundationToken = getRootToken('--lote118-foundation-final');
  const iconLoginToken = getRootToken('--lote119-icon-login-rescue');
  const commercialToken = getRootToken('--lote120-commercial-components');
  const cleanInterfaceToken = getRootToken('--lote121-clean-interface');
  const cleanShellToken = getRootToken('--lote121-clean-shell');
  const touchMin = getRootToken('--touch-target-min');
  const pageBottomSafe = getRootToken('--lote121-page-bottom-safe');
  const shellInlineSafe = getRootToken('--lote121-shell-inline-safe');
  const { sheetCount, ruleCount, blockedCount } = countAccessibleRules();
  const importantCount = countImportantRules();
  const overflowPx = getHorizontalOverflow();
  const overflowOk = overflowPx <= 1;
  const ruleBudgetOk = ruleCount === 0 || ruleCount <= 1600;
  const importantBudgetOk = importantCount <= 180;

  const items: CssInventoryItem[] = [
    {
      id: 'foundation-118',
      label: 'Fundação limpa',
      value: foundationToken === 'active' ? 'Ativa' : 'Não detectada',
      detail: foundationToken === 'active' ? 'Base principal sem master-ui carregado e sem lote77–117 no main.tsx.' : 'A fundação limpa não apareceu no :root; confira import do lote118.',
      tone: foundationToken === 'active' ? 'ok' : 'warn',
      ok: foundationToken === 'active',
    },
    {
      id: 'icon-login-119',
      label: 'Ícones e login seguros',
      value: iconLoginToken === 'active' ? 'Ativo' : 'Não detectado',
      detail: iconLoginToken === 'active' ? 'Camada pequena mantém SVG/login estáveis após a limpeza.' : 'A camada de ícones/login não carregou; login e ícones podem ficar crus.',
      tone: iconLoginToken === 'active' ? 'ok' : 'warn',
      ok: iconLoginToken === 'active',
    },
    {
      id: 'commercial-120',
      label: 'Componentes comerciais',
      value: commercialToken === 'active' ? 'Ativos' : 'Não detectados',
      detail: commercialToken === 'active' ? 'Cards, tabelas, chips e dashboard usam a camada comercial limpa.' : 'A camada comercial não carregou; componentes internos podem perder acabamento.',
      tone: commercialToken === 'active' ? 'ok' : 'warn',
      ok: commercialToken === 'active',
    },
    {
      id: 'clean-interface-121',
      label: 'Interface limpa v121',
      value: cleanInterfaceToken === 'active' ? 'Ativa' : 'Não detectada',
      detail: cleanInterfaceToken === 'active' ? 'Camada final remove resíduos visuais, reforça mobile-first e padroniza tokens atuais.' : 'A camada v121 não carregou; conferir import no main.tsx.',
      tone: cleanInterfaceToken === 'active' ? 'ok' : 'warn',
      ok: cleanInterfaceToken === 'active',
    },
    {
      id: 'clean-shell-121',
      label: 'Shell sem herança antiga',
      value: cleanShellToken === 'active' ? 'Ativo' : 'Não detectado',
      detail: cleanShellToken === 'active' ? 'Diagnóstico aponta shell limpo, sem depender dos módulos v77–v97.' : 'Token de shell limpo não encontrado.',
      tone: cleanShellToken === 'active' ? 'ok' : 'warn',
      ok: cleanShellToken === 'active',
    },
    {
      id: 'css-rules',
      label: 'Inventário de regras',
      value: ruleCount > 0 ? `${ruleCount} regras` : 'Indisponível',
      detail: ruleBudgetOk ? 'Quantidade lida está dentro do esperado para a base limpa atual.' : 'Quantidade alta: revisar se algum CSS antigo voltou a ser importado.',
      tone: ruleBudgetOk ? 'ok' : 'warn',
      ok: ruleBudgetOk,
    },
    {
      id: 'important-budget',
      label: 'Prioridade forçada',
      value: `${importantCount} !important`,
      detail: importantBudgetOk ? 'Dentro do orçamento seguro atual; o antigo master-ui não está mais participando da auditoria.' : 'Ainda existe prioridade forçada demais; reduzir com validação visual real por tela.',
      tone: importantBudgetOk ? 'ok' : 'warn',
      ok: importantBudgetOk,
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
      detail: touchMin ? 'Token atual de toque mínimo disponível para botões e formulários.' : 'Token de toque mínimo não carregado.',
      tone: touchMin ? 'ok' : 'warn',
      ok: Boolean(touchMin),
    },
    {
      id: 'safe-bottom',
      label: 'Espaço inferior mobile',
      value: pageBottomSafe || 'não definido',
      detail: pageBottomSafe ? 'Há reserva para o dock não cobrir botões no celular.' : 'Token de espaço inferior não carregado.',
      tone: pageBottomSafe ? 'ok' : 'warn',
      ok: Boolean(pageBottomSafe),
    },
    {
      id: 'safe-inline',
      label: 'Largura segura',
      value: shellInlineSafe || 'não definida',
      detail: shellInlineSafe ? 'A largura principal tem limite claro para web e mobile.' : 'Token de largura segura não carregado.',
      tone: shellInlineSafe ? 'ok' : 'warn',
      ok: Boolean(shellInlineSafe),
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
    `CSS limpo v121: ${report.okCount}/${report.total} (${report.score}%)`,
    `Folhas: ${report.sheetCount} · regras lidas: ${report.ruleCount}`,
    ...report.items.map((item) => `${item.ok ? '[OK]' : '[ATENÇÃO]'} ${item.label}: ${item.value} · ${item.detail}`),
  ].join('\n');
}

# Hotfix 246 — Receber parcela tocável no iPhone + Recentes refinados

## Problema atacado
No fluxo de Crediário, o usuário conseguia visualizar o modal de recebimento, mas o CTA final podia não responder de forma confiável no iPhone. O risco era combinação de área rolável, footer, teclado/Safari, camada de toque e dependência exclusiva do `submit` do formulário.

## Correção no Receber Parcela
- O footer de ações foi separado da área rolável do modal.
- O conteúdo central é o único proprietário do scroll.
- CTA principal com 56 px no mobile.
- `pointer-events: auto`, `touch-action: manipulation` e z-index explícitos no footer/botões.
- Safe area inferior preservada.
- Com teclado aberto, footer continua dentro da viewport útil.
- Antes da confirmação, o campo focado perde foco para recolher o teclado quando possível.
- A ação principal ganhou um caminho explícito de `onClick` além do `onSubmit`/Enter.
- O guard `saving`/`receiveInFlight` continua impedindo duplicidade.
- A chamada financeira `api.receiveInstallment` e seus payloads ficaram **idênticos** à base anterior.

## Atividades Recentes e Vendas Recentes
- status agora possuem tons semânticos (finalizada/quitada, em aberto, cancelada, neutra);
- cards ganharam melhor borda, radius, sombra e separação da área expandida;
- botões de ações reorganizados no mobile;
- breakpoint estreito reorganiza fatos e ações em uma coluna;
- `aria-label` do card informa venda, cliente, valor, data e ação;
- cópias de apoio ficaram mais claras.

## QA realizado
- Browser harness do CTA em 375×700: PASS.
- 390×700: PASS.
- 430×700: PASS.
- 390×430 com teclado simulado: PASS.
- Em todos: botão visível, habilitado, dentro da viewport, `elementFromPoint` atingiu o próprio botão e o clique disparou uma vez.
- Recentes 390 px: sem overflow horizontal.
- Recentes 1366 px: sem overflow horizontal.
- A base já continha auditoria v245 com 360 PNGs e 14 rotas no scroll audit de 390 px, todas com `endReached=true`.

## Validação técnica
Passou neste ambiente:
- `node --check` dos scripts;
- lint local;
- commercial check v246;
- release check v246 estrutural;
- transpile isolado dos TS/TSX modificados;
- comparação das chamadas financeiras antes/depois.

Não foi possível validar de forma completa aqui:
- `npm run type-check` do projeto inteiro;
- `npm run build`.

Motivo: o RAR enviado não contém `node_modules`; o TypeScript global reporta módulos ausentes como React/Vite. Rode esses dois comandos no PC antes de commit/deploy.

## Critério de aceite no iPhone real
1. Abrir Crediário e uma parcela.
2. Tocar em Receber.
3. Conferir antes de receber.
4. Com teclado aberto, confirmar que o CTA continua acessível.
5. Tocar em Confirmar recebimento apenas em dado seguro/de teste.
6. Confirmar loading, retorno e atualização.
7. Repetir em 390 px / iPhone real.

## Status
**PARCIAL DE PRODUÇÃO / PRONTO PARA VALIDAÇÃO LOCAL FINAL.** A correção estrutural e o QA simulado passaram, porém um fluxo financeiro só deve receber PRONTO 10/10 após `type-check + build` no PC e teste real no Safari/iPhone.

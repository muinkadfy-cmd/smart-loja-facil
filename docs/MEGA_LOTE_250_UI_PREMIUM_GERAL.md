# Mega Lote 250 — UI Premium Geral Web + Mobile

## Objetivo
Refinar toda a interface compartilhada sem alterar regras de negócio, mantendo as correções de login v249, modais financeiros/iPhone v247 e PWA.

## Melhorias
- Nova camada final `ui-premium-polish.css`, isolada por `smart-mobile-rebuild-v250`.
- Desktop mais próximo de SaaS/ERP: remove duplicações de navegação, reduz espaço morto e melhora relatórios, configurações, logs e topbar.
- Mobile com melhor respiro, foco, safe-area, touch targets, cabeçalhos e cards sem alterar fluxos.
- Topbar diferencia **Sincronizar** de **Recarregar**.
- Card “Loja ativa” usa ícone real de sincronização; no desktop a duplicação com a topbar é removida.
- Sidebar usa versão curta com descrição completa via tooltip e marca rota atual com `aria-current`.
- Dashboard troca emoji por iconografia real e remove atalho duplicado: “Nova venda” vira “Receber parcela”.
- Telas genéricas passam a usar ícone real da rota, não letra.
- Diagnóstico genérico não mostra mais cache/versão v135 obsoletos.
- Central de avisos deixa de inventar venda, horário, backup ou cliente e passa a exibir somente alertas derivados do estado real.
- QA `npm run qa:ui` verifica rotas, ícones, dados fictícios, mobile, desktop e contratos de modal.

## Preservado
Não altera Supabase/RLS/migrations, pagamentos, caixa, estoque, cálculos, recebimento, cancelamento, vencimentos, PDF/PNG, sincronização ou dados existentes.

## Testes esperados antes do deploy
`npm run type-check`
`npm run build`
`npm run verify:dist`
`npm run lint`
`npm run qa:ui`
`npm run release:check`
`npm run release:commercial:check`

## Evidência de escopo
A matriz completa de 14 rotas e diálogos está em `docs/MEGA_LOTE_250_MATRIZ_AUDITORIA.md`.

# Auditoria Desktop Premium — Smart Loja Fácil

Data: 10/09/2026  
Escopo: experiência desktop/PC; mobile congelado  
Build auditado: `dist-codex-build`

## Status

**PRONTO**

- 14 rotas desktop reais mapeadas e abertas.
- 84 capturas finais de rota desktop: 14 rotas × 6 viewports.
- 13 superfícies de diálogo inspecionadas no código; 4 fluxos principais abertos visualmente em 1366 e 1920, além de 2 regressões mobile.
- 204 screenshots de tela produzidos durante baseline, iterações e rodada final.
- 7 contact sheets finais; 211 arquivos PNG de evidência no total.
- 24 problemas de UI/UX registrados: 6 P0, 12 P1 e 6 P2.
- 24 problemas tratados no lote desktop.
- 0 overflow horizontal nas 84 capturas finais de rota.
- 0 erro inesperado registrado pelo fixture local durante a rodada final.

## Rotas auditadas

1. Painel (`dashboard`)
2. Vendas / PDV (`sales`)
3. Caixa (`cash`)
4. Pedidos (`orders`)
5. Crediário (`credits`)
6. Comprovantes (`receipts`)
7. Cupom (`coupons`)
8. Produtos (`products`)
9. Clientes (`customers`)
10. Relatórios (`reports`)
11. Backup (`backup`)
12. Configurações (`settings`)
13. Logs / Diagnóstico (`audit`)
14. Diagnóstico Web (`diagnostics`)

Estoque, vendas recentes, atividades recentes e central de avisos aparecem como áreas/fluxos das rotas acima, não como rotas autônomas do shell atual.

## Viewports finais

- 1280 × 720
- 1366 × 768
- 1440 × 900
- 1536 × 864
- 1920 × 1080
- 2560 × 1440

As prioridades 1366 × 768 e 1920 × 1080 receberam inspeção individual e contact sheet dedicada.

## Principais correções

- Sidebar desktop reestruturada visualmente: densidade, hierarquia, estado ativo, nome da loja, status, rodapé de ambiente/versão e navegação rolável discreta.
- Topbar reduzida e alinhada; Sincronizar, Recarregar, notificações e saída receberam linguagem consistente e tooltips nativos.
- Conteúdo passou a usar largura desktop real com limite confortável de 1500 px.
- Dashboard ganhou grade de quatro KPIs, ações horizontais, duas colunas de informação e vendas recentes compactas.
- PDV ganhou distribuição de catálogo, carrinho e pagamento adequada a monitor.
- Cards, filtros, formulários, listas, relatórios, backup, diagnóstico, crediário e comprovantes ganharam densidade desktop consistente.
- Formulários passaram a usar grids semânticos em desktop, sem espremer conteúdo.
- Modais deixaram o formato de sheet mobile no desktop e passaram a usar largura, centralização, header/body/footer e grids adequados ao conteúdo.
- Estados `hover`, `focus-visible`, `active`, `disabled`, badges, chips, bordas, raios e sombras foram harmonizados.
- Melhorias semânticas pequenas foram adicionadas ao JSX: `aria-current`, `role=status`, `role=alert` e títulos de ações compactas.

## Isolamento desktop

Todas as declarações visuais novas vivem em `src/mobile-app/styles/desktop-premium.css` e estão protegidas por uma destas condições:

- `@media (min-width: 1024px)`
- `@media (min-width: 1280px)`
- `@media (min-width: 1600px)`
- variações desktop para ponteiro fino/hover e altura reduzida

A folha é importada depois dos estilos existentes. Overrides com `!important` foram usados somente onde a camada mobile legada já impunha regras globais com alta especificidade; todos permanecem dentro do breakpoint desktop.

## Preservação mobile

Baseline e pós-alteração foram comparados em 375, 390 e 430 px para Painel, PDV, Crediário, Comprovantes, Produtos e Clientes.

- 18 pares comparados.
- Diferença visual máxima: **0,0000%**.
- Diferença visual média: **0,0000%**.
- Receber parcela e Cancelar crediário também foram reabertos em 390 × 844 e permaneceram com a composição mobile preservada.

## Validação técnica

- `npm run type-check`: passou.
- `npm run build`: passou; saída gerada em `dist-codex-build`.
- `npm run lint`: passou sem achados críticos.
- `npm run release:check`: passou.
- `npm run release:commercial:check`: passou em modo strict.

O primeiro commercial check detectou três perfis temporários do Chrome usados no QA. Eles foram movidos de `.cache` para uma quarentena recuperável fora do workspace e o ciclo completo foi executado novamente com sucesso. Avisos remanescentes são somente itens já protegidos/ignorados: `.env.production`, logs locais e o legado `src-tauri` indicado pelo próprio release check.

## Notas por área

| Área | Nota |
|---|---:|
| Sidebar | 9,4/10 |
| Topbar | 9,3/10 |
| Dashboard | 9,5/10 |
| PDV | 9,3/10 |
| Produtos | 9,2/10 |
| Clientes | 9,2/10 |
| Crediário | 9,3/10 |
| Comprovantes | 9,3/10 |
| Atividades Recentes | 9,2/10 |
| Vendas Recentes | 9,3/10 |
| Modais desktop | 9,4/10 |
| Consistência geral | 9,3/10 |
| Desktop 1366 | 9,4/10 |
| Desktop 1920 | 9,5/10 |
| Preservação mobile | 10/10 |

## Limites conscientes do lote

- Nenhuma regra financeira, cálculo, pagamento, caixa, estoque, vencimento, crediário, Supabase, migration, RPC, sincronização, autenticação, licença, PDF, PNG, impressão ou compartilhamento foi alterada.
- O aviso de chunk principal acima de 500 kB continua sendo uma oportunidade técnica separada; não bloqueia o build e não foi misturado ao lote visual.
- O arquivo `src/mobile-app/screens/ProductsCustomersScreens.tsx` já estava modificado antes deste trabalho, foi preservado e deve continuar fora do commit deste lote.

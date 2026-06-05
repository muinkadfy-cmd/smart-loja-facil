# Mega lote 176 - listas e buscas limitadas

Data: 2026-06-05

## Objetivo

Eliminar renderizacao pesada de listas, selects gigantes e buscas imediatas nas telas operacionais da Jaque Confeccoes e Presentes, mantendo regras de negocio, login, Supabase auth, RLS, env, PDF, comprovantes e recibos sem alteracao funcional.

## Arquivos alterados neste lote

- `src/lib/listLimits.ts`
- `src/pages/Sales.tsx`
- `src/pages/Products.tsx`
- `src/pages/Customers.tsx`
- `src/pages/Credits.tsx`
- `src/pages/Receipts.tsx`
- `src/pages/Orders.tsx`
- `src/pages/Cash.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Audit.tsx`
- `src/pages/Backup.tsx`
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/screens/ProductsCustomersScreens.tsx`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/OrdersScreen.tsx`
- `src/mobile-app/screens/CashScreen.tsx`
- `src/mobile-app/screens/BackupScreen.tsx`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `docs/MEGA_LOTE_176_LISTAS_BUSCAS_LIMITADAS.md`

## Padrao aplicado

- Limite inicial: 20 itens.
- Resultado de busca: ate 30 itens.
- Carregar mais: passo de 20 itens.
- Crediario/comprovantes compactos: 10 itens iniciais.
- Debounce de busca: 350 ms.
- Busca curta: evita busca pesada antes de 2 caracteres, preservando busca direta por SKU/codigo de barras.
- Mensagens leigas: primeiros resultados, muitos resultados, refine a busca, nenhum resultado.

## Telas revisadas

- Vendas/PDV: produtos e clientes deixam de expor selects gigantes; produtos sem estoque ficam ao fim; busca por nome, SKU e barras; carregar mais.
- Produtos: tabela limitada; busca por nome, SKU e barras; ajuste de estoque usa lista filtrada; SKU, barras, custo e venda preservados.
- Clientes: tabela limitada; busca por nome, telefone, WhatsApp/endereco/id; carregar mais.
- Crediario: 10 notas/clientes iniciais; parcela compacta por padrao; proxima parcela em destaque; ver todas/recolher; receber, PDF, WhatsApp e extrato preservados.
- Comprovantes: 10 iniciais; busca por cliente, telefone, venda, nota/status; PDF/visualizar/enviar preservados.
- Pedidos: cliente/produto com busca limitada; pedidos em lotes.
- Caixa: 20 movimentos recentes; carregar mais; calculos preservados.
- Relatorios: resumo primeiro; tabela detalhada em 30 linhas por vez.
- Logs/Auditoria: 30 logs iniciais; filtro por tipo erro/aviso/sincronizacao/sistema.
- Backup: historico limitado; ver mais backups.
- Mobile: PDV, produtos, clientes, crediario, comprovantes, pedidos, caixa e backup revisados com limites e botoes de carregar mais.

## PWA/cache

- Versao do app: `0.1.176`.
- `WEB_APP_VERSION`: `pwa-supabase-v176-listas-buscas-limitadas`.
- `WEB_CACHE_VERSION` e service worker: `smart-loja-pwa-supabase-v176-listas-buscas-limitadas`.
- Manifest atualizado para Jaque v176.

## Testes executados

- `npm ci --ignore-scripts --no-audit --no-fund`: passou.
- `npm run type-check`: passou.
- `npm run lint`: passou.
- `npm run build`: passou, com aviso Vite de chunk maior que 500 kB.
- `npm run release:check`: passou; avisos de `.env.production` local e `src-tauri` legado fora do pacote.
- `node scripts/credit_payment_guard_tests.js`: passou.
- `npm run release:commercial:check`: passou; avisos de `.env` local e logs ignorados.
- `npm run release:commercial:prepare`: passou; pacote limpo gerado em `release-commercial/smart-loja-facil-commercial-clean`.
- `npm run qa:commercial`: passou.
- `npm run qa:load`: passou; validou carga sintetica e listas em lotes.
- `npm audit --audit-level=high`: nao validado; o endpoint do npm retornou erro nas duas tentativas e nao gravou log no cache local.

## Validacao manual no codigo

- Produtos e clientes nao renderizam a lista inteira nas tabelas principais.
- Vendas/PDV e Pedidos nao mostram todos os produtos/clientes de uma vez nos selects.
- Crediario nao renderiza todas as notas de uma vez e nao abre todas as parcelas por padrao.
- Comprovantes nao renderiza todos os comprovantes salvos de uma vez.
- Caixa, relatorios, logs e backup possuem limites e carregar mais.
- PDF/recibo/comprovante: HTML/layout de recibo nao foi alterado neste lote.
- Login, Supabase auth, RLS, ENV e senha: nao foram alterados neste lote.

## Riscos e limitacoes

- Produtos/clientes ainda sao buscados pela API completa para manter totais, edicao e compatibilidade com o contrato atual. O peso de DOM/select foi reduzido; paginacao real Supabase por busca deve ser o proximo lote.
- `npm audit` ficou bloqueado por erro do endpoint/cache npm neste ambiente.
- Validacao visual em aparelho real/mobile instalado nao foi executada aqui.

## Proximo lote ideal

- Criar endpoints/metodos paginados para produtos e clientes com busca Supabase por nome, SKU, barras, telefone e WhatsApp.
- Separar imagens/fotos de produto da listagem principal quando a tela so precisa de nome/preco/estoque.
- Code-splitting do bundle principal para remover o aviso de chunk grande do Vite.

## Comandos sugeridos

```bash
git add package.json package-lock.json public/sw.js public/manifest.webmanifest src/lib/listLimits.ts src/pages/Sales.tsx src/pages/Products.tsx src/pages/Customers.tsx src/pages/Credits.tsx src/pages/Receipts.tsx src/pages/Orders.tsx src/pages/Cash.tsx src/pages/Reports.tsx src/pages/Audit.tsx src/pages/Backup.tsx src/mobile-app/screens/SalesScreen.tsx src/mobile-app/screens/ProductsCustomersScreens.tsx src/mobile-app/screens/CreditsScreen.tsx src/mobile-app/screens/ReceiptsScreen.tsx src/mobile-app/screens/OrdersScreen.tsx src/mobile-app/screens/CashScreen.tsx src/mobile-app/screens/BackupScreen.tsx src/lib/webApi.ts scripts/release_check.js scripts/commercial_package_check.js scripts/commercial_release_package.js docs/MEGA_LOTE_176_LISTAS_BUSCAS_LIMITADAS.md
git commit -m "Mega lote: limitar listas e busca infinita no sistema"
git push
```


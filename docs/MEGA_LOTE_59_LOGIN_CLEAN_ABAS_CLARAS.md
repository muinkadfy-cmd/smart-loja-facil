# Mega Lote 59 — Login clean + abas internas mais claras

## Objetivo
Reduzir poluição visual, diminuir a tela/bloco de login, clarear as abas internas e manter o padrão clássico azul/branco/bege do Smart Loja Fácil.

## Auditoria 1 — Visual e UX
- O bloco de login/entrada estava grande demais e com excesso de seções comerciais.
- As abas internas tinham muitos cards navy/preto, gradientes fortes e sombras pesadas.
- Produtos, Clientes, Pedidos, Vendas/PDV e Diagnóstico pareciam de outro tema em relação ao shell clássico claro.
- A leitura estava pesada para usuário leigo por excesso de contraste escuro e painéis grandes.

## Auditoria 2 — Regressão e segurança
- Não foi alterada regra de dados, SQLite, Supabase, permissões ou fluxo de venda.
- O lote atua em CSS e cache PWA.
- Service worker atualizado para evitar celular preso em cache antigo.
- Mantidos nomes de classes existentes para reduzir risco.

## Arquivos alterados
- `src/styles.css`
- `public/sw.js`
- `docs/MEGA_LOTE_59_LOGIN_CLEAN_ABAS_CLARAS.md`

## Melhorias aplicadas
- Login/entrada mais compacto e limpo.
- Card “Olá, aguardando login” mais baixo no shell logado.
- Menos preto/navy dentro das abas.
- Cards internos claros com borda cinza e cabeçalho azul controlado.
- Formulários e tabelas mais leves.
- Diagnóstico com visual menos técnico/pesado.
- Micro polimento de botões, chips, inputs, espaçamentos e bordas.

## Testes executados
- `npm run lint` passou.
- `npm run release:check` passou.

## Testes não possíveis nesta sessão
- `npm run type-check` não foi concluído porque o ZIP veio sem `node_modules`; faltam tipos/dependências locais (`react`, `vite`, etc.).
- Preview visual manual no Chrome do sandbox não foi usado como validação final.

## Risco
Baixo a médio. Alteração focada em CSS global; pode exigir revisão visual fina em telas muito específicas com formulários longos.

## Próximo lote recomendado
Padronizar tela por tela começando por Produtos, Clientes, Pedidos e Vendas/PDV, removendo CSS antigo duplicado com segurança.

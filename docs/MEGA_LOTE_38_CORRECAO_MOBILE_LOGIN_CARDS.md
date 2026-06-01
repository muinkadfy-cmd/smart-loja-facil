# Mega Lote 38 - Correção mobile crítica da tela de login

## Diagnóstico do print enviado
O modo mobile estava quebrado porque os cards de recursos da tela de login continuavam em 3 colunas no celular. Isso causava:
- textos quebrando letra por letra;
- cards espremidos;
- coluna da direita cortada;
- baixa legibilidade;
- sensação de layout não mobile-first.

## O que foi feito
- Corrigido `login-feature-strip` no mobile para usar 1 coluna real.
- Cards agora ficam empilhados, com ícone à esquerda, texto no centro e seta à direita.
- Adicionado bloqueio de overflow horizontal no login mobile.
- Ajustados tamanhos de ícones, textos, gaps e paddings para Android/iPhone.
- Melhorada a legibilidade dos textos dos cards.
- Encurtados textos dos recursos para evitar quebra ruim no celular.
- Mantida a identidade visual web/mobile da tela premium.
- Atualizado cache do service worker para o celular puxar os arquivos novos.

## Arquivos alterados
- `src/pages/Welcome.tsx`
- `src/styles.css`
- `public/sw.js`

## Regressão verificada
- A alteração foi restrita à tela de entrada/login e CSS responsivo.
- Não mexe em rotas, banco, Tauri, SQLite, Supabase, permissões ou lógica comercial.
- Mantém botão Entrar chamando a mesma ação existente.
- Mantém estrutura original do projeto.

## Testes executados
- `npm run type-check` ✅
- `npm run build` ✅
- `npm run lint` ✅
- `npm run release:check` ✅
- `node --check public/sw.js` ✅

## Testes não executados
- `npm run check:js` não existe neste `package.json`.
- `npm run validate` não existe neste `package.json`.
- `npm run codex:preflight` não existe neste `package.json`.
- `npm run codex:mobile` não existe neste `package.json`.
- `npm run codex:ready` não existe neste `package.json`.
- Teste visual em aparelho físico não foi executado aqui; a correção foi feita diretamente em cima do problema visto no print.

## Limitações reais
- A arte/ilustração ainda é feita em CSS, não é uma imagem 3D real como a referência.
- O restante das páginas internas ainda precisa de polimento individual para chegar em 9.5+/10.

## Nota honesta após este lote
- Login mobile corrigido: 9.3/10
- Login web/mobile equivalente: 9.1/10
- Sistema geral: 8.7/10

## Próximo passo ideal
Polir Dashboard, Produtos, Clientes e Vendas/PDV com o mesmo padrão mobile-first: cards empilháveis, tabelas sem estouro, botões tocáveis e hierarquia igual no web e no celular.

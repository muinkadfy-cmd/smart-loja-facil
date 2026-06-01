# Mega Lote 60 — Login clean + micro polimento das abas

## Objetivo
Aplicar o COMANDO MESTRE 10/10 na tela inicial/login e reforçar a limpeza visual das abas principais do Smart Loja Fácil Web.

## O que foi alterado
- Tela de entrada/login reduzida, mais compacta e mais limpa.
- Topbar da entrada com logo, texto e botão em melhor hierarquia.
- Remoção de menus informativos e blocos promocionais que deixavam a entrada poluída.
- Estado PWA/Web seguro mantido, mas com leitura mais simples para usuário leigo.
- Menos preto/navy nos cards internos das abas.
- Cards, painéis, tabelas, filtros e formulários com fundo mais claro.
- Inputs e selects com contraste melhor.
- Botões e chips com acabamento mais consistente.
- Service worker atualizado para evitar cache visual antigo.

## Arquivos alterados
- `src/pages/Welcome.tsx`
- `src/styles.css`
- `public/sw.js`
- `docs/MEGA_LOTE_60_LOGIN_CLEAN_MICRO_POLIMENTO_ABAS.md`

## Risco
Baixo a médio. O lote atua principalmente em markup da entrada e CSS de acabamento visual.

## Limitação honesta
A limpeza foi feita de forma segura por camada CSS final, sem refatorar cada página individualmente. Algumas telas complexas ainda podem precisar de lotes específicos por aba para ficar 100% no padrão final.

## Testes recomendados
- `npm run lint`
- `npm run release:check`
- abrir em web e mobile: login, dashboard, produtos, clientes, pedidos, vendas/PDV e diagnóstico.

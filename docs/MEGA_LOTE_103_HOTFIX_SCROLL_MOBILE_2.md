# Hotfix Lote 103 — Rolagem geral mobile/web 2

## Problema
Após o Lote 103, a tela mobile continuou presa: não era possível rolar normalmente para baixo nem navegar com conforto. O primeiro hotfix liberou a rolagem do menu, mas o contêiner principal ainda podia ficar travado por regras antigas de `height`, `overflow` e bottom nav fixo.

## Correção
- Libera rolagem do `html`, `body`, `#root`, shell, layout, main e conteúdo.
- Mantém rolagem interna apenas em tabelas/listas quando necessário.
- Ajusta padding inferior do mobile para o bottom nav não cobrir conteúdo.
- Mantém o menu lateral/drawer com rolagem própria quando aberto.
- Atualiza versão/cache para forçar o celular a puxar a correção.

## Não alterado
- Supabase
- login
- vendas
- clientes
- produtos
- caixa
- crediário
- permissões

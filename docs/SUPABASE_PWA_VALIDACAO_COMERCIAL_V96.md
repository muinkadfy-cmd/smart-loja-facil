# Validação comercial v96 — Supabase, PWA, Storage e multiaparelho

## Objetivo
Validar o sistema em ambiente real antes de vender para cliente final.

## Checklist obrigatório

1. Aplicar todas as migrations no Supabase.
2. Confirmar bucket `product-photos` no Supabase Storage.
3. Criar usuários owner, admin, operator e viewer.
4. Criar duas lojas diferentes e confirmar isolamento por RLS.
5. Cadastrar produto com foto no PC e abrir no celular.
6. Cadastrar cliente no celular e abrir no PC.
7. Fazer venda e conferir estoque/caixa.
8. Receber parcela no crediário e conferir restante.
9. Instalar PWA no celular e confirmar versão v96.
10. Desligar internet, abrir telas em cache e religar para testar pendências.
11. Rodar `npm run release:commercial:check`.
12. Rodar `npm run release:commercial:prepare`.

## Resultado esperado
Somente liberar venda ampla se todos os itens críticos passarem sem erro.

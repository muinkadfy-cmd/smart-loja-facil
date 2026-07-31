# Hotfix 244 — Corrigir estado ausente no modal de produto

## Falha confirmada
O TypeScript encontrou 14 erros em `ProductsCustomersScreens.tsx` porque o código usava:
- `deleteProductFeedback`
- `setDeleteProductFeedback`

mas o estado correspondente não estava declarado dentro de `ProductsScreen`.

## Causa raiz
O Hotfix 243 adicionou o feedback inline no modal de exclusão de produto, porém a declaração do `useState` não foi incluída na posição correta do componente.

## Correção aplicada
Foi adicionada a declaração:

```ts
const [deleteProductFeedback, setDeleteProductFeedback] =
  useState<{ tone: 'info' | 'error'; text: string } | null>(null);
```

Também foi reforçado o `release_check.js` para falhar caso o componente use o feedback sem declarar o estado e o setter.

## Arquivos alterados
- `src/mobile-app/screens/ProductsCustomersScreens.tsx`
- `scripts/release_check.js`
- arquivos de versão/cache/release v244

## Anti-regressão
Não altera:
- regra de cancelamento do crediário;
- regra de exclusão do produto;
- Supabase/RPC/migration;
- pagamentos;
- caixa;
- estoque;
- layout do modal;
- confirmação `CANCELAR`;
- confirmação `EXCLUIR`.

## Testes disponíveis no ambiente
- verificação direta da declaração do estado;
- sintaxe/transpile TypeScript e TSX;
- `npm run lint`;
- `npm run release:check`;
- `npm run release:commercial:check`.

## Limitação
O build completo precisa ser repetido no computador do usuário, onde as dependências já estão instaladas.

## Critério de aceite
1. Aplicar o ZIP.
2. Rodar `npm run type-check`.
3. Confirmar zero erros.
4. Rodar `npm run build`.
5. Confirmar geração de `dist-codex-build`.
6. Testar exclusão de produto e cancelamento de crediário no iPhone.

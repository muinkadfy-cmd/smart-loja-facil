# Hotfix 243 — Cancelar crediário sempre responde

## Falha confirmada
O clique no botão final `Cancelar crediário` podia parecer não fazer nada.

A causa raiz estava na interface:
- o botão ficava desabilitado enquanto `CANCELAR` não estivesse exatamente preenchido;
- botão desabilitado não executava validação nem mostrava explicação;
- erros de motivo, confirmação, permissão ou RPC eram gravados no feedback da página;
- esse feedback ficava atrás do modal, portanto invisível no iPhone;
- se o Supabase cancelasse e a recarga imediata falhasse, a tela podia mostrar erro mesmo com a operação concluída.

## Correção aplicada

### Crediário
- O botão `Cancelar crediário` permanece clicável enquanto não estiver salvando.
- Ao tocar com campos incompletos, mostra imediatamente dentro do rodapé:
  - motivo muito curto;
  - falta de `CANCELAR`;
  - erro retornado pelo Supabase;
  - falta de permissão;
  - função RPC não instalada.
- Durante a operação mostra `Cancelando o crediário na nuvem...`.
- O campo de confirmação ignora espaços acidentais do teclado do iPhone.
- `autoCorrect` foi desativado.
- O resultado da RPC ganhou fallback visual seguro: se o banco confirmou, mas a lista não recarregou imediatamente, o card é marcado como cancelado localmente e a próxima atualização confirma o dado real.

### Produto
O mesmo problema existia no botão `Excluir cadastro`. Foi corrigido com:
- botão sempre responsivo;
- erros visíveis dentro do modal;
- confirmação `EXCLUIR` robusta;
- estado de processamento visível.

## O que não mudou
- regra de banco;
- RPC e migration do lote 241;
- pagamentos;
- caixa;
- estoque;
- confirmação obrigatória `CANCELAR`;
- confirmação obrigatória `EXCLUIR`;
- motivo obrigatório;
- cálculos;
- vencimentos;
- PDF, PNG e comprovantes.

## Arquivos alterados
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/lib/webApi.ts`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ProductsCustomersScreens.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Testes realizados
- sintaxe/transpile TS e TSX dos arquivos modificados: passou;
- `npm run lint`: passou;
- `npm run release:check`: passou com ambiente temporário apenas para validação estrutural;
- `npm run release:commercial:check`: passou;
- validação estrutural:
  - botão de cancelar desabilita somente durante `saving`;
  - feedback está dentro do modal;
  - erro usa `role=alert` e `aria-live`;
  - modal de produto recebeu a mesma proteção.

## Limitação do ambiente
`npm install` não concluiu porque o registry interno retornou 404 para `youch-core@0.3.3`. O type-check completo e o build Vite devem ser repetidos no computador de publicação.

## Critério de aceite
1. Abrir crediário no iPhone.
2. Abrir `Cancelar crediário`.
3. Tocar no botão sem preencher.
4. Confirmar que aparece mensagem dentro do modal.
5. Informar motivo com seis ou mais letras.
6. Digitar `CANCELAR`.
7. Tocar novamente.
8. Confirmar que aparece `Cancelando...`.
9. Em caso de falha do Supabase, confirmar que o erro real aparece dentro do modal.
10. Em caso de sucesso, confirmar que o modal fecha e a nota sai de Abertos/Vencidos.

## Status
PRONTO para teste real no iPhone.

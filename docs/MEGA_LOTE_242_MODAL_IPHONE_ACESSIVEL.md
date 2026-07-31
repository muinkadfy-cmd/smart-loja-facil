# Mega Lote 242 — Modais acessíveis no iPhone e celulares

## Problema confirmado
No iPhone, o modal de cancelamento do crediário ficava comprido. O usuário precisava arrastar a tela e, mesmo assim, o botão final podia ficar abaixo da área tocável ou próximo da barra inferior/teclado do Safari.

A causa estava na combinação de:
- modal com rolagem interna;
- barra de ações usando `bottom` negativo;
- margem inferior negativa;
- ausência de ajuste completo para `100dvh`;
- área segura inferior do iPhone;
- botão destrutivo aparecendo abaixo do botão Voltar no layout de uma coluna.

O mesmo padrão também existia na exclusão segura de produto e no painel rápido de cliente do PDV.

## Correção aplicada

### Crediário
- Modal de cancelamento convertido para formulário real.
- Botão `Cancelar crediário` agora funciona como `submit`.
- Tecla `Concluir/Done` do teclado pode confirmar o formulário quando os dados estiverem válidos.
- Barra inferior fica fixa/visível dentro do modal.
- Botão crítico aparece primeiro no celular.
- Altura mínima de toque aumentada para 56 px.
- Respeita `safe-area-inset-bottom` do iPhone.
- Modal usa `100dvh` e acompanha melhor a abertura do teclado.
- Totais foram compactados no celular para reduzir rolagem.
- Texto do motivo foi reduzido para duas linhas iniciais, mantendo expansão manual.

### Produtos
- Mesmo tratamento aplicado ao modal `Excluir cadastro`.
- Botão de exclusão fica acessível acima da barra inferior do iPhone.
- Tecla `Done` pode enviar o formulário.
- Confirmação continua exigindo `EXCLUIR`.

### Outras telas
- Todos os modais que usam `mapp-receive-drawer` receberam:
  - rolagem suave no iOS;
  - área segura;
  - rodapé sticky sem `bottom` negativo;
  - campos com margem de rolagem para não ficarem atrás do teclado;
  - botões maiores e preparados para toque.
- O bottom sheet de cliente rápido no PDV recebeu o mesmo ajuste estrutural.

## Anti-regressão
Não foram alterados:
- cancelamento no banco;
- pagamentos;
- caixa;
- estoque;
- regras de confirmação `CANCELAR` e `EXCLUIR`;
- vencimentos;
- cálculo de crediário;
- busca e expansão de parcelas;
- migrations do Supabase;
- PDF, PNG ou comprovantes.

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

## Testes executados
- Transpile de sintaxe TypeScript/TSX nos dois componentes alterados: passou.
- Validação estrutural do CSS e seletores do lote: passou.
- `npm run lint`: passou.
- `npm run release:check`: passou em validação estrutural com arquivo `.env.production` temporário e descartado.
- `npm run release:commercial:check`: passou.
- Verificação do ZIP Delta e ausência de `.env`, banco, `node_modules` e builds: passou.

## Limitação do ambiente
O `npm install` completo não concluiu porque o registry interno retornou erro 404 para `youch-core@0.3.3`. Por isso o build Vite completo precisa ser repetido no computador de publicação, que possui acesso normal ao registry e às variáveis reais do Supabase.

## Critério de aceite no iPhone
1. Abrir Crediário.
2. Abrir uma nota.
3. Tocar em `Cancelar crediário`.
4. Preencher o motivo.
5. Digitar `CANCELAR`.
6. Confirmar que o botão vermelho permanece visível acima da barra inferior/teclado.
7. Tocar sem precisar arrastar a página externa.
8. Repetir no modal `Excluir cadastro` de Produto.
9. Abrir cliente rápido no PDV e conferir que `Salvar e usar na venda` continua acessível.

## Status
PRONTO para aplicação e validação final em iPhone real.

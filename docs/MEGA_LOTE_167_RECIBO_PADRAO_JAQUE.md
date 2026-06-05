# Mega Lote 167 — Recibo padrão Jaque no Crediário e Comprovantes

## Objetivo

Aplicar o modelo de recibo físico enviado como padrão visual para comprovantes, extratos, parcelas e vendas dentro do app mobile-first, usando a nova logo Jaque Confecções e Presentes e as cores rosa/dourado da marca.

## Correções principais

- Visualizar não abre mais HTML solto por arquivo/blob no celular.
- Visualizar agora abre o recibo dentro do próprio app, na área de prévia segura.
- O botão PDF deixa de gerar PDF textual simplificado com letras grudadas.
- O PDF agora usa o fluxo seguro de impressão/salvar PDF do navegador com o mesmo layout base do recibo.
- Crediário ganhou botão Ver recibo em cada parcela.
- Crediário mantém botão Ver extrato da nota.
- Ao vir do Crediário para Comprovantes, o app consegue focar a nota ou a parcela correta.
- O recibo padrão remove o destaque grande de “restante” do documento.
- O saldo em aberto fica apenas em anotações quando necessário, sem poluir o recibo.

## Layout novo do recibo

- Logo Jaque Confecções e Presentes no topo, centralizada e com tamanho controlado.
- Telefone/WhatsApp no topo direito.
- Título dinâmico por tipo:
  - COMPROVANTE DE VENDA
  - COMPROVANTE DE PAGAMENTO
  - COMPROVANTE PARCIAL
  - AVISO DE PARCELA ATRASADA
  - RECIBO DE CREDIÁRIO
  - EXTRATO DA NOTA
- Campos de cliente, fone e endereço.
- Tabela com Qtd., Produto, R$ un e Total.
- Área de pagamento com Pix, Dinheiro, Crédito e Débito.
- Total destacado no canto direito.
- Anotações no rodapé.
- Visual inspirado no recibo físico enviado.

## Status destacados

- Parcela paga: carimbo escuro “PAGO” com data.
- Parcela parcial: destaque laranja.
- Parcela atrasada: destaque vermelho.
- Parcela aberta: destaque azul.
- Nota quitada: status de quitada/paga.

## Arquivos alterados

- src/mobile-app/screens/ReceiptsScreen.tsx
- src/mobile-app/screens/CreditsScreen.tsx
- public/brand/jaque-receipt-logo.png
- public/brand/jaque-receipt-logo-wide.png
- public/sw.js
- public/manifest.webmanifest
- src/main.tsx
- src/lib/webApi.ts
- package.json
- package-lock.json
- scripts/release_check.js
- scripts/commercial_package_check.js
- scripts/commercial_release_package.js

## Testes executados

- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm audit --audit-level=high
- node scripts/credit_payment_guard_tests.js
- npm run release:commercial:check
- npm run release:commercial:prepare

## Observações honestas

- O build passou, mas o Vite ainda avisa que o chunk principal passa de 500 KB. Não quebrou o app, mas segue como otimização futura para celulares fracos.
- O arquivo .env.production existe no workspace local e está protegido/ignorado. Ele não deve ser enviado no commit/ZIP público.
- Este lote não mexe em login, Supabase, env, senha ou regras de autenticação.

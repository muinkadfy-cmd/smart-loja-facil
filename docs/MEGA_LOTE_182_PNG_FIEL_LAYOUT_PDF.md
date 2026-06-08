# Mega Lote 182 — PNG fiel ao layout do PDF

## Objetivo
Corrigir o comprovante em PNG que estava saindo como texto cru/linearizado e fazer o PNG seguir o mesmo padrão visual do comprovante PDF preto/branco.

## O que foi alterado

- O gerador de PNG da aba Comprovantes deixou de montar uma imagem simplificada com linhas soltas.
- O PNG agora é desenhado em canvas com a mesma estrutura visual do PDF:
  - fundo preto;
  - folha/recibo branco;
  - borda preta forte;
  - logo no topo;
  - título destacado;
  - bloco de cliente/telefone/endereço;
  - tabela de produtos comprados quando houver;
  - tabela de parcelas/status;
  - cards de total/pago/saldo;
  - anotações;
  - rodapé com nome da loja.
- O PNG gerado por Atividades recentes/Vendas recentes também foi polido para seguir o padrão visual de recibo, em vez de sair como texto grudado.
- Mantido compartilhamento sem link e sem texto extra.
- Mantido PDF como documento principal.
- Atualizado cache/versão para v182.

## Arquivos alterados

- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `docs/MEGA_LOTE_182_PNG_FIEL_LAYOUT_PDF.md`

## Testes executados

Passaram:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run build
npm run lint
npm run release:check
npm audit --audit-level=high
node scripts/credit_payment_guard_tests.js
npm run qa:push
npm run qa:commercial
npm run qa:load
npm run release:commercial:check
npm run release:commercial:prepare
```

Resultado: 0 vulnerabilidades high.

## Observação honesta

O build ainda mostra aviso do Vite sobre chunk acima de 500 KB. Não quebrou o sistema, mas ainda é recomendável otimizar depois para celular fraco.

## Não foi alterado

- Login;
- Supabase Auth;
- ENV;
- RLS;
- Regras de venda;
- Notificações push;
- Estrutura base do PDF.

# Mega Lote 186 — Comprovantes PDF/PNG com fontes maiores e leitura melhor

## Objetivo
Aumentar a fonte e melhorar a legibilidade de todos os comprovantes gerados em PDF e PNG, mantendo o mesmo padrão visual e a mesma base de layout entre PDF, PNG, Atividades recentes, Vendas recentes e aba Comprovantes.

## O que foi alterado
- Aumentei a largura base do canvas do comprovante para melhorar nitidez no WhatsApp e leitores de PDF.
- Aumentei fontes de:
  - título do comprovante;
  - cliente, venda e forma de pagamento;
  - cabeçalhos de tabela;
  - produtos comprados;
  - valores unitários e totais;
  - área de pagamento;
  - total final;
  - anotações;
  - rodapé.
- Aumentei altura das linhas de produtos para evitar texto apertado.
- Aumentei respiro entre blocos.
- Mantive PDF e PNG usando a mesma função `renderReceiptCanvas`, garantindo padrão único.
- Mantive desconto no comprovante quando existir.
- Atualizei versão/cache para v186.

## Arquivos alterados
- `src/mobile-app/components/receiptShare.ts`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Não alterado
- Login
- Supabase Auth
- ENV
- RLS
- Notificações push
- Regras de venda
- Regras de crediário
- Banco de dados

## Validação
Este pacote foi preparado a partir do ZIP de arquivos editados do Lote 185. Neste ambiente não havia o projeto completo para rodar `npm run build` real de ponta a ponta. Foram feitas verificações estáticas nos arquivos editados e revisão manual do gerador compartilhado.

Ao aplicar no projeto completo, rode:

```bash
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

## Resultado esperado
- PDF e PNG com letras maiores.
- Melhor leitura no WhatsApp e no leitor de PDF.
- Mesmo layout base entre PDF e PNG.
- Menos sensação de comprovante espremido.

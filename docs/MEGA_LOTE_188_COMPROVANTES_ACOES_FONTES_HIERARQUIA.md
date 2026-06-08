# Mega Lote 188 — Comprovantes PDF/PNG com ações padronizadas, fontes maiores e hierarquia 10/10

## Objetivo
Padronizar os comprovantes nas abas Comprovantes, Vendas recentes e Atividades recentes para manter o mesmo padrão visual em PDF/PNG/compartilhamento, com fonte maior, descrição de produtos mais legível, desconto sempre visível quando existir e fluxo mais claro para usuário leigo.

## O que foi feito
- Padronizadas as ações principais para: **PDF**, **Extrato PNG** e **Compartilhar**.
- Vendas recentes e Atividades recentes agora usam as mesmas ações e o mesmo gerador visual base da aba Comprovantes.
- O PNG e o PDF continuam usando o mesmo template base, evitando diferenças visuais entre arquivos.
- A descrição/nome dos produtos foi ampliada e ganhou quebra responsiva em até 3 linhas.
- A coluna Produto ganhou mais espaço, com valores e totais ainda preservados.
- A hierarquia do cabeçalho do recibo foi ajustada para melhor leitura.
- A área de cliente/venda/tipo/forma ganhou fonte maior.
- As tabelas HTML da aba Comprovantes ganharam fonte maior, mais respiro e produto mais destacado.
- Comprovante de venda no crediário deixa de listar Pix/Dinheiro/Cartão como se fosse pagamento recebido.
- Comprovante de parcela/crediário deixa a área de pagamento como **Resumo do crediário**, sem exigir forma Pix/Dinheiro/Cartão quando não for necessário.
- Desconto permanece no layout quando existir.

## Arquivos alterados
- `package.json`
- `package-lock.json`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `src/lib/webApi.ts`
- `src/mobile-app/components/receiptShare.ts`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/screens/DashboardScreen.tsx`
- `docs/MEGA_LOTE_188_COMPROVANTES_ACOES_FONTES_HIERARQUIA.md`

## Testes executados
- `npm run type-check` — passou
- `npm run build` — passou com aviso Vite de chunk acima de 500 KB
- `npm run lint` — passou
- `npm run release:check` — passou
- `npm audit --audit-level=high` — 0 vulnerabilidades high
- `node scripts/credit_payment_guard_tests.js` — passou
- `npm run qa:push` — passou
- `npm run qa:commercial` — passou
- `npm run qa:load` — passou
- `npm run release:commercial:check` — passou
- `npm run release:commercial:prepare` — passou

## Observações honestas
- O build ainda mostra aviso de chunk maior que 500 KB. Não quebrou, mas vale otimizar depois para celular fraco.
- Não foi feito teste visual em Android/iPhone real dentro deste ambiente; a validação foi feita por código, build e QA automatizado.

## Não foi alterado
- Login
- Supabase Auth
- ENV
- RLS
- Notificações push
- Banco de dados
- Regras principais de venda/crediário

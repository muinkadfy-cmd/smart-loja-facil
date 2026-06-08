# Mega Lote 171 — PDF manual real + Crediário rápido

## Objetivo
Corrigir o PDF que saía com CSS/HTML cru dentro do arquivo e agilizar o recebimento de parcelas no Crediário sem obrigar o usuário a voltar ao topo da tela.

## Correções P0

### PDF real, sem HTML/CSS grudado
- O botão PDF não usa mais o texto do HTML estilizado como fonte principal do arquivo.
- O PDF agora é montado manualmente, com comandos de PDF e dados reais da nota/parcela.
- O arquivo final contém campos desenhados de forma controlada: logo, título, cliente, telefone, tabela, status, totais e anotações.
- `style`, `script`, `template` e `noscript` também foram blindados no conversor de texto para evitar vazamento de CSS caso algum comprovante antigo seja usado como fallback.
- Nome do arquivo agora ganha data/hora para evitar o alerta repetido de “baixar o arquivo novamente”.

### Crediário mais rápido
- O formulário de receber parcela virou uma gaveta/bottom sheet dentro da tela atual.
- Ao tocar em **Receber**, o usuário não precisa mais rolar até o topo.
- O recebimento abre sobre a lista, mantendo o contexto da parcela selecionada.
- A ação pode ser cancelada tocando fora ou no botão Cancelar.
- Botões de confirmação ficam fixos no rodapé da gaveta para acelerar o uso no celular.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Testes executados
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`

## Resultado
- Type-check OK.
- Build OK.
- Lint OK.
- Release check OK.
- 0 vulnerabilidades high.
- Testes obrigatórios do recebimento de crediário OK.

## Observação honesta
O Vite ainda avisa que o chunk principal passa de 500 KB. Isso não quebrou o app, mas continua sendo ponto recomendado para otimização futura em celulares fracos.

## Versão/cache
- App: `pwa-supabase-v171-pdf-manual-crediario-rapido`
- Cache: `smart-loja-pwa-supabase-v171-pdf-manual-crediario-rapido`

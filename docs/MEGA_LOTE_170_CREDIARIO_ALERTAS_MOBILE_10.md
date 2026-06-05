# Mega Lote 170 — Crediário mobile 10/10 + avisos laterais de ações

## Objetivo
Polir a aba Crediário com foco mobile-first, corrigir sensação de tela espremida, organizar notas/parcelas com hierarquia clara e adicionar avisos laterais quando ações importantes forem finalizadas.

## Escopo seguro
Este lote não altera login, Supabase, ENV, senha, permissões/RLS ou regras de autenticação. As mudanças ficam em interface mobile, Crediário, avisos de ação e mensagens de sucesso/feedback.

## Crediário
- Recuperado e preservado o fluxo com **Ver recibo** por parcela e **Ver extrato da nota**.
- Nota continua expansível/recolhível.
- Cards ganharam respiro, alinhamento e hierarquia melhor.
- Resumo da nota usa Total / Pago / Saldo / Contato.
- Criado bloco **Próxima cobrança** para o usuário leigo entender qual parcela cobrar primeiro.
- Botões de parcela não ficam mais sobrepostos aos valores.
- Botões **Ver recibo** e **Receber** ficaram separados, alinhados e tocáveis no mobile.
- Ações finais da nota ficaram sticky acima da bottom nav, sem cobrir o conteúdo principal.
- Filtros e busca receberam micro polimento.
- Texto de ajuda do Crediário foi reduzido para não empurrar a lista para baixo.

## Avisos laterais / feedback das ações
Criado o helper `notifyMobileAction` e uma pilha global de avisos laterais no app.

Ações com aviso lateral revisadas/adicionadas:
- Venda concluída.
- Compartilhar comprovante de venda.
- Parcela recebida no Crediário.
- Abrir recibo/extrato da nota.
- Abrir caixa.
- Lançar entrada/saída no caixa.
- Fechar caixa.
- Produto cadastrado/atualizado/inativado/reativado.
- Estoque ajustado.
- Cliente cadastrado/atualizado/inativado/reativado.
- Backup criado/importado/restaurado.
- Recibo visualizado.
- PDF baixado.
- Envio/compartilhamento de comprovante.

## Arquivos principais alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/components/actionToast.ts`
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/screens/CashScreen.tsx`
- `src/mobile-app/screens/ProductsCustomersScreens.tsx`
- `src/mobile-app/screens/BackupScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- scripts de release/commercial

## Versão/cache
- Versão: `0.1.170`
- App: `pwa-supabase-v170-crediario-alertas-mobile-10`
- Cache: `smart-loja-pwa-supabase-v170-crediario-alertas-mobile-10`

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
Todos os testes passaram. O build ainda exibe aviso de chunk acima de 500 KB, sem quebrar o app. Recomenda-se otimização futura de divisão de chunks para celulares fracos.

## Próximo lote ideal
Auditar a aba Comprovantes após o novo recibo padrão preto/branco em celular real: validar abrir recibo, PDF, envio, scroll, logo e status em venda, extrato, parcela paga, parcial, aberta e atrasada.

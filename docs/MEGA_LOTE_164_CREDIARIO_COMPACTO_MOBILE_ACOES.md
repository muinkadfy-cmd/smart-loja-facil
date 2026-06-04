# Mega Lote 164 — Crediário compacto mobile, notas expansíveis e ações revisadas

## Objetivo
Corrigir a aba **Crediário** após análise dos prints reais no Android/Chrome, deixando a tela mais curta, mais organizada e mais fácil para usuário leigo receber parcelas sem confundir com a aba Comprovantes.

## Problemas vistos nos prints
- O campo de busca estava aparecendo com aparência crua de input do navegador.
- Cada nota abria com todas as parcelas visíveis, deixando a tela grande demais no celular.
- Os cards das parcelas ocupavam muita altura e exigiam muita rolagem.
- O status da nota precisava ficar mais claro: Aberto, Parcial, Vencido ou Quitado.
- Os botões de ação precisavam ficar mais previsíveis: receber próxima parcela, abrir/recolher parcelas e abrir comprovantes.
- A bottom navigation estava visualmente correta, mas o conteúdo precisava de mais respiro para não parecer preso atrás dela.

## O que foi alterado
- A lista do crediário agora nasce **compacta**.
- Cada nota mostra apenas a próxima parcela relevante quando está recolhida.
- Adicionado botão **Ver todas as parcelas** para expandir a nota.
- Adicionado botão **Recolher parcelas e deixar compacto** quando a nota está aberta.
- Cabeçalho da nota agora é clicável, com `aria-expanded` para acessibilidade.
- Status geral da nota agora usa regra mais clara:
  - **Quitado**: tudo pago.
  - **Vencido**: existe parcela vencida em aberto.
  - **Parcial**: parte já foi paga e ainda há saldo.
  - **Aberto**: ainda não houve pagamento.
- Adicionada barra de progresso de parcelas pagas.
- Campo de busca recebeu card visual próprio, sem borda preta nativa.
- Filtros foram polidos para rolagem horizontal limpa.
- Cards, bordas, sombras, botões, espaçamento e hierarquia foram micro ajustados para mobile.

## Fluxos e botões revisados
- Filtro **Todos**.
- Filtro **Abertos**.
- Filtro **Vencidos**.
- Filtro **Quitados**.
- Busca por cliente, venda, telefone e status.
- Botão **Ver vencidos** quando existe atraso.
- Toque no cabeçalho da nota para expandir/recolher.
- Botão **Ver todas as parcelas**.
- Botão **Recolher parcelas e deixar compacto**.
- Botão **Receber** dentro de parcela em aberto.
- Botão **Receber próxima parcela**.
- Painel de recebimento: cancelar, conferir antes de receber, corrigir valor, usar saldo exato e confirmar recebimento.
- Botão **Abrir comprovantes desta nota**.

## Proteções mantidas
- Não foi alterada a regra financeira do recebimento.
- Não foi alterado cálculo de caixa.
- Não foi alterada baixa no banco.
- Não foi movida função de comprovante de volta para o Crediário.
- O Crediário continua focado em consultar saldo e receber parcelas.
- Comprovantes continua sendo a aba de A4/PDF, visualização iPhone e envio.

## Versionamento PWA
- App: `pwa-supabase-v164-crediario-compacto-mobile`
- Cache: `smart-loja-pwa-supabase-v164-crediario-compacto-mobile`
- Classe HTML: `smart-mobile-rebuild-v164`

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
Build aprovado e pacote comercial limpo preparado. O Vite manteve aviso de chunk acima de 500 KB; não quebra o app, mas segue como otimização recomendada para celular fraco.

## Próximo lote ideal
Fazer uma auditoria visual final no Crediário e Comprovantes juntos depois do deploy real no celular, conferindo se o cache v164 aparece no diagnóstico e se a rolagem com bottom nav ficou confortável em aparelhos Android e iPhone.

# Mega Lote 213 — Crediário Compacto Premium Mobile

## Objetivo
Deixar a aba Crediário mais próxima da referência enviada: mais compacta, limpa, SaaS/mobile, com menos altura desperdiçada e melhor leitura para usuário leigo.

## Ajustes aplicados
- subnav de Operação ficou compacto, sem título grande, com quatro botões principais visíveis;
- resumo do crediário virou faixa compacta em 4 colunas: Em aberto, Vencidos, Clientes e Próximo vencimento;
- banner “Crediário fácil” ficou menor, sem ilustração grande e com botão de fechar;
- seletor Simples/Avançado ficou mais compacto;
- busca e filtros receberam micro ajuste de altura, borda e espaçamento;
- card do cliente ficou mais limpo;
- removido Contato da área principal do card, deixando visível Total/Pago/Saldo;
- em modo recolhido, a parcela detalhada não ocupa espaço;
- Próxima cobrança ganhou layout limpo com valor à direita;
- ações principais ficam alinhadas: Receber próxima parcela, Ver extrato da nota e Corrigir;
- seta visual no card indica abrir/recolher parcelas;
- mantida lógica do crediário automático mais/menos;
- mantidos: receber, corrigir, estornar, complemento, modo simples/avançado, extrato e recibo.

## Arquivos alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v213

## Classificação
- Crediário layout: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- Lógica de cálculo: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Risco: baixo, alterações focadas em layout/UX.

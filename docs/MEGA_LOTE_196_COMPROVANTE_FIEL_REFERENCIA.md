# Mega Lote 196 — Comprovante Fiel à Referência

## Auditoria do problema
O comprovante compartilhado ainda estava menos fiel que a referência: ícones viravam traços em alguns celulares, cabeçalhos não tinham o círculo/ícone rosa, a caixa do cliente ficava mais simples, e atividades/vendas recentes não seguiam o mesmo acabamento do extrato principal.

## Ajustes realizados
- Ícones do cliente, telefone, endereço, produtos e parcelas agora são vetoriais no canvas, sem depender de emoji/fonte do aparelho.
- Cabeçalhos pretos ganharam círculo branco com ícone rosa, igual à referência.
- Caixa de cliente ficou com coluna de ícone, divisória vertical e linhas horizontais em rosa claro.
- Tabelas mantêm cabeçalho pink, bordas pretas e divisórias rosadas.
- Logo, título, status e badge foram micro ajustados para maior fidelidade visual.
- Atividades recentes e vendas recentes usam o mesmo padrão visual no PNG/PDF/Compartilhar.
- Compartilhar continua enviando somente arquivo PNG ou PDF, sem texto e sem link junto.
- Cache/PWA atualizado para v196.

## Segurança
Não foram criadas tabelas, migrations, buckets ou policies.

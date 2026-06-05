# Mega Lote 175 — Produto com preço de custo, venda, SKU e barras automáticos

## Objetivo
Verificar o cadastro de produtos e ajustar o fluxo para usuário leigo:

- manter preço de venda;
- adicionar preço de custo;
- gerar SKU automaticamente;
- gerar código de barras automaticamente;
- preservar login, Supabase, ENV, RLS e autenticação.

## Ajustes aplicados

### Cadastro de produtos mobile
- Campo **Preço de custo** adicionado.
- Campo **Preço de venda** ficou explícito.
- Campo **SKU automático** gera código quando vazio.
- Campo **Código de barras automático** gera EAN-13 interno quando vazio.
- Botão **Gerar** recria SKU e barras quando o usuário quiser.
- Cards mostram custo para conferência interna.
- Valor em estoque mostra venda e custo total para gestão.

### Cadastro de produtos web/desktop
- Campo **Preço de custo** adicionado.
- Campo **Preço de venda** mantido.
- SKU e código de barras agora são gerados automaticamente no cadastro.
- Botão para regerar SKU/barras.
- Tabela de produtos ganhou coluna de custo.
- Detalhes do produto mostram custo e venda.

### Supabase
- Nova migration segura:
  - `supabase/migrations/202606051320_product_cost_price_sku_barcode_auto.sql`
- Adiciona `products.cost_price` com default 0.
- Adiciona índices auxiliares para SKU e código de barras.
- O app tem fallback: se a coluna ainda não existir no Supabase, ele não quebra a tela de produtos.

## Observação importante
Para o preço de custo ficar salvo na nuvem, rode a migration no Supabase. Sem a migration, o app continua funcionando e salva o produto sem quebrar, mas o custo pode ficar em modo compatibilidade até a coluna existir.

## Testes executados

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
npm audit --audit-level=high
node scripts/credit_payment_guard_tests.js
npm run release:commercial:check
npm run release:commercial:prepare
```

Resultado: todos passaram. `npm audit --audit-level=high` retornou 0 vulnerabilidades high.

## Limitação honesta
O build ainda mostra alerta de chunk acima de 500 KB. Não quebrou o sistema, mas continua recomendado otimizar em lote futuro para celulares fracos.

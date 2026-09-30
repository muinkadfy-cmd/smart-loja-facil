# Mega Lote 251 — Design System Premium — Fase 2

## Base usada

Esta Fase 2 foi preparada sobre a Fase 1 R2 já aplicada/testada no projeto local do usuário. O arquivo `ui-premium-polish.css` desta entrega deriva diretamente do mesmo arquivo da Fase 1 R2, preservando o marcador legado `Mega Lote 250` exigido pelo `qa:ui` enquanto o `package.json` permanecer em `0.1.250`.

## Escopo da Fase 2

Expansão visual/responsiva do Design System para as três áreas operacionais prioritárias:

- PDV / Vendas;
- Produtos;
- Clientes.

Nenhuma regra de negócio foi alterada. Esta fase não muda cálculo de venda, desconto, troco, parcelamento, primeiro vencimento, estoque, baixa/entrada, caixa, crediário, comprovantes, APIs, Supabase, persistência, migrations, secrets, PWA ou service worker.

## Diagnóstico antes da alteração

A base já possuía fluxo funcional e componentes reais, mas a apresentação ainda dependia de estilos históricos distribuídos entre `mobile-app.css`, `desktop-premium.css` e a camada premium final. O objetivo desta fase não é criar outro arquivo de hotfix: o refinamento foi incorporado na mesma `ui-premium-polish.css` consolidada iniciada na Fase 1.

### PDV

- reforço visual do fluxo guiado sem mudar o estado `currentStep`;
- resumo de carrinho/subtotal/cliente com melhor hierarquia;
- busca e categorias compactas com rolagem horizontal segura no mobile;
- cards de produto com foto, preço, estoque e ação legíveis;
- mini carrinho com stepper e total organizados;
- pagamento rápido e segmentos com alvos de toque adequados;
- checkout e total final com maior contraste;
- layout desktop em duas colunas e mobile em uma coluna sem overflow horizontal.

### Produtos

- hero de ação mais compacto;
- KPIs em 4 colunas no desktop e 2 no mobile;
- alerta de estoque com CTA adaptado para tela pequena;
- busca/filtros com melhor densidade e scroll seguro;
- formulário e foto do produto com adaptação para telas estreitas;
- cards compactos/expandidos com preço, metadados e ações mais claros.

### Clientes

- mesma linguagem de Produtos para manter consistência;
- KPIs responsivos;
- busca/filtros compactos;
- cards com limite, contato e ações organizadas;
- ações expandidas adaptadas para toque e telas estreitas.

## Compatibilidade e segurança

- mantém `smart-mobile-rebuild-v250` enquanto a versão real continua `0.1.250`;
- mantém o texto `Mega Lote 250` exigido pelo contrato atual de `qa:ui`;
- mantém `prefers-reduced-motion`;
- não adiciona novo arquivo CSS carregado por último;
- não altera `dialog-hotfix.css` nem contratos de modal do iPhone;
- não usa `position: fixed` novo nesta camada;
- não altera arquivos de backend, banco ou Cloudflare.

## Validações executadas antes do ZIP

Executadas nesta entrega:

- comparação com o CSS exato da Fase 1 R2;
- parser CSS `tinycss2`: 0 erros de sintaxe;
- chaves CSS balanceadas;
- presença dos tokens obrigatórios atuais do `qa:ui`;
- confirmação de `prefers-reduced-motion`;
- confirmação de ausência de novo `position: fixed`;
- ZIP Delta contém somente os arquivos desta fase.

Os testes completos (`type-check`, `build`, `verify:dist`, `lint`, `qa:ui`, `release:check`, `release:commercial:check`) devem ser executados na árvore real `C:\smart-loja-facil-git` após aplicar o Delta. Se qualquer teste falhar, o instalador deve restaurar automaticamente o arquivo anterior.

## Arquivos do Delta

- `src/mobile-app/styles/ui-premium-polish.css`
- `docs/MEGA_LOTE_251_DESIGN_SYSTEM_FASE_2.md`

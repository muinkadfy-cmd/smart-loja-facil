# Mega Lote 104 — Mapeamento das fotos mobile + correção de navegação 10/10

## Contexto
Foram analisados 2 ZIPs enviados pelo usuário:

1. `smart-loja-facil-git.zip` — base atual do projeto PWA web/mobile.
2. `drive-download-20260602T170316Z-3-001.zip` — pacote com 40 imagens/fotos de conferência mobile.

O segundo ZIP contém principalmente screenshots Android/Chrome em resolução 1080 × 2316, além de uma foto de comprovante/WhatsApp. As imagens foram usadas como referência de auditoria visual e mobile-first, não como assets de interface.

## Mapeamento das fotos

### Grupo 1 — Menu lateral / navegação / bottom nav
Arquivos relacionados:
- `Screenshot_20260602_135751_Chrome.jpg`
- `Screenshot_20260602_135754_Chrome.jpg`
- `Screenshot_20260602_140102_Chrome.jpg`

Problemas mapeados:
- menu lateral precisava rolar sem travar;
- sidebar fechada não podia ocupar espaço lateral;
- bottom nav precisava ficar fixo sem cobrir conteúdo;
- tela principal precisava rolar de forma natural.

Correção aplicada:
- nova camada CSS `lote104-mobile-photo-map.css` fixa o scroll no contêiner correto no mobile;
- sidebar fechada usa `transform: translateX(-110%)` e não ocupa layout;
- bottom nav recebe `z-index`, altura e safe-area controlados;
- `.neo-main` passa a ser o contêiner de rolagem no mobile.

### Grupo 2 — Dashboard / cards / ambiente e conexões
Arquivos relacionados:
- `Screenshot_20260602_135801_Chrome.jpg`
- `Screenshot_20260602_135807_Chrome.jpg`
- `Screenshot_20260602_135812_Chrome.jpg`
- `Screenshot_20260602_135852_Chrome.jpg`

Problemas mapeados:
- cards muito compridos ou apertados;
- textos quebrando;
- conteúdo sumindo atrás do dock;
- área branca grande em alguns estados após hotfix de scroll.

Correção aplicada:
- kpis/cards ficam em uma coluna no mobile;
- conteúdo recebe padding inferior seguro para o dock;
- painel principal perde máscara/corte indevido;
- títulos e chips ficam com `white-space` controlado.

### Grupo 3 — PDV / venda / cliente / pagamento
Arquivos relacionados:
- `Screenshot_20260602_135827_Chrome.jpg`
- `Screenshot_20260602_135833_Chrome.jpg`
- `Screenshot_20260602_135837_Chrome.jpg`
- `Screenshot_20260602_135842_Chrome.jpg`
- `Screenshot_20260602_135846_Chrome.jpg`

Problemas mapeados:
- formulário do PDV e cliente apertados;
- risco de rolagem horizontal;
- áreas de pagamento empilhadas precisavam caber melhor;
- resumo de venda precisava ficar legível.

Correção aplicada:
- grids de PDV e pagamento viram uma coluna no mobile;
- inputs e botões passam a ter largura máxima segura;
- tabelas mantêm rolagem horizontal apenas quando inevitável;
- botões têm altura mínima confortável para toque.

### Grupo 4 — Produtos / clientes / pedidos / relatórios / crediário
Arquivos relacionados:
- `Screenshot_20260602_135904_Chrome.jpg`
- `Screenshot_20260602_135907_Chrome.jpg`
- `Screenshot_20260602_135911_Chrome.jpg`
- `Screenshot_20260602_135923_Chrome.jpg`
- `Screenshot_20260602_135928_Chrome.jpg`
- `Screenshot_20260602_135931_Chrome.jpg`
- `Screenshot_20260602_135947_Chrome.jpg`
- `Screenshot_20260602_135949_Chrome.jpg`
- `Screenshot_20260602_135957_Chrome.jpg`

Problemas mapeados:
- filtros/tabelas com risco de corte;
- cards e campos muito próximos;
- estados vazios precisavam manter contraste;
- bottom nav podia cobrir o final da tela.

Correção aplicada:
- grids genéricos `.grid-2`, `.grid-3`, `.grid-4`, `.form-grid`, `.two-col` viram 1 coluna no mobile;
- cards recebem espaçamento consistente;
- `neo-main` tem padding inferior extra para o dock;
- estados vazios ganham fundo e borda mais visíveis.

### Grupo 5 — Diagnóstico, sincronização e auditoria
Arquivos relacionados:
- `Screenshot_20260602_140017_Chrome.jpg`
- `Screenshot_20260602_140020_Chrome.jpg`
- `Screenshot_20260602_140024_Chrome.jpg`
- `Screenshot_20260602_140028_Chrome.jpg`
- `Screenshot_20260602_140030_Chrome.jpg`
- `Screenshot_20260602_140034_Chrome.jpg`
- `Screenshot_20260602_140037_Chrome.jpg`
- `Screenshot_20260602_140042_Chrome.jpg`
- `Screenshot_20260602_140047_Chrome.jpg`
- `Screenshot_20260602_140050_Chrome.jpg`
- `Screenshot_20260602_140053_Chrome.jpg`
- `Screenshot_20260602_140057_Chrome.jpg`
- `Screenshot_20260602_140108_Chrome.jpg`
- `Screenshot_20260602_140115_Chrome.jpg`
- `Screenshot_20260602_140122_Chrome.jpg`

Problemas mapeados:
- telas longas precisam rolar naturalmente;
- diagnósticos não podem ficar presos em altura fixa;
- cartões precisam manter leitura clara no celular.

Correção aplicada:
- rolagem mobile centralizada em `.neo-main`;
- `.neo-page-shell`, `.neo-page-content`, `.classic-page` e `.stack` não usam altura fixa no mobile;
- cards grandes passam a empilhar.

### Grupo 6 — Comprovante / imagem avulsa
Arquivo relacionado:
- `IMG-20260602-WA0132.jpg`

Uso no lote:
- referência visual para não perder legibilidade em comprovantes e telas longas;
- não foi importada como asset para evitar peso desnecessário no PWA.

## Correções técnicas principais

- Adicionado `src/styles/lote104-mobile-photo-map.css`.
- Importado o CSS no fim do `src/main.tsx`, depois dos hotfixes anteriores.
- Adicionada a classe global `lote104-mobile-photo-map` no `documentElement`.
- Atualizada versão lógica para `pwa-supabase-v104-mobile-photo-map`.
- Atualizado cache para `smart-loja-pwa-supabase-v104-mobile-photo-map`.
- Atualizada fila local para `smart-loja:web-outbox-v104`.
- Adicionados aliases de ícone PWA para compatibilidade:
  - `/icons/icon-192-maskable.png`
  - `/icons/icon-512-maskable.png`
  - `/brand/smart-loja-icon.png`

## Resultado esperado

- Mobile com rolagem normal.
- Sem área branca gigante cobrindo conteúdo.
- Sidebar fechada não ocupa espaço.
- Sidebar aberta rola internamente.
- Bottom nav permanece fixo sem cobrir o fim da página.
- Cards e formulários empilhados com melhor leitura.
- Menos risco de texto cortado ou tela presa.

## Limitação honesta

O lote foi validado por build e testes estáticos. A validação visual final precisa ser feita no navegador/celular após deploy, com Ctrl+F5 no PC e fechamento/reabertura do PWA no Android.

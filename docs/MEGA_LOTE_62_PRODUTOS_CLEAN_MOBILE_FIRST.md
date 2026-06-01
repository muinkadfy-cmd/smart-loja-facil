# Mega Lote 62 — Produtos clean, mobile-first e menos poluição

## Escopo
Aba Produtos, incluindo filtros, métricas, lista, ações, cadastro/edição, ajuste de estoque, estados vazios e micro acabamento visual.

## O que foi feito
- Apliquei uma camada dedicada `products-clean-v62` para deixar a aba Produtos mais clara e menos carregada.
- Reduzi o excesso de preto/navy nos painéis de produtos, ações e formulários.
- Deixei filtros com fundo claro, bordas suaves e textos mais legíveis.
- Melhorei KPIs de produtos com cards claros, ícones menores e melhor hierarquia.
- Padronizei a lista de produtos com tabela clara, cabeçalho azul suave e estado vazio mais legível.
- Reorganizei visualmente a área de ações para parecer painel comercial, não bloco técnico.
- Cadastros, foto do produto e ajuste de estoque ganharam fundo claro, inputs mais limpos e bordas consistentes.
- Corrigi textos e rótulos com acentos: Código, Preço, Ações, Edição, Relatório, produtos visíveis e mensagens principais.
- Atualizei o service worker para evitar cache antigo após aplicar o ZIP.

## Arquivos alterados
- `src/pages/Products.tsx`
- `src/styles.css`
- `public/sw.js`
- `docs/MEGA_LOTE_62_PRODUTOS_CLEAN_MOBILE_FIRST.md`

## Testes executados
- `npm run lint`
- `npm run release:check`

## Limitação real
O ambiente do ZIP não trouxe `node_modules`, então `npm run type-check` pode falhar localmente se as dependências não estiverem instaladas. Rode `npm install` no seu PC antes do type-check caso necessário.

## Risco
Baixo a médio. O lote é principalmente visual e preserva funções existentes de cadastro, edição, estoque, foto, tabela, WhatsApp e filtros.

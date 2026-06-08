# Mega Lote 187 — Produtos mais legíveis nos comprovantes PDF/PNG

## Objetivo
Aumentar a fonte da descrição/nome dos produtos em todos os comprovantes gerados por PDF/PNG e melhorar a quebra responsiva para não cortar, não espremer e manter leitura boa no WhatsApp e no leitor de PDF.

## Ajustes realizados
- Aumentei a fonte da coluna **Produto** nos comprovantes.
- Aumentei o peso da tipografia dos nomes/descrições dos produtos.
- A tabela de produtos agora calcula altura de linha conforme o tamanho da descrição.
- Produtos podem quebrar em até 3 linhas com respiro melhor.
- Reduzi largura das colunas menores para dar mais espaço à descrição do produto.
- Aumentei fonte de valores de item e quantidade para manter consistência.
- Mantive PDF e PNG no mesmo layout base.
- Atualizei cache/versão para v187.

## Arquivos principais
- `src/mobile-app/components/receiptShare.ts`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- scripts de release/check

## Validação
Este pacote foi aplicado em cima do ZIP de arquivos editados do Lote 186. Ao aplicar no projeto completo, rode:

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
```

## Limitação honesta
Não rodei build completo aqui porque o pacote de entrada contém apenas os arquivos editados do lote anterior, não o projeto inteiro com todas as dependências/código-fonte.

# Mega Lote 115 — Layout Perfeito Universal Web/Mobile

## Auditoria sênior realizada
Foram revisados os pontos de layout que estavam deixando o PWA com sensação de tela quebrada no mobile:

- header mobile sobrepondo conteúdo;
- card de loja ocupando área visual sem reservar espaço real;
- rolagem reaproveitada ao trocar de abas;
- conteúdo sendo espremido por CSS acumulado;
- blocos vazios e instruções grandes demais no mobile;
- bottom nav cobrindo partes da tela;
- drawer/menu lateral brigando com topo e conteúdo;
- cards/tabelas/formulários sem uma regra universal única.

## Definição do layout universal
Este lote estabelece a fundação visual final:

### Mobile
- `neo-main` é a moldura fixa do app;
- `neo-topbar` ocupa espaço real, sem sticky/fixed perigoso;
- `neo-page-shell` é a única área principal de rolagem;
- `bottom nav` fica fixo e o conteúdo recebe padding inferior seguro;
- drawer lateral fica acima da tela com overlay e rolagem própria;
- busca e atalhos extras ficam ocultos no mobile para reduzir poluição;
- páginas internas usam grids de uma coluna quando necessário;
- cards/formulários/tabelas não podem ultrapassar a largura da tela.

### Web/tablet
- sidebar fixa com rolagem interna;
- topbar estável e sem sobreposição;
- conteúdo centralizado com largura máxima;
- `neo-page-shell` controla a rolagem principal;
- grids se adaptam sem espremimento.

## Arquivos alterados
- `src/components/Shell.tsx`
- `src/main.tsx`
- `src/styles/lote115-perfect-layout-foundation.css`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `package.json`
- `README.md`

## Riscos restantes
- O projeto ainda tem muitos CSS antigos com `!important`. Este lote estabiliza por cima com uma camada final, mas o próximo passo ideal é consolidar CSS e remover camadas antigas sem quebrar telas.
- Alguns módulos internos podem precisar de micro ajuste específico depois de prints reais: Crediário, Relatórios, Comprovantes e Configurações.

## Status comercial
- Mobile estrutural: melhorado para uma base muito mais confiável.
- Web: mais estável e menos espremido.
- Pronto para vender: quase, dependendo de teste real no celular após deploy.

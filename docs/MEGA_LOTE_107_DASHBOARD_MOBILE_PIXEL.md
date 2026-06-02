# Mega Lote 107 — Dashboard Mobile Pixel + Sininho + Manifest Icons

## Objetivo
Corrigir os problemas visuais confirmados nos prints reais do celular:
- sininho com badge aparecia, mas o ícone não aparecia;
- cards do Dashboard quebravam palavras como `registrad as`;
- topbar mobile cortava o nome do app;
- manifest PWA gerava aviso de ícone maskable.

## O que mudou
- `Shell.tsx`: adicionado sino SVG inline como fallback real, sem depender do mapa de ícones.
- `Dashboard.tsx`: textos dos cards foram encurtados para leitura mobile.
- `lote107-dashboard-mobile-pixel.css`: nova camada isolada para topbar, cards, badge, sino e Dashboard mobile.
- `public/icons/*.png`: ícones PWA 192/512 e maskable regenerados como PNG válido.
- `webApi.ts`, `sw.js`, `manifest`, `release_check`: versão e cache atualizados para v107.

## Validação esperada
- O botão de notificação mostra sino visível dentro do botão branco.
- O badge vermelho fica no canto superior direito.
- Dashboard mobile mantém 2 colunas quando couber.
- Textos dos cards não quebram de forma feia.
- Ticket médio ocupa largura total.
- Bottom nav permanece preservado.

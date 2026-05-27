# Mega Lote 39 - Dashboard Premium baseado na referencia visual

## Objetivo
Redesenhar a interface principal do Smart Loja Facil com foco em:
- visual premium inspirado na referencia enviada pelo usuario;
- consistencia web/desktop e mobile;
- prioridade mobile-first;
- melhor hierarquia visual;
- micro polimento em cards, botoes, menu, topbar e dashboard;
- preservacao das rotas e funcionalidades ja existentes.

## Alteracoes principais
1. **Shell / estrutura global**
   - novo layout premium com sidebar mais moderna;
   - topo com bloco de boas-vindas, fita de acoes e chips de status;
   - navegacao mobile inferior com 5 acoes principais;
   - menu lateral mobile em modo drawer;
   - visual mais proximo da referencia com dark blue, brilho suave e cards compactos.

2. **Dashboard**
   - nova grade de KPIs no topo;
   - bloco de ambiente e conexoes com cards informativos;
   - atalhos rapidos em grade visual;
   - grafico de vendas reformulado;
   - bloco de status do sistema;
   - faixa final de confianca / seguranca.

3. **Cache / PWA**
   - versao do service worker atualizada para forcar recarregamento no celular.

## Arquivos alterados
- `src/components/Shell.tsx`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `public/sw.js`

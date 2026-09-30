# Mega Lote 251 — Fase 1
## Design System Premium + Shell/Dashboard

Base auditada: `main` v250 / `package.json` 0.1.250.

### Objetivo desta fase
Começar o Mega Lote 251 sem alterar regras de negócio. Esta fase consolida a camada visual já existente em vez de adicionar um novo arquivo de hotfix por cima.

### Arquivos
- `src/mobile-app/components/SectionHeader.tsx`
  - novo primitivo compartilhado para títulos de seção;
  - ação opcional com `aria-label`;
  - usa classes já existentes para evitar duplicar estilo.
- `src/mobile-app/screens/DashboardScreen.tsx`
  - usa `SectionHeader` nas áreas de ações e produtos;
  - mantém cálculo, chamadas de API, navegação e compartilhamento;
  - adiciona rótulo acessível aos KPIs e `aria-live` ao estado de estoque.
- `src/mobile-app/styles/ui-premium-polish.css`
  - reescrito no mesmo caminho da camada v250;
  - cria tokens semânticos (`--ui-*`) e mantém aliases v250;
  - melhora topbar desktop 1024–1279 sem texto espremido;
  - exibe rótulos Sincronizar/Recarregar somente a partir de 1280px;
  - impede corte do botão Sair;
  - melhora nome da loja/sidebar/rodapé;
  - mantém 4 KPIs e 4 atalhos em desktop;
  - mantém 2 colunas no mobile;
  - preserva targets de toque e `focus-visible`;
  - mantém `prefers-reduced-motion`.

### Deliberadamente NÃO alterado
- Supabase, migrations, RLS e RPCs;
- pagamentos, caixa, crediário, parcelas, estoque e comprovantes;
- PWA/service worker/manifest;
- `dialog-hotfix.css` e correções críticas do iPhone;
- versão do pacote (continua 0.1.250 nesta fase);
- deploy/Cloudflare.

### QA necessário na máquina do projeto antes de release
Rodar, nesta ordem:
1. `npm run type-check`
2. `npm run build`
3. `npm run verify:dist`
4. `npm run lint`
5. `npm run qa:ui`
6. `npm run release:check`
7. `npm run release:commercial:check`

Depois validar visualmente 390px e 1366px no Dashboard e topbar, além de 320/360/375/393/412/430 e desktop 1280/1440/1536/1920 conforme matriz do projeto.

### Status
Candidato a teste local. Não é release final v251 e não deve ser implantado em produção sem os testes acima e verificação visual.
## Correção R2
- Mantém explicitamente o marcador `Mega Lote 250` exigido por `scripts/qa/ui_contract_check.js` enquanto a base continua em `0.1.250`.
- Nenhuma regra de negócio foi alterada nesta correção; é somente compatibilidade do contrato de QA.

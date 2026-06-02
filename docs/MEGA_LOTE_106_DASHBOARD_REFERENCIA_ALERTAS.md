# Mega Lote 106 — Dashboard referência + alertas personalizados

## Objetivo
Entregar arquivos prontos para aproximar o Dashboard mobile/web da referência visual enviada, sem gerar imagem, preservando PWA, Supabase e dados.

## Escopo
- Dashboard mobile com topbar, loja ativa, busca, KPIs em cards 2 colunas e bottom nav no padrão da referência.
- Drawer mobile premium com item ativo em destaque marrom/salmão.
- Central de alertas personalizada com alertas por recurso.
- Opção de som ligada/desligada.
- Opção de notificações do navegador ativadas/pausadas.
- Versionamento/cache v106.

## Arquivos alterados
- `src/components/Shell.tsx`
- `src/pages/Dashboard.tsx`
- `src/lib/alerts.ts`
- `src/lib/sound.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/styles/lote106-dashboard-reference-alerts.css`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `README.md`
- `package.json`

## Teste manual recomendado
1. Abrir Dashboard no celular.
2. Conferir se KPIs aparecem como referência.
3. Abrir menu lateral e conferir rolagem.
4. Abrir sino/notificações.
5. Alternar Som ligado/desligado.
6. Alternar Notificações.
7. Navegar para Produtos/Crediário/PDV sem perda de dados.

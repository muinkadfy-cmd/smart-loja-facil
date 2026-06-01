# Mega Lote 06 — Alertas laterais e sons operacionais

## Objetivo
Deixar o sistema mais fácil para usuário leigo, mostrando alertas na lateral e emitindo sons curtos em operações importantes.

## Alterações
- Criado painel lateral de alertas.
- Alertas de parcelas vencidas.
- Alertas de vencimentos próximos em até 3 dias.
- Alertas de estoque baixo conforme limite configurado.
- Alertas de pedidos locais em aberto.
- Cliques nos alertas levam direto para a tela relacionada.
- Sons leves para operações com gravação no SQLite.
- Som de erro quando uma operação crítica falha.
- Som de aviso quando existe alerta crítico.

## Segurança
- Sons usam WebAudio local, sem arquivos externos e sem internet.
- Alertas são calculados com dados do SQLite via comandos Tauri existentes.
- Nenhum dado comercial foi movido para localStorage.
- localStorage foi usado apenas para preferência visual/sonora.

## Arquivos alterados
- src/App.tsx
- src/components/Shell.tsx
- src/lib/api.ts
- src/styles.css

## Arquivos novos
- src/components/AlertsPanel.tsx
- src/lib/sound.ts
- docs/MEGA_LOTE_06_ALERTAS_SONS.md

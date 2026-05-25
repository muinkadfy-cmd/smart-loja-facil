# Mega Lote 05 — Polimento operacional e responsividade

## Objetivo
Melhorar a usabilidade real depois que o Tauri abriu em modo dev, mantendo o sistema 100% offline, modo dark, leve e com dados importantes no SQLite local.

## Alterações
- Dashboard com faixa operacional informando SQLite/local/offline.
- Atalhos rápidos da dashboard agora navegam para módulos reais: venda, produto, cliente, crediário, backup e relatórios.
- Botão WhatsApp do topo leva para Configurações, onde fica o telefone/WhatsApp local da loja.
- Avatar do administrador leva para Configurações.
- Modo PC lento agora aplica classe global para reduzir sombras/efeitos visuais.
- Ajuste de layout para 1366x768: cards mais compactos, painel mais baixo, tabela mais densa e rolagem interna no conteúdo.
- Melhor foco visual em botões para uso com teclado.

## Arquivos alterados
- src/App.tsx
- src/components/Shell.tsx
- src/pages/Dashboard.tsx
- src/styles.css

## Testes executados
- npm run type-check
- npm run build
- npm run release:check

## Teste não executado
- cargo check
- cargo build
- npm run tauri:dev

Motivo: ambiente sem Cargo/Rust instalado. No Windows do usuário, rodar npm run tauri:dev após aplicar o ZIP.

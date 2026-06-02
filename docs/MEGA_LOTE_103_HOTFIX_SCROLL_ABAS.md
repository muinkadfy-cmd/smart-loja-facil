# Hotfix Lote 103 — Rolagem das abas/menu lateral

## Problema
Após o Lote 103, a rolagem das abas/menu lateral podia ficar travada em algumas larguras porque camadas visuais anteriores deixavam a sidebar com `overflow: hidden` e o bloco de navegação sem altura flexível suficiente.

## Correção
- Criada camada `src/styles/lote103-scroll-abas-hotfix.css`.
- Importada após o CSS do Lote 103.
- A navegação lateral `.neo-nav` agora recebe `flex: 1`, `min-height: 0` e `overflow-y: auto`.
- A sidebar preserva cabeçalho e rodapé fixos e libera rolagem só na lista de abas.
- Ajustado comportamento web/mobile com `100dvh` e rolagem por toque.

## Testes
- npm run type-check
- npm run lint
- npm run build
- npm run release:check
- node --check scripts/release_check.js
- validação JSON do manifest

# Mega Lote 254 — Acabamento Visual Global

Versão alvo: **v254**

## Escopo

Lote exclusivamente visual/UI/UX, construído sobre a v253 já sincronizada.

- Shell global: sidebar, topbar, badges, versão e densidade.
- Painel: sincronização compacta, KPIs, alerta de estoque, atalhos e uso da área acima da dobra.
- Relatórios: toolbar, filtros, KPIs e listas.
- Comprovantes: densidade, filtros e hierarquia visual.
- Backup: separação clara entre criar backup e restaurar.
- Configurações: grupos e formulários mais legíveis.
- Logs / Diagnóstico: padronização dos painéis e redução de ruído visual.
- Cupom: editor e prévia integrados ao mesmo Design System.
- Revisão simultânea para desktop/notebook, Android e iPhone.

## Proteções

Este lote não altera:
- regras de venda;
- cálculos financeiros;
- estoque e baixa de estoque;
- crediário e recebimentos;
- caixa;
- Supabase, migrations, banco ou secrets;
- permissões;
- geração de comprovantes/cupom.

## Referência visual

O ajuste de densidade para notebook foi guiado especialmente pela produção em 1360×768, preservando toque confortável no mobile.

## Validação obrigatória

`type-check`, `build`, `verify:dist`, `lint`, `qa:ui`, `release:check`,
`release:commercial:check` e `git diff --check`.

Após os testes: commit, push, Wrangler deploy e validação online de HTML,
manifest, Service Worker, bundle JS, CSS v254 e versão visível.

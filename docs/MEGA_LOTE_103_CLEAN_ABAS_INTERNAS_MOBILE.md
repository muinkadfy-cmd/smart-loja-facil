# Mega Lote 103 — Clean total das abas internas + mobile premium

## Objetivo
Aplicar o mesmo padrão clean do login centralizado nas abas internas do Smart Loja Fácil, com foco em PWA web/mobile, menos poluição, contraste melhor e aparência comercial premium.

## Escopo
- Dashboard
- Vendas / PDV
- Produtos
- Clientes
- Pedidos
- Caixa
- Crediário
- Comprovantes
- Backup
- Configurações
- Logs / Diagnóstico
- Diagnóstico Web
- Tabelas, formulários, cards, botões, chips/status e estados vazios

## Alterações principais
- Versão lógica: `pwa-supabase-v103`.
- Cache PWA: `smart-loja-pwa-supabase-v103-clean-internal-mobile`.
- Fila local: `smart-loja:web-outbox-v103`.
- Nova camada visual: `src/styles/lote103-clean-internal-mobile.css`.
- Fundo geral levemente mais escuro para destacar cards e inputs.
- Cards, painéis, formulários e tabelas com bordas suaves e sombra leve.
- PDV com melhorias de mobile, pagamento em blocos mais limpos e estados vazios mais claros.
- Diagnóstico com leitura mais organizada.
- Release check permanece PWA-only, sem exigir Tauri.

## Risco
Baixo/médio. Lote focado em CSS/versionamento, sem alteração de regra financeira, login, Supabase ou contratos de dados.

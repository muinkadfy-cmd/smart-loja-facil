# Smart Loja Fácil Offline

Sistema comercial local para Windows criado do zero com **Tauri v2 + React + TypeScript + Vite + SQLite local real**.

## Objetivo

Rodar em PC fraco, sem internet, sem login online, sem Supabase, sem Cloudflare, sem API externa e sem servidor na nuvem. Dados importantes são gravados no SQLite local pelo backend Tauri/Rust.

## Rodar em modo dev

```bash
npm install
npm run release:check
npm run tauri:dev
```

## Build Windows

```bash
npm run type-check
npm run build
npm run tauri:build
```

## Módulos entregues nesta base

- Tela inicial simples sem login obrigatório
- Dashboard offline
- Clientes
- Produtos com ajuste de estoque e motivo
- Vendas/PDV com transação SQLite
- Caixa com abertura, resumo diário e fechamento auditado
- Crediário com parcelas e recebimento
- Pedidos locais
- Comprovantes 80mm/A4 via impressão
- Relatórios CSV locais
- Backup manual do SQLite
- Restauração segura com confirmação dupla e backup antes de restaurar
- Configurações
- Auditoria/logs

## Onde fica o banco

O SQLite é criado pelo Tauri na pasta de dados do aplicativo do Windows. O caminho exato aparece no rodapé do sistema ao abrir.

## Regras importantes

- Não há dados falsos de demonstração.
- Configurações iniciais são criadas no SQLite.
- Vendas gravam venda, itens, caixa, estoque, recibo e auditoria em transação.
- Recebimento de parcela atualiza parcela, crediário, pagamento, caixa e auditoria em transação.
- Backup copia o SQLite e valida `PRAGMA integrity_check`.

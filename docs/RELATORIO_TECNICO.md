# Relatório Técnico - Base Inicial

## Arquitetura

- Desktop: Tauri v2
- Frontend: React + TypeScript + Vite
- Banco principal: SQLite local pelo Rust/Tauri
- Sem CDN, sem fonte online e sem chamada externa
- PWA shell básico com assets locais

## Persistência

Tabelas criadas:

- settings
- customers
- products
- sales
- sale_items
- cash_movements
- credits
- credit_installments
- payments
- orders
- order_items
- receipts
- stock_movements
- backups_log
- audit_log
- cash_closings

## Transações críticas

Implementadas:

- Venda: cria venda, itens, baixa estoque, caixa quando não é crediário, crediário quando aplicável, recibo e auditoria.
- Recebimento de parcela: atualiza parcela, crediário, pagamento, caixa e auditoria.
- Ajuste de estoque: altera estoque e registra movimento/auditoria.
- Pedido local: cria pedido e itens com request_id.

## Segurança de dados

- Sem IndexedDB como banco principal.
- Sem localStorage como banco de dados.
- Request ID para venda, pagamento e pedido.
- Histórico preservado via audit_log e stock_movements.
- Backup manual com integrity_check.

## Limitações da base inicial

- Restauração de backup com confirmação dupla ainda precisa ser implementada em lote seguinte.
- Impressão ESC/POS Epson TM-T20 nativa ainda não foi adicionada; existe impressão 80mm via HTML/print.
- Edição completa de registros ainda está inicial; cadastro e criação já existem.
- Fechamento de caixa agora possui tela própria para abertura, conferência e fechamento.
- Restauração de backup foi adicionada com confirmação dupla e backup de segurança antes de substituir o banco.
- Senha administrativa local ainda está preparada, mas não há fluxo visual completo de ativação/login.


## Mega Lote 02

- Adicionado módulo Caixa.
- Adicionado resumo de caixa diário.
- Adicionada abertura e fechamento de caixa com auditoria.
- Adicionada restauração segura de backup.
- Separado menu Vendas/PDV e Caixa.

# Mega Lote 146 — Auditoria de backup, fotos de produtos e histórico geral

## Objetivo
Verificar e reforçar como o Smart Loja Fácil protege dados gerais, fotos de produtos, backups e históricos no PWA web/mobile com Supabase.

## Resultado da auditoria

### Backup web/mobile
O backup web gera um arquivo JSON baixado no aparelho. Ele inclui dados comerciais da loja e registra evidência em `backups_log`.

Inclui no JSON:
- loja/configurações principais;
- clientes;
- produtos;
- vendas;
- itens de venda;
- caixa;
- crediário;
- pagamentos;
- pedidos;
- comprovantes;
- movimentações de estoque;
- auditoria exportada como consulta histórica;
- resumo das fotos de produtos.

### Fotos de produtos
As fotos usam o bucket Supabase Storage `product-photos`.

Regra:
- foto normal sobe para `product-photos` e o produto guarda o link/caminho em `products.image_url`;
- limite atual: 2 MB;
- formatos: PNG, JPG/JPEG e WEBP;
- se o Storage falhar, a foto pode ficar embutida no cadastro em modo compatibilidade.

Importante: o backup JSON salva o link/caminho das fotos. Ele não copia os arquivos físicos do bucket para dentro do JSON quando a foto está no Storage. Para migrar para outro projeto Supabase, também é necessário copiar o bucket `product-photos`.

### Histórico geral
O sistema registra histórico em:
- `sales` e `sale_items` para vendas;
- `cash_sessions` e `cash_movements` para caixa;
- `credits`, `credit_installments` e `payments` para crediário;
- `orders` e `order_items` para pedidos;
- `receipts` para comprovantes;
- `stock_movements` para estoque;
- `audit_log` para auditoria;
- `backups_log` para histórico de backup.

## Correções seguras aplicadas
- Criada migration para garantir `backups_log` com RLS.
- Criada migration para garantir bucket `product-photos`.
- Criadas policies de Storage para leitura e escrita por loja/papel.
- Backup web passou a incluir `product_photo_summary`.
- Histórico de backup em Supabase passou a receber metadados de fotos.
- Diagnóstico comercial passou a auditar bucket `product-photos` e resumo das fotos.
- Tela Backup passou a explicar melhor o que entra no backup e o que depende do bucket.

## Limitação honesta
Não foi validado contra Supabase produção nesta execução. Depois de aplicar a migration, testar:
1. criar produto com foto;
2. abrir em segundo aparelho;
3. criar backup;
4. conferir o JSON baixado;
5. restaurar em loja de teste;
6. confirmar se as fotos do Storage continuam acessíveis.

## Arquivos alterados/novos
- `docs/MEGA_LOTE_146_BACKUP_FOTOS_HISTORICO.md`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/release_check.js`
- `src/lib/productionChecklist.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/mobile-app/screens/BackupScreen.tsx`
- `src/pages/Backup.tsx`
- `supabase/migrations/202606040146_backup_storage_photos_history.sql`

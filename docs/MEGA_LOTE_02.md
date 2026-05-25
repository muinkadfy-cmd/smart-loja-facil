# Mega Lote 02 - Caixa, Backup Seguro e Polimento Comercial

## Objetivo

Este lote reforça a base offline para teste em modo dev no Tauri, sem adicionar dependência de internet e mantendo SQLite como banco principal.

## Entregas

- Módulo **Caixa** separado de Vendas/PDV.
- Abertura de caixa com valor inicial e observação.
- Fechamento de caixa com valor contado, diferença e auditoria.
- Resumo diário de entradas, saídas e saldo esperado.
- Lista de movimentos do caixa do dia.
- Restauração de backup com confirmação dupla.
- Backup automático de segurança antes de restaurar.
- Validação de integridade do backup antes de restaurar.
- Menu lateral ajustado: Vendas/PDV separado de Caixa.
- Documentação técnica atualizada.

## Regras preservadas

- Sem Supabase.
- Sem Cloudflare.
- Sem API externa.
- Sem IndexedDB/localStorage como banco principal.
- Sem CDN ou fonte online.
- Dados críticos em SQLite local.
- Ações críticas auditadas.
- Backup antes de operação perigosa.

## Como testar

```bash
npm install
npm run release:check
npm run type-check
npm run build
npm run tauri:dev
```

Depois, dentro do app:

1. Abra o sistema.
2. Acesse **Caixa**.
3. Abra o caixa com valor inicial.
4. Faça uma venda em dinheiro/pix/cartão.
5. Volte em **Caixa** e confira entradas.
6. Feche o caixa informando valor contado.
7. Crie backup.
8. Restaure um backup digitando `RESTAURAR`.
9. Feche e abra o app para confirmar persistência.

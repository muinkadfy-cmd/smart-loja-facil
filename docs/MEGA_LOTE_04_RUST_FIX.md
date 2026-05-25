# Mega Lote 04 — Correção Rust/Tauri E0597

## O que foi corrigido

Corrigidos os erros Rust `E0597` em consultas SQLite que usavam `stmt.query_map(...).collect(...)` diretamente como expressão final da função.

O padrão foi alterado para:

1. criar `rows` com `query_map`;
2. coletar em `result`;
3. retornar `Ok(result)`.

Isso força o temporário de `MappedRows` a ser finalizado antes de `stmt` e `connection` saírem do escopo.

## Arquivo editado

- `src-tauri/src/main.rs`

## Funções corrigidas

- `list_customers`
- `list_products_inner`
- `list_sales_inner`
- `list_orders`
- `list_receipts`
- `list_backups`
- `list_audit`

## Como aplicar

Extraia este ZIP por cima da pasta do projeto, preservando a estrutura original.

Depois rode:

```bash
npm run tauri:dev
```

Ou diretamente:

```bash
cd src-tauri
cargo check
```

## Testes executados neste ambiente

- Conferência textual das funções alteradas.
- Verificação de que o ZIP contém apenas arquivos editados/novos.

## Testes não executados aqui

- `cargo check`
- `cargo build`
- `npm run tauri:dev`
- `npm run tauri:build`

Motivo: este ambiente não possui Cargo/Rust instalado.

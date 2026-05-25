# MEGA LOTE 17 — Fix Rust payment_method

## Problema corrigido
O build Tauri falhava com `error[E0063]: missing field payment_method in initializer of CreditInstallment`.

## Correção aplicada
Adicionado `payment_method: None` no initializer usado internamente no fluxo `receive_installment_flex`, onde a lista de parcelas é usada para cálculo e redistribuição antes da leitura final do banco.

## Arquivos alterados
- src-tauri/src/main.rs

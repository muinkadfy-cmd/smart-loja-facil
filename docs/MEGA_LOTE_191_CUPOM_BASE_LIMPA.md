# Mega Lote 191 — Cupom Base Limpa

## Objetivo
Substituir o layout anterior do cupom pela nova arte limpa enviada pelo usuário, mantendo desconto, nome do cliente e código do cupom dentro da própria foto, com micro ajuste e PNG sem corte.

## Entregas
- Arte base substituída em `public/coupons/cupom-jaque-otica-base.png`.
- Desconto desenhado no espaço limpo central.
- Nome do cliente desenhado dentro do campo branco do cupom.
- Código do cupom desenhado dentro do campo branco inferior.
- Redução automática de fonte para nome e código longos.
- Descontos rápidos 10/20/30/50.
- Exportação PNG 1080×1350.
- Compartilhar PNG com fallback para download.
- Cache PWA atualizado para v191.

## Observação
Este lote não cria banco, migration, bucket ou policy. O cupom é gerado localmente no aparelho e não salva dados pessoais na nuvem.

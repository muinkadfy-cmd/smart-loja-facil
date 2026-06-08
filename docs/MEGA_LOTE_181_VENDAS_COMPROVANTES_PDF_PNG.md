# Mega Lote 181 — Vendas com valores polidos + comprovantes PDF/PNG sem texto extra

## Objetivo
Ajustar o fluxo de vendas e compartilhamento de comprovantes sem mexer em login, Supabase Auth, ENV, RLS ou estrutura de notificações externas.

## Entregas principais

- Aba Vendas/PDV mobile com campos de valores em modo texto decimal, aceitando vírgula ou ponto e normalizando automaticamente.
- Campo de desconto preservado para quando o lojista precisar aplicar desconto, com máscara de moeda mais amigável.
- Campo de valor pago preservado para dinheiro/cartão/Pix, com máscara de moeda mais amigável.
- Em crediário, o valor pago fica zerado automaticamente para evitar confusão.
- Compartilhamento de comprovante pelo celular agora tenta compartilhar o arquivo pronto, sem montar texto/link do WhatsApp.
- Opção de compartilhar/baixar comprovante em PDF.
- Opção de compartilhar/baixar comprovante em PNG.
- Atividades recentes no Dashboard receberam ações de comprovante no mesmo padrão da aba Comprovantes.
- Vendas recentes no PDV mobile receberam ações de comprovante no mesmo padrão.
- Vendas recentes no web/desktop receberam coluna de comprovante com PDF/PNG.
- Comprovantes agora têm botões separados para Enviar PDF e Enviar PNG.
- Se o navegador bloquear compartilhamento de arquivo, o sistema baixa o arquivo e orienta anexar manualmente.
- Texto genérico antigo do sistema é limpo dos comprovantes gerados para compartilhamento.
- Desconto, quando existir no comprovante, fica preservado no PDF/PNG.

## Arquivos principais alterados

- `src/mobile-app/components/receiptShare.ts`
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/screens/DashboardScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/pages/Sales.tsx`
- `src/styles.css`
- `src/types.ts`
- `src/lib/webApi.ts`
- `src-tauri/src/main.rs`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- scripts de release/QA

## Testes executados

Passaram:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run build
npm run lint
npm run release:check
npm audit --audit-level=high
node scripts/credit_payment_guard_tests.js
npm run qa:push
npm run qa:commercial
npm run qa:load
npm run release:commercial:check
npm run release:commercial:prepare
```

Resultado: 0 vulnerabilidades high.

## Observações honestas

- O build Vite ainda mostra aviso de chunk acima de 500 KB. Não quebrou o app, mas continua sendo ponto de otimização futura para celular fraco.
- `cargo check` não foi executado porque o container não tem `cargo` instalado. O arquivo Rust foi ajustado com cuidado para incluir subtotal/desconto em recibos Tauri, mas a validação Rust real precisa ser feita em máquina com Rust/Tauri instalado.
- O compartilhamento automático de arquivo depende do suporte do navegador/celular ao Web Share API com arquivos. Quando o celular bloqueia, o fallback baixa PDF/PNG para anexar manualmente.

## Próximo lote ideal

Otimizar chunk grande do PWA com code-splitting e validar compartilhamento PDF/PNG em aparelho Android e iPhone reais.

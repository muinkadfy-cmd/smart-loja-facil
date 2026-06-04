# Mega Lote 166 — PDF real, visualizar mobile e logo premium

## Objetivo
Corrigir a falha dos botões de visualização no iPhone/Android, fazer o extrato/comprovante sair como arquivo PDF real e aplicar a logo premium enviada nos layouts de extrato, comprovante, venda e ícones do app/PWA/taskbar.

## Correções principais

### Comprovantes
- Botão **Visualizar** agora abre a prévia em nova tela usando arquivo HTML em Blob URL, evitando a falha de `document.write`/popup que afetava alguns navegadores mobile.
- Botão **Baixar PDF** gera um arquivo `.pdf` real no navegador, com a logo premium no topo e o conteúdo textual do extrato/comprovante.
- Botões de nota, parcela e comprovante salvo agora selecionam, rolam para a prévia e tentam abrir a visualização limpa imediatamente.
- Cards e botões receberam micro polimento visual para deixar Visualizar/PDF/Enviar mais claros.

### Crediário
- Botão da nota mudou para **Visualizar extrato / PDF**.
- Ao tocar, o app grava foco da nota, abre Comprovantes, expande cliente/nota, seleciona o extrato e rola para a prévia.
- Feedback leigo informa que o extrato abriu na aba Comprovantes e que é possível Visualizar, Baixar PDF e Enviar.

### Logo e identidade
- Logo premium enviada aplicada como fallback oficial dos comprovantes.
- Layouts de extrato de nota, comprovante de parcela e comprovante de venda/reimpressão usam a logo no cabeçalho do documento.
- Ícones PWA atualizados em 192/512/maskable.
- Ícones Tauri/taskbar/Windows atualizados, incluindo `.ico` multi-resolução.

### Cache e versão
- Versão atualizada para `0.1.166`.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v166-pdf-real-logo-mobile`.
- Manifest atualizado para `Smart Loja Fácil PWA v166`.

## Arquivos alterados/novos
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- `index.html`
- `package.json`
- `package-lock.json`
- `public/brand/jaque-logo-premium.png`
- `public/brand/smart-loja-icon.png`
- `public/icons/*`
- `src-tauri/icons/*`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Testes executados
- `npm run type-check` — OK
- `npm run build` — OK, com aviso conhecido de chunk acima de 500 KB
- `npm run lint` — OK
- `npm run release:check` — OK
- `npm audit --audit-level=high` — OK, 0 vulnerabilidades high
- `node scripts/credit_payment_guard_tests.js` — OK
- `npm run release:commercial:check` — OK, com aviso esperado de `.env.production` local ignorado
- `npm run release:commercial:prepare` — OK

## Observações honestas
- O PDF gerado no navegador é um arquivo `.pdf` real, com logo premium e resumo textual. A visualização HTML continua sendo a versão mais bonita para print/compartilhamento visual com layout completo.
- O build ainda mostra aviso de chunk maior que 500 KB. Não quebra o app, mas fica como melhoria futura para desempenho em celular fraco.
- A ENV `.env.production` não entra no ZIP/commit; deve continuar configurada no Cloudflare Production.

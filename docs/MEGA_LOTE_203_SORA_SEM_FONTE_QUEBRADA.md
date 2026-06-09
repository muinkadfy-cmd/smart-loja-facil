# Mega Lote 203 — Sora Sem Fonte Quebrada

## Diagnóstico
O console mostrava:

- `Failed to decode downloaded font`
- `OTS parsing error: invalid sfntVersion: 1008821359`

Esse código indica que o navegador recebeu conteúdo inválido no lugar do `.ttf`.
Na prática, o caminho `/fonts/Sora-*.ttf` estava retornando HTML/fallback do app ou arquivo corrompido, então o Chrome tentava decodificar HTML como fonte.

## Correção
- Removidos os `@font-face` locais quebrados que apontavam para `/fonts/Sora-*.ttf`.
- Adicionado carregamento seguro da Sora via Google Fonts no CSS.
- Comprovantes agora aguardam o carregamento da Sora antes de desenhar o canvas.
- Se a rede bloquear a fonte, o sistema mantém fallback seguro sem quebrar o app.
- Não foram incluídos arquivos `.ttf` no ZIP.

## Arquivos
- `src/styles.css`
- `src/mobile-app/styles/mobile-app.css`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`

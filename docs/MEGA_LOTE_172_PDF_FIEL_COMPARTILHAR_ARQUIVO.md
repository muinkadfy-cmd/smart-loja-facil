# Mega Lote 172 — PDF fiel preto/branco + compartilhar arquivo pronto

## Objetivo
Corrigir o PDF que estava abrindo com layout desalinhado/sobreposto e melhorar o botão Enviar/Compartilhar para tentar compartilhar o arquivo PDF pronto, não apenas texto.

## Correções principais
- Refeito o cabeçalho do PDF manual para evitar sobreposição entre nome da loja e título.
- Logo do PDF trocada para versão larga, mais próxima do recibo de referência.
- Layout do PDF ficou mais parecido com a tela interna: logo à esquerda, título à direita, dados do cliente, tabela, cartões de resumo e anotações.
- O botão PDF continua gerando arquivo `.pdf` real, sem HTML/CSS dentro.
- O botão Enviar agora gera o PDF e usa Web Share API com `File` quando o navegador permitir.
- Se Android/iPhone/Chrome bloquear anexo automático, o sistema baixa o PDF e abre WhatsApp com orientação simples para anexar o arquivo baixado.
- Nome do arquivo mantém data/hora para reduzir aviso de download repetido.

## Limite honesto
Não existe forma confiável via link `wa.me` de anexar arquivo PDF automaticamente em todos os navegadores. O caminho certo é:
1. usar compartilhamento nativo com arquivo quando `navigator.share` + `canShare(files)` permitir;
2. se o navegador bloquear, baixar o PDF e orientar o usuário a anexar manualmente.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `docs/MEGA_LOTE_172_PDF_FIEL_COMPARTILHAR_ARQUIVO.md`

## Testes executados
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`

## Observação
O build passou, mas o Vite ainda avisou sobre chunk acima de 500 KB. Não quebra o app, mas segue como otimização futura.

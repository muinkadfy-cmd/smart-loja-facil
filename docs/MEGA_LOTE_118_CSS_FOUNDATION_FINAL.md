# Lote 118 — Limpeza Física Controlada + CSS Foundation 10/10

## Objetivo
Reduzir a herança antiga, parar a briga entre CSS acumulados e consolidar uma fundação única para layout PWA web/mobile premium.

## Feito
- `main.tsx` carrega somente `styles.css` e `lote118-foundation-final.css`.
- `master-ui.css` foi desativado do carregamento principal.
- CSS antigos `lote77` a `lote117` continuam fora do carregamento.
- Criada fundação final `src/styles/lote118-foundation-final.css`.
- `styles.css` foi reduzido para reset/base essencial.
- Criado script `npm run css:clean-legacy` para remoção física controlada dos CSS antigos.
- `.gitignore` já protege `.env`, `.env.production`, bancos e `dist`.
- Versão/cache atualizados para v118.

## Testes obrigatórios
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `npm run release:commercial:check`
- `node --check scripts/release_check.js`
- validação JSON do manifest

## Risco restante
A limpeza física dos arquivos antigos depende de rodar `npm run css:clean-legacy` depois de aplicar o ZIP. O ZIP não apaga arquivos antigos sozinho ao ser expandido.

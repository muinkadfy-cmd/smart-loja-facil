# Mega Lote 163 — Comprovantes mobile 10/10, status colorido e A4/PDF sem corte lateral

## Objetivo
Corrigir a aba **Comprovantes** após validação por prints reais no Android/iPhone/Chrome mobile: havia corte lateral, busca com aparência de input cru, cards de cliente com borda de botão padrão, prévia A4 larga demais no celular e cabeçalho do comprovante quebrando o nome da loja.

## Correções aplicadas
- Aba Comprovantes ficou **mobile-first real**, com `overflow-x` protegido para evitar corte lateral.
- Campo de busca recebeu acabamento premium, largura segura e fonte 16px para evitar zoom/estrangulamento no mobile.
- Filtros em chips agora rolam horizontalmente sem empurrar a tela inteira.
- Card do cliente deixou de parecer botão cru do navegador.
- Cliente, nota e parcelas receberam hierarquia mais clara, com totais e alertas por cor.
- Status da nota agora aparece como:
  - **Paga** em verde;
  - **Parcial** em laranja;
  - **Aberta** em azul;
  - **Atrasada** em vermelho.
- Parcelas atrasadas/parciais/pagas receberam destaque visual no card e no comprovante.
- Prévia dentro da aba ganhou iframe maior, sem padding interno quebrando o conteúdo.
- Botões Visualizar, A4/PDF, Enviar e Fechar ficaram mais compactos e seguros no mobile.

## Layout do comprovante
- O comprovante deixou de quebrar o nome da loja em várias linhas estreitas.
- O cabeçalho do comprovante foi reorganizado para não disputar espaço com o selo de status.
- Tabelas de parcelas viram cards no celular, evitando scroll lateral.
- A4/PDF agora extrai o corpo do HTML antes de montar a página de impressão, evitando HTML completo dentro de outro HTML.
- Toolbar de impressão/preview ficou responsiva no celular.
- A tela limpa de Visualizar/print agora abre o comprovante diretamente, sem wrapper extra que causava largura errada.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Versão/cache PWA
- App: `pwa-supabase-v163-comprovantes-mobile-10-status`
- Cache: `smart-loja-pwa-supabase-v163-comprovantes-mobile-10-status`
- Classe HTML: `smart-mobile-rebuild-v163`

## Testes executados
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run release:commercial:prepare`

## Resultado dos testes
- TypeScript: OK.
- Build Vite: OK.
- Lint local: OK.
- Release check: OK.
- Commercial check: OK, com avisos esperados de `.env.production` e logs locais protegidos.
- Audit high: 0 vulnerabilidades.
- Testes do crediário: OK.

## Observação honesta
O build ainda mostra aviso de chunk acima de 500 KB. Não quebra a entrega, mas o próximo lote ideal deve dividir módulos grandes para melhorar carregamento em celulares fracos.

## Próxima validação manual recomendada
No celular real, abrir **Mais > Comprovantes**, testar:
1. busca por cliente;
2. filtro Crediário e Parcelas;
3. expandir cliente;
4. expandir nota;
5. visualizar nota inteira;
6. visualizar parcela individual;
7. testar status pago/parcial/aberto/atrasado;
8. abrir A4/PDF e conferir se não tem corte lateral.

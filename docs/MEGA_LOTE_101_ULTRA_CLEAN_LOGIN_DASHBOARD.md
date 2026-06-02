# Mega Lote 101 — Ultra Clean Login + Dashboard Respirado

## Objetivo
Reduzir poluição visual, deixar login com foco real em e-mail/senha, ampliar área útil do dashboard e manter o projeto como PWA web/mobile com Supabase e Cloudflare.

## Alterações principais
- Versão lógica atualizada para `pwa-supabase-v101`.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v101-ultra-clean`.
- Fila web atualizada para `smart-loja:web-outbox-v101`, preservando filas antigas v100/v99/v98 como legado.
- Nova camada visual `src/styles/lote101-ultra-clean.css`.
- Login simplificado com menos textos, sem blocos longos e sem informação técnica no modo compacto.
- Dashboard com sidebar mais estreita, topbar mais leve, chips reduzidos e cards com mais área útil.
- PDV e páginas internas receberam ajustes de densidade para menos corte e melhor leitura.
- Release check mantido PWA-only, sem exigir Tauri.

## Riscos evitados
- Não alterei regras de dados, vendas, clientes, produtos, caixa, crediário ou permissões.
- Não mexi em migrations nem em políticas Supabase.
- Não incluí `dist`, `node_modules`, `.env`, bancos SQLite ou arquivos sensíveis no ZIP final.

## Testes executados
- `npm run type-check` — passou.
- `npm run lint` — passou.
- `npm run build` — passou.
- `npm run release:check` — passou com avisos não bloqueantes de legado local.
- `node --check scripts/release_check.js` — passou.
- Validação JSON do `public/manifest.webmanifest` via Node — passou.
- `npm run release:commercial:check` — falhou corretamente porque a base local contém `.env.production` e bancos SQLite de teste fora do ZIP.

## Validação visual necessária
Após aplicar e fazer deploy, conferir no PC e celular:
1. Login deve parecer simples: logo, e-mail, senha e entrar.
2. Dashboard deve parecer menos apertado, com sidebar menor e menos chips.
3. Cards devem preservar valores em uma linha sempre que possível.
4. Menu ativo deve ter leitura clara.
5. PDV deve continuar funcionando e com menos corte lateral.

## Próximo lote sugerido
Lote 102 — Aplicar o mesmo padrão ultra clean em Produtos, Clientes, Caixa, Crediário e Relatórios, tela por tela.

# Mega Lote 54 — Backup Web, Comprovantes Premium e Correção Supabase

## Objetivo

Fechar um gargalo crítico do PWA web/mobile: a aba Backup ainda dependia do ambiente desktop/Tauri e o fluxo de comprovante web precisava de uma prévia mais comercial. Também foram corrigidos problemas de migração SQL que poderiam travar uma base Supabase limpa.

## Entregas principais

- Aba **Backup** liberada no modo web/mobile.
- Exportação de backup JSON da loja na nuvem.
- Histórico local dos backups baixados no navegador.
- Importação protegida de backup JSON com confirmação dupla.
- Antes de importar backup web, o app gera uma nova cópia do estado atual.
- Importação web em modo seguro/mesclado: atualiza ou repõe registros compatíveis sem apagar a loja inteira.
- Prévia de comprovante web com barra de impressão premium e fallback para download HTML.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v54`.
- Versão web atualizada para `pwa-supabase-v54`.
- Correção na migration base: remoção de coluna duplicada `total` em `receipts`.
- Correção na migration do lote 53: remoção de `set subtotal` duplicado na RPC `web_create_sale`.

## Arquivos alterados

- `public/sw.js`
- `src/App.tsx`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/pages/Backup.tsx`
- `src/styles.css`
- `supabase/migrations/202605250001_base_limpa_smart_loja.sql`
- `supabase/migrations/202605270053_web_sales_cash_credits_rpc.sql`

## Arquivo novo

- `docs/MEGA_LOTE_54_BACKUP_WEB_COMPROVANTES_SUPABASE_FIX.md`

## Observações de segurança

A restauração web não faz limpeza destrutiva do banco. Ela é propositalmente uma importação de recuperação/mesclagem, para evitar perda acidental de vendas, caixa, crediário e comprovantes. Para uma restauração 100% destrutiva, o ideal é criar uma RPC administrativa própria, com logs e bloqueio por papel owner/admin.

## Testes executados

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- validação JSON de `package.json`
- validação JSON de `public/manifest.webmanifest`
- validação JSON de `src-tauri/tauri.conf.json`

## Resultado

Todos os testes acima passaram.

## Riscos restantes

- A importação web foi validada por TypeScript/build, mas não foi executada contra um projeto Supabase real nesta sessão.
- Se as migrations antigas já tiverem sido aplicadas no Supabase remoto, editar migration antiga pode exigir alinhamento manual do histórico. Se ainda não foram aplicadas, o caminho corrigido é aplicar normalmente com `npx supabase db push`.
- Backup web destrutivo completo ainda não foi implementado por segurança.

## Próximo lote recomendado

- Comprovante 80mm/58mm/A4 web com HTML completo por item, logo da loja, dados do cliente e termos.
- RPC administrativa para restore web destrutivo opcional apenas para owner, com auditoria forte.
- E2E de fluxo: criar cliente, produto, venda, comprovante, backup JSON, importação e relatório.

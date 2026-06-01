# Mega Lote 94 — Limpeza técnica comercial

## Objetivo
Reduzir risco técnico antes de venda: auditoria CSS real, release_check limpo, README atualizado e verificação de pacote comercial.

## Entregas
- `scripts/css_audit.js` agora mede automaticamente `src/styles.css`, `src/master-ui.css` e todos os módulos `src/styles/*.css`.
- `scripts/release_check.js` foi refeito para usar lista dinâmica de CSS e remover duplicidades históricas.
- `scripts/commercial_package_check.js` verifica SQLite, `.env` real e arquivos grandes antes de pacote comercial.
- `README.md` atualizado para a realidade atual: PWA, Supabase, Cloudflare, Tauri, SQLite e Storage.
- Versão PWA/cache/outbox atualizada para v94.
- Checklist comercial recebeu item de release técnico v94.

## Comandos

```bash
npm ci
npm run type-check
npm run lint
npm run build
npm run release:check
node scripts/css_audit.js
node scripts/commercial_package_check.js
node scripts/commercial_package_check.js --strict
npm audit --audit-level=moderate
```

## Observação
`commercial_package_check.js --strict` pode falhar no workspace de desenvolvimento se existirem `.sqlite3` de teste. Isso é esperado: o modo strict serve para impedir pacote final sujo para cliente.

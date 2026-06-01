# Correção lint/release — ignorar arquivos gerados

## Problema corrigido

Os comandos `npm run release:check` e `npm run lint` estavam varrendo pastas geradas por build/check do Rust e .NET, principalmente:

- `src-tauri/.cargo-check/`
- `src-tauri/target/`
- `tools/QaWorkflow/bin/`
- `tools/QaWorkflow/obj/`
- `dist/`
- `node_modules/`

Isso gerava falso erro como URL externa, debugger, TODO/FIXME e console em arquivos compilados, `.pdb`, `.rmeta`, `.rlib`, DLLs e arquivos gerados automaticamente.

## Arquivos alterados

- `scripts/release_check.js`
- `scripts/lint.js`

## O que mudou

- `release_check` agora ignora pastas geradas.
- `lint` agora ignora pastas geradas.
- `lint` agora lê apenas extensões de texto/código conhecidas, evitando varrer binários.

## Comandos recomendados depois de aplicar

```powershell
cd "C:\smart-loja-facil"
Remove-Item -Recurse -Force "src-tauri\.cargo-check" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "src-tauri\target" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "tools\QaWorkflow\bin" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "tools\QaWorkflow\obj" -ErrorAction SilentlyContinue

npm run release:check
npm run type-check
npm run lint
npm run build
```

Se passar:

```powershell
git add scripts/release_check.js scripts/lint.js docs/CORRECAO_LINT_RELEASE_IGNORAR_BUILD_GERADO.md
git commit -m "corrige lint e release check ignorando builds gerados"
git push origin main
npx wrangler deploy
```

# Mega Lote 97 — Hotfix Build 2

Correção de compatibilidade para projetos clonados do GitHub que ainda estavam antes dos lotes de diagnóstico e fotos de produtos.

## Corrigido

- Inclui as dependências de diagnóstico que faltavam no clone local.
- Inclui `productPhotoStorage.ts`, exigido por `webApi.ts`.
- Atualiza `Shell.tsx` para usar os nomes atuais de sincronização: `readWebSyncSnapshot` e `getWebOutboxStats`.
- Mantém o build apontado para PWA/Supabase v97.

## Como aplicar

Extraia este ZIP por cima do projeto em `C:\smart-loja-facil-git` e rode:

```powershell
npm run build
```

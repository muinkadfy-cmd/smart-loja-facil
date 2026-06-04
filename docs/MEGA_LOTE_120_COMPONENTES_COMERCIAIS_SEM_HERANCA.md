# Lote 120 — Restaurar Componentes Comerciais Sem Herança Antiga

## Objetivo
Restaurar a aparência comercial dos componentes que ficaram crus após a desativação da herança CSS antiga, sem reativar os lotes antigos `lote77` até `lote116`.

## Problemas corrigidos
- Blocos do Dashboard sem estilo em "Ambiente e conexões".
- Cards internos sem grade, borda, sombra ou espaçamento comercial.
- Tags `Ativa`, `Dono`, `Web` aparecendo como marcações cruas.
- Atalhos rápidos sem padrão visual forte.
- Status do sistema sem cards compactos e legíveis.
- Faixa de segurança/performance e estados vazios sem acabamento consistente.

## Arquivos alterados
- `src/main.tsx`
- `src/lib/webApi.ts`
- `src/styles/lote120-commercial-components.css`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `README.md`
- `package.json`

## Segurança
- Não reimporta CSS antigo.
- Não altera Supabase, dados, vendas, clientes, produtos, caixa, crediário ou permissões.
- Mantém o projeto como PWA web/mobile.

## Versionamento
- App: `pwa-supabase-v120-commercial-components`
- Cache: `smart-loja-pwa-supabase-v120-commercial-components`

## Próximo lote ideal
Depois de validar prints reais, o próximo lote ideal é lapidação tela a tela com a nova foundation: PDV, Clientes, Produtos, Caixa, Crediário, Relatórios, Backup e Configurações.

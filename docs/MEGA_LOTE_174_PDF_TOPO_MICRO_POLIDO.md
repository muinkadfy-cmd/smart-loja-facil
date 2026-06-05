# Mega Lote 174 — PDF topo micro polido

## Objetivo

Corrigir o topo do PDF do recibo/extrato/comprovante, mantendo o padrão preto/branco já aprovado e sem voltar para HTML/CSS dentro do arquivo.

## Ajustes aplicados

- Mantido PDF manual real, sem HTML/CSS grudado.
- Micro ajuste no cabeçalho do PDF para evitar sobreposição entre logo, título, número da nota, status e carimbo.
- Logo reduzida e reposicionada com mais respiro.
- Nome da loja centralizado abaixo da logo em tamanho menor.
- Título do documento reposicionado e com largura controlada.
- Linha divisória do título ajustada.
- Número da nota e status foram separados do carimbo.
- Carimbo PAGO reposicionado para não encostar no título/status.
- Badge de status Parcial/Pendente/Atrasado reposicionado para não cobrir texto.
- Caixa de dados do cliente desceu levemente para criar respiro no topo.
- Versão/cache atualizados para v174.

## Escopo preservado

Este lote não altera login, Supabase, ENV, senha, RLS ou autenticação.

## Testes executados

- npm ci --ignore-scripts --no-audit --no-fund
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm audit --audit-level=high
- node scripts/credit_payment_guard_tests.js
- npm run release:commercial:check
- npm run release:commercial:prepare

Resultado: todos passaram, com 0 vulnerabilidades high. O Vite manteve o aviso de chunk acima de 500 KB, sem quebrar o build.

# Mega Lote 137 — Pós-venda / Suporte e SLA do Primeiro Cliente

## COMANDO MESTRE 10/10

Status: aplicado.

- Prioridade: P2/P1 comercial com proteção de operação real.
- Mobile-first: sim.
- Supabase/sincronização/permissões: preservados.
- PWA/cache/versionamento: atualizado para v137.
- ZIP final: somente arquivos editados/novos.
- Testes: type-check, build, lint, release:check, release:commercial:check, release:commercial:prepare e npm audit.
- Limitação real: ainda precisa validar em dois aparelhos físicos, Supabase produção, papéis owner/admin/operator/viewer, impressão real e primeiro cliente acompanhado.

## Objetivo

Depois de proposta, termo e aceite, o sistema precisava controlar o pós-venda do primeiro cliente para não perder chamados, prazos, responsáveis e evidências.

Este lote cria uma central simples dentro do Diagnóstico Web para registrar suporte/SLA sem mexer em venda, caixa, estoque, crediário, backup real ou Supabase.

## O que foi criado

### Pós-venda / suporte e SLA

Nova seção no Diagnóstico Web com:

- cliente/loja;
- responsável pelo suporte;
- canal combinado;
- revisão do primeiro dia;
- regra de SLA;
- checklist de pós-venda;
- chamados P0/P1/P2;
- status do chamado;
- prazo;
- responsável;
- evidência;
- observações;
- relatório copiável.

### Chamados com prioridade

Prioridades usadas:

- P0: crítico, parar operação afetada até corrigir;
- P1: alto, corrigir antes de deixar cliente operar sozinho;
- P2: ajuste, acabamento ou melhoria sem bloquear operação.

Status usados:

- Aberto;
- Em atendimento;
- Aguardando cliente;
- Resolvido.

## Segurança

A central de pós-venda:

- não grava venda;
- não abre ou fecha caixa;
- não altera estoque;
- não altera cliente/produto;
- não recebe crediário;
- não altera pedido;
- não restaura backup;
- não altera Supabase;
- não copia senha;
- não copia chave privada.

Tudo fica salvo localmente no aparelho como checklist/evidência comercial.

## Diagnóstico comercial

O teste comercial agora também verifica a área:

- Pós-venda / suporte e SLA do primeiro cliente.

Se existir chamado P0/P1 aberto, o Diagnóstico mostra alerta vermelho e orienta não considerar o cliente estável.

## PWA/cache

Versões atualizadas:

- App: `pwa-supabase-v137-pos-venda-suporte`
- Cache: `smart-loja-pwa-supabase-v137-pos-venda-suporte`

## Arquivos alterados

- `docs/MEGA_LOTE_137_POST_VENDA_SUPORTE_SLA.md`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/release_check.js`
- `src/lib/productionChecklist.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`

## Testes executados

Todos passaram:

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
npm run release:commercial:check
npm run release:commercial:prepare
npm audit --audit-level=high
```

Resultado:

- TypeScript OK;
- Build OK;
- Lint OK;
- Release check v137 OK;
- Pacote comercial limpo OK;
- npm audit com 0 vulnerabilidades.

## Limitações reais

Ainda falta validar:

- 2 aparelhos físicos;
- Supabase produção;
- papéis owner/admin/operator/viewer;
- impressão real;
- PWA instalado após deploy;
- primeiro cliente acompanhado.

## Próximo lote ideal

Mega Lote 138 — Central de Feedback do Cliente / NPS e Melhorias Prioritárias.

Objetivo: após suporte/SLA, coletar satisfação do cliente, dores, pedidos de melhoria, nota de atendimento e prioridade comercial para o próximo ciclo.

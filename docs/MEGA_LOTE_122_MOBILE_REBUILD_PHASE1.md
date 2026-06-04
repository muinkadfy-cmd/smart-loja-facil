# Mega Lote 122 — Nova Interface Mobile-First Limpa do Zero + Supabase Preservado — Fase 1

## Objetivo
Criar uma interface nova e isolada para o PWA, sem herdar o Shell visual antigo nem os CSS de lotes anteriores, preservando login, sessão, Supabase e sincronização existente.

## O que foi criado
Nova estrutura isolada:

- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/mobileAppRoutes.ts`
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/layout/MobileHeader.tsx`
- `src/mobile-app/layout/MobileBottomNav.tsx`
- `src/mobile-app/components/*`
- `src/mobile-app/screens/*`
- `src/mobile-app/styles/mobile-app.css`

## Telas novas existentes
- Dashboard
- Vendas / PDV
- Produtos
- Clientes
- Pedidos
- Caixa
- Crediário
- Relatórios
- Comprovantes
- Backup
- Configurações
- Logs / Diagnóstico
- Diagnóstico Web

## Botões que já navegam
No Dashboard novo:
- Nova venda → Vendas / PDV
- Novo pedido → Pedidos
- Novo produto → Produtos
- Novo cliente → Clientes
- Abrir caixa → Caixa
- Relatórios → Relatórios
- Backup → Backup
- Logs → Logs / Diagnóstico
- Alerta de estoque baixo → Produtos
- Alerta de nenhuma venda → Vendas / PDV

## Dados reaproveitados do Supabase
A nova interface reutiliza a camada existente `api.ts`/`webApi.ts` para:
- status do app
- dashboard
- vendas
- produtos
- clientes
- pedidos
- caixa
- crediário
- comprovantes
- backup
- logs
- diagnóstico/cache

## O que ficou como placeholder premium
As telas de Relatórios, Configurações e Diagnóstico Web foram criadas com layout novo e ações básicas. A função completa deve ser migrada nas próximas fases sem trazer CSS antigo.

## Regras preservadas
- Não reativar CSS antigo
- Não importar lote77 até lote121
- Não usar Shell antigo como base visual
- Não mexer em Supabase/tabelas/RLS
- Não alterar regras financeiras
- Não incluir `.env.production` no ZIP

## Testes executados
- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `npm run release:commercial:check`
- `node --check scripts/release_check.js`
- validação JSON de `public/manifest.webmanifest`

## Riscos restantes
- Fase 1 cria a base nova. Algumas funções completas ainda estão em placeholder premium.
- Próximas fases devem migrar função por função para a nova interface.
- O login antigo foi preservado, mas a tela após login agora usa o app novo.

## Próximo lote ideal
Lote 123 — Migrar Produtos + Clientes para a nova interface limpa, com cadastro/edição real e listas mobile premium.

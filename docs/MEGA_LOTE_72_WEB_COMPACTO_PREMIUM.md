# Mega Lote 72 — Web compacto premium, topo profissional e ícones com contraste

## Objetivo

Reduzir a sensação de tela crua no web, aumentar a densidade útil em 1366x768, corrigir quebra visual do card de login pendente e reforçar a iconografia com mais contraste, mantendo mobile-first e sem alterar regras financeiras ou dados.

## Auditoria resumida

Problemas observados antes do lote:

- Topo web ocupava altura demais e empurrava o dashboard para baixo.
- Texto `Aguardando login` podia quebrar de forma ruim em larguras menores.
- Ícones SVG estavam modernos, mas ainda muito claros/pastel para uso comercial.
- Menu lateral e conteúdo tinham boa base, porém faltava grid mais firme e aparência de produto fechado.
- Cards principais tinham pouco destaque hierárquico no web.
- Rodapé da lateral ficava visualmente apertado em telas baixas.

## Alterações aplicadas

### Web/desktop

- Compactação forte do topo em desktop.
- Layout web com sidebar fixa e área principal com rolagem própria.
- Grid do topo reorganizado para busca, login e ações ficarem mais próximos e profissionais.
- Linha de status compacta abaixo dos atalhos.
- Dashboard começa mais cedo na tela, reduzindo rolagem inicial.
- Cards KPI mais compactos, com destaque melhor para Vendas hoje.
- Ambiente/conexões, atalhos e gráfico com bordas, sombra e contraste mais comerciais.
- Trust strip ocultada no desktop para reduzir poluição e melhorar uso de espaço.

### Mobile

- Preservado mobile-first com bottom dock.
- Busca continua oculta no mobile para reduzir poluição.
- Topbar mobile recebeu ajustes de contraste e fundo claro.
- Login mobile ficou mais limpo, sem card pesado simulando desktop.

### Login

- Texto do card superior alterado de `Aguardando login` para `Login pendente`.
- Detalhe reduzido para `Entre para sincronizar`, evitando quebra feia.
- Login mantém aviso humano quando Supabase não está configurado.

### Ícones

- Cores dos ícones ficaram mais fortes e comerciais.
- Stroke dos SVGs ganhou mais peso.
- Ícones principais agora têm contraste maior em menu, atalhos, cards e status.
- Mantido SVG interno, sem depender de PNG ruim ou pixelado.

### PWA/cache

- Versão atualizada para `pwa-supabase-v72`.
- Cache atualizado para `smart-loja-pwa-supabase-v72-web-compacto-premium`.

## Arquivos alterados

- `src/components/AppIcon.tsx`
- `src/components/Shell.tsx`
- `src/styles.css`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `docs/MEGA_LOTE_72_WEB_COMPACTO_PREMIUM.md`

## Testes executados

- `npm run type-check` — passou
- `npm run lint` — passou
- `npm run release:check` — passou
- `npm run build` — passou
- `npm audit --audit-level=low` — passou, 0 vulnerabilidades
- `node --check public/sw.js` — passou
- `package.json` — JSON válido
- `public/manifest.webmanifest` — JSON válido
- Preview local em `127.0.0.1:4174` respondeu HTTP 200

## Limitações reais

- Supabase real não foi testado porque o pacote analisado não contém `.env` com `VITE_SUPABASE_URL` e chave pública.
- RLS/policies reais e sincronização entre dois aparelhos continuam pendentes de validação com credenciais reais.
- Este lote foi focado em interface web/mobile, ícones, densidade, login visual e cache.

## Nota estimada após o lote

- Web visual: 8.4/10
- Mobile visual: 8.9/10
- Login visual: 9.1/10
- Iconografia: 9.2/10
- Prontidão visual comercial: 8.5/10
- Supabase real: 6.6/10 enquanto URL/key/RLS não forem testados
- Prontidão comercial geral: 8.1/10

## Próximo lote recomendado

Lote 73: Supabase real e sincronização por módulo:

- configurar `.env` seguro;
- testar login real;
- testar criação de loja inicial;
- validar produtos/clientes/vendas em web e celular;
- revisar RLS/policies;
- criar checklist por módulo com status: local, pendente, sincronizando, sincronizado ou erro.

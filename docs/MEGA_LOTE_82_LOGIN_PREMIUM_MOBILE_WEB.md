# Mega Lote 82 — Login Premium Mobile/Web

## Objetivo
Corrigir a tela inicial/login com foco mobile-first e aparência comercial premium, a partir dos prints enviados: card alto demais, rolagem desnecessária, título cortando quando a página é rolada, botão secundário com aparência de link simples, hierarquia visual fraca e mensagem técnica de Supabase exposta para usuário leigo.

## Alterações principais
- Criado `src/styles/lote82-login-premium.css` com uma camada final e isolada para o login.
- Adicionada classe `master-login-v82` no layout de entrada.
- Atualizado texto de status de `Supabase não configurado` para `Nuvem não configurada`, mantendo detalhes técnicos apenas na mensagem de configuração.
- Botão `Abrir painel sem sincronizar` alterado para `Continuar sem nuvem`, com aparência de botão secundário premium.
- Nota final reescrita em linguagem simples sobre senha, dados locais e sincronização.
- Desktop agora usa altura controlada para evitar rolagem ruim e corte de título.
- Mobile mantém rolagem segura, safe-area e card com toque confortável.
- Checklist comercial ganhou item específico para validar login em desktop/notebook baixo/celular.
- Diagnóstico CSS reconhece o token `--lote82-login-premium`.
- PWA/cache/fila atualizados para v82.

## Versão/cache
- `WEB_APP_VERSION = pwa-supabase-v82`
- `WEB_CACHE_VERSION = smart-loja-pwa-supabase-v82-login-premium-mobile-web`
- `WEB_OUTBOX_KEY = smart-loja:web-outbox-v82`

## Arquivos alterados
- `src/pages/Welcome.tsx`
- `src/components/WebAuthPanel.tsx`
- `src/styles/lote82-login-premium.css`
- `src/main.tsx`
- `src/lib/webApi.ts`
- `src/lib/cssInventoryReadiness.ts`
- `src/lib/productionChecklist.ts`
- `public/sw.js`
- `scripts/css_audit.js`
- `scripts/release_check.js`

## Testes executados
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check scripts/release_check.js`
- `node scripts/css_audit.js`
- `node scripts/css_shell_sidebar_audit.js`
- `node scripts/css_important_audit.js`
- `npm audit --audit-level=moderate`

## Resultado
- TypeScript passou.
- Lint passou.
- Build passou.
- Release check passou.
- Service worker passou.
- Audit npm: 0 vulnerabilidades.

## Limitações
- `cargo check` não foi executado neste ambiente porque Rust/Cargo não está disponível.
- Teste visual real em navegador/Tauri/celular precisa ser confirmado no seu ambiente.
- O CSS global legado ainda está grande e com muitos `!important`; este lote adiciona uma camada final para corrigir o login sem mexer agressivamente nas telas já prontas.

## Validação visual recomendada
1. Abrir `localhost:1420` em notebook/desktop com altura baixa.
2. Confirmar que logo, título, campos, botão Entrar pela nuvem, aviso da nuvem, botão Continuar sem nuvem e nota final aparecem sem corte.
3. Testar sem Supabase configurado.
4. Testar com Supabase configurado.
5. Testar em celular pequeno.
6. Confirmar que não existe corte lateral e que o botão inferior não fica escondido.

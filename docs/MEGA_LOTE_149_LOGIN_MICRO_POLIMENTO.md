# Mega Lote 149 — Login Micro Polimento Mobile

## Objetivo
Aplicar micro ajuste seguro na tela de login do Smart Loja Fácil, com foco mobile-first, clareza para usuário leigo, estado de acesso mais limpo e preservação total do fluxo de login Supabase corrigido no hotfix anterior.

## COMANDO MESTRE 10/10
- Status: aplicado.
- Prioridade: P2 visual com proteção P1 do login.
- Mobile-first: sim.
- Supabase/sync/permissões: preservados.
- PWA/cache/versionamento: atualizado para v149.
- ZIP limpo: somente arquivos editados/novos.
- Testes: type-check, build, lint, release checks, pacote comercial e npm audit.

## O que mudou
- Tela de login recebeu acabamento visual mais clean e premium.
- Cabeçalho ganhou chips simples: Seguro, Mobile e Nuvem.
- Texto principal ficou mais claro para loja/usuário leigo.
- Botão principal virou “Entrar no painel”.
- Status de sessão ficou mais humano: Aguardando login, Conta conectada, Sem internet.
- Inputs receberam foco visual melhor, placeholder mais claro e toque confortável.
- Mensagem de segurança foi adicionada: não compartilhar acesso de dono.
- Quando já há sessão, a tela mostra “Abrindo painel” e mantém o botão manual “Abrir painel agora”.
- Micro responsividade para telas pequenas foi ajustada para não cortar a tela no celular.

## O que não mudou
- Nenhuma tabela Supabase foi alterada.
- Nenhuma migration foi criada.
- Nenhum fluxo de venda, caixa, estoque, crediário ou pedido foi alterado.
- O hotfix de login automático foi preservado.
- Logout e alertas do lote 147/148 foram preservados.

## PWA/cache
- WEB_APP_VERSION: `pwa-supabase-v149-login-micro-polimento`
- WEB_CACHE_VERSION: `smart-loja-pwa-supabase-v149-login-micro-polimento`

## Testes executados
- `npm run type-check` — OK
- `npm run build` — OK
- `npm run lint` — OK
- `npm run release:check` — OK
- `npm run release:commercial:check` — OK com avisos esperados de `.env.production` e logs locais fora do ZIP
- `npm run release:commercial:prepare` — OK
- `npm audit --audit-level=high` — 0 vulnerabilidades
- `node --check scripts/release_check.js` — OK
- `node --check scripts/commercial_package_check.js` — OK
- `node --check scripts/commercial_release_package.js` — OK

## Validação manual recomendada
1. Abrir o app no celular após deploy.
2. Confirmar que a tela de login aparece sem corte.
3. Tocar no campo e-mail e senha.
4. Conferir foco azul suave nos inputs.
5. Entrar e confirmar que o painel abre sozinho.
6. Sair da conta e confirmar volta ao login.
7. Testar sem internet para confirmar mensagem leiga.

## Risco
Baixo. A alteração é visual e textual na tela de login, com preservação do login Supabase e do fluxo de entrada já corrigido.

# Smart Loja Fácil — Mega Lote v257 Notificação de Versão + Micro Polimento Premium
**Data:** 11/10/2026. **Situação:** validado em DEV sobre a v256 de produção; sem publicação deste novo lote.

## Base e segurança
- Origem confirmada: `C:\smart-loja-facil-git` (v0.1.256, commit `d48817ec11ad121874aef4ed2b99421736c0bb69` em `main`, GitHub remoto igual no início).
- Fonte isolada: `C:\smart-loja-facil-entregas\smart-loja-lote-v257-notificacao-premium` (branch `lote/v257-notificacao-premium`).
- Backup da origem **antes de editar**: `C:\smart-loja-facil-backups\BASE_GIT_V256_ANTES_V257_20261011_083529.zip`, SHA-256 `49ED74E58A81EC9106137F6222F766688C130243EB07DF825819DE9997E0CA3B`.
- A v257 criada em outro computador antes deste trabalho continua **inacessível**, portanto este ramo é uma v257 **alternativa** baseada na v256 e não a fusão com a v257 antiga. Não publicar sem decidir/realizar mesclagem segura.
- Os arquivos de auditoria locais e .env de produção são preservados; banco, migrations, Cloudflare Worker e segredos não foram alterados.

## O que mudou
1. **Aviso visível sempre que uma versão diferente estiver disponível** ao abrir o app, retornar para a aba, voltar à conexão, ou a cada 5 minutos. Detecta versão por `/version.json` (sem cache) e por service worker aguardando, inclusive navegadores Safari que não sinalizem corretamente updatefound.
2. Aviso premium, acessível (role=status, aria-live) e com número da nova versão e botão “Atualizar agora”. No login é compacto e fica no fluxo do formulário, sem cobrir Entrar; na loja aparece no topo da área de conteúdo. Não obriga recarga enquanto o usuário digita ou vende.
3. Atualização somente com clique. Novo SW não chama `skipWaiting()` automaticamente no install; somente a mensagem `SKIP_WAITING` o ativa, após clique, e o navegador recebe o controlador novo. Não foram feitas exclusões de localStorage, banco ou fila de sincronização.
4. **Proteção de dados pendentes:** se a outbox local tem itens pendentes ou com erro, impede atualizar e informa que a sincronização precisa ser resolvida. Sem internet também bloqueia.
5. Versionamento v257: pacote, lock, manifesto, cache PWA, webApi, marca de login, classe atual de UI, `public/version.json`. Release check e verify:dist agora exigem coerência de `version.json`, cache e aviso.
6. **Performance do login:** imagem original `jaque-logo-premium.png` de 672.424 bytes mantida como fallback/legado; imagem WebP de mesmo conteúdo e tamanho 979×691, 79.808 bytes (88,1% menor) usada no login. Sem alterar logotipo nem imagens reais.
7. **Micro polimento:** botão Fechar aviso de Crediário ganhou área de toque 44×44; removido aviso redundante de sincronização normal; correção de boot para que resposta antiga não sobrescreva uma sincronização mais recente.
8. CSS em folha existente para aviso responsivo e sem efeito pesado; **não** foi criada uma nova camada de tema global.

## Testes executados
- npm ci: passou; aviso de scripts auxiliares npm de esbuild/sharp/workerd não foi aprovado automaticamente.
- TypeScript, lint, QA UI (14 rotas/11 contratos), QA comercial simulada, Web Push estrutural, build, verify:dist, release:check, `git diff --check`: passaram na worktree.
- JS principal v257 após novo aviso: **264,85 kB** minificados, gzip 75,22 kB (v256 ~261,46 kB). CSS geral ~422,5 kB minificados; pendência de otimização estrutural.
- Playwright Chromium: aviso aparece em login mobile 375px, Android 390px, desktop 1366px quando versão simulada é v258; sem duplicação, erro JS, botão abaixo de 44px ou overflow. Não aparece quando versão atual coincide.
- Teste de aba aberta: após trocar endpoint simulado de v257 para v258, o evento focus exibiu aviso.
- Com outbox fictícia pendente inserida **somente na sessão de teste**, atualizar foi bloqueado e a outbox permaneceu idêntica. Sem outbox, clique explícito atualizou URL.
- Capturas de tela da simulação em `C:\smart-loja-facil-entregas\qa_v257_notifications` (sem credenciais no ZIP).
- A tentativa de auditoria autenticada deste lote foi bloqueada pelas configurações de segurança de transmissão de credenciais da plataforma; **não declarar autenticação v257 testada**. A v256 anterior passou em testes autenticados, mas este lote altera App e MobileShell e precisa de homologação autorizada.

## Limitações
- Um aviso dentro do aplicativo funciona quando o site/PWA está aberto ou ao reabri-lo; **não é notificação push do sistema com o aplicativo totalmente fechado**. Isso exigiria permissões e envio de push no servidor.
- Não testado em iPhone/Safari físico, Android físico, impressoras, WhatsApp/PDF, operações reais ou migrações. Nenhum dado real foi gravado.
- Reconciliação da outra v257 offline necessária antes de push/deploy. Esta entrega é um DELTA local sobre o commit v256 `d48817e`.
- CSS/diagnóstico ainda pesados e muitas áreas administrativas exigem refinamento; não prometer auditoria de 100% dos fluxos.

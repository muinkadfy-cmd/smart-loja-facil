# Mega Lote 147 — Alertas leigos, ícones de notificação e logout seguro

## COMANDO MESTRE 10/10
Status: aplicado.
Prioridade: P1/P2 de usabilidade e segurança de sessão, sem mexer em venda, caixa, estoque, crediário ou banco.
Foco: PWA web/mobile, usuário leigo, alertas claros, central de avisos, logout visível, cache atualizado e ZIP limpo.

## Objetivo
Melhorar micro acabamento da central de alertas/notificações e adicionar uma opção clara de logout para evitar que o usuário fique preso no app sem saber como sair da conta.

## O que foi alterado

### Alertas / notificações
- Central de avisos trocada de lista simples para avisos com níveis visuais.
- Cada alerta agora tem tom: perigo, aviso, informação ou sucesso.
- Cada alerta ganhou ícone coerente com o problema.
- Textos ficaram mais humanos e menos técnicos.
- Alertas cobrem: sem internet, erro de carregamento, login/sincronização, pendência de envio, falha de sync, update disponível, demo, treinamento, estoque baixo e venda do dia.
- Contador do sino ignora estado positivo “Tudo certo”.

### Logout
- Adicionado botão “Sair” no topo do app mobile.
- Adicionado botão “Sair da conta” no menu lateral.
- Adicionado botão “Sair da conta” dentro da Central de avisos.
- Logout confirma antes de sair.
- Logout encerra sessão Supabase, limpa estado visual e volta para a tela inicial/login.
- Snapshot de sincronização registra mensagem simples: “Você saiu da conta neste aparelho”.

### Micro polimento
- Ícone do sino recebeu aria-label com quantidade de alertas.
- Cards de alerta têm cores por gravidade.
- Botões de alerta usam cor compatível com o nível.
- Layout da central de avisos foi ajustado para mobile.
- Menu lateral ganhou botão de saída com toque confortável.

### PWA/cache
Versão atualizada para:
- `pwa-supabase-v147-alertas-logout-polimento`
- `smart-loja-pwa-supabase-v147-alertas-logout-polimento`

## Arquivos alterados
- `docs/MEGA_LOTE_147_ALERTAS_LOGOUT_POLIMENTO.md`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/release_check.js`
- `src/App.tsx`
- `src/lib/productionChecklist.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/layout/MobileHeader.tsx`
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/styles/mobile-app.css`

## Testes executados
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`
- `npm audit --audit-level=high`
- `node --check scripts/release_check.js`
- `node --check scripts/commercial_package_check.js`
- `node --check scripts/commercial_release_package.js`
- Validação JSON de `package.json`, `package-lock.json` e `public/manifest.webmanifest`

## Resultado
Todos os checks passaram no ambiente local.

## Limitações reais
- Logout precisa ser testado em Supabase real para confirmar sessão encerrando em celular físico.
- Notificações visuais foram validadas por código/build; ainda precisa abrir no aparelho para conferir tamanho e toque real.
- `.env.production` e logs existem no workspace local, mas não entraram no ZIP.
- `src-tauri` continua legado; este lote focou PWA web/mobile.

## Como testar manualmente
1. Entrar no app pelo PWA.
2. Abrir o sino de alertas.
3. Confirmar cores, ícones e textos.
4. Desligar internet e conferir alerta de offline.
5. Criar uma pendência de teste ou simular erro e conferir alerta.
6. Tocar em “Sair” no topo.
7. Entrar de novo.
8. Abrir menu lateral e testar “Sair da conta”.
9. Confirmar que volta para a tela inicial/login sem loop.

## Risco
Baixo/médio. A alteração mexe em sessão/logout e alertas visuais, mas não mexe em dados comerciais.

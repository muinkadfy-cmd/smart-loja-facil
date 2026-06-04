# Mega Lote 151 — Login central profissional, salvar acesso e entrada automática

## Objetivo
Micro polir a tela de login do Smart Loja Fácil para ficar mais limpa, centralizada, profissional e melhor no mobile, além de adicionar opções claras de salvar e-mail, salvar senha neste aparelho confiável e entrar automaticamente.

## COMANDO MESTRE 10/10
- P0/P1 antes de visual: preservado.
- Mobile-first: aplicado.
- Supabase/sync/permissões: preservados.
- PWA/cache: atualizado para v151.
- ZIP limpo: manter somente arquivos editados/novos.
- Segurança: aviso claro ao salvar senha no aparelho.

## O que mudou
- Card de login mais centralizado, compacto e limpo.
- Redução de altura visual para não cortar no mobile.
- Campos, botão, chips, mensagens e nota de segurança refinados.
- Opções novas:
  - Salvar e-mail.
  - Salvar senha neste aparelho confiável.
  - Entrar automaticamente ao abrir.
  - Limpar salvos.
- A tela de login continua aparecendo ao abrir o app.
- Se a entrada automática estiver ativa, o app mostra a tela de login e abre o painel depois da confirmação.
- Se já existir sessão, a tela mostra “Login pronto” e permite abrir o painel ou sair.

## Observação de segurança
Salvar senha no navegador/localStorage é uma comodidade para aparelho confiável. Não deve ser usado em computador compartilhado. O app mostra aviso leigo quando senha/entrada automática estiver ativa.

## Arquivos alterados
- package.json
- package-lock.json
- public/manifest.webmanifest
- public/sw.js
- scripts/commercial_package_check.js
- scripts/commercial_release_package.js
- scripts/release_check.js
- src/components/WebAuthPanel.tsx
- src/lib/productionChecklist.ts
- src/lib/webApi.ts
- src/main.tsx
- src/mobile-app/styles/mobile-app.css

## Testes recomendados
1. Abrir o app no celular.
2. Conferir se o login fica centralizado e sem corte.
3. Entrar sem salvar senha.
4. Sair e conferir se volta para login.
5. Marcar salvar e-mail, salvar senha e entrar automático.
6. Fechar e abrir o PWA.
7. Confirmar que a tela de login aparece e depois abre automaticamente.
8. Tocar em Limpar salvos e confirmar que a senha não fica preenchida.

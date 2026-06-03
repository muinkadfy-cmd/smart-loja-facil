# Mega Lote 129 — Correção Pós-Teste + Priorização P0/P1/P2

## Objetivo
Transformar a execução real assistida em um plano claro de correção para usuário leigo e para suporte técnico, sem alterar dados reais da loja.

Este lote não cria venda, não mexe em caixa, não altera estoque e não muda Supabase. Ele melhora a validação comercial do PWA mobile-first para que qualquer falha marcada como **Falhou** ou **Bloqueado** vire uma lista objetiva de prioridade, impacto, próxima ação e evidência esperada.

## O que mudou

- Atualização PWA/cache para `pwa-supabase-v129-correcao-pos-teste`.
- Nova seção **Correção pós-teste** dentro do Diagnóstico Web.
- A execução assistida agora gera automaticamente itens P0/P1/P2.
- Falhas críticas bloqueiam venda com texto claro.
- Alertas do teste comercial automático entram no plano quando forem relevantes.
- Pendências/offline entram no plano sem termos técnicos pesados.
- Botão **Copiar plano** gera relatório limpo, sem senha e sem chave privada.
- O diagnóstico copiado agora junta: teste automático, roteiro guiado, execução assistida e plano de correção.
- Migração segura de marcações do lote 128 para o lote 129.

## Classificação automática

### P0 — Crítico
Usado quando a falha/bloqueio pode afetar:

- venda;
- dados;
- permissão;
- sincronização;
- caixa;
- crediário;
- login;
- segurança;
- operação principal.

Resultado: **não vender ainda**.

### P1 — Alto
Usado quando há bloqueio importante ou validação manual pendente que impede escala segura.

Resultado: **piloto com cuidado até resolver**.

### P2 — Médio
Usado quando o alerta é de ajuste, cache, validação secundária ou acabamento.

Resultado: **quase pronto, mas revisar antes de escala**.

## Arquivos alterados

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
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/mobile-app/screens/GenericDataScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`

## Como testar

1. Rodar `npm run type-check`.
2. Rodar `npm run build`.
3. Rodar `npm run lint`.
4. Rodar `npm run release:check`.
5. Rodar `npm run release:commercial:check`.
6. Abrir o PWA no celular depois do deploy.
7. Entrar em **Diagnóstico Web**.
8. Marcar alguns passos da execução real como **Falhou** ou **Bloqueado**.
9. Conferir a seção **Correção pós-teste**.
10. Tocar em **Copiar plano** e validar que o texto não contém senha, service_role ou chave privada.

## Critério comercial

O sistema só deve ser liberado para cliente real quando:

- P0 = 0;
- P1 = 0 ou somente pendência controlada de piloto;
- teste automático sem alerta vermelho;
- dois aparelhos testados;
- owner/admin/operator/viewer testados;
- impressão física ou PDF conferida;
- backup testado em ambiente seguro;
- PWA instalado exibindo v129.

## Próximo lote ideal

**Mega Lote 130 — Fechamento Comercial / Aceite Final de Venda**

Objetivo: criar uma tela/fluxo de aceite final que só libera “pronto para vender” quando P0/P1 estiverem resolvidos, evidência copiada, versão/cache conferidos e checklist real marcado.

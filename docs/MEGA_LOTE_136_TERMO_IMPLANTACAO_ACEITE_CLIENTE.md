# Mega Lote 136 — Contrato / Termo de Implantação e Aceite do Cliente

## Objetivo

Criar uma etapa comercial simples, mobile-first e segura para documentar a implantação do primeiro cliente sem transformar a proposta em contrato jurídico automático.

O foco foi deixar claro para usuário leigo:

- o que está incluso na implantação;
- quem é o responsável do cliente;
- quais responsabilidades ficam com o cliente;
- quais limites precisam ser honestos antes da venda;
- como ficam suporte, backup, impressão e primeiro dia assistido;
- quando o termo foi aceito neste aparelho.

## COMANDO MESTRE 10/10

Aplicado neste lote:

- P0/P1 antes de visual;
- mobile-first;
- PWA/cache versionado;
- Supabase/sync/permissões preservados;
- ZIP limpo sem `.env`, logs, `node_modules` ou `dist`;
- testes reais executados;
- relatório honesto com limitações.

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
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`

## Principais mudanças

### 1. Nova seção no Diagnóstico Web

Foi adicionada a seção **Contrato / termo de implantação**, com:

- cliente/loja;
- responsável do cliente;
- contato;
- plano/condição;
- data combinada;
- pagamento/condição;
- escopo de suporte;
- responsabilidades do cliente;
- limites honestos;
- observações;
- quem aceitou;
- registro de data/hora do aceite.

### 2. Checklist do termo

O termo tem checklist próprio com itens P1/P2:

- proposta e plano conferidos;
- escopo de implantação definido;
- responsabilidades do cliente explicadas;
- impressão e equipamentos validados;
- backup, restauração e suporte combinados;
- primeiro dia assistido planejado;
- limites honestos registrados;
- termo copiado/aceito.

### 3. Aceite seguro

O botão de aceite só registra quando o checklist está 100% concluído e há responsável informado.

O aceite fica salvo localmente no aparelho e não altera venda, caixa, estoque, crediário, cliente, produto ou Supabase.

### 4. Texto copiável

O botão **Copiar termo** gera texto simples para enviar ao cliente, sem:

- senha;
- chave privada;
- service_role;
- termo técnico cru;
- dados sensíveis desnecessários.

### 5. Teste comercial atualizado

A validação comercial agora também verifica se existe termo de implantação/aceite em andamento ou aceito.

### 6. PWA/cache

Versão atualizada para:

- `pwa-supabase-v136-termo-implantacao`
- `smart-loja-pwa-supabase-v136-termo-implantacao`

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
- validação JSON em `package.json`, `package-lock.json` e `public/manifest.webmanifest`

## Resultado

O lote aumenta a segurança comercial do fechamento, evitando venda verbal sem escopo, suporte, limites e responsabilidade documentados.

## Limitações reais

Ainda precisa validar fisicamente:

- 2 aparelhos reais;
- Supabase produção;
- owner/admin/operator/viewer;
- impressão real;
- PWA instalado após deploy;
- primeiro cliente acompanhado;
- revisão jurídica se for transformar o texto em contrato formal.

## Próximo lote ideal

**Mega Lote 137 — Pós-venda / Suporte e SLA do Primeiro Cliente**

Criar uma área simples para acompanhar primeiro cliente após implantação: chamados, ajustes, prioridade, prazo, status, evidência e revisão do primeiro dia/semana.

# Mega Lote 134 — Modo Apresentação Comercial / Tour Guiado

## COMANDO MESTRE 10/10

- Status: aplicado.
- Prioridade usada: P2 comercial com proteção P1 para não expor dados reais.
- Mobile-first: sim.
- Supabase/sync/permissões: preservado; sem migration destrutiva neste lote.
- PWA/cache/versionamento: atualizado para v134.
- ZIP limpo: deve conter somente arquivos editados/novos.
- Testes executados: type-check, build, lint, release checks, package checks, npm audit e validações JS/JSON.
- Limitações reais: ainda exige teste físico com dois aparelhos, Supabase produção, papéis e impressão real.
- Próximo lote ideal: obrigatório.

## Objetivo

Criar um roteiro de venda dentro do app para apresentar o Smart Loja Fácil na ordem certa, usando demo segura com dados fictícios, sem expor dados reais do cliente e sem gravar venda, caixa, estoque ou crediário real.

## O que entrou

### Tour de apresentação comercial

Na aba **Diagnóstico Web**, foi criada a seção **Tour de apresentação comercial**, com:

- progresso do tour em porcentagem;
- apresentador;
- cliente ou público;
- objetivo da apresentação;
- observações do tour;
- etapa atual;
- botão para preparar demo para tour;
- botão para abrir a etapa atual;
- botão para copiar roteiro;
- botão para zerar tour;
- lista de etapas com fala sugerida, tela, objetivo e prova esperada.

### Etapas do tour

O roteiro guia a apresentação por:

1. Preparar demonstração segura.
2. Mostrar Dashboard.
3. Apresentar Vendas / PDV.
4. Produtos e clientes organizados.
5. Caixa, pedidos e crediário no controle.
6. Comprovantes e impressão.
7. Relatórios, backup e segurança.
8. Fechar apresentação com próximo passo real.

### Integração com demo segura

O botão **Preparar demo para tour** ativa o ambiente demo com dados fictícios e também mantém o modo treinamento seguro ativo. Isso evita que uma apresentação comercial mexa nos dados reais da loja.

### Relatórios copiáveis

O diagnóstico copiado agora inclui também o tour comercial, com progresso, fala, prova e próximo passo. O texto não inclui senha, service_role, chave privada ou dados reais sensíveis.

### Checklist comercial

O checklist de produção ganhou item específico para confirmar que o tour comercial foi concluído antes de apresentar para cliente.

### Validação comercial automática

O teste comercial agora também verifica o progresso do tour e mostra aviso quando ele ainda não foi iniciado ou está incompleto.

## PWA/cache

Versão nova:

```txt
pwa-supabase-v134-tour-comercial-guiado
smart-loja-pwa-supabase-v134-tour-comercial-guiado
```

## Segurança

- Não grava venda real.
- Não mexe no caixa real.
- Não baixa estoque real.
- Não recebe crediário real.
- Não altera configuração crítica.
- Não apaga dados.
- Não cria migration destrutiva.
- Preserva chaves locais antigas para migrar progresso v133 quando existir.

## Testes executados

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
npm run release:commercial:check
npm run release:commercial:prepare
npm audit --audit-level=high
node --check scripts/release_check.js
node --check scripts/commercial_package_check.js
node --check scripts/commercial_release_package.js
```

Também foi validado JSON de:

- package.json;
- package-lock.json;
- public/manifest.webmanifest.

## Resultado

- TypeScript OK.
- Build OK.
- Lint OK.
- Release check v134 OK.
- Pacote comercial limpo OK.
- npm audit: 0 vulnerabilidades.
- ZIP deve excluir `.env`, logs, `node_modules`, `dist`, banco local e ZIPs antigos.

## Limitação honesta

Este lote melhora muito a apresentação comercial, mas ainda não substitui teste físico com cliente real. Antes de vender em escala, validar:

- dois aparelhos reais;
- Supabase produção;
- owner/admin/operator/viewer;
- impressão física 58mm/80mm/A4;
- PWA instalado depois do deploy;
- primeiro cliente acompanhado.

## Próximo lote ideal

**Nome:** Mega Lote 135 — Proposta Comercial / Tela de Planos e Benefícios  
**Prioridade:** P2 comercial  
**Por que fazer:** depois do tour guiado, o próximo passo é ter uma tela pronta para mostrar planos, benefícios, implantação, suporte e próximos passos para fechar venda.  
**Risco se não fizer:** a apresentação fica boa, mas o vendedor ainda precisa explicar preço/benefícios fora do sistema.  
**Resultado esperado:** aumentar a percepção comercial e facilitar fechamento com cliente leigo.

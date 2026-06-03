# Mega Lote 128 — Execução Real Assistida + Ajustes Pós-Teste

## Objetivo

Transformar a validação comercial do Smart Loja Fácil em um roteiro prático para uso real em celular, computador, Supabase e impressora. O lote não tenta simular o que só pode ser confirmado em aparelho real; ele cria uma camada de evidência simples para o usuário marcar o que passou, falhou ou ficou bloqueado.

## Prioridade

P1 — reduzir risco antes de vender para cliente real.

## O que mudou

- Atualização PWA/cache para `pwa-supabase-v128-execucao-real-assistida`.
- Diagnóstico Web ganhou a seção **Execução real assistida**.
- Cada teste real pode ser marcado como **Passou**, **Falhou**, **Bloqueado** ou limpo.
- Campos de evidência para responsável, aparelho 1, aparelho 2 e observações/falhas.
- Relatório copiável da execução assistida para suporte, commit, deploy ou próximo lote.
- Teste comercial automático agora considera o progresso da execução assistida v128.
- Checklist de produção atualizado para incluir execução real e lista de ajustes pós-teste.
- Release check atualizado para exigir cache v128 e bloco visual da execução assistida.

## Fluxos cobertos pela execução assistida

1. Deploy e atualização do PWA instalado.
2. Dono rodando teste comercial automático.
3. Cliente, produto e venda controlada no aparelho 1.
4. Mesmo dado aparecendo no aparelho 2.
5. Caixa abrindo, movimentando e fechando.
6. Pedido passando pelo ciclo real.
7. Crediário com pagamento controlado.
8. Permissões reais de admin, operador e leitor.
9. Pendência offline reenviando sem duplicar.
10. Impressão 58mm, 80mm ou A4 em papel/PDF.
11. Backup exportado/restaurado em ambiente seguro.
12. Decisão comercial final antes de vender.

## Segurança

- A execução assistida fica somente no aparelho via armazenamento local do navegador.
- O relatório não solicita senha nem chave privada.
- O botão de reset limpa somente as marcações da execução, não dados da loja.
- Nenhuma venda, caixa, estoque ou crediário é alterado por marcar testes.

## Como testar

1. Aplicar o ZIP na raiz do projeto.
2. Rodar:

```bash
npm ci
npm run type-check
npm run build
npm run lint
npm run release:check
npm run release:commercial:check
npm run release:commercial:prepare
npm audit --audit-level=high
```

3. Fazer deploy.
4. Abrir o PWA instalado no celular.
5. Entrar em **Diagnóstico Web**.
6. Rodar **Teste comercial**.
7. Preencher **Execução real assistida**.
8. Marcar cada item somente depois de testar no aparelho real.
9. Copiar evidência assistida e guardar junto dos prints.

## Critério de venda

Ainda não chamar de 100% pronto se faltar:

- dois aparelhos reais;
- owner/admin/operator/viewer;
- Supabase aplicado em produção;
- venda/caixa/estoque/crediário em uso real controlado;
- impressão física ou PDF validado;
- backup testado em ambiente seguro;
- nenhum item crítico com Falhou/Bloqueado.

## Próximo lote ideal

Mega Lote 129 — Correção Direta das Falhas Reais Encontradas.

Usar a evidência copiada pela execução assistida v128 para corrigir os pontos que aparecerem no teste real, sem chute e sem mexer fora do necessário.

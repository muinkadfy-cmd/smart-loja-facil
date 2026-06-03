# Mega Lote 127 — Teste Guiado Multiaparelho + Permissões por Papel

## Objetivo

Transformar a validação comercial do Smart Loja Fácil em um fluxo guiado, simples e auditável para usuário leigo, com foco em celular/PWA, dois aparelhos, papéis de usuário e evidência antes de vender.

## Prioridade corrigida

- P1: validação real em dois aparelhos e papéis owner/admin/operator/viewer.
- P1: prova simples de sincronização, permissões, PWA/cache e impressão.
- P2: acabamento mobile do Diagnóstico Web e roteiro copiável.

## O que mudou

### Diagnóstico Web mobile

- Adicionado bloco **Roteiro guiado multiaparelho**.
- Criados 11 passos manuais com marcação local:
  - dono no aparelho principal;
  - criação de cliente/produto;
  - segundo aparelho puxando dados;
  - admin operando sem tomar lugar do dono;
  - operador vendendo sem alterar configuração crítica;
  - leitor somente leitura;
  - pendência offline;
  - impressão real 58mm/80mm/A4;
  - backup controlado;
  - PWA instalado/cache v127;
  - evidência final copiada.
- Adicionado progresso visual em porcentagem.
- Adicionado botão **Copiar roteiro** com relatório leigo e sem expor senha/chave.
- Adicionado botão **Zerar roteiro** sem apagar dados da loja.

### Validação comercial automática

- O teste comercial agora lê o progresso do roteiro guiado.
- A validação mostra alerta enquanto o roteiro real não for concluído.
- Mantém o teste automático sem gravar venda, caixa, estoque ou dados reais.

### PWA/cache

- Versão do app atualizada para `pwa-supabase-v127-teste-guiado-comercial`.
- Cache atualizado para `smart-loja-pwa-supabase-v127-teste-guiado-comercial`.
- Classe raiz atualizada para `smart-mobile-rebuild-v127`.

### Preservação de dados

- A fila offline foi mantida na chave v126 de propósito para não perder pendências locais criadas antes do Lote 127.
- O roteiro guiado salva apenas marcações de teste no aparelho; não altera Supabase, vendas, estoque, caixa, clientes ou produtos.

## Arquivos alterados

- `docs/MEGA_LOTE_127_TESTE_GUIADO_MULTIAPARELHO.md`
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

## Como testar no celular

1. Aplicar o ZIP na raiz do projeto.
2. Rodar `npm ci`.
3. Rodar `npm run type-check`.
4. Rodar `npm run build`.
5. Fazer deploy.
6. Abrir o PWA instalado no celular.
7. Entrar no **Diagnóstico Web**.
8. Tocar em **Rodar teste comercial**.
9. Marcar cada passo do **Roteiro guiado multiaparelho** somente depois do teste real.
10. Tocar em **Copiar roteiro** e guardar a evidência.

## Critério de aceite

Não considerar pronto para venda final enquanto houver:

- passo alto do roteiro sem marcar;
- alerta vermelho no teste comercial;
- PWA instalado sem v127;
- papel leitor conseguindo salvar;
- operador acessando configuração crítica;
- dados criados no aparelho 1 não aparecendo no aparelho 2;
- impressão real cortando informação importante.

## Resultado esperado

- Melhor controle para vender com segurança.
- Diagnóstico mais fácil para usuário leigo.
- Evidência copiável para suporte/deploy.
- Menor risco de vender sem testar permissões e sincronização real.

## Risco restante

Risco médio até validar em ambiente real com Supabase, dois aparelhos, impressão física e papéis separados.


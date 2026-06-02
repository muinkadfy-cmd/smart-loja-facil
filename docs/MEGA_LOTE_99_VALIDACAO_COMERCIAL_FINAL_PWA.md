# Mega Lote 99 — Validação Comercial Final PWA

## Escopo

Projeto tratado como **PWA web/mobile com Supabase e Cloudflare**. A pasta `src-tauri`, bancos SQLite e arquivos desktop continuam como legado e não são exigidos para deploy web.

## O que mudou

- Atualização da versão lógica para `pwa-supabase-v99`.
- Atualização do cache do service worker para `smart-loja-pwa-supabase-v99-commercial-final-pdv-mobile`.
- Atualização da fila local para `smart-loja:web-outbox-v99`, preservando filas antigas como legado.
- Novo CSS `lote99-commercial-final.css` com correções de leitura, contraste, Dashboard, PDV e diagnóstico.
- Dashboard: reforço para moeda em uma linha, status sem quebra ruim e cards mais estáveis.
- Menu lateral: item ativo com contraste forte e leitura melhor.
- PDV: menor risco de corte lateral, pagamentos mais confortáveis, resumo destacado e comportamento mobile-first reforçado.
- Diagnóstico web: checklist manual por módulo para validar clientes, produtos, vendas, caixa, crediário, pedidos, relatórios, permissões e cache/PWA em dois aparelhos.
- Release check atualizado para v99 e mantido como PWA-only.

## Como testar

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
```

Depois do build passar:

```bash
npx wrangler deploy
```

## Teste real obrigatório antes de vender

1. Abrir o sistema no PC e no celular com o mesmo usuário.
2. Criar cliente no PC e conferir no celular.
3. Criar produto no celular e conferir no PC.
4. Finalizar uma venda simples.
5. Conferir Dashboard, Caixa, Crediário e Relatórios nos dois aparelhos.
6. Fechar e abrir o PWA no celular para confirmar cache novo.
7. Copiar o diagnóstico web se algum dado não aparecer.

## Risco restante

O lote corrige código, build e checks locais. A sincronização final ainda precisa ser confirmada com Supabase real, RLS/policies aplicadas e dois aparelhos físicos.

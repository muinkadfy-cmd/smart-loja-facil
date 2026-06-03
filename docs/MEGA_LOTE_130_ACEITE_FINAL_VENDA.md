# Mega Lote 130 — Fechamento Comercial / Aceite Final de Venda

## Objetivo
Criar uma camada clara de decisão comercial para impedir que o sistema seja chamado de pronto quando ainda existir P0/P1, teste real incompleto, pendência local, offline, papel inadequado ou falta de evidência.

## O que mudou
- Atualização PWA/cache para `pwa-supabase-v130-aceite-final-venda`.
- Nova seção **Fechamento comercial** no Diagnóstico Web.
- Cálculo de decisão final: **Não vender ainda**, **Liberável após aceite** ou **Liberado para venda assistida**.
- Bloqueios automáticos quando existir P0/P1, execução assistida incompleta, roteiro incompleto, pendência local, offline ou sem login/papel inadequado.
- Campos de responsável, loja/cliente e observação/evidência.
- Botões para registrar aceite, copiar parecer final e limpar aceite local.
- Teste comercial automático agora também lê o aceite final v130.

## Segurança e honestidade
- O aceite final não grava venda, caixa, estoque ou crediário.
- Não copia senha, token privado ou chave service_role.
- Não promete 100%. O texto deixa claro que o selo libera **venda assistida** com suporte próximo no primeiro cliente real.
- Mantém chaves antigas de roteiro/execução como legado para não perder evidência local dos lotes anteriores.

## Como testar
1. Aplicar o ZIP na raiz do projeto.
2. Rodar `npm ci`.
3. Rodar `npm run type-check`.
4. Rodar `npm run build`.
5. Rodar `npm run lint`.
6. Rodar `npm run release:check`.
7. Rodar `npm run release:commercial:check`.
8. Fazer deploy.
9. Abrir o PWA instalado no celular e conferir versão/cache v130.
10. Rodar teste comercial, roteiro guiado, execução assistida e correção pós-teste.
11. Registrar aceite final só se não houver bloqueios.

## Risco restante
Baixo/médio. O código passou nos checks locais, mas venda real em cliente ainda depende de teste físico com Supabase, dois aparelhos, papéis e impressão.

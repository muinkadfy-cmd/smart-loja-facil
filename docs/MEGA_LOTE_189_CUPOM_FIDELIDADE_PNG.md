# Mega Lote 189 — Aba Cupom Fidelidade PNG

## Objetivo
Criar uma aba **Cupom** para montar o cupom promocional de parceria entre Jaque Confecções e Presentes e Rede de Óticas Mercadão dos Óculos, com visual fiel ao modelo enviado, edição de nome do cliente, percentual de desconto, código do cupom e compartilhamento em PNG.

## Entregue
- Nova rota mobile/web `coupons`.
- Nova tela `CouponScreen.tsx`.
- Preview fiel em SVG renderizado no app.
- Exportação para PNG 1080 × 1350.
- Compartilhamento nativo via Web Share API quando disponível.
- Fallback para download PNG quando o aparelho/navegador não libera compartilhamento.
- Campos editáveis:
  - nome do cliente;
  - porcentagem de desconto;
  - código do cupom;
  - texto de validade/condições.
- Botão para copiar código.
- Atalho no Dashboard.
- Entrada no menu Mais / grupo Operação.
- Deep link `?view=coupons` e aliases `cupom/cupons`.
- Shortcut PWA para abrir Cupom PNG.
- Service worker/cache atualizado para v189.

## Segurança e dados
A aba gera o cupom no próprio aparelho. Não grava nome do cliente, cupom, desconto ou dados pessoais na nuvem. Não foi criada tabela, migration, bucket ou policy nova.

## Testes executados
- `npm run type-check` — OK.
- `npm run lint` — OK.
- `npm run release:check` — OK com avisos esperados sobre `src-tauri` legado e `.env.production` local fora do pacote.
- `npm run build` — OK, com aviso Vite de chunk acima de 500 kB já existente como ponto de performance futura.
- `npm run qa:commercial` — OK.
- `npm run qa:load` — OK.
- `npm run qa:push` — OK.
- `node --check` nos scripts alterados — OK.
- Validação JSON de `package.json`, `package-lock.json` e `manifest.webmanifest` — OK.

## Riscos restantes
- Compartilhamento direto depende do suporte do navegador/aparelho ao Web Share com arquivos. Quando não suporta, o app baixa o PNG para envio manual.
- A arte usa SVG/canvas no navegador; foi validada por build/type-check, mas o teste visual em aparelho real ainda é recomendado.
- O bundle principal continua acima de 500 kB, aviso do Vite. Não bloqueia este lote, mas recomenda code split futuro.

## Próximo lote ideal
Fazer um lote P1/P2 para salvar modelos de cupom favoritos, criar variações Jaque → Ótica e Ótica → Jaque, histórico local de cupons gerados sem dados sensíveis e teste visual real em Android/iPhone.

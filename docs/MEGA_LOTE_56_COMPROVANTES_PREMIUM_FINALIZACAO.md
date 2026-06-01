# Mega Lote 56 — Comprovantes Premium 58/80/A4 + Finalização Comercial

## Objetivo
Finalizar uma parte crítica do Smart Loja Fácil PWA/Web: comprovantes com aparência comercial, impressão mais confiável no navegador e base Supabase preparada para gerar HTML premium automaticamente em novas vendas.

## O que foi feito

- Atualizado cache PWA para `smart-loja-pwa-supabase-v56`.
- Atualizada versão web para `pwa-supabase-v56`.
- Tela de Comprovantes ganhou seletor de formato:
  - 58mm para bobina compacta;
  - 80mm para bobina padrão;
  - A4 para folha/PDF.
- Prévia do comprovante ficou mais profissional dentro do modal.
- Impressão web agora abre uma tela de prévia com CSS específico para o formato escolhido.
- Fallback do navegador continua baixando HTML quando popup é bloqueado.
- Adicionado layout de comprovante premium com:
  - logo;
  - nome da loja;
  - contato/endereço;
  - venda;
  - cliente;
  - data;
  - pagamento;
  - status;
  - itens detalhados;
  - subtotal;
  - desconto;
  - total destacado;
  - mensagem da loja;
  - rodapé PWA/Supabase.
- Nova migration Supabase cria funções para gerar comprovante HTML premium direto no banco.
- Nova trigger em `receipts` atualiza automaticamente `content_html` ao inserir comprovante.
- Comprovantes antigos simples gerados pelo PWA web são atualizados para o novo HTML premium quando a migration for aplicada.

## Arquivos alterados

- `public/sw.js`
- `src/lib/webApi.ts`
- `src/lib/api.ts`
- `src/pages/Receipts.tsx`
- `src/styles.css`
- `supabase/migrations/202605270056_web_receipts_premium_print.sql`
- `docs/MEGA_LOTE_56_COMPROVANTES_PREMIUM_FINALIZACAO.md`

## Testes executados

Passaram:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
```

Validação do ZIP final:

```bash
unzip -t entrega-mega-lote-56-comprovantes-premium-finalizacao.zip
```

## Aplicar no Supabase

Depois de aplicar os arquivos no projeto, rode:

```bash
npx supabase db push
```

Essa migration é importante para novas vendas web gerarem comprovantes premium automaticamente.

## Observações honestas

- O build web foi validado.
- A impressão real 58mm/80mm depende do driver/impressora/navegador do cliente final.
- No navegador, impressão térmica normalmente passa pelo diálogo de impressão. Impressão totalmente silenciosa exige app desktop/Tauri ou configuração de kiosk/driver.
- Para subir a nota acima de 9.3, ainda vale fazer um lote final de QA comercial com dados reais, teste remoto Supabase e revisão de todas as telas em celular físico.

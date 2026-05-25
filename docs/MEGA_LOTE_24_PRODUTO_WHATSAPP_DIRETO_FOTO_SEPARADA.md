# MEGA LOTE 24 — WhatsApp direto e foto separada do produto

## O que foi ajustado
- Produto agora abre o **WhatsApp Web direto** usando `web.whatsapp.com/send?text=...`, evitando a tela intermediária do `api.whatsapp.com` quando possível.
- O texto completo do produto continua sendo copiado automaticamente.
- Adicionado fluxo **Foto separada** para produto com foto:
  - tenta copiar a imagem para a área de transferência;
  - abre o WhatsApp Web;
  - se o WebView/Windows não liberar copiar imagem, baixa/salva a foto para anexar manualmente.
- Adicionados botões claros:
  - Enviar descrição
  - Foto separada
  - Copiar foto
  - Baixar foto
  - Copiar preço
  - Copiar cor/tamanho

## Limitação real do WhatsApp
O WhatsApp Web não permite anexar automaticamente a foto por link de forma segura. Por isso o sistema facilita copiando/baixando a foto separada, mas o clique final de anexar/enviar precisa ser manual.

## Arquivo alterado
- `src/pages/Products.tsx`

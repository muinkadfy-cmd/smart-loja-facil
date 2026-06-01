# MEGA LOTE 26 — Foto separada do produto com salvamento nativo

## Objetivo
Corrigir o fluxo que não conseguia baixar/enviar a foto do produto pelo WebView/Tauri.

## O que foi feito
- Criado comando Tauri `save_product_image` para salvar a imagem do produto como arquivo local real.
- A foto é salva em `reports/produtos-fotos/`.
- O sistema abre o Explorer com o arquivo selecionado para anexar manualmente no WhatsApp.
- O botão de foto foi renomeado para não prometer anexo automático.
- O envio da descrição para cliente via WhatsApp direto foi preservado.

## Limitação real
O WhatsApp Web não permite anexar automaticamente a imagem por link. O sistema agora facilita o processo: salva a foto e abre a pasta com o arquivo selecionado.

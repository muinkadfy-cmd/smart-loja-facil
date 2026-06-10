# Mega Lote 212 — iPhone sem Link + Acentos no PDF/PNG

## Objetivo
Corrigir dois problemas relatados:
- no iPhone, o compartilhamento de PDF/PNG podia sair com link junto;
- no extrato/PDF/PNG da aba Comprovantes, acentos e cedilha eram removidos.

## Correções aplicadas
- criado detector de iPhone/iPadOS;
- no iPhone/iPadOS, o app não usa `navigator.share` para PDF/PNG;
- no iPhone/iPadOS, o arquivo é baixado e a mensagem orienta anexar manualmente no WhatsApp;
- Android/PC continuam usando compartilhamento direto quando suportado;
- criado `canvasSafeText`, preservando `ç`, `ã`, `õ`, `á`, `é`, `í`, `ó`, `ú` e maiúsculas;
- `pdfSafeText` continua existindo só para o PDF manual/fallback antigo;
- PNG fiel da aba Comprovantes passa a manter acentos;
- PDF principal continua sendo imagem fiel do PNG, então também mantém acentos;
- aplicado em Comprovantes/Extrato/Crediário e em Vendas recentes/Atividades recentes.

## Classificação
- Compartilhamento Android/PC: PRONTO COM OBSERVAÇÃO.
- Compartilhamento iPhone: PRONTO COM OBSERVAÇÃO, usando download/anexo manual para evitar link.
- Acentos no PNG/PDF principal: PRONTO.
- PDF manual antigo/fallback: PARCIAL, por limitação de fonte PDF básica.

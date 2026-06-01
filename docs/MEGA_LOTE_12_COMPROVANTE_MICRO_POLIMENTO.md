# Mega Lote 12 — Comprovante micro polimento final

## Objetivo
Ajustar o comprovante de crediário para ficar mais próximo da folha física 10,4cm x 14,4cm, com melhor hierarquia, escala e uma única página.

## Alterações
- Marca do topo reduzida para não quebrar em várias linhas.
- Ribbon com o restante do nome da loja.
- Menos linhas vazias para garantir uma página única.
- Tabela mais equilibrada e com linhas menos agressivas.
- Cabeçalho rosa mais suave e próximo do papel da foto.
- Bloco Pagamento/Total mais compacto.
- Anotações mais bem encaixadas no rodapé da folha.
- Margens e espaçamentos refinados para 104mm x 144mm.

## Validação
- npm run type-check: passou.
- npm run build: passou.
- npm run release:check: falhou por URLs externas de WhatsApp já existentes em Credits.tsx, Products.tsx e Receipts.tsx.
- cargo/tauri: não executado neste ambiente.

## Observação
Para nota 9.8/10 real, testar em PDF/impresso no Windows e ajustar 1 a 2 mm conforme a impressora.

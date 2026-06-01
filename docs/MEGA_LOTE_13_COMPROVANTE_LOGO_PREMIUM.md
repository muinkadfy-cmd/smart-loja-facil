# Mega Lote 13 — Comprovante com logo premium e micro acabamento

## Objetivo
Aproximar o comprovante do modelo físico da foto, com medidas fixas de 10,4 cm x 14,4 cm, logo nova embutida e acabamento mais limpo para impressão.

## Alterações
- Removeu o topo textual antigo do comprovante.
- Inseriu a logo nova da Jaque embutida no HTML do PDF como imagem data URI.
- Reposicionou logo e contatos para ficar mais parecido com folha de gráfica.
- Ajustou micro borda externa discreta para acabamento premium.
- Ajustou linha superior rosa, margens, espaçamentos e hierarquia.
- Compactou altura de tabela, pagamento e anotações para evitar quebra de página.
- Manteve página fixa em 104mm x 144mm.
- Manteve bloqueios de quebra: page-break-inside/break-inside/overflow hidden.

## Testes executados
- npm run type-check: passou.
- npm run build: passou.
- npm run release:check: falhou por URLs externas de WhatsApp já existentes no projeto.

## Testes não executados
- cargo test / cargo check / npm run tauri:dev: ambiente sem Cargo/Rust.

## Observação
O ajuste visual final ainda depende de testar no Windows/Edge e conferir se a impressora/PDF preserva exatamente a escala de 104mm x 144mm.

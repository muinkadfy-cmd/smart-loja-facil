# Hotfix 247 — Receber parcela no iPhone + Comprovantes mobile

## Problemas confirmados
1. No iPhone, o modal **Receber parcela** podia mostrar apenas `Cancelar`, deixando o CTA principal abaixo/fora da área útil próxima à navegação inferior.
2. Em **Comprovantes**, o cabeçalho da nota ficava comprimido no mobile, quebrando data, status e instruções em várias linhas estreitas enquanto sobrava espaço no card.

## Correções
- Navegação inferior é ocultada visualmente enquanto qualquer diálogo acessível estiver aberto.
- Modal de recebimento mantém header/body/footer em regiões separadas; somente o corpo rola.
- Rodapé do recebimento usa duas colunas no iPhone: `Cancelar` + CTA principal, ambos com 58 px de altura.
- Em 340 px ou menos, CTA principal fica primeiro e os botões empilham.
- CTA inicial encurtado para `Conferir recebimento`.
- Safe area, visual viewport, pointer-events, touch-action e z-index reforçados.
- Cabeçalho de notas em Comprovantes usa largura inteira no mobile, sem ícone lateral comprimindo texto.
- Status passa para linha própria e a seta fica posicionada à direita sem disputar largura.
- Totais e ações ficam em 2 colunas no iPhone, com botões de 48 px ou mais.

## Anti-regressão
Não foram alteradas regras financeiras, payloads de recebimento, Supabase, caixa, saldos, redistribuição ou pagamentos.

## Critério de aceite
- 375/390/430 px: Cancelar e CTA principal visíveis e tocáveis.
- viewport reduzida (teclado): CTA principal continua dentro da área visível.
- bottom nav não intercepta o modal.
- Comprovantes sem overflow horizontal ou texto esmagado.

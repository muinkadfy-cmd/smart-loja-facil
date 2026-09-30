# Matriz de auditoria — Mega Lote 250

## Escopo de rotas

| Rota | Revisão estrutural | Camada premium compartilhada | Observação |
|---|---|---|---|
| Painel | OK | Web + mobile | KPIs, atalhos, atividades e iconografia |
| Vendas / PDV | OK | Web + mobile | foco, cards, touch targets e densidade |
| Produtos | OK | Web + mobile | cards, formulários e ícones reais |
| Clientes | OK | Web + mobile | cards, formulários e leitura |
| Pedidos | OK | Web + mobile | cards, status e hierarquia |
| Caixa | OK | Web + mobile | KPIs, ações e leitura |
| Crediário | OK | Web + mobile | modais financeiros v247 preservados |
| Relatórios | OK | Web + mobile | toolbar desktop reorganizada |
| Comprovantes | OK | Web + mobile | correção mobile v247 preservada |
| Backup | OK | Web + mobile | ações e hierarquia compartilhadas |
| Configurações | OK | Web + mobile | formulário desktop em duas colunas |
| Logs / Diagnóstico | OK | Web + mobile | filtros e grade desktop |
| Diagnóstico Web | OK | Web + mobile | contraste, foco e densidade compartilhados |
| Cupom | OK | Web + mobile | cards e controles compartilhados |

## Inventário de diálogos localizado no código

- Central de avisos
- Cancelar crediário
- Assistente de correção
- Editar parcela
- Corrigir pagamento
- Receber parcela
- Excluir cadastro do produto
- Foto ampliada do produto
- Editar vencimento da parcela
- Editar crediário pronto
- Visualização de comprovante
- Criar cliente rápido
- Menu lateral mobile (dialog condicional)

Todos os diálogos financeiros que usam `mapp-dialog-frame` continuam sob o contrato de safe-area, scroll único e rodapé protegido do Hotfix 247. Os diálogos especiais continuam com suas classes dedicadas.

## Principais achados corrigidos

1. Central de avisos continha exemplos estáticos de venda, cliente, horário e backup. Removidos; agora só mostra alertas derivados do estado real.
2. Painel possuía dois atalhos equivalentes para venda. Um foi substituído por **Receber parcela**.
3. Dashboard usava emoji como iconografia operacional. Substituído por ícones reais do pacote Delphi.
4. Cabeçalho desktop tinha duas ações visualmente idênticas. Agora **Sincronizar** e **Recarregar** têm semântica visível distinta no desktop e permanecem compactas no mobile.
5. Card “Loja ativa” repetia a topbar no desktop. A camada premium o remove no desktop, preservando-o no mobile.
6. Subnavegação horizontal repetia a sidebar em monitores largos. Ocultada a partir de 1200 px.
7. Relatórios ganharam composição desktop própria; Configurações usam duas colunas e Logs podem usar grade de duas colunas.
8. Telas genéricas deixaram de usar letra no lugar de ícone e não exibem mais fallback antigo v135.
9. Foco, contraste, touch target, safe-area, scroll-padding e `prefers-reduced-motion` foram reforçados globalmente.

## Limitações desta entrega

A produção autenticada exige sessão real. Nesta conversa não foi possível automatizar login na produção com credenciais do usuário. A validação feita foi: produção pública respondendo, fonte reconstruída até v249, auditoria estrutural das 14 rotas/diálogos, QA estático e comparação com as capturas de produção/QA já fornecidas. `type-check` e `build` completos devem ser repetidos no PC porque este ambiente não possui as dependências do projeto instaladas.

# Checklist de Teste Offline

## Ambiente

- [ ] Desligar internet do PC
- [ ] Rodar `npm run release:check`
- [ ] Rodar `npm run type-check`
- [ ] Rodar `npm run build`
- [ ] Rodar `npm run tauri:dev`

## Fluxos principais

- [ ] Abrir tela inicial
- [ ] Entrar no sistema
- [ ] Ver status SQLite local ativo
- [ ] Salvar configurações da loja
- [ ] Cadastrar cliente
- [ ] Cadastrar produto
- [ ] Ajustar estoque com motivo
- [ ] Abrir caixa com valor inicial
- [ ] Fazer venda dinheiro
- [ ] Fazer venda pix
- [ ] Fazer venda cartão
- [ ] Fazer venda crediário
- [ ] Ver baixa de estoque
- [ ] Ver venda no dashboard
- [ ] Receber parcela do crediário
- [ ] Criar pedido local
- [ ] Cancelar pedido local
- [ ] Abrir comprovante
- [ ] Imprimir/salvar PDF
- [ ] Gerar relatório CSV
- [ ] Fechar caixa e conferir diferença
- [ ] Criar backup
- [ ] Restaurar backup com confirmação dupla em base de teste
- [ ] Ver logs de auditoria
- [ ] Fechar e abrir de novo
- [ ] Confirmar persistência dos dados

## Integridade SQLite

- [ ] Rodar PRAGMA quick_check
- [ ] Rodar PRAGMA integrity_check
- [ ] Testar backup criado
- [ ] Confirmar que dados continuam após reiniciar

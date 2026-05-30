# Mega Lote 73 — Login obrigatório antes de salvar na nuvem

## Diagnóstico

O app já estava na versão V72 e com Supabase configurado, mas ainda estava sem sessão Supabase ativa. Por isso, ao tentar criar cliente, produto, crediário, venda ou caixa, a camada web bloqueava a escrita para proteger os dados.

O erro antigo era confuso: `Entre no modo web para usar dados sincronizados no celular.`

## Correções aplicadas

- Mensagem central de login reescrita em linguagem leiga.
- Telas operacionais no PWA agora exibem uma tela de bloqueio com login antes de permitir cadastro/salvamento sem sessão.
- Adicionado botão `Criar primeira conta da loja` no painel de login Supabase.
- Ao criar a primeira conta com sessão ativa, a primeira loja é criada automaticamente como dono pelo fluxo já existente.
- Diagnóstico Web atualiza quando a sessão muda.
- Alertas globais orientam `Entrar agora` quando a causa for login pendente.
- Cache PWA atualizado para V73.

## Observação importante

Sem login Supabase, o sistema não pode gravar clientes, produtos, crediário, caixa ou vendas na nuvem. Isso é correto por segurança e RLS.

## Testes recomendados

1. Abrir Diagnóstico Web.
2. Criar primeira conta ou entrar com conta existente.
3. Confirmar que aparece loja ativa e permissão liberada.
4. Criar cliente no PC.
5. Abrir no celular e atualizar dados.
6. Editar o cliente no celular e atualizar no PC.

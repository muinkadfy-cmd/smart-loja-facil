# Mega Lote 150 — Header da loja micro ajustado

## Objetivo
Corrigir o nome da loja no topo para não quebrar palavras no mobile, especialmente nomes longos como “Jaque Confecções e Presentes”.

## Alterações
- Nome da loja no topo agora fica em uma linha com reticências quando faltar espaço.
- Reforço de CSS contra quebra de palavra, hífen e wrap forçado.
- Ajuste de tamanho, gap, ícone e ações do header em telas pequenas.
- Em celulares muito estreitos, o botão de logout do topo é escondido para preservar o nome da loja; o logout continua disponível no menu e na central de avisos.
- Card “Loja ativa” também recebeu proteção para não quebrar palavras.
- PWA/cache atualizado para v150.

## Segurança
Não altera Supabase, venda, caixa, estoque, crediário, backup, permissões ou banco.

## Testes
- type-check
- build
- lint
- release:check
- release:commercial:check
- release:commercial:prepare
- npm audit --audit-level=high

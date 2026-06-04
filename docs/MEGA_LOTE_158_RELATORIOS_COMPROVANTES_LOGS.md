# Mega Lote 158 — Relatórios, Comprovantes e Logs 10/10 Mobile

## Objetivo
Corrigir o release check e melhorar as abas Relatórios, Comprovantes e Logs/Diagnóstico com foco mobile-first, usuário leigo, impressão 58mm/80mm/A4, filtros, cópia para suporte e compatibilidade iPhone/Android por código.

## Comando Mestre 10/10
Aplicado com prioridade P0/P1 antes de visual. Este lote não cria módulo grande novo e não altera venda, caixa, estoque ou crediário fora do necessário para exibição, comprovantes e relatórios.

## Correções principais
- Central de avisos agora aparece com esse nome e oferece botão Sair da conta dentro da própria central.
- `npm run release:check` volta a passar.
- Aba Comprovantes ganhou filtros, botão 58mm, prévia em tela cheia, status mais seguro e comprovantes virtuais por parcela do crediário.
- Aba Relatórios ganhou ajuda contextual, botão Ver mais, copiar resumo e avisos sobre relatórios que não dependem do período.
- Aba Logs/Auditoria ganhou tela mobile própria, filtros, copiar últimos logs e copiar último erro para suporte.
- CSS mobile recebeu polimento para filtros/chips, comprovantes, logs e botões em telas estreitas.

## Testes executados
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm run release:commercial:check
- npm run release:commercial:prepare
- npm audit --audit-level=high
- node scripts/credit_payment_guard_tests.js
- node --check nos scripts editados
- validação JSON em package.json e manifest.webmanifest

## Limitações reais
Ainda precisa testar fisicamente em Android/iPhone:
- impressão 58mm;
- impressão 80mm;
- A4/PDF;
- WhatsApp/compartilhamento;
- preview em tela cheia no PWA instalado;
- logs com erro real do Supabase;
- comprovante de parcela após pagamento real.

## Versão/cache
- WEB_APP_VERSION: pwa-supabase-v158-relatorios-comprovantes-logs
- WEB_CACHE_VERSION: smart-loja-pwa-supabase-v158-relatorios-comprovantes-logs

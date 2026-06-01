# Mega Lote 58 — Micro polimento clássico Web/Mobile

## Objetivo
Corrigir o visual clássico Windows 7/Delphi/WinForms aplicado no lote anterior, removendo sobreposições da tela inicial e refinando hierarquia, respiro, densidade e rolagem no PWA web e mobile.

## Ajustes principais
- Corrigido o fluxo da tela de entrada: o card principal agora usa layout em bloco, sem sobrepor hero, resumo, recursos e rodapé.
- Reduzido o peso visual da landing, mantendo a paleta clara clássica solicitada.
- Melhorada a hierarquia do hero: título, subtítulo, CTA, nota de segurança e ilustração com espaçamento previsível.
- Ajustado o mobile da landing para evitar textos gigantes, cards colados e cortes laterais.
- Contrato de rolagem desktop reforçado: shell fixo em 100dvh, sidebar com rolagem própria e conteúdo principal rolando no painel correto.
- Dashboard recebeu mais respiro, cards mais equilibrados e status/chips com melhor leitura.
- Micro acabamento global aplicado em painéis, formulários, tabelas, botões, estados, cards e modais.
- Dock mobile e header mobile ajustados para não cobrir conteúdo e manter leitura clara.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v58`.
- Versão web atualizada para `pwa-supabase-v58`.

## Arquivos alterados
- `src/styles.css`
- `public/sw.js`
- `src/lib/webApi.ts`
- `docs/MEGA_LOTE_58_MICRO_POLIMENTO_CLASSICO_WEB_MOBILE.md`

## Observação
Este lote é focado em acabamento visual/UX. Não altera regras de negócio nem migrations do Supabase.

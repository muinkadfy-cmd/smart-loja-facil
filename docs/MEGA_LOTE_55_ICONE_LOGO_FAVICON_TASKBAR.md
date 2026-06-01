# Mega Lote 55 — Ícone, Logo, Favicon e Taskbar

## Objetivo

Aplicar o pacote de identidade visual enviado pelo usuário no PWA Web, no instalável/Tauri e na interface principal do Smart Loja Fácil.

## O que foi alterado

- Favicon real em `public/favicon.ico`.
- Apple Touch Icon real em `public/apple-touch-icon.png`.
- Ícones PWA 192/512 e maskable substituídos pelos arquivos do IconKitchen.
- Manifest atualizado para usar os PNG reais e não depender mais do `logo.svg` como ícone instalável.
- Service worker atualizado para `smart-loja-pwa-supabase-v55` e cacheando os novos assets de marca.
- Versão web atualizada para `pwa-supabase-v55`.
- Ícones Tauri/Windows atualizados para melhorar taskbar, instalador e janela.
- Ícones Android/iOS atualizados com base no pacote enviado.
- Header, sidebar, topo mobile e landing/login agora usam o logo real em imagem.

## Arquivos sensíveis

Nenhum `.env`, secret, node_modules, dist ou backup real foi incluído neste lote.

## Observação

Depois do deploy, pode ser necessário limpar cache/atalho antigo no celular ou aceitar a atualização do PWA para ver o novo ícone. No Windows, a taskbar pode manter cache antigo; se isso acontecer, feche o app, desfixe/fixe novamente ou reinstale o pacote gerado.

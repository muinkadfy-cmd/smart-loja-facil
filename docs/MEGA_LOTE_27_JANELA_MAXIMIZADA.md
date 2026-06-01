# MEGA LOTE 27 — Abrir sistema em janela maximizada

## Objetivo
Fazer o Smart Loja Fácil abrir em janela maximizada no Windows, sem usar fullscreen travado.

## O que foi alterado
- `src-tauri/tauri.conf.json`: adicionado `maximized: true` na janela principal.
- `src-tauri/src/main.rs`: no setup do Tauri, a janela principal é maximizada e recebe foco ao iniciar.

## Observação
Foi usado maximizado, não fullscreen exclusivo. Assim o sistema abre ocupando a tela, mas mantém comportamento normal de janela do Windows.

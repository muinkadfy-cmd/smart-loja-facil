# Mega Lote 110 — Dashboard Rescue + micro ajuste universal

## Objetivo
Corrigir os problemas vistos no print real após o Lote 109:
- cards do Dashboard cortando valores no desktop;
- status do sistema quebrando texto na vertical;
- versão grande poluindo a sidebar;
- topbar e cards com pouco respiro;
- manter o botão de atualizar/limpar cache e aviso de nova versão.

## O que foi feito
- Criada camada `src/styles/lote110-dashboard-rescue.css`.
- Cards KPI agora usam grid mais seguro para valores e ícones.
- Sidebar ganhou versão compacta legível.
- Status do sistema recebeu grid seguro para impedir texto vertical.
- Topbar recebeu ajustes de largura, respiro e truncamento controlado.
- Context cards e dashboard grid ficaram mais estáveis em desktop/tablet/mobile.
- Mobile continua priorizado: blocos pesados seguem ocultos no celular para leitura rápida.

## Versionamento
- App: `pwa-supabase-v110-dashboard-rescue`
- Cache: `smart-loja-pwa-supabase-v110-dashboard-rescue`
- Outbox: preservado para não arriscar pendências locais antigas.

## Segurança
Não altera Supabase, tabelas, dados, vendas, clientes, produtos, caixa ou crediário.

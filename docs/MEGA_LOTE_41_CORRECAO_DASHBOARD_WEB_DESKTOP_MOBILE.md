# Mega Lote 41 - Correção do Dashboard Web/Desktop/Mobile

## Motivo
Após aplicar o lote anterior, o print mostrou três problemas importantes:
- no modo web/localhost, o Dashboard ainda abria como tela de módulo em migração;
- topo/ações ficaram altos e criaram sobra visual antes do conteúdo;
- sidebar exibiu scrollbar branca e pesada, quebrando acabamento premium.

## O que foi corrigido
- `App.tsx`: no runtime Web/Cloudflare, a página Dashboard agora renderiza o Dashboard visual premium, em vez da tela de migração.
- `styles.css`: refinamento do header, action ribbon, chips de status, grids e sidebar.
- `public/sw.js`: cache atualizado para o celular puxar a versão nova.

## Resultado esperado
- Dashboard aparece no web/desktop e no mobile.
- Topo fica mais compacto.
- Status lateral não invade/corta fora da tela.
- Sidebar fica mais premium, com scrollbar discreta.
- Web continua parecendo uma versão expandida do mobile.

## Limitações
Os demais módulos ainda podem permanecer em tela de migração no modo Web/Supabase até serem migrados para Supabase real. Isso evita dados falsos e perda de dados.

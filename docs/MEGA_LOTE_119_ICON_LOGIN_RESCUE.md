# Mega Lote 119 — Icon/Login Rescue após CSS Foundation

## Diagnóstico
Depois da limpeza física/controlada do CSS antigo, o login perdeu regras essenciais que antes limitavam `.app-svg-icon`. O componente `AppIcon` usa um `<span>` com `style width/height`, mas por padrão `span` é inline e pode ignorar essas dimensões. Como o SVG interno usa `width="100%" height="100%"`, o logo ocupou a tela inteira.

## Correção
- Criada camada `src/styles/lote119-icon-login-rescue.css`.
- Recriada regra base de `.app-svg-icon` com `display: inline-grid`, largura/altura respeitadas e SVG limitado ao container.
- Recriada estrutura mínima do login sem depender dos CSS antigos.
- Atualizada versão/cache para forçar limpeza no PWA.

## Resultado esperado
- Logo volta a 64px no login.
- Ícones do sistema ficam controlados.
- Login fica centralizado e utilizável.
- Nenhuma regra de dados/Supabase foi alterada.

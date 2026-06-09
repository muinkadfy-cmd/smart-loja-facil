# Mega Lote 195 — Avisos Responsivos + Comprovante Sem Texto/Link

## Objetivo
Corrigir a Central de Avisos no mobile para que as notificações fiquem visíveis e padronizar os comprovantes de atividades recentes/vendas recentes para compartilhar somente arquivo PNG ou PDF, sem mensagem, palavras ou link junto.

## Entregas
- Central de Avisos mais responsiva e organizada no celular.
- Painel de alertas externos compactado para liberar espaço para notificações.
- Lista de notificações com altura mínima visível.
- Botões da central mais compactos e hierarquia melhor.
- Compartilhamento de comprovantes somente com `files`, sem `text` e sem `url`.
- Ajuste no comprovante do crediário para evitar ícones virando traço.
- Micro ajuste no layout PNG/PDF do extrato.
- Atividades recentes e vendas recentes mantêm PDF/PNG/Compartilhar com arquivo anexo.
- Cache/PWA atualizado para v195.

## Testes
- `npm run type-check`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Observação
O Web Share do Android/Chrome pode variar por aparelho, mas o payload agora envia apenas arquivos, sem texto e sem link.

# Mega Lote 190 — Cupom Pixel Fiel

## Objetivo
Refazer a aba de cupom com base fiel na arte enviada pelo cliente, exportando PNG 1080x1350 sem corte no rodapé.

## Entregas
- Nova aba **Cupom** no app mobile/PWA.
- Template baseado na arte original enviada, copiada para `public/coupons/cupom-jaque-otica-base.png`.
- Sobreposição dinâmica de desconto, nome do cliente e código do cupom.
- Botões **Baixar PNG** e **Compartilhar PNG**.
- Descontos rápidos 10/20/30/50.
- Safe area visual do rodapé travada.
- Atalho no Dashboard e shortcut do manifest para abrir a aba de cupom.
- Cache do PWA atualizado para v190.

## Arquivos principais
- `src/mobile-app/screens/CouponScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/mobile-app/mobileAppRoutes.ts`
- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/screens/DashboardScreen.tsx`
- `src/mobile-app/deepLinks.ts`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `public/coupons/cupom-jaque-otica-base.png`

## Observações
- O preview visual usa a arte base original para fidelidade máxima.
- O PNG final é desenhado em canvas para garantir 1080x1350 e evitar corte.
- Em navegadores sem compartilhamento de arquivos, o app faz fallback para download do PNG.

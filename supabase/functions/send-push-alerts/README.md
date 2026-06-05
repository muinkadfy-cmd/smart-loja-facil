# send-push-alerts

Rotina de nuvem para enviar alertas externos do PWA.

## Secrets necessários

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_SUBJECT` — exemplo: `mailto:contato@sualoja.com`
- `VAPID_PUBLIC_KEY` — mesma chave pública colocada no Cloudflare como `VITE_WEB_PUSH_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` — somente na Supabase Function, nunca no frontend

## Deploy

```bash
supabase functions deploy send-push-alerts --no-verify-jwt
```

## Agendamento

Chamar por cron diariamente, por exemplo 08:00, para avisar parcelas vencidas/vencendo.

# BulkSMSBD Edge Function

`bulksmsbd/index.ts` is an optional secure proxy for the official BulkSMSBD API.
The desktop app's wallet ledger stays local (the app authenticates users
locally); this function only keeps the **provider API key and Sender ID** in
Supabase Edge Function Secrets and performs the real provider HTTP calls.

## Deploy

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set \
  BULKSMSBD_API_KEY=your-provider-api-key \
  BULKSMSBD_SENDER_ID=8809612xxxxxx \
  SMS_GATEWAY_TOKEN=<long-random-token> \
  BULKSMSBD_GATEWAY_URL=https://bulksmsbd.net/api/smsapi \
  BULKSMSBD_BALANCE_URL=https://bulksmsbd.net/api/getBalanceApi

supabase functions deploy bulksmsbd --no-verify-jwt
```

`BULKSMSBD_DLR_URL` is optional. Set it only if the provider has enabled a
delivery-report endpoint for the account; otherwise use the Super Admin SMS Log
manual Delivered/Failed controls.

## Desktop configuration

Set these two environment variables on the machine running the app, then restart
the app:

```bat
setx SMS_EDGE_URL "https://<project-ref>.supabase.co/functions/v1/bulksmsbd"
setx SMS_EDGE_TOKEN "<the same long random token>"
```

When `SMS_EDGE_URL` is present, the main process routes **send, balance and DLR**
through the Edge Function. The provider API key is never sent to the desktop,
the renderer, the SQLite database, logs or the SMS history.

## Contract

All requests are `POST` with `Authorization: Bearer $SMS_GATEWAY_TOKEN`:

```json
{ "action": "send",    "provider": "bulksmsbd", "to": "8801712345678", "message": "Hello", "type": "text" }
{ "action": "balance", "provider": "bulksmsbd" }
{ "action": "dlr",     "provider": "bulksmsbd", "sms_id": "provider-id" }
```

Responses are normalized. `response_code: "202"` means **submitted**, not
delivered:

```json
{ "ok": true, "response_code": "202", "status": "submitted", "provider_message_id": "...", "raw": "..." }
{ "ok": false, "error": "1007: Provider balance is insufficient" }
```

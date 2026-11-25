// ============================================================================
// Supabase Edge Function — BulkSMSBD secure gateway proxy
//
// WHY THIS EXISTS
//   The desktop app is offline-first and authenticates users locally. Therefore
//   its provider credentials must not be shipped inside the installer. When this
//   function is configured, the Electron main process sends only an authorized,
//   wallet-neutral payload here; the real BulkSMSBD API key and Sender ID live
//   in Supabase Edge Function Secrets.
//
// REQUIRED SUPABASE SECRETS (Dashboard → Edge Functions → Secrets)
//   BULKSMSBD_API_KEY          provider API key (secret)
//   BULKSMSBD_SENDER_ID        approved sender/mask (secret)
//   SMS_GATEWAY_TOKEN          long random token shared with the desktop app
//   BULKSMSBD_GATEWAY_URL      optional, default https://bulksmsbd.net/api/smsapi
//   BULKSMSBD_BALANCE_URL      optional, default https://bulksmsbd.net/api/getBalanceApi
//   BULKSMSBD_DLR_URL          optional, delivery-report endpoint (if enabled)
//
// DESKTOP ENVIRONMENT
//   SMS_EDGE_URL=https://<project-ref>.supabase.co/functions/v1/bulksmsbd
//   SMS_EDGE_TOKEN=<same random token>
//
// The function is intentionally standalone (no imports) so it can be deployed
// with the Supabase CLI without an import map.
// ============================================================================

const GATEWAY_URL = Deno.env.get('BULKSMSBD_GATEWAY_URL') || 'https://bulksmsbd.net/api/smsapi'
const BALANCE_URL = Deno.env.get('BULKSMSBD_BALANCE_URL') || 'https://bulksmsbd.net/api/getBalanceApi'
const DLR_URL = Deno.env.get('BULKSMSBD_DLR_URL') || ''
const API_KEY = Deno.env.get('BULKSMSBD_API_KEY') || ''
const SENDER_ID = Deno.env.get('BULKSMSBD_SENDER_ID') || ''
const GATEWAY_TOKEN = Deno.env.get('SMS_GATEWAY_TOKEN') || ''
const TIMEOUT_MS = Math.min(60_000, Math.max(1_000, Number(Deno.env.get('BULKSMSBD_TIMEOUT_MS') || 15_000)))

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-sms-token, content-type',
  'access-control-allow-methods': 'POST, OPTIONS'
}

const RESPONSE_TEXT: Record<string, string> = {
  '202': 'SMS Submitted Successfully',
  '1002': 'Sender ID is not correct or is disabled',
  '1003': 'Required fields are missing',
  '1005': 'Provider internal error',
  '1006': 'Balance validity is not available',
  '1007': 'Provider balance is insufficient',
  '1011': 'API user was not found',
  '1012': 'Masking SMS must be sent in Bengali',
  '1013': 'Sender ID was not found for this API key',
  '1014': 'Sender type was not found for this API key',
  '1015': 'No valid gateway found for this sender',
  '1016': 'Active price info was not found for this sender',
  '1017': 'Price info was not found for this sender',
  '1018': 'The provider account is disabled',
  '1019': 'The price for this sender is disabled',
  '1020': 'The parent provider account was not found',
  '1021': 'The parent price for this sender was not found',
  '1031': 'The provider account is not verified',
  '1032': 'This IP is not whitelisted by the provider'
}

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS }
  })
}

// Constant-time-ish comparison; avoids early length leak for identical lengths.
function tokenMatches(provided: string): boolean {
  if (!GATEWAY_TOKEN || provided.length !== GATEWAY_TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < GATEWAY_TOKEN.length; i++) diff |= GATEWAY_TOKEN.charCodeAt(i) ^ provided.charCodeAt(i)
  return diff === 0
}

function redact(text: string): string {
  let out = String(text || '')
  if (API_KEY.length >= 4) out = out.split(API_KEY).join('[redacted]')
  try { if (API_KEY.length >= 4) out = out.split(encodeURIComponent(API_KEY)).join('[redacted]') } catch { /* ignore */ }
  if (GATEWAY_TOKEN.length >= 4) out = out.split(GATEWAY_TOKEN).join('[redacted]')
  return out
}

function normalizeRecipient(raw: unknown): string {
  const value = String(raw ?? '')
  if (!value || value.length > 30) throw new Error('INVALID_RECIPIENT')
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits
  if (digits.length === 11 && digits.startsWith('01')) digits = '88' + digits
  if (digits.length === 13 && digits.startsWith('8801')) return digits
  throw new Error('INVALID_RECIPIENT')
}

const GSM_BASE = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXT = '^{}\\[~]|€'
const GSM_CHARS = new Set<string>([...GSM_BASE, ...GSM_EXT])

function smsEncoding(text: string): 'text' | 'unicode' {
  return Array.from(text).every((c) => GSM_CHARS.has(c)) ? 'text' : 'unicode'
}

function providerId(json: any): string | null {
  if (!json || typeof json !== 'object') return null
  const candidates = [
    json.message_id, json.sms_id, json.request_id, json.id,
    json.data?.request_id, json.data?.id, json.data?.message_id,
    Array.isArray(json.smsinfo) ? json.smsinfo[0]?.sms_id : null,
    Array.isArray(json.data) ? json.data[0]?.id : null
  ]
  for (const c of candidates) if (c !== undefined && c !== null && String(c).trim() !== '') return String(c)
  return null
}

function errorText(code: unknown, fallback = ''): string {
  const key = String(code ?? '').trim()
  const known = RESPONSE_TEXT[key]
  if (known) return `${key}: ${known}`
  return fallback || (key ? `${key}: provider rejected the SMS request` : 'Provider rejected the SMS request')
}

async function providerRequest(url: string, params: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<{ text: string; json: any }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let res: Response
    if (method === 'GET') {
      const target = new URL(url)
      for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v)
      res = await fetch(target.toString(), { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal })
    } else {
      res = await fetch(url, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
        signal: controller.signal
      })
    }
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* provider may return text */ }
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(text.slice(0, 180))}`)
    return { text: redact(text), json }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('SMS_GATEWAY_TIMEOUT')
    throw new Error(redact(String(err?.message || err).slice(0, 300)))
  } finally {
    clearTimeout(timer)
  }
}

async function sendOne(to: string, message: string, type: string) {
  if (!API_KEY) throw new Error('BULKSMSBD_API_KEY_MISSING')
  if (!SENDER_ID) throw new Error('BULKSMSBD_SENDER_ID_MISSING')
  const { text, json } = await providerRequest(GATEWAY_URL, {
    api_key: API_KEY,
    senderid: SENDER_ID,
    number: to,
    message,
    type
  })
  const code = json?.response_code ?? json?.status
  const providerError = String(json?.error_message ?? '').trim()
  const ok = String(code) === '202' && !providerError
  if (!ok) return { ok: false, error: errorText(code, providerError || text.slice(0, 180)), raw: text.slice(0, 500) }
  return {
    ok: true,
    response_code: '202',
    status: 'submitted', // 202 means submitted, never delivered
    provider_message_id: providerId(json),
    raw: text.slice(0, 500)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  const auth = req.headers.get('authorization') || ''
  const provided = (auth.startsWith('Bearer ') ? auth.slice(7) : req.headers.get('x-sms-token') || '').trim()
  if (!tokenMatches(provided)) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)

  let body: any
  try { body = await req.json() } catch { return reply({ ok: false, error: 'INVALID_JSON' }, 400) }
  const action = String(body?.action || '')

  try {
    if (action === 'send') {
      if (String(body?.provider || '') !== 'bulksmsbd') return reply({ ok: false, error: 'UNSUPPORTED_PROVIDER' }, 400)
      const to = normalizeRecipient(body?.to)
      const message = String(body?.message ?? '')
      if (!message.trim()) return reply({ ok: false, error: 'SMS_MESSAGE_EMPTY' }, 400)
      if (message.length > 2000) return reply({ ok: false, error: 'SMS_MESSAGE_TOO_LONG' }, 400)
      const type = body?.type === 'unicode' ? 'unicode' : smsEncoding(message)
      return reply(await sendOne(to, message, type))
    }

    if (action === 'bulk') {
      if (String(body?.provider || '') !== 'bulksmsbd') return reply({ ok: false, error: 'UNSUPPORTED_PROVIDER' }, 400)
      const messages = Array.isArray(body?.messages) ? body.messages : []
      if (!messages.length || messages.length > 100) return reply({ ok: false, error: 'INVALID_BULK_MESSAGES' }, 400)
      const normalized = messages.map((m: any) => {
        const to = normalizeRecipient(m?.to)
        const message = String(m?.message ?? '')
        if (!message.trim() || message.length > 2000) throw new Error('INVALID_BULK_MESSAGE')
        return { to, message }
      })
      const manyUrl = GATEWAY_URL.replace(/\/smsapi\/?$/i, '/smsapimany')
      const { text, json } = await providerRequest(manyUrl, {
        api_key: API_KEY,
        senderid: SENDER_ID,
        messages: JSON.stringify(normalized)
      })
      const code = json?.response_code ?? json?.status
      const providerError = String(json?.error_message ?? '').trim()
      const ok = String(code) === '202' && !providerError
      if (!ok) return reply({ ok: false, error: errorText(code, providerError || text.slice(0, 180)), raw: text.slice(0, 500) })
      return reply({ ok: true, response_code: '202', status: 'submitted', provider_message_id: providerId(json), raw: text.slice(0, 500) })
    }

    if (action === 'balance') {
      if (!API_KEY) return reply({ ok: false, error: 'BULKSMSBD_API_KEY_MISSING' }, 400)
      const { text, json } = await providerRequest(BALANCE_URL, { api_key: API_KEY }, 'GET')
      const smsValue = json?.sms_balance ?? json?.data?.sms_balance ?? json?.sms_count ?? json?.total_sms ?? json?.remaining_sms
      const value = smsValue ?? json?.balance ?? json?.data?.balance ?? json?.remaining_balance
      let parsed = value
      if (parsed === undefined || parsed === null) {
        const m = text.match(/(?:balance|remaining)[^0-9-]*(-?\d+(?:\.\d+)?)/i) || text.match(/^\s*(-?\d+(?:\.\d+)?)\s*$/i)
        parsed = m ? m[1] : undefined
      }
      const balance = Number(parsed)
      if (parsed === undefined || parsed === null || !Number.isFinite(balance)) {
        return reply({ ok: false, error: 'SMS_BALANCE_RESPONSE_INVALID', raw: text.slice(0, 300) })
      }
      return reply({ ok: true, balance, unit: smsValue !== undefined && smsValue !== null ? 'sms' : 'currency', raw: text.slice(0, 500) })
    }

    if (action === 'dlr') {
      if (!DLR_URL) return reply({ ok: false, error: 'SMS_DLR_URL_MISSING' }, 400)
      if (!API_KEY) return reply({ ok: false, error: 'BULKSMSBD_API_KEY_MISSING' }, 400)
      const smsId = String(body?.sms_id || '').trim()
      if (!smsId) return reply({ ok: false, error: 'SMS_PROVIDER_ID_MISSING' }, 400)
      const { text, json } = await providerRequest(DLR_URL, { api_key: API_KEY, sms_id: smsId }, 'GET')
      const providerStatus = json?.status ?? json?.delivery_status ?? json?.sms_status ?? json?.data?.status ?? json?.response ?? null
      return reply({ ok: true, provider_status: providerStatus == null ? null : String(providerStatus).slice(0, 80), raw: text.slice(0, 500) })
    }

    return reply({ ok: false, error: 'UNKNOWN_ACTION' }, 400)
  } catch (err: any) {
    return reply({ ok: false, error: redact(String(err?.message || err).slice(0, 300)) }, 200)
  }
})

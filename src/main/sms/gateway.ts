// ============================================================================
// SMS GATEWAY ADAPTER — runs ONLY in the Electron main process.
//
// Secrets are read from the server environment and never leave this module:
//   SMS_PROVIDER        generic | bulksmsbd | smsnetbd | sslwireless
//   SMS_GATEWAY_URL     provider endpoint
//   SMS_SENDER_ID       approved sender / mask
//   SMS_API_KEY         API key / token
//   SMS_API_SECRET      optional API secret
//   SMS_ENABLED         1/0 (optional override)
//   SMS_REFUND_ON_FAILED 1/0 (optional override)
//   SMS_TIMEOUT_MS      request timeout (default 15000)
//   SMS_BALANCE_URL     BulkSMSBD balance endpoint (default getBalanceApi)
//   SMS_DLR_URL         delivery-report endpoint (default deliveryReportApi)
//   SMS_LOW_BALANCE_THRESHOLD  in-app warning threshold (default 20)
//
// The Super Admin can store provider/url/sender/policy in the installation DB,
// but the API key/secret are ENV-ONLY and are never returned to the renderer.
// ============================================================================

export const BULKSMSBD_DEFAULT_GATEWAY = 'https://bulksmsbd.net/api/smsapi'
export const BULKSMSBD_DEFAULT_BALANCE = 'https://bulksmsbd.net/api/getBalanceApi'
export const BULKSMSBD_DEFAULT_DLR = 'https://bulksmsbd.net/api/deliveryReportApi'

export const SMS_PROVIDERS = ['generic', 'bulksmsbd', 'smsnetbd', 'sslwireless'] as const
export type SmsProvider = typeof SMS_PROVIDERS[number]

export interface SmsGatewayConfig {
  provider: SmsProvider
  gatewayUrl: string
  balanceUrl: string
  dlrUrl: string
  senderId: string
  apiKey: string
  apiSecret: string
  enabled: boolean
  refundOnFailed: boolean
  lowBalanceThreshold: number
  timeoutMs: number
  // Optional Supabase Edge Function proxy. When set, the provider API key and
  // sender ID live in Supabase Edge Function Secrets and never in the desktop
  // environment. The Electron main process still owns every wallet decision.
  edgeUrl: string
  edgeToken: string
  env: {
    provider: boolean
    gatewayUrl: boolean
    balanceUrl: boolean
    dlrUrl: boolean
    senderId: boolean
    enabled: boolean
    refundOnFailed: boolean
    lowBalanceThreshold: boolean
    edgeUrl: boolean
    edgeToken: boolean
  }
}

export interface SmsSendResult {
  providerMessageId: string | null
  status: 'sent' | 'pending'
  raw: string
  provider: SmsProvider
  encoding: 'text' | 'unicode'
  requestId: string
}

export interface SmsBulkMessage {
  to: string
  message: string
}

export interface SmsBulkSendResult {
  providerMessageId: string | null
  status: 'sent'
  raw: string
  provider: SmsProvider
  requestId: string
  accepted: number
}

const GSM_BASE = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXT = '^{}\\[~]|€'
const GSM_CHARS = new Set<string>([...GSM_BASE, ...GSM_EXT])
const GSM_EXT_CHARS = new Set<string>([...GSM_EXT])

// Accurate billable segment count for the two encodings every gateway uses.
// GSM extension characters ({ } [ ] ~ | ^ \\ €) consume two septets.
export function countSmsSegments(text: string): number {
  const value = String(text ?? '')
  if (!value.length) return 0
  const chars = Array.from(value)
  const gsm = chars.every((c) => GSM_CHARS.has(c))
  if (gsm) {
    const septets = chars.reduce((n, c) => n + (GSM_EXT_CHARS.has(c) ? 2 : 1), 0)
    return septets <= 160 ? 1 : Math.ceil(septets / 153)
  }
  // UCS-2 counts UTF-16 code units (an emoji is a surrogate pair = 2 units).
  return value.length <= 70 ? 1 : Math.ceil(value.length / 67)
}

// BulkSMSBD expects type=text for GSM and type=unicode for Bangla/other scripts.
export function smsEncoding(text: string): 'text' | 'unicode' {
  return Array.from(String(text ?? '')).every((c) => GSM_CHARS.has(c)) ? 'text' : 'unicode'
}

// Normalize a Bangladesh mobile number to 8801XXXXXXXXX. Rejects anything that
// cannot be a real mobile number — no silent junk sends.
export function normalizeRecipient(raw: string): string {
  const rawText = String(raw ?? '')
  if (!rawText || rawText.length > 30) throw new Error('INVALID_RECIPIENT')
  let digits = rawText.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits
  if (digits.length === 11 && digits.startsWith('01')) digits = '88' + digits
  if (digits.length === 13 && digits.startsWith('8801')) return digits
  throw new Error('INVALID_RECIPIENT')
}

function envBoolean(name: string): boolean | undefined {
  const v = process.env[name]
  if (v === undefined || String(v).trim() === '') return undefined
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase())
}

function envString(name: string): string | undefined {
  const v = process.env[name]
  if (v === undefined) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

export function envConfig(): {
  provider?: SmsProvider
  gatewayUrl?: string
  balanceUrl?: string
  dlrUrl?: string
  senderId?: string
  enabled?: boolean
  refundOnFailed?: boolean
  lowBalanceThreshold?: number
  apiKey: string
  apiSecret: string
  edgeUrl?: string
  edgeToken: string
  timeoutMs: number
} {
  const providerRaw = envString('SMS_PROVIDER')
  const provider = providerRaw && (SMS_PROVIDERS as readonly string[]).includes(providerRaw)
    ? providerRaw as SmsProvider
    : undefined
  const timeout = Number(envString('SMS_TIMEOUT_MS') || 15000)
  const thresholdText = envString('SMS_LOW_BALANCE_THRESHOLD')
  const thresholdRaw = thresholdText === undefined ? undefined : Number(thresholdText)
  return {
    provider,
    gatewayUrl: envString('SMS_GATEWAY_URL'),
    balanceUrl: envString('SMS_BALANCE_URL'),
    dlrUrl: envString('SMS_DLR_URL'),
    senderId: envString('SMS_SENDER_ID'),
    enabled: envBoolean('SMS_ENABLED'),
    refundOnFailed: envBoolean('SMS_REFUND_ON_FAILED'),
    lowBalanceThreshold: thresholdRaw !== undefined && Number.isFinite(thresholdRaw) && thresholdRaw >= 0 ? Math.min(Math.trunc(thresholdRaw), 1_000_000) : undefined,
    apiKey: envString('SMS_API_KEY') || '',
    apiSecret: envString('SMS_API_SECRET') || '',
    edgeUrl: envString('SMS_EDGE_URL'),
    edgeToken: envString('SMS_EDGE_TOKEN') || '',
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 ? Math.min(timeout, 60_000) : 15000
  }
}

// Edge routing is all-or-nothing: never silently fall back to a local key when
// the Super Admin configured a secure proxy.
export function viaEdge(cfg: SmsGatewayConfig): boolean {
  return !!cfg.edgeUrl
}

export function isGatewayConfigured(cfg: SmsGatewayConfig): boolean {
  if (!cfg.enabled || !cfg.provider) return false
  if (viaEdge(cfg)) return !!(cfg.edgeUrl && cfg.edgeToken)
  return !!(cfg.gatewayUrl && cfg.senderId && cfg.apiKey)
}

export function configError(cfg: SmsGatewayConfig): string {
  if (!cfg.enabled) return 'SMS_GATEWAY_DISABLED'
  if (!cfg.provider) return 'SMS_PROVIDER_INVALID'
  if (viaEdge(cfg)) {
    if (!isHttpUrl(cfg.edgeUrl)) return 'SMS_EDGE_URL_INVALID'
    if (!cfg.edgeToken) return 'SMS_EDGE_TOKEN_MISSING'
    if (cfg.provider !== 'bulksmsbd') return 'SMS_EDGE_PROVIDER_UNSUPPORTED'
    return ''
  }
  if (!cfg.gatewayUrl) return 'SMS_GATEWAY_URL_MISSING'
  if (!isHttpUrl(cfg.gatewayUrl)) return 'SMS_GATEWAY_URL_INVALID'
  if (!cfg.senderId) return 'SMS_SENDER_ID_MISSING'
  if (!cfg.apiKey) return 'SMS_API_KEY_MISSING'
  return ''
}

// BulkSMSBD response codes (official API documentation). 202 means SUBMITTED —
// never treat it as delivered.
export const BULKSMSBD_RESPONSE: Record<string, string> = {
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

export function bulksmsbdError(code: unknown, fallback = ''): string {
  const key = String(code ?? '').trim()
  const known = BULKSMSBD_RESPONSE[key]
  if (known) return `${key}: ${known}`
  return fallback || (key ? `${key}: provider rejected the SMS request` : 'Provider rejected the SMS request')
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
  } catch {
    return false
  }
}

async function httpJson(url: string, init: RequestInit, timeoutMs: number): Promise<{ res: Response; text: string; json: any }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* non-JSON gateway response */ }
    return { res, text, json }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('SMS_GATEWAY_TIMEOUT')
    throw new Error('SMS_GATEWAY_NETWORK_ERROR: ' + String(err?.message || err).slice(0, 180))
  } finally {
    clearTimeout(timer)
  }
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

// Provider responses can echo request parameters. Never let an API key/secret
// reach an error message, the UI, the SMS history table or the audit log.
function redact(cfg: SmsGatewayConfig, text: string): string {
  let out = String(text || '')
  for (const secret of [cfg.apiKey, cfg.apiSecret, cfg.edgeToken]) {
    if (!secret || secret.length < 4) continue
    out = out.split(secret).join('[redacted]')
    try { out = out.split(encodeURIComponent(secret)).join('[redacted]') } catch { /* ignore */ }
  }
  return out
}

interface EdgeEnvelope {
  ok?: boolean
  status?: string
  response_code?: string | number
  provider_message_id?: string | null
  balance?: number | string
  unit?: 'sms' | 'currency'
  provider_status?: string | null
  raw?: string
  error?: string
}

// Call the optional Supabase Edge Function proxy. The function holds the real
// provider credentials in Supabase secrets; this request only carries a scoped
// installation token plus the already-authorized wallet-neutral payload.
async function edgeRequest(cfg: SmsGatewayConfig, action: string, payload: Record<string, unknown>): Promise<EdgeEnvelope> {
  if (!cfg.edgeUrl) throw new Error('SMS_EDGE_URL_MISSING')
  if (!cfg.edgeToken) throw new Error('SMS_EDGE_TOKEN_MISSING')
  const { res, text, json } = await httpJson(cfg.edgeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${cfg.edgeToken}`,
      'x-sms-token': cfg.edgeToken
    },
    body: JSON.stringify({ action, ...payload })
  }, cfg.timeoutMs)
  if (!res.ok) throw new Error(`SMS_EDGE_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
  if (!json || typeof json !== 'object') throw new Error('SMS_EDGE_RESPONSE_INVALID')
  if (json.ok === false) throw new Error('SMS_GATEWAY_REJECTED: ' + redact(cfg, String(json.error || text).slice(0, 200)))
  return json as EdgeEnvelope
}

export interface SmsGatewayBalance {
  balance: number
  // BulkSMSBD returns a monetary credit balance; some compatible gateways
  // return an SMS count. The preflight uses the correct unit, never mixes them.
  unit: 'sms' | 'currency'
  raw: string
  provider: SmsProvider
  checkedAt: string
}

export interface SmsDeliveryReport {
  status: 'delivered' | 'failed' | 'sent' | 'pending'
  providerStatus: string | null
  raw: string
}

// BulkSMSBD Balance Check API (also works for compatible providers).
export async function fetchGatewayBalance(cfg: SmsGatewayConfig): Promise<SmsGatewayBalance> {
  try {
    if (viaEdge(cfg)) {
      const json = await edgeRequest(cfg, 'balance', { provider: cfg.provider })
      const value = json.balance
      const balance = Number(value)
      if (value === undefined || value === null || !Number.isFinite(balance)) throw new Error('SMS_BALANCE_RESPONSE_INVALID')
      return {
        balance,
        unit: json.unit === 'sms' ? 'sms' : 'currency',
        raw: redact(cfg, String(json.raw || '').slice(0, 500)),
        provider: cfg.provider,
        checkedAt: new Date().toISOString()
      }
    }
    if (!cfg.apiKey) throw new Error('SMS_API_KEY_MISSING')
    if (!cfg.balanceUrl) throw new Error('SMS_BALANCE_URL_MISSING')
    if (!isHttpUrl(cfg.balanceUrl)) throw new Error('SMS_BALANCE_URL_INVALID')
    const url = new URL(cfg.balanceUrl)
    url.searchParams.set('api_key', cfg.apiKey)
    const { res, text, json } = await httpJson(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' }
    }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    const raw = redact(cfg, text.slice(0, 500))
    const smsValue = json?.sms_balance ?? json?.data?.sms_balance ?? json?.sms_count ?? json?.total_sms ?? json?.remaining_sms
    const value = smsValue ?? json?.balance ?? json?.data?.balance ?? json?.remaining_balance
    let parsed = value
    if (parsed === undefined || parsed === null) {
      const m = text.match(/(?:balance|remaining)[^0-9-]*(-?\d+(?:\.\d+)?)/i) || text.match(/^\s*(-?\d+(?:\.\d+)?)\s*$/i)
      parsed = m ? m[1] : undefined
    }
    const balance = Number(parsed)
    if (parsed === undefined || parsed === null || !Number.isFinite(balance)) {
      throw new Error('SMS_BALANCE_RESPONSE_INVALID: ' + raw.slice(0, 180))
    }
    return {
      balance,
      unit: smsValue !== undefined && smsValue !== null ? 'sms' : 'currency',
      raw,
      provider: cfg.provider,
      checkedAt: new Date().toISOString()
    }
  } catch (err: any) {
    throw new Error(redact(cfg, String(err?.message || err).slice(0, 300)))
  }
}

// BulkSMSBD Delivery Report API. The URL is configurable so a provider-specific
// endpoint path can be used without touching code.
export async function fetchDeliveryReport(cfg: SmsGatewayConfig, providerMessageId: string): Promise<SmsDeliveryReport> {
  try {
    const smsId = String(providerMessageId || '').trim()
    if (!smsId) throw new Error('SMS_PROVIDER_ID_MISSING')
    if (viaEdge(cfg)) {
      const json = await edgeRequest(cfg, 'dlr', { provider: cfg.provider, sms_id: smsId })
      const s = String(json.provider_status ?? json.status ?? '').toLowerCase()
      let status: SmsDeliveryReport['status'] = 'pending'
      if (/deliver/.test(s) || s === 'success' || s === 'successful') status = 'delivered'
      else if (/fail|reject|undeliver|expire|error|cancel/.test(s)) status = 'failed'
      else if (/sent|submit|accept|queue|process/.test(s)) status = 'sent'
      return { status, providerStatus: json.provider_status == null ? null : String(json.provider_status).slice(0, 80), raw: redact(cfg, String(json.raw || '').slice(0, 500)) }
    }
    if (!cfg.apiKey) throw new Error('SMS_API_KEY_MISSING')
    if (!cfg.dlrUrl) throw new Error('SMS_DLR_URL_MISSING')
    if (!isHttpUrl(cfg.dlrUrl)) throw new Error('SMS_DLR_URL_INVALID')
    const url = new URL(cfg.dlrUrl)
    url.searchParams.set('api_key', cfg.apiKey)
    url.searchParams.set('sms_id', smsId)
    const { res, text, json } = await httpJson(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' }
    }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    const raw = redact(cfg, text.slice(0, 500))
    const providerStatus = json?.status ?? json?.delivery_status ?? json?.sms_status ?? json?.data?.status ?? json?.response ?? null
    const s = String(providerStatus ?? text ?? '').toLowerCase()
    let status: SmsDeliveryReport['status'] = 'pending'
    if (/deliver|delivr/.test(s) || s === 'success' || s === 'successful') status = 'delivered'
    else if (/fail|reject|undeliver|undeliv|expire|error|cancel/.test(s)) status = 'failed'
    else if (/sent|submit|accept|queue|process/.test(s)) status = 'sent'
    return { status, providerStatus: providerStatus == null ? null : String(providerStatus).slice(0, 80), raw }
  } catch (err: any) {
    throw new Error(redact(cfg, String(err?.message || err).slice(0, 300)))
  }
}

// Personalized bulk endpoint (BulkSMSBD smsapimany). Every item is normalized
// and the whole batch is accepted/rejected as one provider request, so the
// caller records one message row per recipient with the same batch response.
export async function sendBulkViaGateway(
  cfg: SmsGatewayConfig,
  messages: SmsBulkMessage[],
  reference: string
): Promise<SmsBulkSendResult> {
  try {
    const err = configError(cfg)
    if (err) throw new Error(err)
    if (!Array.isArray(messages) || !messages.length || messages.length > 100) throw new Error('INVALID_BULK_MESSAGES')
    const normalized = messages.map((m) => {
      const message = String(m?.message ?? '')
      if (!message.trim() || message.length > 2000) throw new Error('INVALID_BULK_MESSAGE')
      return { to: normalizeRecipient(String(m?.to ?? '')), message }
    })

    if (viaEdge(cfg)) {
      const json = await edgeRequest(cfg, 'bulk', { provider: cfg.provider, messages: normalized, reference })
      const code = json.response_code ?? (json.status === 'sent' ? '202' : undefined)
      if (String(code) !== '202') throw new Error('SMS_GATEWAY_REJECTED: ' + bulksmsbdError(code, String(json.error || '').slice(0, 180)))
      return {
        providerMessageId: json.provider_message_id ? String(json.provider_message_id) : null,
        status: 'sent',
        raw: redact(cfg, String(json.raw || '').slice(0, 500)),
        provider: cfg.provider,
        requestId: reference,
        accepted: normalized.length
      }
    }

    if (cfg.provider !== 'bulksmsbd') throw new Error('BULK_SMS_NOT_SUPPORTED')
    const manyUrl = cfg.gatewayUrl.replace(/\/smsapi\/?$/i, '/smsapimany')
    // The official smsapimany contract is api_key + senderid + messages JSON.
    // The per-message content is Unicode-safe; no extra type parameter is sent.
    const body = new URLSearchParams({
      api_key: cfg.apiKey,
      senderid: cfg.senderId,
      messages: JSON.stringify(normalized)
    })
    const { res, text, json } = await httpJson(manyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString()
    }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    const code = json?.response_code ?? json?.status
    const providerError = String(json?.error_message ?? '').trim()
    if (String(code) !== '202' || providerError) {
      throw new Error('SMS_GATEWAY_REJECTED: ' + bulksmsbdError(code, providerError || redact(cfg, text.slice(0, 180))))
    }
    return {
      providerMessageId: providerId(json),
      status: 'sent',
      raw: redact(cfg, text.slice(0, 500)),
      provider: cfg.provider,
      requestId: reference,
      accepted: normalized.length
    }
  } catch (err: any) {
    throw new Error(redact(cfg, String(err?.message || err).slice(0, 300)))
  }
}

// ---------------------------------------------------------------------------
// Provider adapters. Each returns a provider message id when the gateway
// accepted the request. A non-2xx / explicit failure throws — the caller then
// applies the configured refund policy.
// ---------------------------------------------------------------------------
export async function sendViaGateway(
  cfg: SmsGatewayConfig,
  recipient: string,
  message: string,
  reference: string
): Promise<SmsSendResult> {
  try {
    const result = await sendViaGatewayInner(cfg, recipient, message, reference)
    return { ...result, raw: redact(cfg, result.raw) }
  } catch (err: any) {
    // Last line of defence: provider/network errors must never echo a secret.
    throw new Error(redact(cfg, String(err?.message || err).slice(0, 300)))
  }
}

async function sendViaGatewayInner(
  cfg: SmsGatewayConfig,
  recipient: string,
  message: string,
  reference: string
): Promise<SmsSendResult> {
  const err = configError(cfg)
  if (err) throw new Error(err)
  const to = normalizeRecipient(recipient)
  const encoding = smsEncoding(message)

  if (viaEdge(cfg)) {
    const json = await edgeRequest(cfg, 'send', { provider: cfg.provider, to, message, reference, type: encoding })
    const code = json.response_code ?? (json.status === 'sent' ? '202' : undefined)
    if (String(code) !== '202') throw new Error('SMS_GATEWAY_REJECTED: ' + bulksmsbdError(code, String(json.error || '').slice(0, 180)))
    return {
      providerMessageId: json.provider_message_id ? String(json.provider_message_id) : null,
      status: 'sent', // 202 = submitted, NOT delivered
      raw: redact(cfg, String(json.raw || '').slice(0, 500)),
      provider: cfg.provider,
      encoding,
      requestId: reference
    }
  }

  if (cfg.provider === 'generic') {
    const { res, text, json } = await httpJson(cfg.gatewayUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        api_key: cfg.apiKey,
        api_secret: cfg.apiSecret || undefined,
        sender_id: cfg.senderId,
        senderid: cfg.senderId,
        recipient: to,
        to,
        message,
        text: message,
        type: encoding,
        reference
      })
    }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    if (json && (json.success === false || json.error === true || (json.status && /fail|error/i.test(String(json.status))))) {
      throw new Error('SMS_GATEWAY_REJECTED: ' + redact(cfg, text.slice(0, 180)))
    }
    return { providerMessageId: providerId(json), status: 'sent', raw: text.slice(0, 500), provider: cfg.provider, encoding, requestId: reference }
  }

  if (cfg.provider === 'bulksmsbd') {
    const url = new URL(cfg.gatewayUrl)
    url.searchParams.set('api_key', cfg.apiKey)
    url.searchParams.set('type', encoding)
    url.searchParams.set('number', to)
    url.searchParams.set('senderid', cfg.senderId)
    url.searchParams.set('message', message)
    const { res, text, json } = await httpJson(url.toString(), { method: 'GET' }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    const code = json?.response_code ?? json?.status
    const ok = String(code) === '202' || json?.success === true
    const providerError = String(json?.error_message ?? '').trim()
    if (!ok || providerError) {
      throw new Error('SMS_GATEWAY_REJECTED: ' + bulksmsbdError(code, providerError || redact(cfg, text.slice(0, 180))))
    }
    return { providerMessageId: providerId(json), status: 'sent', raw: text.slice(0, 500), provider: cfg.provider, encoding, requestId: reference }
  }

  if (cfg.provider === 'smsnetbd') {
    const body = new URLSearchParams({
      api_key: cfg.apiKey,
      msg: message,
      to,
      sender_id: cfg.senderId,
      type: encoding
    })
    const { res, text, json } = await httpJson(cfg.gatewayUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString()
    }, cfg.timeoutMs)
    if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
    if (json && Number(json.error) !== 0 && json.error !== undefined) {
      throw new Error('SMS_GATEWAY_REJECTED: ' + redact(cfg, text.slice(0, 180)))
    }
    return { providerMessageId: providerId(json), status: 'sent', raw: text.slice(0, 500), provider: cfg.provider, encoding, requestId: reference }
  }

  // SSL Wireless (SMS Plus v3)
  const { res, text, json } = await httpJson(cfg.gatewayUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      api_token: cfg.apiKey,
      sid: cfg.senderId,
      msisdn: to,
      sms: message,
      csms_id: reference
    })
  }, cfg.timeoutMs)
  if (!res.ok) throw new Error(`SMS_GATEWAY_HTTP_${res.status}: ${redact(cfg, text.slice(0, 180))}`)
  if (json && json.status && !/success/i.test(String(json.status))) {
    throw new Error('SMS_GATEWAY_REJECTED: ' + redact(cfg, text.slice(0, 180)))
  }
  return { providerMessageId: providerId(json), status: 'sent', raw: text.slice(0, 500), provider: cfg.provider, encoding, requestId: reference }
}

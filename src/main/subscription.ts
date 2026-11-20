// Yearly subscription system (offline).
// - First run starts a 30-day trial.
// - Expiry is stored in the local settings table (key: sub_expire).
// - When expired, requireAuth() blocks all authenticated IPC and the renderer
//   shows a full-screen payment gate (bKash / Nagad numbers + activation code box).
// - Paying customers get a monthly activation code from the developer
//   (scripts/gen-sub-code.js). A valid code extends the subscription by 1 year.
import { ipcMain } from 'electron'
import { createHash, randomUUID } from 'crypto'
import { getSetting, setSetting, logActivity } from './db'

// ---- subscription product info (shown on the payment gate) ----
export const SUB_PRICE_BDT = 10000
export const SUB_BKASH = '01331707900'
export const SUB_NAGAD = '01616595386'

const CODE_SECRET = 'AVA-Cable-Sub-2025#x9K' // keep in sync with scripts/gen-sub-code.js
const TRIAL_DAYS = 30
const YEAR_DAYS = 365
const EXPIRING_SOON_DAYS = 7

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, dd] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, dd)
  d.setDate(d.getDate() + days)
  return localDate(d)
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// Activation code for a month, e.g. '2025-12' -> 8 hex chars
function codeFor(mk: string): string {
  return createHash('sha256').update(CODE_SECRET + '|' + mk).digest('hex').slice(0, 8).toUpperCase()
}

export interface SubState {
  expire: string
  daysLeft: number
  state: 'active' | 'expiring' | 'expired'
  price: number
  bkash: string
  nagad: string
}

export function getSubState(): SubState {
  let expire = getSetting('sub_expire', '')
  if (!expire) {
    expire = addDays(localDate(), TRIAL_DAYS)
    setSetting('sub_expire', expire)
  }
  // expire date is inclusive (valid until end of that day)
  const daysLeft = Math.ceil((new Date(expire + 'T23:59:59').getTime() - Date.now()) / 86_400_000)
  const state: SubState['state'] = daysLeft <= 0 ? 'expired' : daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'active'
  return { expire, daysLeft, state, price: SUB_PRICE_BDT, bkash: SUB_BKASH, nagad: SUB_NAGAD }
}

export function isSubscriptionExpired(): boolean {
  return getSubState().state === 'expired'
}

function activate(rawCode: string): SubState {
  const code = String(rawCode || '').trim().toUpperCase()
  const now = new Date()
  const valid = [codeFor(monthKey(now)), codeFor(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)))]
  if (!valid.includes(code)) throw new Error('INVALID_CODE')
  const cur = getSubState()
  // extend 1 year from the later of (today, current expiry) — renewing early never loses days
  const base = cur.expire > localDate() ? cur.expire : localDate()
  setSetting('sub_expire', addDays(base, YEAR_DAYS))
  logActivity(null, null, 'subscription_activate', 'settings', 'new expiry: ' + addDays(base, YEAR_DAYS))
  return getSubState()
}

export function registerSubscriptionIpc(): void {
  // No auth required: the gate is shown before login when expired.
  ipcMain.handle('sub:status', () => {
    // fire-and-forget remote approval check (keeps local state fresh)
    checkRemoteApproval().catch(() => {})
    return getSubState()
  })
  ipcMain.handle('sub:activate', (_e, code: string) => activate(code))
  ipcMain.handle('sub:sendRequest', (_e, d: any) => sendPaymentRequest(d))
  ipcMain.handle('sub:checkRemote', () => checkRemoteApproval())
  ipcMain.handle('sub:appId', () => getAppId())
}

// ============================================================
// Supabase online approval (optional — Settings → Supabase)
// Flow: app sends a payment request (pending) → developer approves
// in the admin panel → app auto-activates until expires_at.
// ============================================================

function sbUrl(): string {
  return getSetting('supabase_url', '').trim().replace(/\/$/, '')
}

function sbKey(): string {
  return getSetting('supabase_anon_key', '').trim()
}

export function supabaseConfigured(): boolean {
  return Boolean(sbUrl() && sbKey())
}

// Unique id of this installation (sent with every request)
export function getAppId(): string {
  let id = getSetting('sub_app_id', '')
  if (!id) {
    id = randomUUID()
    setSetting('sub_app_id', id)
  }
  return id
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(sbUrl() + path, {
    ...init,
    headers: {
      apikey: sbKey(),
      Authorization: 'Bearer ' + sbKey(),
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  if (!res.ok) throw new Error('SUPABASE_' + res.status)
  return res
}

export async function sendPaymentRequest(d: { mobile: string; method: string; trxId: string; companyName?: string }): Promise<boolean> {
  if (!supabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED')
  if (!d.mobile || !d.trxId || !d.method) throw new Error('MISSING_FIELDS')
  await sbFetch('/rest/v1/sub_requests', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      app_id: getAppId(),
      company_name: d.companyName || null,
      mobile: String(d.mobile),
      method: d.method === 'nagad' ? 'nagad' : 'bkash',
      trx_id: String(d.trxId),
      amount: SUB_PRICE_BDT,
      status: 'pending',
      current_expiry: getSubState().expire
    })
  })
  logActivity(null, null, 'subscription_request_sent', 'settings', 'trx: ' + d.trxId)
  return true
}

// If an approved payment exists for this installation, activate locally.
// Safe to call any time; offline/no-config simply returns the local state.
export async function checkRemoteApproval(): Promise<SubState> {
  if (!supabaseConfigured()) return getSubState()
  try {
    const res = await sbFetch(`/rest/v1/sub_status?app_id=eq.${encodeURIComponent(getAppId())}&select=status,expires_at&order=approved_at.desc&limit=1`)
    const rows = (await res.json()) as any[]
    const row = rows && rows[0]
    if (row && row.status === 'approved' && row.expires_at) {
      const remote = String(row.expires_at).slice(0, 10)
      const cur = getSubState()
      if (remote > cur.expire) {
        setSetting('sub_expire', remote)
        logActivity(null, null, 'subscription_approved_remote', 'settings', 'new expiry: ' + remote)
      }
    }
  } catch {
    // offline / not configured — local state stands
  }
  return getSubState()
}

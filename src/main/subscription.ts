// Yearly subscription system (offline).
// - First run starts a 30-day trial.
// - Expiry is stored in the local settings table (key: sub_expire).
// - When expired, requireAuth() blocks all authenticated IPC and the renderer
//   shows a full-screen payment gate (bKash / Nagad numbers + activation code box).
// - Paying customers get a monthly activation code from the developer
//   (scripts/gen-sub-code.js). A valid code extends the subscription by 1 year.
import { ipcMain } from 'electron'
import { createHash, randomUUID } from 'crypto'
// Subscription / trial state is INSTALLATION-level: it always reads and writes
// the primary database (never an account workspace), so switching accounts can
// neither reset nor bypass the subscription.
import { getSetting, setSetting, logActivity, getPrimaryDb as getDb } from './db'
import { getSession } from './ipc/auth'

// ---- Supabase (baked-in defaults; settings keys supabase_url / supabase_anon_key can override) ----
const DEFAULT_SUPABASE_URL = 'https://ttmjcjvthrnzyiifdqht.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0bWpjanZ0aHJuenlpaWZkcWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNTI1MDIsImV4cCI6MjExMDcyODUwMn0.mCWYnB_Sys3hYA8OaZYU3QzAP_ZBM6XW8PHu86a3ps8'

// ---- subscription product info (shown on the payment gate) ----
export const SUB_PRICE_BDT = 10000
export const SUB_BKASH = '01331707900'
export const SUB_NAGAD = '01616595386'

const CODE_SECRET = 'AVA-Cable-Sub-2025#x9K' // keep in sync with scripts/gen-sub-code.js
// Free trial: 7 days — from first run, and re-granted (max, never shortened)
// every time an account is approved via Supabase.
const TRIAL_DAYS = 7
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

// Call when a signup account is approved: the approved USER gets a 7-day trial
// from the approval date and the installation's global expiry is extended to at
// least that (never shortening a purchased subscription).
export function grantApprovalTrial(): void {
  const end = addDays(localDate(), TRIAL_DAYS)
  const cur = getSubState()
  if (end > cur.expire) {
    setSetting('sub_expire', end)
    logActivity(null, null, 'trial_granted', 'settings', 'new expiry: ' + end)
  }
}

// ---- per-user trial ----
// A user's own trial_ends is THE authority: each account gets 7 free days from
// creation/approval, then the payment gate blocks until a purchase. Buying
// (activation code or remote approval) extends the whole installation and
// re-dates every user's trial to the paid expiry (syncUsersToSubExpire).
// NULL trial_ends (fresh-install admin) → the global 7-day first-run trial.
function trialIso(te: string | null | undefined): string {
  if (!te) return ''
  return te.includes(' ') ? te.replace(' ', 'T') : te + 'T23:59:59'
}

export function isUserBlocked(userId: number): boolean {
  let trialEnds: string | null = null
  try {
    const row = getDb().prepare('SELECT trial_ends FROM users WHERE id = ?').get(userId) as any
    trialEnds = row?.trial_ends ?? null
  } catch { /* db not ready — global rule only */ }
  if (trialEnds) return Date.now() > new Date(trialIso(trialEnds)).getTime()
  return isSubscriptionExpired()
}

// SubState adjusted for the logged-in user — drives the renderer payment gate
export function getSubStateFor(trialEnds: string | null): SubState {
  if (!trialEnds) return getSubState()
  const t = trialIso(trialEnds)
  const daysLeft = Math.ceil((new Date(t).getTime() - Date.now()) / 86_400_000)
  const state: SubState['state'] = daysLeft <= 0 ? 'expired' : daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'active'
  return { ...getSubState(), expire: t.slice(0, 10), daysLeft, state }
}

// After a purchase, every user of this installation is covered until the paid
// expiry (their per-user trial is re-dated to it).
export function syncUsersToSubExpire(expire: string): void {
  try {
    getDb().prepare('UPDATE users SET trial_ends = ?').run(expire)
  } catch { /* non-fatal */ }
}

function activate(rawCode: string): SubState {
  const code = String(rawCode || '').trim().toUpperCase()
  const now = new Date()
  const valid = [codeFor(monthKey(now)), codeFor(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)))]
  if (!valid.includes(code)) throw new Error('INVALID_CODE')
  const cur = getSubState()
  // extend 1 year from the later of (today, current expiry) — renewing early never loses days
  const base = cur.expire > localDate() ? cur.expire : localDate()
  const newExp = addDays(base, YEAR_DAYS)
  setSetting('sub_expire', newExp)
  // the purchase covers every user of this installation
  syncUsersToSubExpire(newExp)
  logActivity(null, null, 'subscription_activate', 'settings', 'new expiry: ' + newExp)
  return getSubState()
}

export function registerSubscriptionIpc(): void {
  // No auth required: the gate is shown before login when expired.
  ipcMain.handle('sub:status', (e) => {
    // fire-and-forget remote approval check (keeps local state fresh)
    checkRemoteApproval().catch(() => {})
    // per-user trial: the logged-in user's own trial end may block sooner
    try {
      const s = getSession(e)
      if (s) {
        const row = getDb().prepare('SELECT trial_ends FROM users WHERE id = ?').get(s.userId) as any
        return getSubStateFor(row?.trial_ends ?? null)
      }
    } catch { /* fall back to global state */ }
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
  return (getSetting('supabase_url', '') || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '')
}

function sbKey(): string {
  return (getSetting('supabase_anon_key', '') || DEFAULT_SUPABASE_ANON_KEY).trim()
}

export function supabaseConfigured(): boolean {
  return Boolean(sbUrl() && sbKey())
}

// Reused by other modules (user accounts) for anon-key Supabase calls
export async function sbAnonFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return sbFetch(path, init)
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
  if (!res.ok) {
    // surface the real reason (e.g. missing column, auth issue) instead of a generic error
    let detail = 'HTTP ' + res.status
    try {
      const j: any = await res.json()
      if (j?.message) detail = j.message
    } catch { /* keep HTTP code */ }
    throw new Error('SUPABASE_ERROR: ' + detail)
  }
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
        syncUsersToSubExpire(remote)
        logActivity(null, null, 'subscription_approved_remote', 'settings', 'new expiry: ' + remote)
      }
    }
  } catch {
    // offline / not configured — local state stands
  }
  return getSubState()
}

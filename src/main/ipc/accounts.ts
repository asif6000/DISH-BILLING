// User account approval via Supabase:
// - Signup creates a local 'pending' user (cannot log in) and posts it to Supabase.
// - The developer approves/rejects in the admin panel (or Supabase dashboard).
// - The app polls app_user_status; on 'approved' the local user becomes active.
// - Password reset: user requests (password_resets), developer sets a new password
//   in the panel (bcrypt hash written to app_users.reset_hash); the app applies it locally.
// Passwords are NEVER sent to Supabase — the panel only sends a bcrypt hash for resets.
import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { getDb, logActivity } from '../db'
import { requireAuth, sessions } from './auth'
import { sbAnonFetch, supabaseConfigured } from '../subscription'

const PENDING_ROLE = 'Collector'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function nowIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Post a user to Supabase (insert; if the username already exists the 409 is
// silently ignored). NOTE: do NOT use on_conflict/ignore-duplicates here — the
// combination with the RLS insert policy fails (42501). No password hash is sent.
async function supabaseUpsertUser(u: { username: string; full_name: string | null; mobile: string | null; status: string }): Promise<void> {
  if (!supabaseConfigured()) return
  try {
    await sbAnonFetch('/rest/v1/app_users', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        username: u.username,
        full_name: u.full_name,
        mobile: u.mobile,
        status: u.status === 'active' ? 'approved' : 'pending'
      })
    })
  } catch { /* offline / already exists (409) — non-fatal */ }
}

async function requestPasswordReset(username: string): Promise<void> {
  if (!supabaseConfigured()) return
  try {
    await sbAnonFetch('/rest/v1/password_resets', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ username })
    })
  } catch { /* non-fatal */ }
}

// Push all local users to Supabase so the panel can see/approve them
async function syncLocalUsers(): Promise<void> {
  const db = getDb()
  const rows = db.prepare('SELECT username, full_name, mobile, status FROM users ORDER BY id').all() as any[]
  for (const u of rows) await supabaseUpsertUser(u)
}

export function registerAccountsIpc(): void {
  // sync local users to Supabase (Security page / manual)
  ipcMain.handle('accounts:sync', (e) => {
    requireAuth(e)
    if (!supabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED')
    return syncLocalUsers()
  })

  // signup from the login screen (no session yet)
  ipcMain.handle('accounts:signup', async (_e, input: any) => {
    const username = String(input.username || '').trim()
    const password = String(input.password || '')
    const fullName = String(input.fullName || '').trim()
    const mobile = String(input.mobile || '').trim()
    if (!username || !password || !fullName) throw new Error('MISSING_FIELDS')
    if (password.length < 6) throw new Error('PASSWORD_TOO_SHORT')
    const db = getDb()
    const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (dup) throw new Error('USERNAME_EXISTS')
    let role = db.prepare("SELECT id FROM roles WHERE name = ? AND is_system = 1").get(PENDING_ROLE) as any
    if (!role) role = db.prepare("SELECT id FROM roles WHERE name != 'Administrator' ORDER BY id LIMIT 1").get() as any
    if (!role) role = db.prepare('SELECT id FROM roles ORDER BY id LIMIT 1').get() as any
    db.prepare('INSERT INTO users (username, password_hash, full_name, mobile, role_id, status) VALUES (?,?,?,?,?,?)')
      .run(username, bcrypt.hashSync(password, 10), fullName, mobile || null, role.id, 'pending')
    logActivity(null, username, 'account_signup', 'security', 'pending approval')
    await supabaseUpsertUser({ username, full_name: fullName, mobile: mobile || null, status: 'pending' })
    return true
  })

  // forgot password request (no session)
  ipcMain.handle('accounts:forgot', async (_e, username: string) => {
    const name = String(username || '').trim()
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(name) as any
    if (!user) throw new Error('USER_NOT_FOUND')
    await syncLocalUsers() // make sure the account exists in Supabase
    await requestPasswordReset(name)
    logActivity(null, name, 'password_reset_request', 'security')
    return true
  })

  // Poll (no auth — runs on the login screen): sync users, then apply remote
  // approvals and password resets to the local database.
  ipcMain.handle('accounts:checkRemote', async () => {
    if (!supabaseConfigured()) return { ok: false, activated: [], reset: [] }
    try {
      await syncLocalUsers()
      const res = await sbAnonFetch('/rest/v1/app_user_status?select=username,status,reset_hash')
      const rows = (await res.json()) as any[]
      const remote = new Map<string, { status: string; reset_hash: string | null }>()
      for (const r of rows || []) remote.set(String(r.username).trim().toLowerCase(), { status: r.status, reset_hash: r.reset_hash || null })

      const db = getDb()
      const locals = db.prepare('SELECT id, username, password_hash, status FROM users').all() as any[]
      const activated: string[] = []
      const reset: string[] = []
      for (const u of locals) {
        const r = remote.get(u.username.toLowerCase())
        if (!r) continue
        // approved pending signup -> activate locally
        if (u.status === 'pending' && r.status === 'approved') {
          db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(u.id)
          logActivity(null, u.username, 'account_approved', 'security')
          activated.push(u.username)
        }
        // pending signup rejected remotely -> remove the local pending user
        if (u.status === 'pending' && r.status === 'rejected') {
          db.prepare('DELETE FROM users WHERE id = ?').run(u.id)
          logActivity(null, u.username, 'account_rejected_removed', 'security')
        }
        // password reset set by admin -> apply the new bcrypt hash locally
        if (r.reset_hash && r.reset_hash !== u.password_hash) {
          db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(r.reset_hash, u.id)
          logActivity(null, u.username, 'password_reset_applied', 'security')
          reset.push(u.username)
          // kill any open sessions for that user so they log in with the new password
          for (const [winId, s] of sessions.entries()) {
            if (s.username === u.username) sessions.delete(winId)
          }
        }
      }
      return { ok: true, activated, reset }
    } catch {
      return { ok: false, activated: [], reset: [] }
    }
  })

  // periodic remote check while the app is open (handles approvals after login)
  ipcMain.handle('accounts:checkRemoteAuthed', (e) => {
    requireAuth(e)
    return 'ok'
  })
  void nowIso
}

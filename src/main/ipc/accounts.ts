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
import { requirePermission } from './auth'
import { requireAuth, sessions, refreshSessionPerms } from './auth'
import { sbAnonFetch, supabaseConfigured, grantApprovalTrial } from '../subscription'

const PENDING_ROLE = 'Collector'
// roles the developer may assign remotely from the admin panel — SUPER_ADMIN is
// NEVER assignable remotely (security guard)
const REMOTE_ASSIGNABLE_ROLES = ['Manager', 'Collector', 'Administrator']

// Post a user to Supabase (insert). NOTE: do NOT use on_conflict/ignore-duplicates
// here — the combination with the RLS insert policy fails (42501). No password hash
// is sent. A 409 (username already exists remotely) counts as success.
async function supabaseUpsertUser(u: { username: string; full_name: string | null; mobile: string | null; status: string }): Promise<{ ok: boolean; existed?: boolean; error?: string }> {
  if (!supabaseConfigured()) return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' }
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
    return { ok: true }
  } catch (err: any) {
    const m = String(err?.message || err || '')
    // already exists remotely (e.g. re-signup of the same username) — not an error
    if (m.includes('409') || m.includes('duplicate key')) return { ok: true, existed: true }
    // real failure (missing SQL part, permission denied, offline...) — surface it
    logActivity(null, u.username, 'supabase_sync_failed', 'security', m.slice(0, 200))
    return { ok: false, error: m.slice(0, 200) }
  }
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

// Map a remote role_name from Supabase to the local system role id.
// Returns null for empty/unknown/SUPER_ADMIN values — remote can never grant
// or touch the SUPER_ADMIN role.
export function remoteRoleToLocalRoleId(roleName: unknown): number | null {
  const name = String(roleName || '').trim()
  if (!REMOTE_ASSIGNABLE_ROLES.includes(name)) return null
  const role = getDb().prepare('SELECT id FROM roles WHERE name = ? AND is_system = 1').get(name) as any
  return role ? Number(role.id) : null
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
    // push to Supabase as 'pending'; the app also retries on every checkRemote poll
    const push = await supabaseUpsertUser({ username, full_name: fullName, mobile: mobile || null, status: 'pending' })
    return { ok: true, synced: push.ok, syncError: push.error || null }
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

  // Read remote statuses. Prefers the SECURITY DEFINER RPC (immune to view/RLS
  // misconfiguration); falls back to the app_user_status view if the RPC is
  // not installed yet.
  async function fetchRemoteStatuses(): Promise<any[]> {
    try {
      const res = await sbAnonFetch('/rest/v1/rpc/get_app_user_status')
      return (await res.json()) as any[]
    } catch (err: any) {
      const m = String(err?.message || '')
      // RPC function not installed (404/42883) → fall back to the view
      if (m.includes('404') || m.includes('42883') || m.includes('does not exist')) {
        try {
          // view with role_name (projects that ran the v1.0.55 SQL upgrade)
          const res = await sbAnonFetch('/rest/v1/app_user_status?select=username,status,reset_hash,role_name')
          return (await res.json()) as any[]
        } catch {
          // older project: view exists without the role_name column —
          // statuses/resets still work, role sync stays off until upgraded
          const res = await sbAnonFetch('/rest/v1/app_user_status?select=username,status,reset_hash')
          return (await res.json()) as any[]
        }
      }
      throw err
    }
  }

  ipcMain.handle('accounts:checkRemote', async () => {
    if (!supabaseConfigured()) return { ok: false, activated: [], reset: [], roleChanged: [] }
    try {
      await syncLocalUsers()
      const rows = await fetchRemoteStatuses()
      const remote = new Map<string, { status: string; reset_hash: string | null; role_name?: string | null }>()
      for (const r of rows || []) remote.set(String(r.username).trim().toLowerCase(), { status: r.status, reset_hash: r.reset_hash || null, role_name: (r as any).role_name || null })

      const db = getDb()
      const locals = db.prepare('SELECT id, username, password_hash, status, role_id FROM users').all() as any[]
      const activated: string[] = []
      const reset: string[] = []
      const roleChanged: string[] = []
      for (const u of locals) {
        const r = remote.get(u.username.toLowerCase())
        if (!r) continue
        // approved pending signup -> activate locally + 7-day free trial.
        // The remote role_name (if set by the developer in the panel) replaces
        // the default Collector signup role.
        if (u.status === 'pending' && r.status === 'approved') {
          const remoteRoleId = remoteRoleToLocalRoleId((r as any).role_name)
          db.prepare("UPDATE users SET status = 'active', trial_ends = datetime('now','+7 days'), role_id = COALESCE(?, role_id) WHERE id = ?")
            .run(remoteRoleId, u.id)
          logActivity(null, u.username, 'account_approved', 'security', remoteRoleId ? `role=${(r as any).role_name}` : `role=${PENDING_ROLE}`)
          grantApprovalTrial()
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

        // remote role management: the developer sets a role in the admin panel
        // (app_users.role_name) -> the app applies it to the matching local user
        if (u.status === 'active' && (r as any).role_name) {
          const remoteRoleId = remoteRoleToLocalRoleId((r as any).role_name)
          if (remoteRoleId && remoteRoleId !== u.role_id) {
            // never touch a local SUPER_ADMIN account from the remote side
            const localRole = db.prepare('SELECT r.name FROM roles r WHERE r.id = ?').get(u.role_id) as any
            if (localRole?.name !== 'SUPER_ADMIN') {
              db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(remoteRoleId, u.id)
              logActivity(null, u.username, 'role_change_remote', 'security', `${localRole?.name}→${(r as any).role_name}`)
              roleChanged.push(u.username)
              // live session picks up the new permissions without logout
              refreshSessionPerms(u.id)
            }
          }
        }
      }
      return { ok: true, activated, reset, roleChanged }
    } catch (err: any) {
      // surface WHY the remote check failed (missing view/grant, offline, 401...)
      const m = String(err?.message || err || '')
      if (m) logActivity(null, null, 'supabase_check_failed', 'security', m.slice(0, 200))
      return { ok: false, error: m.slice(0, 200), activated: [], reset: [], roleChanged: [] }
    }
  })

  // Supabase user list (all app_users: pending + approved + rejected)
  // for the admin User Management page
  ipcMain.handle('accounts:remoteUsers', async (e) => {
    requirePermission(e, 'security')
    if (!supabaseConfigured()) return []
    try {
      const res = await sbAnonFetch('/rest/v1/rpc/get_app_users')
      return (await res.json()) as any[]
    } catch {
      return []
    }
  })

  // periodic remote check while the app is open (handles approvals after login)
  ipcMain.handle('accounts:checkRemoteAuthed', (e) => {
    requireAuth(e)
    return 'ok'
  })
}

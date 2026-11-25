import { ipcMain, BrowserWindow } from 'electron'
import bcrypt from 'bcryptjs'
// This module OWNS identity, roles, permissions and the audit trail, so every
// query here runs against the INSTALLATION database — never against the
// workspace of an impersonated account (aliased so no call site can drift).
import { getPrimaryDb as getDb, logActivity, getSetting, installIpcScope, getActiveWorkspace } from '../db'
import { enterWorkspace, leaveWorkspace, destroyWindowDb } from '../db/workspaces'
import { isUserBlocked } from '../subscription'
import { isUpdatePending } from '../updateState'
import { hasPermission, hasModuleAccess, isValidRoleKey } from '../../shared/permissions'

export interface Session {
  userId: number
  username: string
  fullName: string
  roleId: number
  roleName?: string
  permissions: string[]
  lastActivity: number
  winId: number
  // set only while a SUPER_ADMIN is impersonating this account from this window
  impersonatedBy?: number
  impersonatedByName?: string
  impersonationStartedAt?: number
  impersonationLogId?: number
}

export const sessions = new Map<number, Session>() // key: webContents.id
const SESSION_DEFAULT_MIN = 480

function ensureDefaultAdmin(): void {
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  if (count.c === 0) {
    // new install: the seeded admin is SUPER_ADMIN (RBAC hierarchy, migration v7)
    const role = (db.prepare("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'").get()
      || db.prepare("SELECT id FROM roles WHERE name = 'Administrator'").get()) as { id: number }
    db.prepare('INSERT INTO users (username, password_hash, full_name, role_id, created_by) VALUES (?,?,?,?,?)')
      .run('admin', bcrypt.hashSync('admin123', 10), 'Administrator', role.id, 'system')
  }
  // default cash account so income/expense/cashbook work out of the box
  const accCount = db.prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }
  if (accCount.c === 0) {
    db.prepare("INSERT INTO accounts (name, type, opening_balance, balance) VALUES ('Main Cash', 'cash', 0, 0)").run()
  }
}

export function getSession(e: Electron.IpcMainInvokeEvent): Session | null {
  return sessions.get(e.sender.id) || null
}

export function requireAuth(e: Electron.IpcMainInvokeEvent): Session {
  const s = sessions.get(e.sender.id)
  if (!s) throw new Error('SESSION_EXPIRED')
  const timeout = (parseInt(getSetting('session_timeout_min', String(SESSION_DEFAULT_MIN)), 10) || SESSION_DEFAULT_MIN) * 60_000
  if (Date.now() - s.lastActivity > timeout) {
    // a timed-out impersonated session must also close its audit row and
    // release the target workspace file
    discardImpersonation(e.sender.id, 'session_timeout')
    sessions.delete(e.sender.id)
    throw new Error('SESSION_EXPIRED')
  }
  s.lastActivity = Date.now()
  // Scope invariant: an impersonated session must read exactly its target's
  // workspace, and a normal/super session must never read a workspace. This
  // turns any future scoping bug into a forced re-login instead of a leak.
  const scope = getActiveWorkspace()
  if (s.impersonatedBy) {
    if (!scope || Number(scope.userId) !== Number(s.userId)) {
      discardImpersonation(e.sender.id, 'scope_mismatch')
      sessions.delete(e.sender.id)
      throw new Error('SESSION_EXPIRED')
    }
  } else if (scope) {
    discardImpersonation(e.sender.id, 'scope_mismatch')
    sessions.delete(e.sender.id)
    throw new Error('SESSION_EXPIRED')
  }
  // subscription gate: later of (global expiry, this user's own 7-day trial)
  if (isUserBlocked(s.userId)) throw new Error('SUBSCRIPTION_EXPIRED')
  return s
}

// The ONE authorization rule used by every IPC handler (mirrored 1:1 by the
// frontend helper in src/shared/permissions.ts so both sides always agree):
// - 'all' → everything (held only by the SUPER_ADMIN role)
// - module key → full access to that module (legacy roles)
// - 'module.action' key → only that action
// A user who was granted the module/granular key is allowed — the check NEVER
// requires 'all'/'SUPER_ADMIN' for ordinary modules.
export function requirePermission(e: Electron.IpcMainInvokeEvent, module: string, action?: string): Session {
  const s = requireAuth(e)
  // ADMIN-ONLY AREAS: security & settings stay gated even in 'open' permission
  // mode, but a user granted the module key or a matching granular key
  // (security.view / security.manage) is allowed — permission no longer means
  // 'must be SUPER_ADMIN'. Collectors/staff without the grant still get
  // PERMISSION_DENIED for role management, activity logs, backups & settings.
  const allowed = hasPermission(s.permissions, module, action)
    // Menu parity: the sidebar shows a module to holders of ANY of its granular
    // keys (hasModuleAccess — e.g. 'reports.view'). Module-only backend checks
    // must accept them too, otherwise such users see the menu item but every
    // data call is denied (Billing Report for collectors). Action-specific
    // checks are unaffected. security/settings stay module-key-only.
    || (!action && module !== 'security' && module !== 'settings' && hasModuleAccess(s.permissions, module))
  if (module === 'security' || module === 'settings') {
    if (!allowed) throw new Error(`PERMISSION_DENIED:${module}${action ? '.' + action : ''}`)
    return s
  }
  // permission_mode 'strict' (default): per-role permissions apply — approved
  // users are staff, not admins. Switch to 'open' (Settings → permission_mode)
  // to let every logged-in user use every module.
  if (getSetting('permission_mode', 'strict') !== 'open') {
    if (!allowed) {
      throw new Error(`PERMISSION_DENIED:${module}${action ? '.' + action : ''}`)
    }
  }
  return s
}

// ---- live-session permission refresh -------------------------------------
// Instead of forcing logout, update the affected sessions IN PLACE and notify
// the renderer so permission changes from Security → Roles take effect
// immediately — no re-login needed.
export function refreshSessionPerms(userId: number): void {
  let perms: string[] | null = null
  for (const [winId, s] of sessions) {
    if (s.userId !== userId) continue
    if (!perms) perms = getEffectivePermissions(userId)
    s.permissions = perms
    try {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id === winId)
      win?.webContents.send('permissions:updated', { userId })
    } catch { /* window already closed (e.g. during tests) */ }
  }
}

// after a role's permissions change, refresh every session holding that role
export function refreshSessionsForRole(roleId: number): void {
  const users = getDb().prepare('SELECT id FROM users WHERE role_id = ?').all(roleId) as any[]
  for (const u of users) refreshSessionPerms(u.id)
}

// effective permissions for a user = role permissions ∪ user_permissions grants
export function getEffectivePermissions(userId: number): string[] {
  const db = getDb()
  const u = db.prepare('SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(userId) as any
  if (!u) return []
  const role = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(u.role_id) as any
  const rolePerms: string[] = JSON.parse(role?.permissions || '[]')
  // 'all' means "everything" in hasPermission() and "is SUPER_ADMIN" in isSuper(),
  // so it belongs to the SUPER_ADMIN role ONLY. Legacy/hand-edited role JSON may
  // still carry it (migration v25 cleans that up) — this is the runtime guard so
  // a corrupt row can never turn Manager/Administrator into a super admin.
  const rolePermsSafe = u.role_name === 'SUPER_ADMIN' ? rolePerms : rolePerms.filter((k) => k !== 'all')
  const grants = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(userId) as any[]
  const granted = grants.map((g) => g.permission_key).filter((k: string) => k !== 'all')
  return Array.from(new Set([...rolePermsSafe, ...granted]))
}

// drop live sessions of a user so permission revocation takes effect immediately
export function dropSessionsForUser(userId: number): void {
  for (const [winId, s] of sessions) {
    if (s.userId === userId) sessions.delete(winId)
  }
}

// SUPER_ADMIN = the only role holding the 'all' permission (migration v7)
export function isSuper(s: { permissions: string[] }): boolean {
  return s.permissions.includes('all')
}

// Administrator-level account = holds BOTH user management and security access.
// Such an account may run every job, including creating/editing/deleting other
// Administrator, Manager, Collector and custom-role accounts. The SUPER_ADMIN
// account itself and the reserved 'all' permission stay untouchable for it.
export function isAdminLevel(s: { permissions: string[] }): boolean {
  return isSuper(s) || (hasModuleAccess(s.permissions, 'users') && hasModuleAccess(s.permissions, 'security'))
}

// ============================================================================
// SUPER_ADMIN impersonation — "Login As User"
// The real SUPER_ADMIN session is parked in this map while its window acts as
// the target user. Nothing about the target account is read or written: no
// password hash, no credentials, no new token. The window simply runs with the
// target's effective permissions (role ∪ per-user grants) and every credential
// or account-admin write is refused while impersonating.
// ============================================================================
export interface ImpersonationState {
  superSession: Session
  targetUserId: number
  targetUsername: string
  targetRoleName: string
  startedAt: number
  logId: number
}

export const impersonations = new Map<number, ImpersonationState>() // key: webContents.id

export function getImpersonation(winId: number): ImpersonationState | undefined {
  return impersonations.get(winId)
}

// close the audit row of an impersonation session that is being discarded
function closeImpersonationLog(st: ImpersonationState, reason: string): void {
  const secs = Math.max(0, Math.round((Date.now() - st.startedAt) / 1000))
  try {
    getDb().prepare(`UPDATE impersonation_logs SET ended_at = datetime('now'), duration_seconds = ?, end_reason = ? WHERE id = ?`)
      .run(secs, reason, st.logId)
  } catch { /* audit is best-effort here; the activity log below still records it */ }
  logActivity(st.superSession.userId, st.superSession.username, 'impersonate_end', 'security', `${st.targetUsername} · ${secs}s · ${reason}`)
}

// drop impersonation state for a window (logout / fresh login / window reload)
export function discardImpersonation(winId: number, reason: string): void {
  const st = impersonations.get(winId)
  // the workspace is left FIRST so the audit row is closed in the installation
  // database (where it was created) and no file handle is left open
  leaveWorkspace(winId)
  if (!st) return
  closeImpersonationLog(st, reason)
  impersonations.delete(winId)
}

// Window closed: close the audit row, forget the session and release the file.
export function cleanupWindow(winId: number): void {
  discardImpersonation(winId, 'window_closed')
  sessions.delete(winId)
  destroyWindowDb(winId)
}

// Database restore replaces the installation file: every live session and
// impersonation must end (otherwise a target session could read the restored
// installation data through a stale scope).
export function dropAllSessionsForRestore(): void {
  for (const winId of Array.from(impersonations.keys())) discardImpersonation(winId, 'database_restored')
  for (const winId of Array.from(sessions.keys())) {
    leaveWorkspace(winId)
    sessions.delete(winId)
    try {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id === winId)
      win?.webContents.send('auth:expired')
    } catch { /* window already closed */ }
  }
}

// notify the renderer that the session identity/permissions changed
function notifySessionChanged(winId: number): void {
  try {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id === winId)
    win?.webContents.send('permissions:updated', { impersonation: true })
  } catch { /* window already closed */ }
}

// SUPER_ADMIN only, never itself, never another SUPER_ADMIN account.
export function beginImpersonation(e: Electron.IpcMainInvokeEvent, targetUserId: number): { user: Session } {
  const s = requireAuth(e)
  const winId = e.sender.id
  if (s.impersonatedBy) throw new Error('IMPERSONATION_ALREADY_ACTIVE')
  if (!isSuper(s)) throw new Error('PERMISSION_DENIED:impersonation')
  const db = getDb()
  const target = db.prepare(`SELECT u.id, u.username, u.full_name, u.role_id, u.status, r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(Number(targetUserId)) as any
  if (!target) throw new Error('USER_NOT_FOUND')
  if (Number(target.id) === Number(s.userId)) throw new Error('CANNOT_IMPERSONATE_SELF')
  if (target.role_name === 'SUPER_ADMIN') throw new Error('CANNOT_IMPERSONATE_SUPER_ADMIN')
  if (target.status !== 'active') throw new Error('TARGET_NOT_ACTIVE')
  // an expired per-user trial would gate every API call → impersonation useless
  if (isUserBlocked(target.id)) throw new Error('TARGET_ACCOUNT_BLOCKED')
  const now = Date.now()
  const info = db.prepare(`INSERT INTO impersonation_logs
      (super_admin_id, super_admin_username, target_user_id, target_username, target_role)
      VALUES (?,?,?,?,?)`).run(s.userId, s.username, target.id, target.username, target.role_name || null)
  const logId = Number(info.lastInsertRowid)
  const session: Session = {
    userId: target.id,
    username: target.username,
    fullName: target.full_name,
    roleId: target.role_id,
    roleName: target.role_name || '',
    permissions: getEffectivePermissions(target.id),
    lastActivity: now,
    winId,
    impersonatedBy: s.userId,
    impersonatedByName: s.username,
    impersonationStartedAt: now,
    impersonationLogId: logId
  }
  const impState: ImpersonationState = {
    superSession: { ...s, permissions: getEffectivePermissions(s.userId) },
    targetUserId: target.id,
    targetUsername: target.username,
    targetRoleName: target.role_name || '',
    startedAt: now,
    logId
  }
  impersonations.set(winId, impState)
  sessions.set(winId, session)
  logActivity(s.userId, s.username, 'impersonate_start', 'security', `${target.username} (${target.role_name || 'no role'})`)
  // DATA ISOLATION: the window now reads/writes ONLY the target account's own
  // workspace database. The super admin's database stays untouched (and is what
  // endImpersonation() reopens). If the workspace cannot be opened, restore the
  // super admin session — never leave a target session on installation data.
  try {
    enterWorkspace(winId, { id: Number(target.id), username: target.username, fullName: target.full_name, roleName: target.role_name || '' })
  } catch (err) {
    // roll the window scope back to the installation database and close the
    // impersonation row; never leave a target session on installation data
    leaveWorkspace(winId)
    sessions.set(winId, s)
    impersonations.delete(winId)
    closeImpersonationLog(impState, 'workspace_failed')
    throw new Error('WORKSPACE_OPEN_FAILED')
  }
  notifySessionChanged(winId)
  return { user: session }
}

// "Return to Super Admin" — restores the parked session (live permissions).
export function endImpersonation(e: Electron.IpcMainInvokeEvent): { user: Session } {
  const winId = e.sender.id
  const st = impersonations.get(winId)
  if (!st) throw new Error('NOT_IMPERSONATING')
  // The parked super admin must still be a live, active SUPER_ADMIN. If the
  // account was deactivated/demoted while impersonating, returning would leak
  // installation data to a revoked account — end the session instead.
  const live = getDb().prepare(`SELECT u.id, u.username, u.full_name, u.role_id, u.status, r.name AS role_name
    FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(st.superSession.userId) as any
  if (!live || live.status !== 'active' || live.role_name !== 'SUPER_ADMIN') {
    leaveWorkspace(winId)
    closeImpersonationLog(st, 'super_admin_inactive')
    impersonations.delete(winId)
    sessions.delete(winId)
    try {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id === winId)
      win?.webContents.send('auth:expired')
    } catch { /* window already closed */ }
    throw new Error('SESSION_EXPIRED')
  }
  // back to the installation database first: the audit row lives there
  leaveWorkspace(winId)
  closeImpersonationLog(st, 'returned')
  impersonations.delete(winId)
  const restored: Session = {
    ...st.superSession,
    username: live.username,
    fullName: live.full_name,
    roleId: live.role_id,
    roleName: live.role_name,
    permissions: getEffectivePermissions(st.superSession.userId),
    lastActivity: Date.now(),
    winId
  }
  delete restored.impersonatedBy
  delete restored.impersonatedByName
  delete restored.impersonationStartedAt
  delete restored.impersonationLogId
  sessions.set(winId, restored)
  notifySessionChanged(winId)
  return { user: restored }
}

// Credential / account-administration writes are refused while impersonating:
// the super admin may operate the app AS the user, but can never change that
// user's password/credentials, delete accounts or rewire roles from inside.
export function assertNotImpersonating(s: Session, action: string): void {
  if (s.impersonatedBy) throw new Error(`IMPERSONATION_BLOCKED:${action}`)
}

export function requireNotImpersonating(e: Electron.IpcMainInvokeEvent, action: string): Session {
  const s = requireAuth(e)
  assertNotImpersonating(s, action)
  return s
}

export function requirePermissionNoImpersonation(e: Electron.IpcMainInvokeEvent, module: string, action?: string): Session {
  const s = requirePermission(e, module, action)
  assertNotImpersonating(s, module + (action ? '.' + action : ''))
  return s
}

// ---- dynamic per-user permission management (RBAC delegation) ----
// SUPER_ADMIN: any non-super user. ADMIN: only accounts they created (Manager/Collector).
// Shared by permissions:set AND the Dashboard KPI override editor.
export const canManageTargetPerms = (s: Session, target: any): boolean => {
  if (target.role_name === 'SUPER_ADMIN') return false
  if (isSuper(s)) return true
  // module key OR any granular users.* grant counts (same rule as backend)
  if (!hasModuleAccess(s.permissions, 'users')) return false
  // Administrator-level accounts manage the permissions of every non-super
  // account; managers keep the delegation chain (only accounts they created).
  return isAdminLevel(s) || target.owner_admin_id === s.userId
}

export function registerAuthIpc(): void {
  // Every handler runs inside its own window's database scope (per-request,
  // async-safe). Installed before the first handler is registered.
  installIpcScope()
  ensureDefaultAdmin()

  ipcMain.handle('auth:login', async (e, username: string, password: string) => {
    // forced update: an update was found but is not installed yet → no login
    if (isUpdatePending()) throw new Error('UPDATE_REQUIRED')
    const db = getDb()
    const name = String(username ?? '').trim()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(name) as any
    // Distinct codes so the login screen can EXPLAIN the problem (pending
    // approval / deactivated / no local account) instead of the old blanket
    // "Invalid username or password" that hid the real reason.
    if (!user) {
      // unknown username -> user_id NULL (column is nullable, FK-safe)
      db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)').run(null, name)
      throw new Error('INVALID_CREDENTIALS')
    }
    if (user.status !== 'active') {
      db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)').run(user.id, name)
      throw new Error(user.status === 'pending' ? 'ACCOUNT_PENDING' : 'ACCOUNT_INACTIVE')
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)').run(user.id, name)
      throw new Error('INVALID_CREDENTIALS')
    }
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id) as any
    const effective = getEffectivePermissions(user.id)
    // a fresh login always supersedes any impersonation parked on this window
    discardImpersonation(e.sender.id, 'new_login')
    // A normal login is a staff session of THIS installation and therefore uses
    // the company database (Collectors/Managers must see their assigned
    // customers). It must never inherit a workspace left behind by a previous
    // impersonation in this window, so the scope is reset explicitly.
    leaveWorkspace(e.sender.id)
    const session: Session = {
      userId: user.id, username: user.username, fullName: user.full_name,
      // effective permissions = role permissions ∪ per-user grants
      // (previously only role permissions were stored, so granular grants from
      // Security → Users never reached the session and Save was denied)
      roleId: user.role_id, roleName: role.name, permissions: effective,
      lastActivity: Date.now(), winId: e.sender.id
    }
    sessions.set(e.sender.id, session)
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id)
    db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,1)').run(user.id, user.username)
    logActivity(user.id, user.username, 'login', 'auth')
    return {
      token: Date.now(),
      user: { id: user.id, username: user.username, fullName: user.full_name, roleId: user.role_id, roleName: role.name, permissions: effective, permissionMode: getSetting('permission_mode', 'strict') },
      isFirstLogin: user.password_reset === 1
    }
  })

  ipcMain.handle('auth:logout', (e) => {
    // close the impersonation audit trail before dropping the session
    discardImpersonation(e.sender.id, 'logout')
    const s = sessions.get(e.sender.id)
    if (s) {
      logActivity(s.userId, s.username, 'logout', 'auth')
      const db = getDb()
      const row = db.prepare('SELECT id FROM login_history WHERE user_id = ? AND logout_at IS NULL ORDER BY id DESC LIMIT 1').get(s.userId) as any
      if (row) db.prepare('UPDATE login_history SET logout_at = datetime(\'now\') WHERE id = ?').run(row.id)
      sessions.delete(e.sender.id)
    }
    return true
  })

  ipcMain.handle('auth:check', (e) => {
    try {
      const u = requireAuth(e) as any
      const pm = getSetting('permission_mode', 'strict')
      ;(u as any).permissionMode = pm
      // Re-read the account LIVE on every check. A role change performed while
      // the user is logged in (e.g. Collector → Administrator) must update the
      // session immediately: keeping the cached roleName made the renderer keep
      // routing an Administrator to the Collector dashboard (NO_COLLECTOR_PROFILE).
      const db = getDb()
      const live = db.prepare(`SELECT u.id, u.username, u.full_name, u.role_id, u.status, r.name AS role_name
        FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(u.userId) as any
      if (!live || live.status !== 'active') {
        // a deactivated target must not keep an impersonated session alive
        discardImpersonation(e.sender.id, 'target_inactive')
        sessions.delete(e.sender.id)
        return { user: null }
      }
      u.username = live.username
      u.fullName = live.full_name
      u.roleId = live.role_id
      u.roleName = live.role_name || ''
      u.permissions = getEffectivePermissions(u.userId)
      // An impersonated target promoted to SUPER_ADMIN must not keep running
      // inside a window that then reads the installation database.
      if (u.impersonatedBy && live.role_name === 'SUPER_ADMIN') {
        discardImpersonation(e.sender.id, 'target_became_super')
        sessions.delete(e.sender.id)
        return { user: null }
      }
      // Re-assert the data scope on every check (renderer reload, permission
      // push, long-running session): only an IMPERSONATED session reads the
      // target's private workspace. Every normal staff session reads the
      // company database, and the super admin's session never inherits a
      // workspace from an earlier impersonation.
      try {
        if (u.impersonatedBy) {
          enterWorkspace(e.sender.id, { id: Number(u.userId), username: u.username, fullName: u.fullName, roleName: u.roleName || '' })
        } else {
          leaveWorkspace(e.sender.id)
        }
      } catch {
        discardImpersonation(e.sender.id, 'workspace_unavailable')
        sessions.delete(e.sender.id)
        return { user: null }
      }
      return { user: u, permissionMode: pm }
    } catch { return { user: null } }
  })

  ipcMain.handle('auth:changePassword', (e, oldPw: string, newPw: string) => {
    // impersonated sessions may never change account credentials
    const s = requireNotImpersonating(e, 'change_password')
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(s.userId) as any
    if (!bcrypt.compareSync(oldPw, user.password_hash)) throw new Error('WRONG_PASSWORD')
    if (!newPw || newPw.length < 6) throw new Error('PASSWORD_TOO_SHORT')
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPw, 10), s.userId)
    logActivity(s.userId, s.username, 'change_password', 'security')
    return true
  })

  // ---- users (SUPER_ADMIN: all accounts; ADMIN: only Manager/Collector accounts) ----
  ipcMain.handle('users:list', (e) => {
    const s = requirePermission(e, 'users', 'view')
    const rows = getDb().prepare(`SELECT u.id, u.username, u.full_name, u.mobile, u.role_id, u.status, u.last_login, u.created_by, r.name AS role_name,
        col.id AS collector_id, st.name AS collector_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN collectors col ON col.user_id = u.id LEFT JOIN staff st ON st.id = col.staff_id
      ORDER BY u.id`).all() as any[]
    // SUPER_ADMIN accounts are visible ONLY to the Super Admin itself —
    // filtered server-side, so exports/pagination can never leak the account.
    if (s.permissions.includes('all')) return rows
    return rows.filter((r) => r.role_name !== 'SUPER_ADMIN')
  })

  // Explicit user↔collector link (Collector Dashboard / collection identity).
  // collectorId null = unlink (falls back to the legacy name match).
  ipcMain.handle('users:linkCollector', (e, userId: number, collectorId: number | null) => {
    const s = requirePermissionNoImpersonation(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    if (target.role_name === 'SUPER_ADMIN') throw new Error('PERMISSION_DENIED:users')
    db.exec('BEGIN')
    try {
      if (collectorId != null) {
        const col = db.prepare('SELECT id FROM collectors WHERE id = ?').get(collectorId) as any
        if (!col) throw new Error('COLLECTOR_NOT_FOUND')
        // one collector = one account: detach it from any previous account first
        db.prepare('UPDATE collectors SET user_id = NULL WHERE id = ?').run(collectorId)
        db.prepare('UPDATE collectors SET user_id = NULL WHERE user_id = ?').run(userId)
        db.prepare('UPDATE collectors SET user_id = ? WHERE id = ?').run(userId, collectorId)
      } else {
        db.prepare('UPDATE collectors SET user_id = NULL WHERE user_id = ?').run(userId)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'link_collector', 'users', `${target.username}:${collectorId ?? 'unlinked'}`)
    // push the change to the collector's live session → dashboard re-links at once
    refreshSessionPerms(userId)
    return true
  })

  const ADMIN_CREATABLE_ROLES = ['Manager', 'Collector']

  ipcMain.handle('users:create', (e, data: any) => {
    const s = requirePermissionNoImpersonation(e, 'users', 'create')
    if (!data.username || !data.full_name || !data.password || !data.role_id) throw new Error('MISSING_FIELDS')
    if (String(data.password).length < 6) throw new Error('PASSWORD_TOO_SHORT')
    const db = getDb()
    const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
    if (dup) throw new Error('USERNAME_EXISTS')
    // privilege escalation guard: only SUPER_ADMIN can create ADMIN/SUPER_ADMIN
    // accounts. Administrator-level accounts may create any role EXCEPT SUPER_ADMIN.
    if (!isSuper(s)) {
      const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(data.role_id) as any
      if (!targetRole) throw new Error('FORBIDDEN_ROLE')
      const allowed = isAdminLevel(s) ? targetRole.name !== 'SUPER_ADMIN' : ADMIN_CREATABLE_ROLES.includes(targetRole.name)
      if (!allowed) throw new Error('FORBIDDEN_ROLE')
    }
    const r = db.prepare("INSERT INTO users (username, password_hash, full_name, mobile, role_id, trial_ends, created_by, owner_admin_id) VALUES (?,?,?,?,?, datetime('now','+7 days'), ?, ?)")
      .run(data.username, bcrypt.hashSync(String(data.password), 10), data.full_name, data.mobile || null, data.role_id, s.username, s.userId)
    const newUserId = Number(r.lastInsertRowid)
    // Every account gets its own 0-SMS wallet (never a fake credit).
    try { db.prepare('INSERT OR IGNORE INTO sms_wallets (user_id, balance) VALUES (?, 0)').run(newUserId) } catch { /* pre-v29 DB */ }
    logActivity(s.userId, s.username, 'create_user', 'users', `${data.username}:${data.full_name}`)
    return newUserId
  })

  ipcMain.handle('users:update', (e, id: number, data: any) => {
    const s = requirePermissionNoImpersonation(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare('SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(id) as any
    if (!target) throw new Error('NOT_FOUND')
    const targetIsSuper = target.role_name === 'SUPER_ADMIN'
    const self = s.userId === id
    if (targetIsSuper && !isSuper(s)) throw new Error('PERMISSION_DENIED:users') // super is untouchable
    if (self && (data.status && data.status !== target.status)) throw new Error('CANNOT_CHANGE_OWN_STATUS')
    if (data.password) {
      if (String(data.password).length < 6) throw new Error('PASSWORD_TOO_SHORT')
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(data.password), 10), id)
    }
    if (isSuper(s)) {
      // role + status changes are SUPER_ADMIN privileges (audit-logged)
      if (data.role_id && data.role_id !== target.role_id) logActivity(s.userId, s.username, 'role_change', 'users', `${target.username}:${target.role_name}→${data.role_id}`)
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, role_id = ?, status = ? WHERE id = ?')
        .run(data.full_name, data.mobile || null, data.role_id, data.status || 'active', id)
    } else {
      // Administrator-level: may change the role/status of any NON-super account
      // (Manager / Collector / Administrator / custom roles), so an Administrator
      // can run the whole team. SUPER_ADMIN records and role stay untouchable,
      // and nobody can change their OWN role (no self-lockout).
      const newStatus = data.status || target.status
      let newRoleId = target.role_id as number
      const roleChange = !!data.role_id && Number(data.role_id) !== Number(target.role_id)
      if (roleChange) {
        if (!isAdminLevel(s)) throw new Error('FORBIDDEN_ROLE')
        if (self) throw new Error('CANNOT_CHANGE_OWN_ROLE')
        const wantedRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(data.role_id) as any
        if (!wantedRole || wantedRole.name === 'SUPER_ADMIN') throw new Error('FORBIDDEN_ROLE')
        newRoleId = data.role_id
        logActivity(s.userId, s.username, 'role_change', 'users', `${target.username}:${target.role_name}→${wantedRole.name}`)
      }
      if (newStatus !== target.status) logActivity(s.userId, s.username, 'status_change', 'users', `${target.username}:${target.status}→${newStatus}`)
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, role_id = ?, status = ? WHERE id = ?')
        .run(data.full_name, data.mobile || null, newRoleId, newStatus, id)
    }
    logActivity(s.userId, s.username, 'update_user', 'users', String(id))
    // role/status/profile edits take effect in the target's LIVE session too
    // (roleName included, so an account promoted to Administrator immediately
    // gets the administrator dashboard instead of staying on the collector one)
    refreshSessionPerms(id)
    return true
  })

  ipcMain.handle('users:delete', (e, id: number) => {
    const s = requirePermissionNoImpersonation(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare('SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(id) as any
    if (!target) throw new Error('NOT_FOUND')
    if (target.role_name === 'SUPER_ADMIN') throw new Error('SUPER_ADMIN_UNDELETABLE')
    const count = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    if (count.c <= 1) throw new Error('LAST_USER')
    if (s.userId === id) throw new Error('CANNOT_DELETE_SELF')
    if (!isSuper(s)) {
      // Administrator-level accounts may delete any non-super account (incl. other
      // Administrators); managers only the Manager/Collector accounts they created.
      const deletable = isAdminLevel(s) ? true : ['Manager', 'Collector'].includes(target.role_name)
      if (!deletable) throw new Error('PERMISSION_DENIED:users')
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    logActivity(s.userId, s.username, 'delete_user', 'users', String(id))
    return true
  })

  const auditPerm = (actorId: number, targetId: number, key: string, action: string, oldValue?: string, newValue?: string) => {
    getDb().prepare('INSERT INTO permission_audit_logs (actor_id, target_user_id, permission_key, action, old_value, new_value) VALUES (?,?,?,?,?,?)')
      .run(actorId, targetId, key, action, oldValue || null, newValue || null)
  }

  ipcMain.handle('permissions:get', (e, userId: number) => {
    const s = requirePermission(e, 'users', 'view')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    return {
      user: { id: target.id, username: target.username, full_name: target.full_name, role_name: target.role_name, status: target.status },
      grants: db.prepare('SELECT permission_key, can_delegate, granted_by FROM user_permissions WHERE user_id = ?').all(userId),
      rolePermissions: JSON.parse((db.prepare('SELECT permissions FROM roles WHERE id = ?').get(target.role_id) as any)?.permissions || '[]'),
      effective: getEffectivePermissions(userId)
    }
  })

  ipcMain.handle('permissions:set', (e, userId: number, grants: { key: string; canDelegate?: boolean }[]) => {
    const s = requirePermissionNoImpersonation(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (s.userId === userId) throw new Error('CANNOT_ASSIGN_TO_SELF') // users cannot grant themselves permissions
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    const actorEffective = getEffectivePermissions(s.userId)
    // FIX: legacy module keys (e.g. 'settings') are valid role keys but not in
    // the catalog — previously the strict catalog check silently FILTERED them
    // out, so a per-user 'settings' grant never actually persisted while the
    // role-level key worked. Per-user grants now accept anything a role can hold.
    const valid = (grants || []).filter((g) => g && isValidRoleKey(g.key))
    // delegation guard: a parent can only grant permissions it itself holds
    // (SUPER_ADMIN holds 'all' so it can grant anything; children cannot exceed parents)
    for (const g of valid) {
      // module key implies all its granular actions (legacy roles stay delegable)
      const moduleKey = g.key.includes('.') ? g.key.split('.')[0] : g.key
      if (!isSuper(s) && !actorEffective.includes(g.key) && !actorEffective.includes(moduleKey)) {
        throw new Error(`DELEGATION_DENIED:${g.key}`)
      }
    }
    const existing = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(userId) as any[]
    const existingKeys = new Set(existing.map((r) => r.permission_key))
    const newKeys = new Set(valid.map((g) => g.key))
    db.exec('BEGIN')
    try {
      for (const k of existingKeys) {
        if (!newKeys.has(k)) {
          db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?').run(userId, k)
          auditPerm(s.userId, userId, k, 'revoke', 'granted', 'revoked')
        }
      }
      for (const g of valid) {
        if (!existingKeys.has(g.key)) {
          db.prepare('INSERT INTO user_permissions (user_id, permission_key, can_delegate, granted_by) VALUES (?,?,?,?)')
            .run(userId, g.key, g.canDelegate === false ? 0 : 1, s.userId)
          auditPerm(s.userId, userId, g.key, 'grant', 'none', `granted${g.canDelegate === false ? ' (no-delegate)' : ''}`)
        } else {
          db.prepare('UPDATE user_permissions SET can_delegate = ? WHERE user_id = ? AND permission_key = ?')
            .run(g.canDelegate === false ? 0 : 1, userId, g.key)
        }
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    // cascade: children of this user must never exceed the parent — remove
    // delegated grants they no longer can hold
    if (!isSuper(s)) {
      const after = getEffectivePermissions(userId)
      const children = db.prepare('SELECT id FROM users WHERE owner_admin_id = ?').all(userId) as any[]
      for (const ch of children) {
        const chGrants = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(ch.id) as any[]
        for (const g of chGrants) {
          if (!after.includes(g.key)) {
            db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?').run(ch.id, g.key)
            auditPerm(s.userId, ch.id, g.key, 'revoke', 'delegated', 'parent-revoked')
            // refresh the child's live session instead of killing it
            refreshSessionPerms(ch.id)
          }
        }
      }
    }
    // refresh the live session IN PLACE (and the renderer) instead of dropping
    // it — granted/revoked permissions take effect immediately without forcing
    // the user to log out and back in
    refreshSessionPerms(userId)
    logActivity(s.userId, s.username, 'permissions_set', 'users', `${target.username}:${valid.length} perms`)
    return true
  })

  ipcMain.handle('permissions:audit', (e, userId: number) => {
    const s = requirePermission(e, 'users', 'view')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target || !canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    return db.prepare(`SELECT p.*, u.username AS actor FROM permission_audit_logs p LEFT JOIN users u ON u.id = p.actor_id
      WHERE p.target_user_id = ? ORDER BY p.id DESC LIMIT 50`).all(userId)
  })

  // ---- roles ----
  ipcMain.handle('roles:list', (e) => {
    const s = requireAuth(e)
    const db = getDb()
    const rows = db.prepare('SELECT * FROM roles ORDER BY id').all() as any[]
    // SUPER_ADMIN role is visible only to the Super Admin itself — hidden from
    // every other account (Admin/Manager/Collector), so it can never be picked,
    // edited or assigned from the UI. Backend guards still reject direct attempts.
    if (s.permissions.includes('all')) return rows
    return rows.filter((r) => r.name !== 'SUPER_ADMIN')
  })

  ipcMain.handle('roles:save', (e, data: any) => {
    const s = requirePermissionNoImpersonation(e, 'security', 'manage')
    const db = getDb()
    // 'all' is exclusive to the SUPER_ADMIN role — it can never be granted to
    // any other role (no unrestricted SUPER_ADMIN access for Administrator).
    const perms: string[] = (data.permissions || []).filter((k: unknown) => typeof k === 'string')
    if (perms.includes('all')) throw new Error('ALL_PERMISSION_RESERVED')
    const invalid = perms.find((k: string) => !isValidRoleKey(k))
    if (invalid) throw new Error(`INVALID_PERMISSION:${invalid}`)
    const description = data.description ? String(data.description).slice(0, 300) : null
    let roleId = data.id as number | undefined
    if (roleId) {
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as any
      if (!role) throw new Error('NOT_FOUND')
      // only the SUPER_ADMIN system role is read-only — the Administrator role
      // permissions CAN be edited from Security → Roles (root cause of the
      // reported bug: SYSTEM_ROLE_READONLY blocked every Administrator save)
      if (role.is_system && role.name === 'SUPER_ADMIN') throw new Error('SYSTEM_ROLE_READONLY')
      // system role names never change (only their permission set does)
      const name = role.is_system ? role.name : String(data.name || role.name).trim()
      db.prepare('UPDATE roles SET name = ?, permissions = ?, description = ? WHERE id = ?').run(name, JSON.stringify(perms), description, roleId)
    } else {
      if (!String(data.name || '').trim()) throw new Error('REQUIRED:name')
      const r = db.prepare('INSERT INTO roles (name, permissions, description) VALUES (?, ?, ?)').run(String(data.name).trim(), JSON.stringify(perms), description)
      roleId = Number(r.lastInsertRowid)
    }
    // push the updated permission set into every live session of this role —
    // changes take effect immediately, without logout/login
    refreshSessionsForRole(roleId!)
    logActivity(s.userId, s.username, 'save_role', 'security', data.name)
    return roleId
  })

  // Delete a CUSTOM role. System roles can never be deleted. If the role is
  // still assigned to users, the caller must pass reassignTo: the users are
  // safely moved to that role (transaction) before the role is deleted.
  ipcMain.handle('roles:delete', (e, id: number, reassignTo?: number) => {
    const s = requirePermissionNoImpersonation(e, 'security', 'manage')
    const db = getDb()
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any
    if (!role) throw new Error('NOT_FOUND')
    if (role.is_system) throw new Error('SYSTEM_ROLE_READONLY')
    const used = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role_id = ?').get(id) as { c: number }
    if (used.c > 0) {
      if (!reassignTo) throw new Error('ROLE_IN_USE')
      const target = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(reassignTo)) as any
      if (!target) throw new Error('TARGET_ROLE_NOT_FOUND')
      if (target.id === role.id) throw new Error('INVALID_REASSIGNMENT')
      if (target.is_system && target.name === 'SUPER_ADMIN') throw new Error('INVALID_REASSIGNMENT')
      db.exec('BEGIN')
      try {
        db.prepare('UPDATE users SET role_id = ? WHERE role_id = ?').run(target.id, id)
        db.prepare('DELETE FROM roles WHERE id = ?').run(id)
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      // every MOVED user gets the target role's permissions immediately
      const moved = db.prepare('SELECT id FROM users WHERE role_id = ?').all(target.id) as any[]
      for (const u of moved) refreshSessionPerms(u.id)
      logActivity(s.userId, s.username, 'delete_role', 'security', `${role.name} → users reassigned to ${target.name}`)
      return { reassigned: used.c }
    }
    db.prepare('DELETE FROM roles WHERE id = ?').run(id)
    logActivity(s.userId, s.username, 'delete_role', 'security', role.name)
    return { reassigned: 0 }
  })

  ipcMain.handle('logs:activity', (e, limit = 200) => {
    requirePermission(e, 'security', 'view')
    return getDb().prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?').all(limit)
  })

  ipcMain.handle('logs:logins', (e, limit = 200) => {
    requirePermission(e, 'security', 'view')
    return getDb().prepare(`SELECT lh.*, u.full_name FROM login_history lh LEFT JOIN users u ON u.id = lh.user_id ORDER BY lh.id DESC LIMIT ?`).all(limit)
  })

  // notify renderer on session expiry
  ipcMain.handle('auth:ping', (e) => {
    try { requireAuth(e); return { ok: true } } catch {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (win) win.webContents.send('auth:expired')
      return { ok: false }
    }
  })
}

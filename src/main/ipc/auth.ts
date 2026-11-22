import { ipcMain, BrowserWindow } from 'electron'
import bcrypt from 'bcryptjs'
import { getDb, logActivity, getSetting } from '../db'
import { isUserBlocked } from '../subscription'
import { isUpdatePending } from '../updateState'
import { hasPermission, hasModuleAccess, isValidRoleKey, isValidPermKey } from '../../shared/permissions'

export interface Session {
  userId: number
  username: string
  fullName: string
  roleId: number
  permissions: string[]
  lastActivity: number
  winId: number
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
    sessions.delete(e.sender.id)
    throw new Error('SESSION_EXPIRED')
  }
  s.lastActivity = Date.now()
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
  const u = db.prepare('SELECT role_id FROM users WHERE id = ?').get(userId) as any
  if (!u) return []
  const role = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(u.role_id) as any
  const rolePerms: string[] = JSON.parse(role?.permissions || '[]')
  const grants = db.prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?').all(userId) as any[]
  return Array.from(new Set([...rolePerms, ...grants.map((g) => g.permission_key)]))
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

export function registerAuthIpc(): void {
  ensureDefaultAdmin()

  ipcMain.handle('auth:login', async (e, username: string, password: string) => {
    // forced update: an update was found but is not installed yet → no login
    if (isUpdatePending()) throw new Error('UPDATE_REQUIRED')
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = \'active\'').get(username) as any
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      // unknown username -> user_id NULL (column is nullable, FK-safe)
      db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)').run(user ? user.id : null, username)
      throw new Error('INVALID_CREDENTIALS')
    }
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id) as any
    const session: Session = {
      userId: user.id, username: user.username, fullName: user.full_name,
      // effective permissions = role permissions ∪ per-user grants
      // (previously only role permissions were stored, so granular grants from
      // Security → Users never reached the session and Save was denied)
      roleId: user.role_id, permissions: getEffectivePermissions(user.id),
      lastActivity: Date.now(), winId: e.sender.id
    }
    sessions.set(e.sender.id, session)
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id)
    db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,1)').run(user.id, user.username)
    logActivity(user.id, user.username, 'login', 'auth')
    return {
      token: Date.now(),
      user: { id: user.id, username: user.username, fullName: user.full_name, roleId: user.role_id, roleName: role.name, permissions: getEffectivePermissions(user.id), permissionMode: getSetting('permission_mode', 'strict') },
      isFirstLogin: user.password_reset === 1
    }
  })

  ipcMain.handle('auth:logout', (e) => {
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
      return { user: u, permissionMode: pm }
    } catch { return { user: null } }
  })

  ipcMain.handle('auth:changePassword', (e, oldPw: string, newPw: string) => {
    const s = requireAuth(e)
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
    const rows = getDb().prepare(`SELECT u.id, u.username, u.full_name, u.mobile, u.role_id, u.status, u.last_login, u.created_by, r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id`).all() as any[]
    // SUPER_ADMIN accounts are visible ONLY to the Super Admin itself —
    // filtered server-side, so exports/pagination can never leak the account.
    if (s.permissions.includes('all')) return rows
    return rows.filter((r) => r.role_name !== 'SUPER_ADMIN')
  })

  const ADMIN_CREATABLE_ROLES = ['Manager', 'Collector']

  ipcMain.handle('users:create', (e, data: any) => {
    const s = requirePermission(e, 'users', 'create')
    if (!data.username || !data.full_name || !data.password || !data.role_id) throw new Error('MISSING_FIELDS')
    if (String(data.password).length < 6) throw new Error('PASSWORD_TOO_SHORT')
    const db = getDb()
    const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
    if (dup) throw new Error('USERNAME_EXISTS')
    // privilege escalation guard: only SUPER_ADMIN can create ADMIN/SUPER_ADMIN accounts
    if (!isSuper(s)) {
      const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(data.role_id) as any
      if (!targetRole || !ADMIN_CREATABLE_ROLES.includes(targetRole.name)) throw new Error('FORBIDDEN_ROLE')
    }
    const r = db.prepare("INSERT INTO users (username, password_hash, full_name, mobile, role_id, trial_ends, created_by, owner_admin_id) VALUES (?,?,?,?,?, datetime('now','+7 days'), ?, ?)")
      .run(data.username, bcrypt.hashSync(String(data.password), 10), data.full_name, data.mobile || null, data.role_id, s.username, s.userId)
    logActivity(s.userId, s.username, 'create_user', 'users', `${data.username}:${data.full_name}`)
    return r.lastInsertRowid
  })

  ipcMain.handle('users:update', (e, id: number, data: any) => {
    const s = requirePermission(e, 'users', 'edit')
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
      // ADMIN can edit profile info and activate/deactivate Manager/Collector accounts,
      // but can NEVER change roles or touch SUPER_ADMIN records
      const newStatus = data.status || target.status
      if (newStatus !== target.status) logActivity(s.userId, s.username, 'status_change', 'users', `${target.username}:${target.status}→${newStatus}`)
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, status = ? WHERE id = ?')
        .run(data.full_name, data.mobile || null, newStatus, id)
    }
    logActivity(s.userId, s.username, 'update_user', 'users', String(id))
    return true
  })

  ipcMain.handle('users:delete', (e, id: number) => {
    const s = requirePermission(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare('SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(id) as any
    if (!target) throw new Error('NOT_FOUND')
    if (target.role_name === 'SUPER_ADMIN') throw new Error('SUPER_ADMIN_UNDELETABLE')
    const count = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    if (count.c <= 1) throw new Error('LAST_USER')
    if (s.userId === id) throw new Error('CANNOT_DELETE_SELF')
    if (!isSuper(s) && !['Manager', 'Collector'].includes(target.role_name)) throw new Error('PERMISSION_DENIED:users')
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    logActivity(s.userId, s.username, 'delete_user', 'users', String(id))
    return true
  })

  // ---- dynamic per-user permission management (RBAC delegation) ----
  // SUPER_ADMIN: any non-super user. ADMIN: only accounts they created (Manager/Collector).
  const canManageTargetPerms = (s: Session, target: any): boolean => {
    if (target.role_name === 'SUPER_ADMIN') return false
    if (isSuper(s)) return true
    // module key OR any granular users.* grant counts (same rule as backend)
    if (!hasModuleAccess(s.permissions, 'users')) return false
    return target.owner_admin_id === s.userId
  }

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
    const s = requirePermission(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (s.userId === userId) throw new Error('CANNOT_ASSIGN_TO_SELF') // users cannot grant themselves permissions
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    const actorEffective = getEffectivePermissions(s.userId)
    const valid = (grants || []).filter((g) => g && isValidPermKey(g.key))
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
    const s = requirePermission(e, 'security', 'manage')
    const db = getDb()
    // 'all' is exclusive to the SUPER_ADMIN role — it can never be granted to
    // any other role (no unrestricted SUPER_ADMIN access for Administrator).
    const perms: string[] = (data.permissions || []).filter((k: unknown) => typeof k === 'string')
    if (perms.includes('all')) throw new Error('ALL_PERMISSION_RESERVED')
    const invalid = perms.find((k: string) => !isValidRoleKey(k))
    if (invalid) throw new Error(`INVALID_PERMISSION:${invalid}`)
    let roleId = data.id as number | undefined
    if (roleId) {
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as any
      if (!role) throw new Error('NOT_FOUND')
      // only the SUPER_ADMIN system role is read-only — the Administrator role
      // permissions CAN be edited from Security → Roles (root cause of the
      // reported bug: SYSTEM_ROLE_READONLY blocked every Administrator save)
      if (role.is_system && role.name === 'SUPER_ADMIN') throw new Error('SYSTEM_ROLE_READONLY')
      // system role names never change (only their permission set does)
      const name = role.is_system ? role.name : (data.name || role.name)
      db.prepare('UPDATE roles SET name = ?, permissions = ? WHERE id = ?').run(name, JSON.stringify(perms), roleId)
    } else {
      const r = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run(data.name || 'New Role', JSON.stringify(perms))
      roleId = Number(r.lastInsertRowid)
    }
    // push the updated permission set into every live session of this role —
    // changes take effect immediately, without logout/login
    refreshSessionsForRole(roleId!)
    logActivity(s.userId, s.username, 'save_role', 'security', data.name)
    return true
  })

  ipcMain.handle('roles:delete', (e, id: number) => {
    const s = requirePermission(e, 'security', 'manage')
    const db = getDb()
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any
    if (role && role.is_system) throw new Error('SYSTEM_ROLE_READONLY')
    const used = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role_id = ?').get(id) as { c: number }
    if (used.c > 0) throw new Error('ROLE_IN_USE')
    db.prepare('DELETE FROM roles WHERE id = ?').run(id)
    logActivity(s.userId, s.username, 'delete_role', 'security', String(id))
    return true
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

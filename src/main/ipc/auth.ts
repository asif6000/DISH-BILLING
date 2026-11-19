import { ipcMain, BrowserWindow } from 'electron'
import bcrypt from 'bcryptjs'
import { getDb, logActivity, getSetting } from '../db'

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
    const role = db.prepare("SELECT id FROM roles WHERE name = 'Administrator'").get() as { id: number }
    db.prepare('INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?,?,?,?)')
      .run('admin', bcrypt.hashSync('admin123', 10), 'Administrator', role.id)
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
  return s
}

export function requirePermission(e: Electron.IpcMainInvokeEvent, module: string): Session {
  const s = requireAuth(e)
  if (!s.permissions.includes('all') && !s.permissions.includes(module)) {
    throw new Error(`PERMISSION_DENIED:${module}`)
  }
  return s
}

export function registerAuthIpc(): void {
  ensureDefaultAdmin()

  ipcMain.handle('auth:login', async (e, username: string, password: string) => {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = \'active\'').get(username) as any
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)').run(user ? user.id : null, username)
      throw new Error('INVALID_CREDENTIALS')
    }
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id) as any
    const session: Session = {
      userId: user.id, username: user.username, fullName: user.full_name,
      roleId: user.role_id, permissions: JSON.parse(role.permissions || '[]'),
      lastActivity: Date.now(), winId: e.sender.id
    }
    sessions.set(e.sender.id, session)
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id)
    db.prepare('INSERT INTO login_history (user_id, username, success) VALUES (?,?,1)').run(user.id, user.username)
    logActivity(user.id, user.username, 'login', 'auth')
    return {
      token: Date.now(),
      user: { id: user.id, username: user.username, fullName: user.full_name, roleId: user.role_id, roleName: role.name, permissions: session.permissions },
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
    try { return { user: requireAuth(e) } } catch { return { user: null } }
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

  // ---- users (admin) ----
  ipcMain.handle('users:list', (e) => {
    requirePermission(e, 'security')
    return getDb().prepare(`SELECT u.id, u.username, u.full_name, u.mobile, u.role_id, u.status, u.last_login, r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id`).all()
  })

  ipcMain.handle('users:create', (e, data: any) => {
    const s = requirePermission(e, 'security')
    if (!data.username || !data.full_name || !data.password || !data.role_id) throw new Error('MISSING_FIELDS')
    if (String(data.password).length < 6) throw new Error('PASSWORD_TOO_SHORT')
    const db = getDb()
    const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
    if (dup) throw new Error('USERNAME_EXISTS')
    const r = db.prepare('INSERT INTO users (username, password_hash, full_name, mobile, role_id) VALUES (?,?,?,?,?)')
      .run(data.username, bcrypt.hashSync(String(data.password), 10), data.full_name, data.mobile || null, data.role_id)
    logActivity(s.userId, s.username, 'create_user', 'security', data.username)
    return r.lastInsertRowid
  })

  ipcMain.handle('users:update', (e, id: number, data: any) => {
    const s = requirePermission(e, 'security')
    const db = getDb()
    if (data.password) {
      if (String(data.password).length < 6) throw new Error('PASSWORD_TOO_SHORT')
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(data.password), 10), id)
    }
    db.prepare('UPDATE users SET full_name = ?, mobile = ?, role_id = ?, status = ? WHERE id = ?')
      .run(data.full_name, data.mobile || null, data.role_id, data.status || 'active', id)
    logActivity(s.userId, s.username, 'update_user', 'security', String(id))
    return true
  })

  ipcMain.handle('users:delete', (e, id: number) => {
    const s = requirePermission(e, 'security')
    const db = getDb()
    const count = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    if (count.c <= 1) throw new Error('LAST_USER')
    if (s.userId === id) throw new Error('CANNOT_DELETE_SELF')
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    logActivity(s.userId, s.username, 'delete_user', 'security', String(id))
    return true
  })

  // ---- roles ----
  ipcMain.handle('roles:list', (e) => {
    requireAuth(e)
    return getDb().prepare('SELECT * FROM roles ORDER BY id').all()
  })

  ipcMain.handle('roles:save', (e, data: any) => {
    const s = requirePermission(e, 'security')
    const db = getDb()
    if (data.id) {
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(data.id) as any
      if (role && role.is_system && role.name === 'Administrator') throw new Error('SYSTEM_ROLE_READONLY')
      db.prepare('UPDATE roles SET name = ?, permissions = ? WHERE id = ?').run(data.name, JSON.stringify(data.permissions || []), data.id)
    } else {
      db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run(data.name, JSON.stringify(data.permissions || []))
    }
    logActivity(s.userId, s.username, 'save_role', 'security', data.name)
    return true
  })

  ipcMain.handle('roles:delete', (e, id: number) => {
    const s = requirePermission(e, 'security')
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
    requirePermission(e, 'security')
    return getDb().prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?').all(limit)
  })

  ipcMain.handle('logs:logins', (e, limit = 200) => {
    requirePermission(e, 'security')
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

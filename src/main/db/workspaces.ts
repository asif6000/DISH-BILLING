// ============================================================================
// Per-account WORKSPACE databases — data isolation for account switching.
//
// Every account that a SUPER_ADMIN impersonates owns a private SQLite database
// inside
//   <userData>/workspaces/<userId>-<username>/ava-cable.db
// while the installation database (users, roles, permissions, audit, login
// history, subscription and the company's own business data) stays at
// <userData>/ava-cable.db and is ALWAYS the primary connection.
//
// A normal staff login intentionally keeps using the company database so a
// Collector/Manager sees the customers they are assigned to (existing feature).
// Only an impersonated session is switched into the target account's private
// workspace, so the super admin's data can never appear there.
//
// Why this design: the app has ~350 hand-written SQL queries. Filtering every
// one of them by an owner_id is both risky and easy to get wrong (one missing
// WHERE leaks another account's data). Physical separation — a different
// database file per impersonated account — makes a leak impossible: a query can
// only ever see the rows of the workspace that is currently open. No existing
// query was changed, so existing features keep working exactly as before.
//
// The super admin's own data is the installation database: it is never touched
// when switching into another account, and it is what comes back on
// "Return to Super Admin".
// ============================================================================
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { DatabaseSync } from 'node:sqlite'
import { closeActiveWorkspace, getPrimaryDb, openActiveDb } from './index'

export interface WorkspaceOwner {
  id: number
  username: string
  fullName: string
  roleName: string
}

function slug(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'user').slice(0, 40)
}

export function workspacesRoot(): string {
  return path.join(app.getPath('userData'), 'workspaces')
}

export function workspaceDirFor(ownerId: number, username: string): string {
  return path.join(workspacesRoot(), `${Number(ownerId)}-${slug(username)}`)
}

// Open the account's private workspace, creating + seeding it on first use.
// winId = the window whose session owns this workspace.
export function enterWorkspace(winId: number, owner: WorkspaceOwner): { path: string; created: boolean } {
  if (!Number.isInteger(Number(owner?.id)) || Number(owner.id) <= 0) throw new Error('INVALID_WORKSPACE_OWNER')
  const dir = workspaceDirFor(owner.id, owner.username)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'ava-cable.db')
  const created = !fs.existsSync(file)
  const conn = openActiveDb(winId, file, { userId: Number(owner.id), username: owner.username })
  // One-time bootstrap, guarded by an ownership marker. The whole seed runs in
  // a transaction: a failure can never leave a half-seeded workspace behind.
  const marker = conn.prepare("SELECT value FROM settings WHERE key = 'workspace_owner_id'").get() as any
  if (marker && Number(marker.value) !== Number(owner.id)) {
    closeActiveWorkspace(winId)
    throw new Error('WORKSPACE_OWNER_MISMATCH')
  }
  if (!marker) {
    conn.exec('BEGIN')
    try {
      seedWorkspace(owner, conn)
      conn.prepare("INSERT INTO settings (key, value) VALUES ('workspace_owner_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(String(owner.id))
      conn.exec('COMMIT')
    } catch (err) {
      try { conn.exec('ROLLBACK') } catch { /* already rolled back */ }
      closeActiveWorkspace(winId)
      throw err
    }
  }
  return { path: file, created }
}

// Back to the installation database (the super admin's own data) for this window.
export function leaveWorkspace(winId: number): void {
  closeActiveWorkspace(winId)
}

// window closed: release the SQLite handle of that window's workspace
export { destroyWindowDb } from './index'

// A brand new workspace gets ONLY what is needed to work with it:
//  - the owner as its single local account (correct "created by" labels and FK
//    targets — the same user id as in the installation database),
//  - the default cash account,
//  - the company name of that account (real data, never a fake company).
// No business data, no sample customers, no dummy rows.
function seedWorkspace(owner: WorkspaceOwner, db: DatabaseSync): void {
  const primary = getPrimaryDb()

  // Role definitions are copied from the installation database so role joins
  // (dashboard KPI checks, collector resolution) behave exactly as they do for
  // the super admin — permissions themselves are still resolved against the
  // primary database at login/switch time.
  const roles = primary.prepare('SELECT id, name, permissions, is_system, description, created_at FROM roles').all() as any[]
  const insRole = db.prepare(`INSERT OR REPLACE INTO roles (id, name, permissions, is_system, description, created_at)
    VALUES (?,?,?,?,?, COALESCE(?, datetime('now')))`)
  for (const r of roles) {
    try { insRole.run(r.id, r.name, r.permissions, r.is_system, r.description ?? null, r.created_at ?? null) }
    catch (e: any) { throw new Error(`SEED_ROLE ${r.id}/${r.name}: ${e.message}`) }
  }

  const srcUser = primary.prepare('SELECT id, username, full_name, mobile, role_id FROM users WHERE id = ?').get(owner.id) as any
  if (srcUser) {
    try {
      db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, full_name, mobile, role_id, status)
        VALUES (?,?,?,?,?,?, 'active')`)
        // random, unguessable hash: logins are validated against the installation
        // database, this row only exists so the workspace is self-consistent
        .run(srcUser.id, srcUser.username, bcrypt.hashSync(randomBytes(32).toString('base64url'), 10),
          srcUser.full_name || srcUser.username, srcUser.mobile || null, srcUser.role_id)
    } catch (e: any) { throw new Error(`SEED_USER ${srcUser.id}/${srcUser.username}/role=${srcUser.role_id}: ${e.message}`) }
    // the owner's personal permission overrides travel with the account.
    // granted_by may point at the installation admin who made the grant — that
    // user must NOT be copied into this account's workspace (data isolation),
    // so the local row attributes the grant to the workspace owner. Effective
    // permissions are still always resolved against the installation database.
    const grants = primary.prepare('SELECT permission_key, can_delegate, granted_by FROM user_permissions WHERE user_id = ?').all(owner.id) as any[]
    const insGrant = db.prepare('INSERT OR REPLACE INTO user_permissions (user_id, permission_key, can_delegate, granted_by) VALUES (?,?,?,?)')
    for (const g of grants) {
      try { insGrant.run(owner.id, g.permission_key, g.can_delegate, owner.id) }
      catch (e: any) { throw new Error(`SEED_GRANT ${owner.id}/${g.permission_key}: ${e.message}`) }
    }
  }

  const acc = db.prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }
  if (!acc?.c) {
    db.prepare("INSERT INTO accounts (name, type, opening_balance, balance) VALUES ('Main Cash', 'cash', 0, 0)").run()
  }

  // A Collector account needs its own collector identity to collect at all
  // (staff + collectors row linked to this account) — same bootstrap rule the
  // app already uses for legacy installs. Identity data only, no business rows.
  if (String(owner.roleName) === 'Collector') {
    const existing = db.prepare('SELECT id FROM collectors WHERE user_id = ?').get(owner.id) as any
    if (!existing) {
      const staff = db.prepare("INSERT INTO staff (name, mobile, status) VALUES (?,?, 'active')")
        .run(srcUser?.full_name || owner.username, srcUser?.mobile || null)
      db.prepare("INSERT INTO collectors (staff_id, user_id, status) VALUES (?,?, 'active')")
        .run(Number(staff.lastInsertRowid), owner.id)
    }
  }

  const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  set.run('company_name', owner.fullName || owner.username)
  set.run('invoice_prefix', 'INV')
}

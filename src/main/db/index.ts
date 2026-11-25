import { DatabaseSync } from 'node:sqlite'
import { AsyncLocalStorage } from 'node:async_hooks'
import { app, ipcMain } from 'electron'
import { join } from 'path'
import { MIGRATIONS } from './migrations'

// ============================================================================
// CONNECTION MODEL (data isolation)
//
//  primary   : the installation database (users, roles, permissions, audit,
//              subscription, Supabase config). ALWAYS reachable through
//              getPrimaryDb() and NEVER used for business data of a
//              non-super account.
//  workspace : one private SQLite file per account, opened ONLY when a SUPER_ADMIN
//              impersonates that account. A normal staff login keeps using the
//              installation (company) database so Collector/Manager workflows
//              (assigned customers, shared billing) keep working as before.
//
// The active database is resolved PER IPC REQUEST (AsyncLocalStorage), not from
// one process-global variable. That matters in two real cases:
//  - two application windows logged into different accounts at the same time,
//  - an async handler (e.g. a Supabase sync) that is still awaiting while a
//    switch happens in the same window: it keeps using the database of the
//    session it started with, so it can never write into the new account.
// ============================================================================
export interface ActiveWorkspaceInfo { userId: number; username: string; path: string }

interface DbState {
  db: DatabaseSync
  path: string
  workspace: ActiveWorkspaceInfo | null
  refs: number
  retired: boolean
  closed: boolean
}

interface RequestContext { state: DbState }

let db: DatabaseSync | null = null // installation connection (fallback outside an IPC request)
let primary: DatabaseSync | null = null // INSTALLATION database — users, roles, auth, audit, subscription
let primaryPath = ''
let primaryState: DbState | null = null
const windowStates = new Map<number, DbState>() // webContents.id → active database of that window
const requestContext = new AsyncLocalStorage<RequestContext>()
let ipcScopeInstalled = false

// Settings that belong to the INSTALLATION, not to one account's workspace:
// subscription state, Supabase credentials/app id, backup folder, security
// policy and updater config. They always live in the primary database.
const INSTALL_SETTING_KEYS = new Set([
  'sub_expire', 'supabase_url', 'supabase_anon_key', 'sub_app_id',
  'backup_dir', 'permission_mode', 'session_timeout_min',
  'supabase_auto_provision', 'auto_update_check', 'update_url', 'auto_backup'
])
export function isInstallSetting(key: string): boolean {
  return INSTALL_SETTING_KEYS.has(key) || key.startsWith('updater_')
}

// The database the CURRENT request may read/write business data from.
// Outside an IPC request (startup, timers) this is the installation database.
export function getDb(): DatabaseSync {
  const ctx = requestContext.getStore()
  if (ctx) return ctx.state.db
  if (!db) throw new Error('Database not initialized')
  return db
}

// Identity / authz / audit / subscription ALWAYS read the installation database,
// never the workspace of an impersonated account.
export function getPrimaryDb(): DatabaseSync {
  if (!primary) throw new Error('Database not initialized')
  return primary
}

function stateForWindow(winId: number | undefined): DbState | null {
  if (winId == null) return primaryState
  return windowStates.get(winId) || primaryState
}

function closeIfRetired(state: DbState): void {
  if (state === primaryState || !state.retired || state.refs > 0 || state.closed) return
  try { state.db.close() } catch { /* already closed */ }
  state.closed = true
}

function releaseState(state: DbState): void {
  state.refs = Math.max(0, state.refs - 1)
  closeIfRetired(state)
}

// Move the CURRENT request onto another connection, transferring the request's
// reference so the old connection can be safely closed when its last user is
// done (never while a request is still reading it).
function switchRequestTo(target: DbState): void {
  const ctx = requestContext.getStore()
  if (!ctx || ctx.state === target) return
  const previous = ctx.state
  target.refs++
  ctx.state = target
  releaseState(previous)
}

// Every IPC handler runs inside the database scope of ITS window. The wrapper
// is installed once, before any handler is registered.
export function withWindowDb<T>(winId: number | undefined, fn: () => T): T {
  const state = stateForWindow(winId)
  if (!state) return fn()
  const ctx: RequestContext = { state }
  state.refs++
  let result: T
  try {
    result = requestContext.run(ctx, fn)
  } catch (err) {
    releaseState(ctx.state)
    throw err
  }
  if (result && typeof (result as any).then === 'function') {
    return (result as any).then(
      (value: any) => { releaseState(ctx.state); return value },
      (err: any) => { releaseState(ctx.state); throw err }
    ) as T
  }
  releaseState(ctx.state)
  return result
}

export function installIpcScope(): void {
  if (ipcScopeInstalled) return
  ipcScopeInstalled = true
  const main = ipcMain as any
  const original = main.handle.bind(main)
  main.handle = (channel: string, listener: (e: any, ...args: any[]) => any) =>
    original(channel, (e: any, ...args: any[]) => withWindowDb(e?.sender?.id, () => listener(e, ...args)))
}

function defaultDbPath(): string {
  return join(app.getPath('userData'), 'ava-cable.db')
}

// installation database path (also used by backups)
export function getDbPath(): string {
  return primaryPath || defaultDbPath()
}

// the database the current context reads business data from
export function getActiveDbPath(): string {
  return requestContext.getStore()?.state.path || getDbPath()
}

export function getActiveWorkspace(): ActiveWorkspaceInfo | null {
  return requestContext.getStore()?.state.workspace || null
}

function openDbFile(filePath: string): DatabaseSync {
  const conn = new DatabaseSync(filePath)
  conn.exec('PRAGMA journal_mode = WAL')
  conn.exec('PRAGMA foreign_keys = ON')
  conn.exec('PRAGMA busy_timeout = 5000')
  runMigrations(conn)
  return conn
}

export function initDb(dbPath?: string): DatabaseSync {
  // A restore replaces the installation file: every window scope must be reset
  // first so nobody can keep reading the previous connection.
  for (const state of new Set(windowStates.values())) {
    if (state === primaryState) continue
    state.retired = true
    closeIfRetired(state)
  }
  windowStates.clear()
  if (primary) { try { primary.close() } catch { /* already closed */ } }

  primaryPath = dbPath || defaultDbPath()
  primary = openDbFile(primaryPath)
  primaryState = { db: primary, path: primaryPath, workspace: null, refs: 0, retired: false, closed: false }
  db = primary
  return db
}

// Switch the ACTIVE database of ONE window to an account's private workspace.
// The installation connection stays open (identity/authz/audit keep working).
export function openActiveDb(winId: number, filePath: string, workspace: { userId: number; username: string }): DatabaseSync {
  if (!primaryState) throw new Error('Database not initialized')
  const existing = windowStates.get(winId) || primaryState
  // re-entering the same account (reload / permission refresh) reuses the
  // connection instead of reopening and re-running migrations
  if (existing.path === filePath && !existing.closed && !existing.retired) {
    existing.workspace = { ...workspace, path: filePath }
    windowStates.set(winId, existing)
    switchRequestTo(existing)
    return existing.db
  }
  const conn = openDbFile(filePath)
  const next: DbState = {
    db: conn, path: filePath, workspace: { ...workspace, path: filePath },
    refs: 0, retired: false, closed: false
  }
  if (existing !== primaryState) existing.retired = true
  windowStates.set(winId, next)
  switchRequestTo(next)
  if (existing !== primaryState) closeIfRetired(existing)
  return conn
}

// Back to the installation database (the super admin's own data) for ONE window.
export function closeActiveWorkspace(winId: number): void {
  if (!primaryState) return
  const existing = windowStates.get(winId)
  windowStates.set(winId, primaryState)
  if (existing && existing !== primaryState) existing.retired = true
  switchRequestTo(primaryState)
  if (existing && existing !== primaryState) closeIfRetired(existing)
}

// Window closed / app shutdown: drop the window scope and close its workspace.
export function destroyWindowDb(winId: number): void {
  const existing = windowStates.get(winId)
  windowStates.delete(winId)
  if (existing && existing !== primaryState) {
    existing.retired = true
    closeIfRetired(existing)
  }
}

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  let version = row.user_version
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
      db.exec('COMMIT')
      version = i + 1
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
}

export function integrityCheck(): boolean {
  const row = getDb().prepare('PRAGMA integrity_check').get() as any
  return row && String(row.integrity_check || row[Object.keys(row)[0]]) === 'ok'
}

// ---------- helpers ----------
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function nextSeq(key: string, pad = 5, prefix = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  const n = (row ? parseInt(row.value, 10) : 0) + 1
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(n))
  return prefix + String(n).padStart(pad, '0')
}

// Business settings read/write the ACTIVE workspace; installation settings
// (subscription, Supabase config, security policy, updater) always go to the
// primary database so switching accounts can never reset the subscription.
export function getSetting(key: string, fallback = ''): string {
  const conn = isInstallSetting(key) ? getPrimaryDb() : getDb()
  const row = conn.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row && row.value !== null && row.value !== undefined ? row.value : fallback
}

export function setSetting(key: string, value: string): void {
  const conn = isInstallSetting(key) ? getPrimaryDb() : getDb()
  conn.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

export function today(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function currentMonth(): string {
  const d = new Date()
  return d.toISOString().slice(0, 7)
}

// The audit trail is installation-wide: it always lands in the primary database,
// even while a super admin works inside another account's workspace.
export function logActivity(userId: number | null, username: string | null, action: string, module: string, details?: string): void {
  getPrimaryDb().prepare('INSERT INTO activity_logs (user_id, username, action, module, details) VALUES (?,?,?,?,?)')
    .run(userId, username, action, module, details || null)
}

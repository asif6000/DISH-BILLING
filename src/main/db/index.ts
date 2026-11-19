import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'path'
import { MIGRATIONS } from './migrations'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getDbPath(): string {
  return join(app.getPath('userData'), 'ava-cable.db')
}

export function initDb(dbPath?: string): DatabaseSync {
  const path = dbPath || getDbPath()
  db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  runMigrations(db)
  return db
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

export function getSetting(key: string, fallback = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row && row.value !== null && row.value !== undefined ? row.value : fallback
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
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

export function logActivity(userId: number | null, username: string | null, action: string, module: string, details?: string): void {
  getDb().prepare('INSERT INTO activity_logs (user_id, username, action, module, details) VALUES (?,?,?,?,?)')
    .run(userId, username, action, module, details || null)
}

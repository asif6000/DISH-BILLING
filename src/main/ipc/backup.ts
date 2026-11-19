import { ipcMain, app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getDb, getDbPath, initDb, integrityCheck, logActivity, getSetting } from '../db'
import { requirePermission, sessions } from './auth'

export function backupsDir(): string {
  const custom = getSetting('backup_dir', '')
  if (custom) return custom
  return path.join(app.getPath('userData'), 'backups')
}

export function ensureBackupsDir(): string {
  const dir = backupsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function checkpointAndCopy(target: string): void {
  const db = getDb()
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch { /* ignore */ }
  fs.copyFileSync(getDbPath(), target)
}

export function autoBackup(): string | null {
  try {
    const dir = ensureBackupsDir()
    const file = path.join(dir, `ava-auto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`)
    checkpointAndCopy(file)
    pruneBackups(dir, 30)
    return file
  } catch {
    return null
  }
}

function pruneBackups(dir: string, keep: number): void {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse()
  for (const f of files.slice(keep)) {
    try { fs.unlinkSync(path.join(dir, f)) } catch { /* ignore */ }
  }
}

export function registerBackupIpc(): void {
  ipcMain.handle('backup:create', async (e, targetPath?: string) => {
    const s = requirePermission(e, 'security')
    let target = targetPath
    if (!target) {
      const win = require('electron').BrowserWindow.fromWebContents(e.sender)
      const res = await dialog.showSaveDialog(win!, {
        title: 'Create Backup',
        defaultPath: path.join(app.getPath('documents'), `ava-backup-${new Date().toISOString().slice(0, 10)}.db`),
        filters: [{ name: 'Database Backup', extensions: ['db'] }]
      })
      if (res.canceled || !res.filePath) return null
      target = res.filePath
    }
    checkpointAndCopy(target)
    logActivity(s.userId, s.username, 'backup_create', 'security', target)
    return target
  })

  ipcMain.handle('backup:restore', async (e, sourcePath?: string) => {
    const s = requirePermission(e, 'security')
    let source = sourcePath
    if (!source) {
      const win = require('electron').BrowserWindow.fromWebContents(e.sender)
      const res = await dialog.showOpenDialog(win!, {
        title: 'Restore Backup',
        filters: [{ name: 'Database Backup', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (res.canceled || !res.filePaths[0]) return null
      source = res.filePaths[0]
    }
    // validate source is a SQLite db
    const header = fs.readFileSync(source).subarray(0, 15).toString('utf8')
    if (!header.startsWith('SQLite format 3')) throw new Error('NOT_A_SQLITE_DB')
    // close current db, replace file, re-init
    const db = getDb()
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch { /* ignore */ }
    db.close()
    const live = getDbPath()
    fs.copyFileSync(live, live + '.before-restore')
    fs.copyFileSync(source, live)
    try { fs.unlinkSync(live + '-wal'); fs.unlinkSync(live + '-shm') } catch { /* ignore */ }
    initDb()
    logActivity(s.userId, s.username, 'backup_restore', 'security', source)
    return true
  })

  ipcMain.handle('backup:list', (e) => {
    requirePermission(e, 'security')
    const dir = ensureBackupsDir()
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f))
        return { name: f, size: st.size, date: st.mtime.toISOString(), path: path.join(dir, f) }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  ipcMain.handle('backup:integrity', (e) => {
    requirePermission(e, 'security')
    return integrityCheck()
  })

  ipcMain.handle('backup:autoRun', () => autoBackup())

  ipcMain.handle('backup:dir', () => backupsDir())

  ipcMain.handle('db:path', () => getDbPath())
}

import { ipcMain, app } from 'electron'
import { getSetting, setSetting, logActivity, getDb } from '../db'
import { requireAuth, requirePermission } from './auth'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', (e) => {
    requireAuth(e)
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as any[]
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value ?? ''
    return out
  })

  ipcMain.handle('settings:set', (e, key: string, value: string) => {
    const s = requirePermission(e, 'settings')
    setSetting(key, String(value))
    logActivity(s.userId, s.username, 'set_setting', 'settings', `${key}=${value}`)
    return true
  })

  ipcMain.handle('settings:setMany', (e, obj: Record<string, string>) => {
    const s = requirePermission(e, 'settings')
    for (const [k, v] of Object.entries(obj)) setSetting(k, String(v))
    logActivity(s.userId, s.username, 'set_settings', 'settings', Object.keys(obj).join(','))
    return true
  })

  ipcMain.handle('app:info', () => {
    return {
      version: app.getVersion(),
      dbPath: undefined as unknown as string, // filled by backup module to avoid circular import
      platform: process.platform
    }
  })

  ipcMain.handle('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
}

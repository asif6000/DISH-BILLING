// Auto-update system (optional, needs internet only when checking/downloading).
// Default feed: GitHub Releases (asif6000/DISH-BILLING). A custom generic URL in
// Settings → Auto Update overrides it. Offline → silently skipped.
// Force-update rule: while an update is found but not yet installed, login is
// blocked (main process throws UPDATE_REQUIRED and the renderer shows UpdateGate).
import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getSetting, setSetting, logActivity } from './db'
import { requireAuth } from './ipc/auth'
import { updateStatus, isUpdatePending, UpdateStatus } from './updateState'

export const GITHUB_OWNER = 'asif6000'
export const GITHUB_REPO = 'DISH-BILLING'

// File logger so update problems are always diagnosable (userData/updater.log)
let logFile: string | null = null
function ulog(level: string, msg: string): void {
  try {
    if (!logFile) logFile = join(app.getPath('userData'), 'updater.log')
    // keep the log small
    try { if (fs.statSync(logFile).size > 500_000) fs.writeFileSync(logFile, '') } catch { /* ignore */ }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${level}: ${msg}\n`)
  } catch { /* ignore */ }
  if (level === 'ERROR') console.error('[updater]', msg)
}

let autoUpdater: any = null

function broadcast(win: BrowserWindow | null) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status', updateStatus)
  }
}

function setStatus(state: string, info?: any, percent = 0) {
  updateStatus.state = state
  updateStatus.info = info || updateStatus.info
  updateStatus.percent = percent
  const wins = BrowserWindow.getAllWindows()
  for (const w of wins) broadcast(w)
}

export { isUpdatePending }

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  let updater: any
  try {
    // lazy require so the app never crashes if the module is missing
    updater = require('electron-updater').autoUpdater
  } catch {
    return
  }
  autoUpdater = updater
  updater.autoDownload = true // internet available + update found → downloads automatically
  updater.logger = {
    info: (m: any) => ulog('INFO', String(m)),
    warn: (m: any) => ulog('WARN', String(m)),
    error: (m: any) => ulog('ERROR', String(m)),
    debug: (m: any) => ulog('DEBUG', String(m))
  } as any

  updater.on('checking-for-update', () => setStatus('checking'))
  updater.on('update-available', (info: any) => setStatus('available', info))
  updater.on('update-not-available', (info: any) => setStatus('not-available', info))
  updater.on('error', (err: any) => {
    // offline / bad URL / no releases → just report, never block the app
    setStatus('error', { message: String(err?.message || err).slice(0, 300) })
  })
  updater.on('download-progress', (p: any) => setStatus('downloading', null, Math.round(p.percent)))
  updater.on('update-downloaded', (info: any) => {
    setStatus('downloaded', info)
    // auto-install: brief warning (save your work), then restart — no click needed.
    // (pre-login the UpdateGate installs even sooner, ~2.5s)
    if (dialog) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update',
        message: 'আপডেট ইনস্টল হচ্ছে… কাজ সেভ করুন! ১০ সেকেন্ডের মধ্যে অ্যাপ নিজে নিজে রিস্টার্ট হবে।\n\nInstalling update… please save your work! The app restarts automatically in 10 seconds.',
        buttons: ['এখনই / Now'],
        defaultId: 0
      }).then((r: any) => {
        if (r.response === 0) updater.quitAndInstall(false, true)
      }).catch(() => {})
    }
    setTimeout(() => {
      try { updater.quitAndInstall(false, true) } catch { /* already restarting */ }
    }, 10_000)
  })

  // check on startup AND every 5 minutes — internet থাকলেই আপডেট নিজে নিজে নামবে ও ইনস্টল হবে
  if (getSetting('auto_update_check', '1') === '1') {
    setTimeout(() => checkForUpdates(false).catch(() => {}), 8000)
    setInterval(() => checkForUpdates(false).catch(() => {}), 5 * 60 * 1000)
  }
}

function feed(): { provider: string; url?: string; owner?: string; repo?: string } {
  const url = getSetting('update_url', '').trim()
  if (url) return { provider: 'generic', url: url.replace(/\/$/, '') + '/' }
  return { provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO }
}

export async function checkForUpdates(manual: boolean): Promise<{ state: string; info?: any }> {
  if (!autoUpdater) {
    if (manual) throw new Error('UPDATER_UNAVAILABLE')
    return { state: 'unavailable' }
  }
  const f = feed()
  autoUpdater.setFeedURL(f)
  try {
    await autoUpdater.checkForUpdates()
    return { state: updateStatus.state, info: updateStatus.info }
  } catch (e: any) {
    // custom update URL failed → try the default GitHub feed once before giving
    // up, so a stale/incorrect Settings → Auto Update URL can never fully kill
    // auto-update
    if (f.provider === 'generic') {
      try {
        autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO })
        await autoUpdater.checkForUpdates()
        return { state: updateStatus.state, info: updateStatus.info }
      } catch { /* report the original error below */ }
    }
    setStatus('error', { message: String(e?.message || e).slice(0, 300) })
    throw e
  }
}

export function registerUpdaterIpc(): void {
  // status / download / install / manual check are allowed before login:
  // the forced-update gate runs on the login screen.
  ipcMain.handle('updater:check', async () => checkForUpdates(true))

  ipcMain.handle('updater:download', () => {
    if (!autoUpdater) throw new Error('UPDATER_UNAVAILABLE')
    autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('updater:install', () => {
    if (!autoUpdater) throw new Error('UPDATER_UNAVAILABLE')
    logActivity(null, null, 'update_install', 'settings', '')
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  ipcMain.handle('updater:status', (): UpdateStatus => updateStatus)

  ipcMain.handle('updater:configure', (e, url: string, autoCheck: boolean) => {
    const s = requireAuth(e)
    setSetting('update_url', String(url || '').trim())
    setSetting('auto_update_check', autoCheck ? '1' : '0')
    logActivity(s.userId, s.username, 'configure_updater', 'settings', url)
    return true
  })

  ipcMain.handle('updater:appVersion', () => app.getVersion())
}

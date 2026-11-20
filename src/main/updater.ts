// Auto-update system (optional, needs internet only when checking/downloading).
// Default feed: GitHub Releases (asif6000/DISH-BILLING). A custom generic URL in
// Settings → Auto Update overrides it. Offline → silently skipped.
// Force-update rule: while an update is found but not yet installed, login is
// blocked (main process throws UPDATE_REQUIRED and the renderer shows UpdateGate).
import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { getSetting, setSetting, logActivity } from './db'
import { requireAuth } from './ipc/auth'
import { updateStatus, isUpdatePending, UpdateStatus } from './updateState'

export const GITHUB_OWNER = 'asif6000'
export const GITHUB_REPO = 'DISH-BILLING'

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
  updater.autoDownload = false // download is triggered by the UpdateGate (forced) or by the user

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
    if (dialog) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'নতুন ভার্সন ডাউনলোড হয়েছে। ইনস্টল করতে চান?\n\nNew version downloaded. Install now?',
        buttons: ['এখনই ইনস্টল / Install Now', 'পরে / Later'],
        defaultId: 0,
        cancelId: 1
      }).then((r: any) => {
        if (r.response === 0) updater.quitAndInstall(false, true)
      })
    }
  })

  // check on startup (GitHub by default) — offline fails silently
  if (getSetting('auto_update_check', '1') === '1') {
    setTimeout(() => checkForUpdates(false).catch(() => {}), 8000)
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
  autoUpdater.setFeedURL(feed())
  try {
    await autoUpdater.checkForUpdates()
    return { state: updateStatus.state, info: updateStatus.info }
  } catch (e: any) {
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

// Auto-update system (optional, needs internet only when checking/downloading).
// Feed URL is configurable in Settings → Auto Update. Offline → silently skipped.
import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { getSetting, setSetting, logActivity } from './db'
import { requireAuth } from './ipc/auth'

let autoUpdater: any = null
let currentStatus = { state: 'idle', info: null as any, percent: 0 }

function broadcast(win: BrowserWindow | null) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status', currentStatus)
  }
}

function setStatus(state: string, info?: any, percent = 0) {
  currentStatus = { state, info: info || currentStatus.info, percent }
  const wins = BrowserWindow.getAllWindows()
  for (const w of wins) broadcast(w)
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  let updater: any
  try {
    // lazy require so the app never crashes if the module is missing
    updater = require('electron-updater').autoUpdater
  } catch {
    return
  }
  autoUpdater = updater
  updater.autoDownload = false // user confirms download (keeps control, offline-friendly)

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

  // check on startup if enabled and configured
  const url = getSetting('update_url', '')
  if (getSetting('auto_update_check', '1') === '1' && url) {
    setTimeout(() => checkForUpdates(false), 8000)
  }
}

async function configureFeed(url: string): Promise<void> {
  if (!autoUpdater) throw new Error('UPDATER_UNAVAILABLE')
  if (url) {
    autoUpdater.setFeedURL({ provider: 'generic', url: url.replace(/\/$/, '') + '/' })
  }
}

async function checkForUpdates(manual: boolean): Promise<{ state: string; info?: any }> {
  if (!autoUpdater) return { state: 'unavailable' }
  const url = getSetting('update_url', '')
  if (!url) {
    if (manual) throw new Error('UPDATE_URL_NOT_SET')
    return { state: 'not-configured' }
  }
  await configureFeed(url)
  try {
    await autoUpdater.checkForUpdates()
    return { state: currentStatus.state, info: currentStatus.info }
  } catch (e: any) {
    setStatus('error', { message: String(e?.message || e).slice(0, 300) })
    throw e
  }
}

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:check', async (e) => {
    requireAuth(e)
    const r = await checkForUpdates(true)
    return r
  })

  ipcMain.handle('updater:download', async (e) => {
    requireAuth(e)
    if (!autoUpdater) throw new Error('UPDATER_UNAVAILABLE')
    autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('updater:install', (e) => {
    requireAuth(e)
    if (!autoUpdater) throw new Error('UPDATER_UNAVAILABLE')
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  ipcMain.handle('updater:status', (e) => {
    requireAuth(e)
    return currentStatus
  })

  ipcMain.handle('updater:configure', (e, url: string, autoCheck: boolean) => {
    const s = requireAuth(e)
    setSetting('update_url', String(url || '').trim())
    setSetting('auto_update_check', autoCheck ? '1' : '0')
    logActivity(s.userId, s.username, 'configure_updater', 'settings', url)
    if (url) configureFeed(String(url).trim())
    return true
  })

  ipcMain.handle('updater:appVersion', () => app.getVersion())
}

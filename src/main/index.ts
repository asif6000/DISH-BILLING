import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'path'
import { initDb, getDbPath, getSetting, integrityCheck } from './db'
import { registerAllIpc } from './ipc'
import { cleanupWindow } from './ipc/auth'
import { generateInternal } from './ipc/billing'
import { autoBackup, backupsDir } from './ipc/backup'
import { initAutoUpdater } from './updater'
import { registerPrintIpc } from './print'

let mainWindow: BrowserWindow | null = null
let dbReady = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // release this window's workspace connection and close any impersonation
  // audit row when the window goes away
  const winId = mainWindow.webContents.id
  mainWindow.on('closed', () => {
    try { cleanupWindow(winId) } catch { /* app shutting down */ }
    mainWindow = null
  })

  // Prevent accidental close without confirmation when logged in
  mainWindow.on('close', (ev) => {
    // allow close; renderer handles unsaved states
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const template: any[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Print Current View', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.print({}) },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Maintenance timers
let backupTimer: NodeJS.Timeout | null = null

function startAutomation(): void {
  // Auto billing on startup (idempotent — skips already generated)
  try {
    if (getSetting('auto_billing', '1') === '1') {
      generateInternal(new Date().toISOString().slice(0, 7), 'auto')
    }
  } catch { /* non-fatal */ }

  // Auto backup every 12h if enabled
  backupTimer = setInterval(() => {
    try {
      if (getSetting('auto_backup', '1') === '1') autoBackup()
    } catch { /* ignore */ }
  }, 12 * 60 * 60 * 1000)

  // initial backup on start if last one is older than 24h
  try {
    const fs = require('fs')
    const dir = backupsDir()
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f: string) => f.endsWith('.db')).sort() : []
    const last = files[files.length - 1]
    const stale = !last || (Date.now() - fs.statSync(require('path').join(dir, last)).mtime.getTime() > 24 * 3600 * 1000)
    if (stale && getSetting('auto_backup', '1') === '1') autoBackup()
  } catch { /* ignore */ }
}

app.whenReady().then(() => {
  try {
    initDb()
    dbReady = true
    if (!integrityCheck()) {
      dialog.showErrorBox('Database Error', 'Local database integrity check failed. Please restore from a backup (Security → Backup & Restore).')
    }
  } catch (err: any) {
    dialog.showErrorBox('Startup Error', 'Failed to open local database: ' + (err?.message || err))
    app.exit(1)
    return
  }

  registerAllIpc()
  registerPrintIpc()
  buildMenu()
  createWindow()
  startAutomation()
  initAutoUpdater(mainWindow!)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backupTimer) clearInterval(backupTimer)
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backupTimer) clearInterval(backupTimer)
})

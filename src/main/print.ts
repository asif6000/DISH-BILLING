import { BrowserWindow, ipcMain, app } from 'electron'

const printWindows = new Set<BrowserWindow>()

export function registerPrintIpc(): void {
  // Open a print preview window with the HTML document; user picks printer via native dialog
  ipcMain.handle('print:preview', (e, html: string, title = 'Document') => {
    const parent = BrowserWindow.fromWebContents(e.sender)
    const win = new BrowserWindow({
      width: 900, height: 800,
      title,
      parent: parent || undefined,
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    })
    printWindows.add(win)
    win.on('closed', () => printWindows.delete(win))
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; color: #111 }
        .toolbar { position: sticky; top: 0; background: #f3f4f6; padding: 8px 14px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #e5e7eb }
        .toolbar button { padding: 6px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px }
        .toolbar button.primary { background: #4f46e5; color: #fff; border-color: #4f46e5 }
        .toolbar select { padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px }
        @media print { .toolbar { display: none } }
      </style></head><body>
      <div class="toolbar">
        <button class="primary" onclick="window.print()">🖨 Print</button>
        <select onchange="setPaper(this.value)">
          <option value="a4">A4</option>
          <option value="thermal80">Thermal 80mm</option>
          <option value="thermal58">Thermal 58mm</option>
        </select>
      </div>
      <div id="doc">${html}</div>
      <script>
        function setPaper(kind) {
          const style = document.getElementById('paperstyle') || document.createElement('style');
          style.id = 'paperstyle';
          if (kind === 'thermal80') style.textContent = '@page { size: 80mm auto; margin: 4mm } #doc { width: 72mm; font-size: 11px } body { margin: 0 }';
          else if (kind === 'thermal58') style.textContent = '@page { size: 58mm auto; margin: 3mm } #doc { width: 52mm; font-size: 10px } body { margin: 0 }';
          else style.textContent = '@page { size: A4; margin: 12mm }';
          document.head.appendChild(style);
        }
      </script></body></html>`
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(doc))
    return true
  })

  // Silent direct printing to a named printer (thermal)
  ipcMain.handle('print:silent', async (e, html: string, deviceName?: string) => {
    const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } })
    printWindows.add(win)
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body>${html}</body></html>`))
    return new Promise((resolve) => {
      win.webContents.print({ silent: true, deviceName: deviceName || undefined, margins: { marginType: 'none' } }, (ok) => {
        win.close()
        resolve(ok)
      })
    })
  })

  ipcMain.handle('print:getPrinters', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return win ? win.webContents.getPrintersAsync() : []
  })

  app.on('before-quit', () => {
    for (const w of printWindows) { try { w.close() } catch { /* ignore */ } }
  })
}

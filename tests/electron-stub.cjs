// Test-only stub for the electron module (node:sqlite business-logic tests)
const path = require('path')
const os = require('os')

module.exports = {
  app: {
    getPath: (name) => path.join(os.tmpdir(), 'ava-test-' + name),
    whenReady: () => Promise.resolve(),
    relaunch: () => {},
    exit: () => {},
    on: () => {},
    getVersion: () => '1.0.0-test'
  },
  ipcMain: {
    _handlers: {},
    handle: (ch, fn) => { module.exports.ipcMain._handlers[ch] = fn }
  },
  BrowserWindow: class {},
  shell: { openExternal: () => {} },
  Notification: class { static isSupported() { return false } show() {} },
  dialog: {}
}

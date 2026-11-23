process.env.NODE_ENV = 'test';
const { initDb } = require('./tests/.dbg.cjs');
// reuse the bundle's internals by requiring the bundled main and stub
const handlers = () => (require('./tests/electron-stub.cjs').ipcMain._handlers);

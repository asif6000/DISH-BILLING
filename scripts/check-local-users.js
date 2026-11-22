// Diagnostic: show local users + recent activity logs from the app's SQLite DB.
// Run:  node scripts/check-local-users.js
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const root = process.env.APPDATA
if (!root) { console.error('APPDATA not found'); process.exit(1) }

// Electron names the userData folder after productName or name — check all candidates
const dirs = fs.readdirSync(root).filter((d) => /ava/i.test(d))
let dbFile = null
for (const d of dirs) {
  const f = path.join(root, d, 'ava-cable.db')
  if (fs.existsSync(f)) { dbFile = f; break }
}
if (!dbFile) {
  console.error('ava-cable.db not found under %APPDATA% — folders checked:', dirs.join(', ') || '(none)')
  process.exit(1)
}
console.log('DB:', dbFile)

const db = new DatabaseSync(dbFile, { readOnly: true })

console.log('\n=== users ===')
console.table(db.prepare('SELECT id, username, full_name, status, last_login FROM users ORDER BY id').all())

console.log('\n=== recent activity_logs (last 20) ===')
console.table(db.prepare('SELECT id, created_at, username, action, details FROM activity_logs ORDER BY id DESC LIMIT 20').all())

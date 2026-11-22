// Make an AVA Cable Management user an Administrator directly in the live DB.
// Usage: node scripts/make-admin.js [--super]
// - creates a backup of the database first
// - shows the user list and asks you to pick a number
// - sets the chosen user's role to 'Administrator' (--super => 'SUPER_ADMIN')
const { DatabaseSync } = require('node:sqlite')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const readline = require('readline')

const APPDATA = path.join(process.env.APPDATA, 'AVA Cable Management System')
const DB = path.join(APPDATA, 'ava-cable.db')
const NEW_ROLE = process.argv.includes('--super') ? 'SUPER_ADMIN' : 'Administrator'

// safety: the app must be closed (SQLite WAL lock)
try {
  const out = execSync('tasklist /FI "IMAGENAME eq AVA Cable Management.exe" /FO CSV /NH', { encoding: 'utf8' })
  if (out.includes('AVA Cable Management.exe')) {
    console.error('\n❌ অ্যাপ এখন চালু আছে!')
    console.error('   প্রথমে "AVA Cable Management" অ্যাপটা সম্পূর্ণ বন্ধ (close) করুন,')
    console.error('   তারপর এই ফাইলটা আবার ডাবল-ক্লিক করুন।')
    process.exit(1)
  }
} catch { /* tasklist failed — continue */ }

if (!fs.existsSync(DB)) {
  console.error('❌ ডাটাবেস পাওয়া যায়নি:', DB)
  process.exit(1)
}

// 1) backup
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
const backup = path.join(APPDATA, `ava-cable.db.backup-${stamp}`)
fs.copyFileSync(DB, backup)
console.log('✅ ব্যাকআপ নেওয়া হলো:', backup)

// 2) open + list users
const db = new DatabaseSync(DB)
const users = db.prepare('SELECT u.id, u.username, u.full_name, u.status, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id').all()
console.log('\nইউজার লিস্ট:')
users.forEach((u, i) => console.log(`  [${i + 1}]  ${u.username}  —  ${u.full_name}  [বর্তমান রোল: ${u.role_name}]  ${u.status}`))

const role = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(NEW_ROLE)
if (!role) {
  console.error(`❌ রোল "${NEW_ROLE}" পাওয়া যায়নি`)
  db.close()
  process.exit(1)
}

// 3) ask which user to promote
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question(`\nকোন ইউজারকে "${NEW_ROLE}" বানাতে চান? নম্বর লিখুন (যেমন 3): `, (answer) => {
  rl.close()
  const idx = parseInt(String(answer).trim(), 10)
  const target = users[idx - 1]
  if (!target) {
    console.error('❌ ভুল নম্বর — আবার চালান')
    db.close()
    process.exit(1)
  }
  if (target.role_name === NEW_ROLE) {
    console.log(`ℹ️  ${target.full_name} (${target.username}) ইতিমধ্যেই ${NEW_ROLE} — কিছু বদলানো হয়নি।`)
    db.close()
    process.exit(0)
  }
  db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role.id, target.id)
  const after = db.prepare('SELECT u.id, u.username, u.full_name, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(target.id)
  console.log(`\n✅ সফল!  ${after.full_name} (${after.username}) এখন ** ${after.role_name} ** রোলে আছে।`)
  console.log('\n📌 এখন অ্যাপ খুলে ওই ইউজার দিয়ে logout → login করুন — নতুন মেনু/অনুমতি দেখা যাবে।')
  db.close()
})

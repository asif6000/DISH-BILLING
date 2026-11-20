#!/usr/bin/env node
// Generates the monthly subscription activation code for AVA Cable Management.
// Usage:
//   node scripts/gen-sub-code.js           -> code for the current month
//   node scripts/gen-sub-code.js 2026-03   -> code for a specific month
// Give the code to the customer after they pay (bKash 01331707900 / Nagad 01616595386).
// A valid code extends the app subscription by 1 year. The previous month's code
// also keeps working as a grace period.
const crypto = require('crypto')

const SECRET = 'AVA-Cable-Sub-2025#x9K' // keep in sync with src/main/subscription.ts

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

let target
if (process.argv[2]) {
  const [y, m] = process.argv[2].split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) {
    console.error('Usage: node scripts/gen-sub-code.js [YYYY-MM]')
    process.exit(1)
  }
  target = monthKey(y, m)
} else {
  const d = new Date()
  target = monthKey(d.getFullYear(), d.getMonth() + 1)
}

const code = crypto.createHash('sha256').update(SECRET + '|' + target).digest('hex').slice(0, 8).toUpperCase()
console.log(`Month: ${target}`)
console.log(`Activation code: ${code}`)

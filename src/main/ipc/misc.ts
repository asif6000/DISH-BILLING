import { ipcMain, shell, Notification } from 'electron'
import { getDb, logActivity, round2, today, currentMonth, getSetting } from '../db'
import { requirePermission } from './auth'
import { generateInternal } from './billing'

export function registerMiscIpc(): void {
  // ---------- Reseller wallet ----------
  ipcMain.handle('resellers:txn', (e, data: { reseller_id: number; type: 'recharge' | 'payment' | 'commission' | 'due'; amount: number; note?: string; date?: string }) => {
    const s = requirePermission(e, 'resellers')
    const db = getDb()
    const amount = round2(Number(data.amount))
    if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
    const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(data.reseller_id) as any
    if (!reseller) throw new Error('NOT_FOUND')
    db.exec('BEGIN')
    try {
      db.prepare('INSERT INTO reseller_txns (reseller_id, type, amount, note, date) VALUES (?,?,?,?,?)')
        .run(data.reseller_id, data.type, amount, data.note || null, data.date || today())
      let delta = 0
      if (data.type === 'recharge' || data.type === 'commission') delta = amount
      else if (data.type === 'payment') delta = -amount
      else if (data.type === 'due') delta = -amount
      db.prepare('UPDATE resellers SET wallet_balance = wallet_balance + ? WHERE id = ?').run(delta, data.reseller_id)
      const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
      if (account && (data.type === 'recharge' || data.type === 'payment')) {
        const cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Other Income' OR name = 'Other Expense' ORDER BY id LIMIT 1").get() as any
        db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
          .run(account.id, data.type === 'recharge' ? 'income' : 'expense', cat ? cat.id : null, data.date || today(), amount, `Reseller ${data.type}: ${reseller.name}`, null, s.username)
        db.prepare('UPDATE accounts SET balance = balance ' + (data.type === 'recharge' ? '+' : '-') + ' ? WHERE id = ?').run(amount, account.id)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'reseller_txn', 'resellers', `${data.type}:${amount}`)
    return true
  })

  ipcMain.handle('resellers:txns', (e, resellerId: number) => {
    requirePermission(e, 'resellers')
    return getDb().prepare('SELECT * FROM reseller_txns WHERE reseller_id = ? ORDER BY date DESC, id DESC').all(resellerId)
  })

  // ---------- Transactions (accounts) bespoke ----------
  ipcMain.handle('transactions:create', (e, data: any) => {
    const s = requirePermission(e, 'accounts')
    const db = getDb()
    const amount = round2(Number(data.amount))
    if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
    if (!data.account_id || !data.type) throw new Error('MISSING_FIELDS')
    // description is optional now — auto-generated so reports/history stay meaningful
    const cat = data.category_id ? db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(data.category_id) as any : null
    const description = String(data.description || '').trim()
      || `${data.type === 'income' ? 'Income' : 'Expense'}${cat ? ' — ' + cat.name : ''}`
    const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(data.account_id) as any
    if (!acct) throw new Error('ACCOUNT_NOT_FOUND')
    // expense cannot overdraw the main balance (atomic check inside the transaction)
    if (data.type === 'expense' && round2(acct.balance) < amount) throw new Error('INSUFFICIENT_BALANCE')
    const dhaka = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' })
    const date = data.date || dhaka.slice(0, 10)
    db.exec('BEGIN')
    try {
      db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by, created_local_time) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(data.account_id, data.type, data.category_id || null, date, amount, description, data.ref || null, s.username, dhaka)
      db.prepare('UPDATE accounts SET balance = balance ' + (data.type === 'income' ? '+' : '-') + ' ? WHERE id = ?').run(amount, data.account_id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, `create_${data.type}`, 'accounts', String(amount))
    return true
  })

  // edit an expense/income: reverse the old deduction, apply the new one (atomic)
  ipcMain.handle('transactions:update', (e, id: number, data: any) => {
    const s = requirePermission(e, 'accounts')
    const db = getDb()
    const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (!old) throw new Error('NOT_FOUND')
    const amount = round2(Number(data.amount))
    if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
    const accountId = data.account_id || old.account_id
    const type = data.type || old.type
    const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any
    if (!acct) throw new Error('ACCOUNT_NOT_FOUND')
    // reversal: undo the old entry on its account, then apply the new one
    const balanceAfterReversal = round2(acct.balance + (old.type === 'income' ? -old.amount : old.amount))
    if (type === 'expense' && balanceAfterReversal < amount) throw new Error('INSUFFICIENT_BALANCE')
    const cat = data.category_id ? db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(data.category_id) as any : null
    const description = String(data.description || '').trim() || `${type === 'income' ? 'Income' : 'Expense'}${cat ? ' — ' + cat.name : ''}`
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE accounts SET balance = balance ' + (old.type === 'income' ? '-' : '+') + ' ? WHERE id = ?').run(old.amount, old.account_id)
      db.prepare('UPDATE accounts SET balance = balance ' + (type === 'income' ? '+' : '-') + ' ? WHERE id = ?').run(amount, accountId)
      db.prepare('UPDATE transactions SET account_id = ?, type = ?, category_id = ?, date = ?, amount = ?, description = ?, ref = ? WHERE id = ?')
        .run(accountId, type, data.category_id || old.category_id, data.date || old.date, amount, description, data.ref ?? old.ref, id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, `update_${type}`, 'accounts', `#${id}: ${old.amount}→${amount}`)
    return true
  })

  // delete an expense/income: reverse its previous deduction (ledger stays consistent)
  ipcMain.handle('transactions:delete', (e, id: number) => {
    const s = requirePermission(e, 'accounts')
    const db = getDb()
    const old = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any
    if (!old) throw new Error('NOT_FOUND')
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE accounts SET balance = balance ' + (old.type === 'income' ? '-' : '+') + ' ? WHERE id = ?').run(old.amount, old.account_id)
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, `delete_${old.type}`, 'accounts', `#${id}: ${old.amount} reversed`)
    return true
  })

  // Main Balance = sum of all active account balances
  ipcMain.handle('accounts:mainBalance', (e) => {
    requirePermission(e, 'accounts')
    const db = getDb()
    const r = db.prepare("SELECT COALESCE(SUM(balance),0) AS v FROM accounts WHERE status = 'active'").get() as { v: number }
    return { balance: round2(r.v) }
  })

  // paginated transaction list (search + type filter) — decorated with labels
  ipcMain.handle('transactions:list', (e, params: any = {}) => {
    requirePermission(e, 'accounts')
    const db = getDb()
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(200, Math.max(5, params.pageSize || 20))
    const where: string[] = []
    const args: any[] = []
    if (params.filters?.type) { where.push('t.type = ?'); args.push(params.filters.type) }
    if (params.search) {
      where.push('(t.description LIKE ? OR t.ref LIKE ? OR ec.name LIKE ? OR a.name LIKE ?)')
      const like = `%${params.search}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db.prepare(`SELECT t.*, ec.name AS _category_id_label, a.name AS _account_id_label
      FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      ${whereSql} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    return { rows, total, page, pageSize }
  })

  ipcMain.handle('account_transfers:create', (e, data: any) => {
    const s = requirePermission(e, 'accounts')
    const db = getDb()
    const amount = round2(Number(data.amount))
    if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
    if (data.from_account_id === data.to_account_id) throw new Error('SAME_ACCOUNT')
    const from = db.prepare('SELECT * FROM accounts WHERE id = ?').get(data.from_account_id) as any
    if (!from) throw new Error('FROM_NOT_FOUND')
    if (round2(from.balance) < amount) throw new Error('INSUFFICIENT_BALANCE')
    db.exec('BEGIN')
    try {
      db.prepare('INSERT INTO account_transfers (from_account_id, to_account_id, date, amount, note) VALUES (?,?,?,?,?)')
        .run(data.from_account_id, data.to_account_id, data.date || today(), amount, data.note || null)
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, data.from_account_id)
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, data.to_account_id)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'account_transfer', 'accounts', String(amount))
    return true
  })

  // ---------- Cashbook ----------
  ipcMain.handle('accounts:cashbook', (e, from: string, to: string) => {
    requirePermission(e, 'accounts')
    const db = getDb()
    const opening = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) + (SELECT COALESCE(SUM(opening_balance),0) FROM accounts)
      FROM transactions WHERE date < ?`).get(from) as { opening?: number }).opening || 0
    const rows = db.prepare(`SELECT t.*, ec.name AS category, a.name AS account FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.date BETWEEN ? AND ? ORDER BY t.date, t.id`).all(from, to)
    let running = Number(opening)
    for (const r of rows as any[]) {
      running += r.type === 'income' ? r.amount : -r.amount
      r.balance = round2(running)
    }
    return { opening: round2(Number(opening)), rows }
  })

  // ---------- Messages ----------
  ipcMain.handle('messages:composeDue', (e, templateId: number, month: string) => {
    const s = requirePermission(e, 'messaging')
    const db = getDb()
    const template = db.prepare('SELECT * FROM sms_templates WHERE id = ?').get(templateId) as any
    if (!template) throw new Error('TEMPLATE_NOT_FOUND')
    const company = getSetting('company_name', 'AVA Cable Network')
    const dues = db.prepare(`SELECT c.id, c.name, c.mobile, COALESCE(SUM(b.total - b.paid),0) AS due
      FROM customers c JOIN bills b ON b.customer_id = c.id
      WHERE c.status = 'active' AND b.month = ? AND b.status != 'cancelled' AND b.status != 'paid'
      GROUP BY c.id HAVING due > 0`).all(month) as any[]
    const ins = db.prepare('INSERT INTO messages (customer_id, mobile, channel, type, text, status) VALUES (?,?,?,?,?,?)')
    let created = 0
    for (const c of dues) {
      const text = template.content
        .replace(/{{name}}/g, c.name).replace(/{{month}}/g, month)
        .replace(/{{total}}/g, String(round2(c.due))).replace(/{{amount}}/g, String(round2(c.due)))
        .replace(/{{company}}/g, company)
      ins.run(c.id, c.mobile, template.type === 'marketing' ? 'whatsapp' : 'sms', template.type, text, 'draft')
      created++
    }
    logActivity(s.userId, s.username, 'compose_due_messages', 'messaging', `${created}`)
    return created
  })

  ipcMain.handle('messages:send', (e, messageId: number) => {
    const s = requirePermission(e, 'messaging')
    const db = getDb()
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any
    if (!msg) throw new Error('NOT_FOUND')
    if (msg.channel === 'whatsapp' && msg.mobile) {
      // opens WhatsApp with prefilled text (requires internet)
      const phone = '88' + String(msg.mobile).replace(/\D/g, '')
      shell.openExternal(`https://wa.me/${phone}?text=${encodeURIComponent(msg.text)}`)
    } else {
      // SMS: no gateway offline — record as queued for external gateway
      db.prepare('UPDATE messages SET status = ? WHERE id = ?').run('queued', messageId)
      shell.openExternal(`sms:${msg.mobile}?body=${encodeURIComponent(msg.text)}`)
      return { status: 'queued' }
    }
    db.prepare('UPDATE messages SET status = ?, sent_at = datetime(\'now\') WHERE id = ?').run('sent', messageId)
    logActivity(s.userId, s.username, 'send_message', 'messaging', String(messageId))
    return { status: 'sent' }
  })

  ipcMain.handle('messages:markSent', (e, messageId: number) => {
    const s = requirePermission(e, 'messaging')
    getDb().prepare('UPDATE messages SET status = ?, sent_at = datetime(\'now\') WHERE id = ?').run('sent', messageId)
    logActivity(s.userId, s.username, 'mark_message_sent', 'messaging', String(messageId))
    return true
  })

  // ---------- Notifications ----------
  ipcMain.handle('notify:dueCustomers', (e) => {
    try {
      const db = getDb()
      const count = (db.prepare(`SELECT COUNT(DISTINCT customer_id) AS c FROM bills WHERE month = ? AND status != 'cancelled' AND status != 'paid'`).get(currentMonth()) as any).c
      if (count > 0 && Notification.isSupported()) {
        new Notification({ title: 'AVA Cable Management', body: `${count} customers have unpaid bills for ${currentMonth()}` }).show()
      }
      return count
    } catch { return 0 }
  })

  // ---------- Automation ----------
  ipcMain.handle('automation:runBilling', (e) => {
    requirePermission(e, 'automation')
    return generateInternal(currentMonth(), 'auto')
  })
}

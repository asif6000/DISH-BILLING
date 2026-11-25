// Package renewal — extend a customer's package validity and collect payment.
import { ipcMain } from 'electron'
import { getDb, logActivity, nextSeq, round2, today } from '../db'
import { requirePermission } from './auth'
import { resolveSessionCollector, collectorCustomerWhere, isCustomerAssignedTo } from './payments'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function plusMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1 + months, d || 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function plusDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function creditAccount(db: any, amount: number, date: string, description: string, ref: string, username: string, categoryName: string) {
  const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
  if (!account) return
  const cat = db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(categoryName) as any
  db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(account.id, 'income', cat ? cat.id : null, date, round2(amount), description, ref, username)
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(round2(amount), account.id)
}

export function registerRenewalIpc(): void {
  // List customers with package + validity for the renewal page
  ipcMain.handle('renewal:list', (e, params: any = {}) => {
    const s = requirePermission(e, 'payments', 'view')
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    if (me.locked) {
      if (me.error) throw new Error(me.error)
      if (me.id == null) throw new Error('NO_COLLECTOR_PROFILE')
    }
    const q = String(params.q || '').trim()
    const filter = params.filter || 'all'
    let sql = `SELECT c.id, c.code, c.name, c.mobile, c.status, c.monthly_bill, c.validity_till,
      p.name AS package, a.name AS area
      FROM customers c
      LEFT JOIN packages p ON p.id = c.package_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.status != 'inactive'`
    if (me.locked && me.id != null) sql += ` AND ${collectorCustomerWhere(me.id)}`
    const args: any[] = []
    if (q) {
      sql += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.mobile LIKE ?)'
      const like = `%${q}%`
      args.push(like, like, like)
    }
    const t = today()
    if (filter === 'expired') {
      sql += ' AND c.validity_till IS NOT NULL AND c.validity_till < ?'
      args.push(t)
    } else if (filter === 'expiring7') {
      sql += ' AND c.validity_till IS NOT NULL AND c.validity_till BETWEEN ? AND ?'
      args.push(t, plusDays(t, 7))
    } else if (filter === 'expiring30') {
      sql += ' AND c.validity_till IS NOT NULL AND c.validity_till BETWEEN ? AND ?'
      args.push(t, plusDays(t, 30))
    }
    sql += ' ORDER BY (c.validity_till IS NULL) ASC, c.validity_till ASC, c.code ASC LIMIT 500'
    return db.prepare(sql).all(...args)
  })

  // Renew: collect payment + extend validity (+ reactivate expired customer), in one transaction
  ipcMain.handle('renewal:renew', (e, input: any) => {
    const s = requirePermission(e, 'payments', 'collect')
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    if (me.locked) {
      if (me.error) throw new Error(me.error)
      if (me.id == null) throw new Error('NO_COLLECTOR_PROFILE')
    }
    const months = Math.max(1, Math.min(36, parseInt(input.months, 10) || 1))
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(input.customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    if (me.locked && me.id != null) {
      if (!isCustomerAssignedTo(db, me.id, customer.id)) throw new Error('CUSTOMER_NOT_ASSIGNED_TO_COLLECTOR')
    }
    const amount = round2(Number(input.amount) || round2(Number(customer.monthly_bill) * months))
    if (!amount || amount <= 0) throw new Error('INVALID_AMOUNT')
    const date = today()
    const receiptNo = 'RCP-' + nextSeq('receipt_seq', 6)
    // renewing early never loses days: extend from the later of (today, current validity)
    const base = customer.validity_till && customer.validity_till > date ? customer.validity_till : date
    const validityTill = plusMonths(base, months)

    db.exec('BEGIN')
    try {
      const collectorId = me.locked ? me.id : (input.collectorId || null)
      db.prepare(`INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(receiptNo, customer.id, amount, input.method || 'cash', input.reference || null, input.note || `Package renewal — ${months} month(s)`, collectorId, input.resellerId || null, date, 'renewal', s.username)
      const newStatus = customer.status === 'free' ? 'free' : 'active'
      db.prepare('UPDATE customers SET validity_till = ?, status = ? WHERE id = ?').run(validityTill, newStatus, customer.id)
      db.prepare(`INSERT INTO customer_connections (customer_id, action, from_value, to_value, date, note, created_by) VALUES (?,?,?,?,?,?,?)`)
        .run(customer.id, 'renewal', customer.validity_till || null, validityTill, date, `${months} month(s)`, s.username)
      creditAccount(db, amount, date, `Package renewal from ${customer.name} (${customer.code})`, receiptNo, s.username, 'Monthly Bill')
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'package_renew', 'payments', `${receiptNo}: ${customer.code} +${months}m -> ${validityTill}`)
    return { receiptNo, amount, validityTill }
  })
}

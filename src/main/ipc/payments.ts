import { ipcMain } from 'electron'
import { ListParams, PaymentInput } from '../../shared/types'
import { getDb, getSetting, logActivity, nextSeq, round2, today } from '../db'
import { requirePermission } from './auth'

function creditAccount(db: any, amount: number, date: string, description: string, ref: string, username: string, categoryName: string) {
  const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
  if (!account) return
  const cat = db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(categoryName) as any
  db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(account.id, 'income', cat ? cat.id : null, date, round2(amount), description, ref, username)
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(round2(amount), account.id)
}

export function registerPaymentIpc(): void {
  // Collect payment — transaction-safe, applies to oldest bills first, leftover → advance
  ipcMain.handle('payments:collect', (e, input: PaymentInput) => {
    const s = requirePermission(e, 'payments', 'collect')
    const db = getDb()
    const amount = round2(Number(input.amount))
    if (!amount || amount <= 0) throw new Error('INVALID_AMOUNT')
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(input.customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    const date = input.date || today()
    const type = input.type === 'advance' || input.applyAdvance ? 'advance' : 'bill'
    const receiptNo = 'RCP-' + nextSeq('receipt_seq', 6)
    // snapshot: customer's remaining due before/after this collection (accurate history)
    const billsDue = () => round2((db.prepare("SELECT COALESCE(SUM(total - paid),0) AS v FROM bills WHERE customer_id = ? AND status != 'cancelled'").get(customer.id) as any).v)
    const dueBefore = billsDue()
    const dhaka = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' })

    db.exec('BEGIN')
    try {
      if (type === 'advance') {
        db.prepare('INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(receiptNo, customer.id, amount, input.method || 'cash', input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, 'advance', s.username, dueBefore, dueBefore, dhaka)
        db.prepare('UPDATE customers SET advance_balance = advance_balance + ? WHERE id = ?').run(amount, customer.id)
        creditAccount(db, amount, date, `Advance payment from ${customer.name} (${customer.code})`, receiptNo, s.username, 'Monthly Bill')
      } else if (input.type === 'connection_fee') {
        db.prepare('INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(receiptNo, customer.id, amount, input.method || 'cash', input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, 'connection_fee', s.username, dueBefore, dueBefore, dhaka)
        creditAccount(db, amount, date, `Connection fee from ${customer.name} (${customer.code})`, receiptNo, s.username, 'Connection Fee')
      } else {
        let remaining = amount
        let firstBillId: number | null = input.billId || null
        const unpaid = firstBillId
          ? db.prepare("SELECT * FROM bills WHERE id = ? AND status != 'cancelled'").all(firstBillId)
          : db.prepare("SELECT * FROM bills WHERE customer_id = ? AND status != 'cancelled' AND status != 'paid' ORDER BY month ASC").all(customer.id)
        if (firstBillId && !(unpaid as any[]).length) throw new Error('BILL_NOT_FOUND_OR_PAID')
        for (const bill of unpaid as any[]) {
          if (remaining <= 0) break
          const due = round2(bill.total - bill.paid)
          if (due <= 0) continue
          const apply = round2(Math.min(remaining, due))
          const newPaid = round2(bill.paid + apply)
          const newStatus = newPaid >= bill.total ? 'paid' : 'partial'
          db.prepare('UPDATE bills SET paid = ?, status = ? WHERE id = ?').run(newPaid, newStatus, bill.id)
          if (!firstBillId) firstBillId = bill.id
          remaining = round2(remaining - apply)
        }
        if (remaining > 0) {
          db.prepare('UPDATE customers SET advance_balance = advance_balance + ? WHERE id = ?').run(remaining, customer.id)
        }
        db.prepare('INSERT INTO payments (receipt_no, customer_id, bill_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(receiptNo, customer.id, firstBillId, amount, input.method || 'cash', input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, 'bill', s.username, dueBefore, round2(dueBefore - (amount - remaining)), dhaka)
        creditAccount(db, amount, date, `Payment from ${customer.name} (${customer.code})`, receiptNo, s.username, 'Monthly Bill')
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'collect_payment', 'payments', `${receiptNo}: ${amount}`)
    return { receiptNo, amount }
  })

  // refund advance payment
  ipcMain.handle('payments:refund', (e, customerId: number, amount: number, note: string) => {
    const s = requirePermission(e, 'payments', 'refund')
    const db = getDb()
    const amt = round2(Number(amount))
    if (!amt || amt <= 0) throw new Error('INVALID_AMOUNT')
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    if (round2(customer.advance_balance) < amt) throw new Error('INSUFFICIENT_ADVANCE')
    const receiptNo = 'RFD-' + nextSeq('receipt_seq', 6)
    db.exec('BEGIN')
    try {
      db.prepare('INSERT INTO payments (receipt_no, customer_id, amount, method, note, payment_date, type, created_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(receiptNo, customerId, amt, 'cash', note || 'Advance refund', today(), 'refund', s.username)
      db.prepare('UPDATE customers SET advance_balance = advance_balance - ? WHERE id = ?').run(amt, customerId)
      const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
      if (account) {
        db.prepare('INSERT INTO transactions (account_id, type, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?)')
          .run(account.id, 'expense', today(), amt, `Refund to ${customer.name} (${customer.code})`, receiptNo, s.username)
        db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amt, account.id)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'refund', 'payments', `${receiptNo}: ${amt}`)
    return { receiptNo, amount: amt }
  })

  // use advance balance to pay dues
  ipcMain.handle('payments:useAdvance', (e, customerId: number) => {
    const s = requirePermission(e, 'payments', 'collect')
    const db = getDb()
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    const advance = round2(customer.advance_balance)
    if (advance <= 0) throw new Error('NO_ADVANCE')
    const receiptNo = 'RCP-' + nextSeq('receipt_seq', 6)
    let leftover = advance
    db.exec('BEGIN')
    try {
      let remaining = advance
      const unpaid = db.prepare("SELECT * FROM bills WHERE customer_id = ? AND status != 'cancelled' AND status != 'paid' ORDER BY month ASC").all(customerId) as any[]
      for (const bill of unpaid) {
        if (remaining <= 0) break
        const due = round2(bill.total - bill.paid)
        if (due <= 0) continue
        const apply = round2(Math.min(remaining, due))
        const newPaid = round2(bill.paid + apply)
        db.prepare('UPDATE bills SET paid = ?, status = ? WHERE id = ?').run(newPaid, newPaid >= bill.total ? 'paid' : 'partial', bill.id)
        remaining = round2(remaining - apply)
      }
      leftover = remaining
      db.prepare('UPDATE customers SET advance_balance = ? WHERE id = ?').run(remaining, customerId)
      db.prepare('INSERT INTO payments (receipt_no, customer_id, amount, method, note, payment_date, type, created_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(receiptNo, customerId, round2(advance - remaining), 'advance', 'Applied advance balance to dues', today(), 'bill', s.username)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'use_advance', 'payments', String(customerId))
    return { applied: round2(advance - leftover), remaining: leftover }
  })

  ipcMain.handle('payments:list', (e, params: ListParams & { from?: string; to?: string; method?: string; collectorId?: number; areaId?: number }) => {
    requirePermission(e, 'payments', 'view')
    const db = getDb()
    const page = Math.max(1, params.page || 1)
    const pageSize = params.all ? 100000 : Math.min(200, Math.max(5, params.pageSize || 20))
    const where: string[] = []
    const args: any[] = []
    if (params.from) { where.push('p.payment_date >= ?'); args.push(params.from) }
    if (params.to) { where.push('p.payment_date <= ?'); args.push(params.to) }
    if (params.method) { where.push('p.method = ?'); args.push(params.method) }
    if (params.collectorId) { where.push('p.collector_id = ?'); args.push(params.collectorId) }
    if (params.areaId) { where.push('c.area_id = ?'); args.push(params.areaId) }
    if (params.search) {
      where.push('(c.name LIKE ? OR c.code LIKE ? OR p.receipt_no LIKE ? OR p.reference LIKE ?)')
      const like = `%${params.search}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db.prepare(`SELECT p.*, c.code AS customer_code, c.name AS customer_name, c.mobile, c.address AS customer_address, a.name AS _area, s.name AS _collector
      FROM payments p JOIN customers c ON c.id = p.customer_id
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN collectors col ON col.id = p.collector_id
      LEFT JOIN staff s ON s.id = col.staff_id
      ${whereSql} ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    const sum = db.prepare(`SELECT COALESCE(SUM(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END),0) AS s
      FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql}`).get(...args) as { s: number }
    // per-method summary (signed for refunds) — used by summary cards
    const byMethodRows = db.prepare(`SELECT p.method, COALESCE(SUM(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END),0) AS s
      FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql} GROUP BY p.method`).all(...args) as any[]
    const byMethod: Record<string, number> = {}
    for (const r of byMethodRows) byMethod[r.method] = round2(r.s)
    return { rows, total, page, pageSize, sum: round2(sum.s), byMethod }
  })

  ipcMain.handle('payments:daily', (e, from: string, to: string) => {
    requirePermission(e, 'payments', 'view')
    return getDb().prepare(`SELECT payment_date AS date,
        COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS collected,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END),0) AS refunded
      FROM payments WHERE payment_date BETWEEN ? AND ? GROUP BY payment_date ORDER BY payment_date DESC`).all(from, to)
  })

  ipcMain.handle('payments:methodSummary', (e, from: string, to: string) => {
    requirePermission(e, 'payments', 'view')
    return getDb().prepare(`SELECT method, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count FROM payments
      WHERE payment_date BETWEEN ? AND ? GROUP BY method`).all(from, to)
  })

  // receipt data for printing
  ipcMain.handle('payments:receipt', (e, receiptId: number) => {
    requirePermission(e, 'payments', 'view')
    const db = getDb()
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(receiptId) as any
    if (!payment) throw new Error('NOT_FOUND')
    const customer = db.prepare('SELECT c.*, a.name AS area_name FROM customers c LEFT JOIN areas a ON a.id = c.area_id WHERE c.id = ?').get(payment.customer_id)
    const company = {
      name: getSetting('company_name', 'AVA Cable Network'),
      name_bn: getSetting('company_name_bn', ''),
      address: getSetting('company_address', ''),
      mobile: getSetting('company_mobile', ''),
      mobile_alt: getSetting('company_mobile_alt', ''),
      email: getSetting('company_email', ''),
      logo: getSetting('company_logo', ''),
      footer: getSetting('bill_footer', '')
    }
    return { payment, customer, company }
  })
}

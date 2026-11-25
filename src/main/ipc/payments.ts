import { ipcMain } from 'electron'
import { ListParams, PaymentInput } from '../../shared/types'
import { getDb, getSetting, logActivity, nextSeq, round2, today } from '../db'
import { requireAuth, requirePermission } from './auth'

function creditAccount(db: any, amount: number, date: string, description: string, ref: string, username: string, categoryName: string) {
  const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
  if (!account) return
  const cat = db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(categoryName) as any
  db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(account.id, 'income', cat ? cat.id : null, date, round2(amount), description, ref, username)
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(round2(amount), account.id)
}

// Resolve the collector identity of the logged-in account.
// Priority: 1) explicit link (collectors.user_id, set from Security → Users)
//           2) legacy name match (users.full_name ↔ staff.name, existing data)
//           3) single-collector bootstrap (existing installs with exactly one
//              active collector and one Collector account without a link)
// - Collector-role accounts are ALWAYS locked to their own profile (never trusted
//   from the frontend); missing/inactive/ambiguous profiles deny collection.
// - Admin / Manager / Super Admin accounts are NEVER locked: they must keep the
//   manual collector dropdown even when their name happens to match a collector.
export function resolveSessionCollector(db: any, s: { userId: number; fullName: string; roleId: number }): { id: number | null; locked: boolean; error?: string } {
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(s.roleId) as any
  const roleName = role?.name || ''
  const linked = db.prepare('SELECT id, status FROM collectors WHERE user_id = ?').all(s.userId) as any[]

  // Only the Collector role is tied to one collector identity. Admins/managers
  // may pick any active collector (including "no collector").
  if (roleName !== 'Collector') {
    return { id: linked.length === 1 ? linked[0].id : null, locked: false }
  }

  const decide = (rows: any[]): { id: number | null; locked: boolean; error?: string } => {
    const active = rows.filter((r) => r.status === 'active')
    if (active.length === 1) return { id: active[0].id, locked: true }
    // never assign a random collector when the mapping is ambiguous
    if (active.length > 1) return { id: null, locked: true, error: 'AMBIGUOUS_COLLECTOR' }
    if (rows.length) return { id: null, locked: true, error: 'COLLECTOR_INACTIVE' }
    return { id: null, locked: true, error: 'NO_COLLECTOR_PROFILE' }
  }

  if (linked.length) return decide(linked)

  const byName = db.prepare(`SELECT col.id, col.status FROM collectors col
    JOIN staff st ON st.id = col.staff_id
    WHERE LOWER(TRIM(st.name)) = LOWER(TRIM(?))`).all(s.fullName) as any[]
  if (byName.length) return decide(byName)

  // Bootstrap for existing single-collector installations (e.g. an account that
  // was created before the explicit link existed). This never creates records and
  // only applies when there is exactly ONE candidate on each side.
  const unlinkedActiveCollectors = db.prepare("SELECT id, status FROM collectors WHERE user_id IS NULL AND status = 'active'").all() as any[]
  const unlinkedCollectorUsers = db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'Collector' AND u.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM collectors c WHERE c.user_id = u.id)`).all() as any[]
  if (unlinkedActiveCollectors.length === 1 && unlinkedCollectorUsers.length === 1 && unlinkedCollectorUsers[0].id === s.userId) {
    return { id: unlinkedActiveCollectors[0].id, locked: true }
  }

  return { id: null, locked: true, error: 'NO_COLLECTOR_PROFILE' }
}

// Customer assignment scope for a collector (shared by customers:list, the
// collector dashboard and payment checks):
//   explicit: customers.collector_id = collector (primary assignment), OR
//   legacy:   customer has NO explicit assignment AND the collector covers the
//             customer's area via collector_areas (existing area assignment).
// Numeric-only interpolation — callers pass resolved session ids.
export function collectorCustomerWhere(collectorId: number): string {
  const id = Number(collectorId)
  return `(c.collector_id = ${id} OR (c.collector_id IS NULL AND EXISTS (SELECT 1 FROM collector_areas ca WHERE ca.collector_id = ${id} AND ca.area_id = c.area_id)))`
}

export function isCustomerAssignedTo(db: any, collectorId: number, customerId: number): boolean {
  return !!db.prepare(`SELECT 1 FROM customers c WHERE c.id = ? AND ${collectorCustomerWhere(collectorId)}`).get(customerId)
}

export function registerPaymentIpc(): void {
  // Collect payment — transaction-safe, applies to oldest bills first, leftover → advance
  ipcMain.handle('payments:collect', (e, input: PaymentInput) => {
    const s = requirePermission(e, 'payments', 'collect')
    const db = getDb()
    // Collector identity comes from the authenticated account, NOT the frontend:
    // a logged-in collector always collects under their own collector profile;
    // admins/managers may pick any ACTIVE collector; invalid/inactive picks rejected.
    const me = resolveSessionCollector(db, s)
    let collectorId = input.collectorId ?? null
    if (me.locked) {
      if (me.error) throw new Error(me.error)
      collectorId = me.id
    } else if (collectorId != null) {
      const col = db.prepare('SELECT status FROM collectors WHERE id = ?').get(collectorId) as any
      if (!col) throw new Error('COLLECTOR_NOT_FOUND')
      if (col.status !== 'active') throw new Error('COLLECTOR_INACTIVE')
    }
    const amount = round2(Number(input.amount))
    if (!amount || amount <= 0) throw new Error('INVALID_AMOUNT')
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(input.customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    if (me.locked && me.id != null && !isCustomerAssignedTo(db, me.id, customer.id)) {
      throw new Error('CUSTOMER_NOT_ASSIGNED_TO_COLLECTOR')
    }
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
          .run(receiptNo, customer.id, amount, input.method || 'cash', input.reference || null, input.note || null, collectorId, input.resellerId || null, date, 'advance', s.username, dueBefore, dueBefore, dhaka)
        db.prepare('UPDATE customers SET advance_balance = advance_balance + ? WHERE id = ?').run(amount, customer.id)
        creditAccount(db, amount, date, `Advance payment from ${customer.name} (${customer.code})`, receiptNo, s.username, 'Monthly Bill')
      } else if (input.type === 'connection_fee') {
        db.prepare('INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(receiptNo, customer.id, amount, input.method || 'cash', input.reference || null, input.note || null, collectorId, input.resellerId || null, date, 'connection_fee', s.username, dueBefore, dueBefore, dhaka)
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
          .run(receiptNo, customer.id, firstBillId, amount, input.method || 'cash', input.reference || null, input.note || null, collectorId, input.resellerId || null, date, 'bill', s.username, dueBefore, round2(dueBefore - (amount - remaining)), dhaka)
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

  // Which collector does the logged-in account resolve to? (drives the
  // auto-selected, read-only collector field on collection pages)
  ipcMain.handle('payments:myCollector', (e) => {
    // identity lookup only — must work on refund/renewal pages too, so no
    // payments.collect requirement here (the mutation handlers enforce that)
    const s = requireAuth(e)
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    const row = me.id != null
      ? db.prepare(`SELECT st.name AS label FROM collectors col JOIN staff st ON st.id = col.staff_id WHERE col.id = ?`).get(me.id) as any
      : null
    return {
      collector: me.id != null ? { id: me.id, label: row?.label || '' } : null,
      locked: me.locked,
      error: me.error
    }
  })

  // Active collectors for the manual dropdown (admin/manager accounts).
  // Admin may assign a payment to ANY active collector (company-wide), so this
  // intentionally ignores the owner_admin_id filter used by the management list.
  ipcMain.handle('payments:collectors', (e) => {
    requirePermission(e, 'payments', 'collect')
    return getDb().prepare(`SELECT c.id, st.name || COALESCE(' — ' || NULLIF(st.mobile, ''), '') AS label
      FROM collectors c JOIN staff st ON st.id = c.staff_id
      WHERE c.status = 'active' ORDER BY st.name`).all()
  })

  // refund advance payment
  ipcMain.handle('payments:refund', (e, customerId: number, amount: number, note: string) => {
    const s = requirePermission(e, 'payments', 'refund')
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    if (me.locked && me.error) throw new Error(me.error)
    const amt = round2(Number(amount))
    if (!amt || amt <= 0) throw new Error('INVALID_AMOUNT')
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    if (me.locked && me.id != null && !isCustomerAssignedTo(db, me.id, customer.id)) {
      throw new Error('CUSTOMER_NOT_ASSIGNED_TO_COLLECTOR')
    }
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
    const me = resolveSessionCollector(db, s)
    if (me.locked && me.error) throw new Error(me.error)
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
    if (me.locked && me.id != null && !isCustomerAssignedTo(db, me.id, customer.id)) {
      throw new Error('CUSTOMER_NOT_ASSIGNED_TO_COLLECTOR')
    }
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
    const s = requirePermission(e, 'payments', 'view')
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    if (me.locked) {
      if (me.error) throw new Error(me.error)
      if (me.id == null) throw new Error('NO_COLLECTOR_PROFILE')
    }
    const page = Math.max(1, params.page || 1)
    const pageSize = params.all ? 100000 : Math.min(200, Math.max(5, params.pageSize || 20))
    const where: string[] = []
    const args: any[] = []
    if (params.from) { where.push('p.payment_date >= ?'); args.push(params.from) }
    if (params.to) { where.push('p.payment_date <= ?'); args.push(params.to) }
    if (params.method) { where.push('p.method = ?'); args.push(params.method) }
    if (params.collectorId) { where.push('p.collector_id = ?'); args.push(params.collectorId) }
    if (params.areaId) { where.push('c.area_id = ?'); args.push(params.areaId) }
    if (me.locked && me.id != null) where.push(collectorCustomerWhere(me.id))
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

import { ipcMain } from 'electron'
import { ListParams } from '../../shared/types'
import { getDb, getSetting, logActivity, nextSeq, round2, currentMonth } from '../db'
import { requirePermission } from './auth'
import { resolveSessionCollector, collectorCustomerWhere } from './payments'

function customerDueBefore(db: any, customerId: number, month: string): number {
  const row = db.prepare(`SELECT COALESCE(SUM(total - paid), 0) AS d FROM bills
    WHERE customer_id = ? AND status != 'cancelled' AND month < ?`).get(customerId, month) as { d: number }
  return round2(row.d)
}

export function registerBillingIpc(): void {
  // Generate monthly bills (idempotent per customer per month)
  ipcMain.handle('billing:generate', (e, month: string, areaId?: number, generatedBy = 'manual') => {
    const s = requirePermission(e, 'billing', 'create')
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('INVALID_MONTH')
    const db = getDb()
    const lateFee = Number(getSetting('late_fee', '0')) || 0
    const customers = db.prepare(`SELECT c.*, p.price AS package_price, p.type AS package_type
      FROM customers c LEFT JOIN packages p ON p.id = c.package_id
      WHERE c.status = 'active' ${areaId ? 'AND c.area_id = ?' : ''}`).all(...(areaId ? [areaId] : [])) as any[]
    let created = 0, skipped = 0
    db.exec('BEGIN')
    try {
      for (const c of customers) {
        // Free connections (Paid/Free dropdown) never get monthly bills —
        // they owe nothing, so no ৳0/noise bills are generated for them.
        if (c.connection_type === 'free') { skipped++; continue }
        const existing = db.prepare('SELECT id FROM bills WHERE customer_id = ? AND month = ?').get(c.id, month)
        if (existing) { skipped++; continue }
        const amount = round2(c.monthly_bill > 0 ? c.monthly_bill : (c.package_price || 0))
        const discountRows = db.prepare('SELECT COALESCE(SUM(amount),0) AS d FROM discounts WHERE customer_id = ? AND (month = ? OR month IS NULL)').get(c.id, month) as { d: number }
        const discount = round2(Math.min(discountRows.d, amount))
        const previousDue = customerDueBefore(db, c.id, month)
        const fee = c.package_type === 'free' ? 0 : lateFee
        const total = round2(amount - discount + previousDue + fee)
        const invoiceNo = 'INV-' + month.replace('-', '') + '-' + nextSeq('invoice_seq', 6)
        db.prepare(`INSERT INTO bills (invoice_no, customer_id, month, amount, discount, late_fee, previous_due, total, status, generated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .run(invoiceNo, c.id, month, amount, discount, fee, previousDue, total, 'due', generatedBy)
        created++
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'generate_bills', 'billing', `${month}: ${created} created, ${skipped} skipped`)
    return { created, skipped, month }
  })

  ipcMain.handle('billing:list', (e, params: ListParams & { month?: string; status?: string; areaId?: number }) => {
    const s = requirePermission(e, 'billing', 'view')
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
    if (params.month) { where.push('b.month = ?'); args.push(params.month) }
    if (params.status) { where.push('b.status = ?'); args.push(params.status) }
    if (params.areaId) { where.push('c.area_id = ?'); args.push(params.areaId) }
    if (me.locked && me.id != null) where.push(collectorCustomerWhere(me.id))
    if (params.search) {
      where.push('(c.name LIKE ? OR c.code LIKE ? OR c.mobile LIKE ? OR b.invoice_no LIKE ?)')
      const like = `%${params.search}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM bills b JOIN customers c ON c.id = b.customer_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db.prepare(`SELECT b.*, c.code AS customer_code, c.name AS customer_name, c.mobile, c.advance_balance, c.connection_type, a.name AS _area
      FROM bills b JOIN customers c ON c.id = b.customer_id LEFT JOIN areas a ON a.id = c.area_id
      ${whereSql} ORDER BY b.month DESC, c.code ASC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    const sums = db.prepare(`SELECT COALESCE(SUM(b.total),0) AS total, COALESCE(SUM(b.paid),0) AS paid
      FROM bills b JOIN customers c ON c.id = b.customer_id ${whereSql}`).get(...args) as { total: number; paid: number }
    return { rows, total, page, pageSize, sums: { total: round2(sums.total), paid: round2(sums.paid), due: round2(sums.total - sums.paid) } }
  })

  // adjust a bill (discount / late fee) — recalculates total
  ipcMain.handle('billing:adjust', (e, billId: number, discount: number, lateFee: number, reason: string) => {
    const s = requirePermission(e, 'billing', 'edit')
    const db = getDb()
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any
    if (!bill) throw new Error('NOT_FOUND')
    const d = round2(Math.max(0, Number(discount) || 0))
    const lf = round2(Math.max(0, Number(lateFee) || 0))
    if (bill.paid > round2(bill.amount - d + bill.previous_due + lf)) throw new Error('ADJUST_BELOW_PAID')
    const total = round2(bill.amount - d + bill.previous_due + lf)
    db.prepare('UPDATE bills SET discount = ?, late_fee = ?, total = ?, status = ? WHERE id = ?')
      .run(d, lf, total, total - bill.paid <= 0 ? 'paid' : (bill.paid > 0 ? 'partial' : 'due'), billId)
    if (d > 0 && reason) {
      db.prepare('INSERT INTO discounts (customer_id, month, amount, reason, date) VALUES (?,?,?,?,?)')
        .run(bill.customer_id, bill.month, d, reason, new Date().toISOString().slice(0, 10))
    }
    logActivity(s.userId, s.username, 'adjust_bill', 'billing', bill.invoice_no)
    return true
  })

  ipcMain.handle('billing:cancel', (e, billId: number) => {
    const s = requirePermission(e, 'billing', 'delete')
    const db = getDb()
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any
    if (!bill) throw new Error('NOT_FOUND')
    if (bill.paid > 0) throw new Error('BILL_HAS_PAYMENTS')
    db.prepare("UPDATE bills SET status = 'cancelled' WHERE id = ?").run(billId)
    logActivity(s.userId, s.username, 'cancel_bill', 'billing', bill.invoice_no)
    return true
  })

  // full invoice data for printing
  ipcMain.handle('billing:invoice', (e, billId: number) => {
    requirePermission(e, 'billing', 'view')
    const db = getDb()
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any
    if (!bill) throw new Error('NOT_FOUND')
    const customer = db.prepare(`SELECT c.*, a.name AS area_name, p.name AS package_name FROM customers c
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN packages p ON p.id = c.package_id WHERE c.id = ?`).get(bill.customer_id)
    const payments = db.prepare('SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date').all(billId)
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
    return { bill, customer, payments, company }
  })

  // auto-billing trigger used by automation (no permission needed, internal)
  ipcMain.handle('billing:autoRun', (e) => {
    if (!getSetting('auto_billing', '1')) return { created: 0, skipped: 0, disabled: true }
    return generateInternal(currentMonth(), 'auto')
  })
}

// internal generation without session (used by scheduler)
export function generateInternal(month: string, by: string): { created: number; skipped: number; month: string } {
  const db = getDb()
  const lateFee = Number(getSetting('late_fee', '0')) || 0
  const customers = db.prepare(`SELECT c.*, p.price AS package_price, p.type AS package_type
    FROM customers c LEFT JOIN packages p ON p.id = c.package_id WHERE c.status = 'active'`).all() as any[]
  let created = 0, skipped = 0
  db.exec('BEGIN')
  try {
    for (const c of customers) {
      const existing = db.prepare('SELECT id FROM bills WHERE customer_id = ? AND month = ?').get(c.id, month)
      if (existing) { skipped++; continue }
      const amount = round2(c.monthly_bill > 0 ? c.monthly_bill : (c.package_price || 0))
      const discountRows = db.prepare('SELECT COALESCE(SUM(amount),0) AS d FROM discounts WHERE customer_id = ? AND (month = ? OR month IS NULL)').get(c.id, month) as { d: number }
      const discount = round2(Math.min(discountRows.d, amount))
      const previousDue = customerDueBefore(db, c.id, month)
      const fee = c.package_type === 'free' ? 0 : lateFee
      const total = round2(amount - discount + previousDue + fee)
      const invoiceNo = 'INV-' + month.replace('-', '') + '-' + nextSeq('invoice_seq', 6)
      db.prepare(`INSERT INTO bills (invoice_no, customer_id, month, amount, discount, late_fee, previous_due, total, status, generated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(invoiceNo, c.id, month, amount, discount, fee, previousDue, total, 'due', by)
      created++
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { created, skipped, month }
}

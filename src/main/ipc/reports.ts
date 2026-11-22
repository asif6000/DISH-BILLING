import { ipcMain } from 'electron'
import { getDb, round2 } from '../db'
import { requirePermission } from './auth'
import { getSetting } from '../db'

export function registerReportIpc(): void {
  // Area-wise collection
  ipcMain.handle('reports:areaCollection', (e, month: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT a.name AS area,
        COUNT(c.id) AS customers,
        COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.area_id = a.id AND b.month = ? AND b.status != 'cancelled'),0) AS billed,
        COALESCE((SELECT SUM(b.paid) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.area_id = a.id AND b.month = ?),0) AS collected
      FROM areas a LEFT JOIN customers c ON c.area_id = a.id
      GROUP BY a.id HAVING customers > 0 ORDER BY billed DESC`).all(month, month)
  })

  // Collector report
  ipcMain.handle('reports:collector', (e, from: string, to: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT s.name AS collector, col.target_amount, col.commission_rate,
        COALESCE(SUM(p.amount),0) AS collected, COUNT(p.id) AS payments,
        COALESCE(SUM(p.amount) * col.commission_rate / 100, 0) AS commission
      FROM collectors col JOIN staff s ON s.id = col.staff_id
      LEFT JOIN payments p ON p.collector_id = col.id AND p.payment_date BETWEEN ? AND ? AND p.type != 'refund'
      GROUP BY col.id ORDER BY collected DESC`).all(from, to)
  })

  // Reseller report
  ipcMain.handle('reports:reseller', (e, month: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT r.name, r.company, r.mobile, r.commission_rate, r.wallet_balance,
        COUNT(c.id) AS customers,
        COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.reseller_id = r.id AND b.month = ? AND b.status != 'cancelled'),0) AS billed,
        COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN customers c3 ON c3.id = pay.customer_id WHERE c3.reseller_id = r.id AND pay.payment_date LIKE ? || '%' AND pay.type != 'refund'),0) AS collected
      FROM resellers r LEFT JOIN customers c ON c.reseller_id = r.id
      GROUP BY r.id ORDER BY customers DESC`).all(month, month)
  })

  // Package report
  ipcMain.handle('reports:package', (e, month: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT p.name, p.type, p.price, COUNT(c.id) AS customers,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END),0) AS active_customers
      FROM packages p LEFT JOIN customers c ON c.package_id = p.id
      GROUP BY p.id ORDER BY customers DESC`).all()
  })

  // Due list (per customer with dues)
  ipcMain.handle('reports:dueList', (e, month: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT c.id, c.code, c.name, c.mobile, a.name AS area, c.advance_balance,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled'),0) AS total_due,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month = ? AND b.status != 'cancelled'),0) AS month_due
      FROM customers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0
      ORDER BY total_due DESC`).all(month)
  })

  // Profit & Loss
  ipcMain.handle('reports:profitLoss', (e, from: string, to: string) => {
    requirePermission(e, 'reports')
    const db = getDb()
    const collections = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments WHERE payment_date BETWEEN ? AND ?`).get(from, to) as { a: number }
    const otherIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'income' AND date BETWEEN ? AND ?`).get(from, to) as { a: number }
    const expenseRows = db.prepare(`SELECT ec.name AS category, COALESCE(SUM(t.amount),0) AS amount FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id
      WHERE t.type = 'expense' AND t.date BETWEEN ? AND ? GROUP BY t.category_id ORDER BY amount DESC`).all(from, to)
    const totalExpenses = (db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'expense' AND date BETWEEN ? AND ?`).get(from, to) as { a: number }).a
    const incomeCats = db.prepare(`SELECT ec.name AS category, COALESCE(SUM(t.amount),0) AS amount FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id
      WHERE t.type = 'income' AND t.date BETWEEN ? AND ? GROUP BY t.category_id ORDER BY amount DESC`).all(from, to)
    return {
      collections: round2(collections.a),
      otherIncome: round2(otherIncome.a),
      totalIncome: round2(collections.a + otherIncome.a),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(collections.a + otherIncome.a - totalExpenses),
      expenseBreakdown: expenseRows,
      incomeBreakdown: incomeCats
    }
  })

  // Balance sheet (simplified)
  ipcMain.handle('reports:balanceSheet', (e) => {
    requirePermission(e, 'reports')
    const db = getDb()
    const cash = db.prepare('SELECT COALESCE(SUM(balance),0) AS a FROM accounts WHERE status = \'active\'').get() as { a: number }
    const receivables = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS a FROM bills WHERE status != 'cancelled'`).get() as { a: number }
    const advance = db.prepare('SELECT COALESCE(SUM(advance_balance),0) AS a FROM customers').get() as { a: number }
    const inventory = db.prepare('SELECT COALESCE(SUM(stock * purchase_price),0) AS a FROM products').get() as { a: number }
    const supplierPayable = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS a FROM purchases WHERE status != 'cancelled'`).get() as { a: number }
    const equity = round2(cash.a + receivables.a + inventory.a - supplierPayable.a - advance.a)
    return {
      assets: { cash: round2(cash.a), receivables: round2(receivables.a), inventory: round2(inventory.a) },
      liabilities: { supplierPayable: round2(supplierPayable.a), customerAdvances: round2(advance.a) },
      equity
    }
  })

  // Expense/income reports
  ipcMain.handle('reports:transactions', (e, type: 'income' | 'expense', from: string, to: string) => {
    requirePermission(e, 'reports')
    return getDb().prepare(`SELECT t.*, ec.name AS category, a.name AS account FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.type = ? AND t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.id DESC`).all(type, from, to)
  })

  // Customer statement
  ipcMain.handle('reports:customerStatement', (e, customerId: number) => {
    requirePermission(e, 'reports')
    const db = getDb()
    const bills = db.prepare('SELECT invoice_no, month, total, paid, status FROM bills WHERE customer_id = ? AND status != \'cancelled\' ORDER BY month').all(customerId)
    const payments = db.prepare('SELECT receipt_no, amount, method, payment_date, type FROM payments WHERE customer_id = ? ORDER BY payment_date').all(customerId)
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
    return { bills, payments, customer }
  })

  // ---------- Two-copy A4 bill report ----------
  // Per-customer billing figures for one month (READ-ONLY, used for reports & printing)
  ipcMain.handle('reports:billList', (e, month: string, filters: any = {}) => {
    requirePermission(e, 'reports')
    const db = getDb()
    // month range: filters.from..filters.to (YYYY-MM) — defaults to the single `month`
    // (same billing calculation logic as the Billing Report, generalized to a range)
    const from = String(filters.from || month || '')
    const to = String(filters.to || filters.from || month || '')
    const hasCollector = filters.collectorId ? Number(filters.collectorId) : 0
    const collectorClause = hasCollector
      ? ` AND EXISTS (SELECT 1 FROM payments pay WHERE pay.customer_id = c.id AND substr(pay.payment_date,1,7) BETWEEN '${from}' AND '${to}' AND pay.collector_id = ${hasCollector})`
      : ''
    const rows = db.prepare(`SELECT c.id, c.code, c.name, c.mobile, c.address, a.name AS area, c.monthly_bill,
        COALESCE((SELECT SUM(b.amount) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS month_bill,
        COALESCE((SELECT SUM(b.late_fee) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS additional,
        COALESCE((SELECT SUM(b.discount) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS discount,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month < ? AND b.status != 'cancelled'),0) AS prev_due,
        COALESCE((SELECT SUM(b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS paid
      FROM customers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.status = 'active' ${filters.areaId ? 'AND c.area_id = ' + Number(filters.areaId) : ''}${collectorClause}
      ORDER BY c.code`).all(from, to, from, to, from, to, from, from, to) as any[]
    let list = rows.map((r) => {
      const totalPayable = round2(r.prev_due + r.month_bill + r.additional - r.discount)
      const currentDue = round2(totalPayable - r.paid)
      return { ...r, totalPayable, currentDue, status: currentDue <= 0 ? 'paid' : r.paid > 0 ? 'partial' : 'due' }
    })
    if (filters.q) {
      const q = String(filters.q).toLowerCase()
      list = list.filter((r) => String(r.code).toLowerCase().includes(q) || String(r.name).toLowerCase().includes(q) || String(r.mobile || '').includes(filters.q))
    }
    if (filters.status && filters.status !== 'all') list = list.filter((r) => r.status === filters.status)
    return list
  })

  // Full bill data for one customer + month (READ-ONLY, for printing both copies)
  ipcMain.handle('reports:customerBill', (e, customerId: number, month: string) => {
    requirePermission(e, 'reports')
    const db = getDb()
    const customer = db.prepare(`SELECT c.*, a.name AS area_name, p.name AS package_name FROM customers c
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN packages p ON p.id = c.package_id WHERE c.id = ?`).get(customerId) as any
    if (!customer) throw new Error('NOT_FOUND')
    const agg = db.prepare(`SELECT COALESCE(SUM(amount),0) AS month_bill, COALESCE(SUM(late_fee),0) AS additional,
        COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(paid),0) AS paid
      FROM bills WHERE customer_id = ? AND month = ? AND status != 'cancelled'`).get(customerId, month) as any
    const prevDueRow = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS v FROM bills
      WHERE customer_id = ? AND month < ? AND status != 'cancelled'`).get(customerId, month) as any
    const figures = {
      monthBill: round2(agg.month_bill), additional: round2(agg.additional), discount: round2(agg.discount),
      prevDue: round2(prevDueRow.v), paid: round2(agg.paid)
    }
    const totalPayable = round2(figures.prevDue + figures.monthBill + figures.additional - figures.discount)
    const currentDue = round2(totalPayable - figures.paid)
    const payments = db.prepare(`SELECT p.receipt_no, p.amount, p.method, p.reference, p.payment_date, p.created_at, p.created_by,
        COALESCE(s.name, p.created_by) AS collected_by
      FROM payments p LEFT JOIN collectors col ON col.id = p.collector_id LEFT JOIN staff s ON s.id = col.staff_id
      WHERE p.customer_id = ? AND (p.bill_id IN (SELECT id FROM bills WHERE customer_id = ? AND month = ?)
        OR (p.bill_id IS NULL AND p.type = 'bill' AND p.payment_date LIKE ? || '%'))
      ORDER BY p.payment_date, p.id`).all(customerId, customerId, month, month)
    const company = {
      name: getSetting('company_name', 'AVA Cable Network'),
      name_bn: getSetting('company_name_bn', ''),
      address: getSetting('company_address', ''),
      mobile: getSetting('company_mobile', ''),
      mobile_alt: getSetting('company_mobile_alt', ''),
      email: getSetting('company_email', ''),
      logo: getSetting('company_logo', ''),
      sms: getSetting('company_sms', getSetting('company_mobile', '')),
      license: getSetting('company_license', ''),
      footer: getSetting('bill_footer', ''),
      authorized: getSetting('company_authorized', '')
    }
    return { customer, month, figures: { ...figures, totalPayable, currentDue, status: currentDue <= 0 ? 'paid' : figures.paid > 0 ? 'partial' : 'due' }, payments, company }
  })
}

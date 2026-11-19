import { ipcMain } from 'electron'
import { getDb, round2 } from '../db'
import { requirePermission } from './auth'

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:stats', (e, month: string) => {
    requirePermission(e, 'dashboard')
    const db = getDb()
    const statusCounts = db.prepare(`SELECT status, COUNT(*) AS c FROM customers GROUP BY status`).all() as any[]
    const sc: Record<string, number> = { active: 0, inactive: 0, disconnected: 0, expired: 0, free: 0 }
    let totalCustomers = 0
    for (const r of statusCounts) { totalCustomers += r.c; sc[r.status] = r.c }
    const pkgFree = (db.prepare(`SELECT COUNT(*) AS c FROM customers c JOIN packages p ON p.id = c.package_id WHERE c.status = 'active' AND p.type = 'free'`).get() as any).c

    const billAgg = db.prepare(`SELECT COALESCE(SUM(total),0) AS billed, COALESCE(SUM(paid),0) AS paid
      FROM bills WHERE month = ? AND status != 'cancelled'`).get(month) as { billed: number; paid: number }
    const dueBills = db.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status != 'cancelled' AND status != 'paid'`).get(month) as { c: number }
    const paidCount = db.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status = 'paid'`).get(month) as { c: number }
    const totalDueAllTime = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS d FROM bills WHERE status != 'cancelled'`).get() as { d: number }
    const monthCollection = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments
      WHERE payment_date LIKE ? || '%'`).get(month) as { a: number }
    const connectionFees = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM payments WHERE type = 'connection_fee'`).get() as { a: number }
    const newCustomers = db.prepare(`SELECT COUNT(*) AS c FROM customers WHERE connection_date LIKE ? || '%'`).get(month) as { c: number }
    const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'expense' AND date LIKE ? || '%'`).get(month) as { a: number }
    const otherIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'income' AND date LIKE ? || '%'`).get(month) as { a: number }

    return {
      totalCustomers,
      activeCustomers: sc.active,
      inactiveCustomers: sc.inactive,
      disconnectedCustomers: sc.disconnected,
      paidCustomers: paidCount.c,
      dueCustomers: dueBills.c,
      freeCustomers: pkgFree,
      newCustomers: newCustomers.c,
      totalBilled: round2(billAgg.billed),
      totalCollection: round2(monthCollection.a),
      totalDue: round2(totalDueAllTime.d),
      connectionFees: round2(connectionFees.a),
      totalExpenses: round2(expenses.a),
      otherIncome: round2(otherIncome.a),
      netProfit: round2(monthCollection.a + otherIncome.a - expenses.a)
    }
  })

  ipcMain.handle('dashboard:dailyCollection', (e, month: string) => {
    requirePermission(e, 'dashboard')
    return getDb().prepare(`SELECT substr(payment_date, 9) AS day, COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS amount
      FROM payments WHERE payment_date LIKE ? || '%' GROUP BY substr(payment_date, 9) ORDER BY day`).all(month)
  })

  ipcMain.handle('dashboard:monthlyRevenue', (e) => {
    requirePermission(e, 'dashboard')
    const rows = getDb().prepare(`SELECT substr(payment_date, 1, 7) AS month, COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS collection
      FROM payments WHERE payment_date >= date('now', '-11 months', 'start of month') GROUP BY substr(payment_date, 1, 7) ORDER BY month`).all() as any[]
    const billed = getDb().prepare(`SELECT month, COALESCE(SUM(total),0) AS billed FROM bills
      WHERE month >= substr(date('now', '-11 months', 'start of month'), 1, 7) AND status != 'cancelled' GROUP BY month ORDER BY month`).all() as any[]
    const map = new Map(rows.map((r: any) => [r.month, r]))
    const out: any[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.toISOString().slice(0, 7)
      const b = billed.find((x: any) => x.month === m)
      out.push({ month: m, collection: map.get(m)?.collection || 0, billed: b?.billed || 0 })
    }
    return out
  })

  ipcMain.handle('dashboard:customerGrowth', (e) => {
    requirePermission(e, 'dashboard')
    return getDb().prepare(`SELECT substr(connection_date, 1, 7) AS month, COUNT(*) AS new_count,
      (SELECT COUNT(*) FROM customers c2 WHERE substr(c2.connection_date, 1, 7) <= substr(c.connection_date, 1, 7)) AS total
      FROM customers c WHERE connection_date >= date('now', '-11 months', 'start of month')
      GROUP BY substr(connection_date, 1, 7) ORDER BY month`).all()
  })

  ipcMain.handle('dashboard:areaStats', (e, month: string) => {
    requirePermission(e, 'dashboard')
    return getDb().prepare(`SELECT a.name AS area, COUNT(c.id) AS customers,
      COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id
        WHERE c2.area_id = a.id AND b.month = ? AND b.status != 'cancelled'), 0) AS billed,
      COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN customers c3 ON c3.id = pay.customer_id
        WHERE c3.area_id = a.id AND pay.payment_date LIKE ? || '%' AND pay.type != 'refund'), 0) AS collection
      FROM areas a LEFT JOIN customers c ON c.area_id = a.id AND c.status = 'active'
      GROUP BY a.id HAVING customers > 0 ORDER BY customers DESC LIMIT 10`).all(month, month)
  })

  ipcMain.handle('dashboard:recent', (e) => {
    requirePermission(e, 'dashboard')
    const db = getDb()
    const payments = db.prepare(`SELECT p.*, c.code AS customer_code, c.name AS customer_name FROM payments p
      JOIN customers c ON c.id = p.customer_id ORDER BY p.id DESC LIMIT 6`).all()
    const customers = db.prepare(`SELECT id, code, name, mobile, connection_date, status, address FROM customers ORDER BY id DESC LIMIT 6`).all()
    const complaints = db.prepare(`SELECT co.*, c.name AS customer_name, c.code AS customer_code FROM complaints co
      JOIN customers c ON c.id = co.customer_id WHERE co.status IN ('pending','assigned') ORDER BY co.id DESC LIMIT 6`).all()
    const pendingComplaints = (db.prepare(`SELECT COUNT(*) AS c FROM complaints WHERE status IN ('pending','assigned')`).get() as any).c
    return { payments, customers, complaints, pendingComplaints }
  })
}

import { ipcMain } from 'electron'
import { getDb, round2, today, logActivity } from '../db'
import { requirePermission, canManageTargetPerms, getEffectivePermissions, refreshSessionPerms } from './auth'
import { resolveSessionCollector, collectorCustomerWhere } from './payments'
import { hasPermission, COLLECTOR_KPI_KEYS } from '../../shared/permissions'

export function registerDashboardIpc(): void {
  // ---- Effective KPI permissions (priority: individual override → role default → deny) ----
  // Role default = role permissions hold 'dashboard' (module → all cards) or
  // 'dashboard.<kpi_key>'. Individual overrides live in collector_kpi_overrides
  // (migration v20) and WIN over the role — allowed=0 denies a card the role
  // grants, allowed=1 grants one it doesn't. No row = pure role default.
  // Per-user granular grants from Security → Users also count as individual grants.
  function effectiveKpiCards(db: any, userId: number): string[] {
    const perms = getEffectivePermissions(userId) // role ∪ per-user grants
    const overrides = db.prepare('SELECT kpi_key, allowed FROM collector_kpi_overrides WHERE user_id = ?').all(userId) as any[]
    const ov = new Map(overrides.map((r) => [String(r.kpi_key), !!Number(r.allowed)]))
    return COLLECTOR_KPI_KEYS.filter((k) => ov.has(k) ? ov.get(k) : hasPermission(perms, 'dashboard', k))
  }

  // Admin view: role defaults + individual overrides + effective result for one account
  ipcMain.handle('dashboard:kpiPermissions', (e, userId: number) => {
    const s = requirePermission(e, 'users', 'view')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    const rolePerms: string[] = JSON.parse((db.prepare('SELECT permissions FROM roles WHERE id = ?').get(target.role_id) as any)?.permissions || '[]')
    const roleAllows: Record<string, boolean> = {}
    for (const k of COLLECTOR_KPI_KEYS) roleAllows[k] = rolePerms.includes('dashboard') || rolePerms.includes('dashboard.' + k)
    const overrides: Record<string, number> = {}
    for (const r of db.prepare('SELECT kpi_key, allowed FROM collector_kpi_overrides WHERE user_id = ?').all(userId) as any[]) overrides[String(r.kpi_key)] = Number(r.allowed)
    return {
      user: { id: target.id, username: target.username, fullName: target.full_name, roleName: target.role_name, status: target.status },
      roleAllows, overrides,
      effective: COLLECTOR_KPI_KEYS.filter((k) => overrides[k] !== undefined ? !!overrides[k] : roleAllows[k])
    }
  })

  // Admin save: individual overrides for one account ({kpi_key: true|false};
  // missing keys = follow role default). Reset to Role Defaults = send {}.
  ipcMain.handle('dashboard:kpiPermissionsSet', (e, userId: number, overrides: Record<string, boolean>) => {
    const s = requirePermission(e, 'users', 'edit')
    const db = getDb()
    const target = db.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId) as any
    if (!target) throw new Error('NOT_FOUND')
    if (!canManageTargetPerms(s, target)) throw new Error('PERMISSION_DENIED:users')
    // validate FIRST — an invalid key aborts the whole save atomically
    // (never wipe existing overrides because of one bad key)
    const entries = Object.entries(overrides || {})
    if (entries.some(([k]) => !(COLLECTOR_KPI_KEYS as readonly string[]).includes(k))) throw new Error('INVALID_KPI_KEY')
    const valid = entries.filter(([, v]) => typeof v === 'boolean')
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM collector_kpi_overrides WHERE user_id = ?').run(userId)
      const ins = db.prepare('INSERT INTO collector_kpi_overrides (user_id, kpi_key, allowed, updated_by) VALUES (?,?,?,?)')
      for (const [k, v] of valid) ins.run(userId, k, v ? 1 : 0, s.userId)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    // push the change to the collector's live session → dashboard re-fetches at once
    refreshSessionPerms(userId)
    logActivity(s.userId, s.username, 'kpi_permissions_set', 'users', `${target.username}:${valid.length} overrides`)
    return { saved: valid.length }
  })
  ipcMain.handle('dashboard:stats', (e, month: string) => {
    requirePermission(e, 'dashboard')
    const db = getDb()
    const statusCounts = db.prepare(`SELECT status, COUNT(*) AS c FROM customers GROUP BY status`).all() as any[]
    const sc: Record<string, number> = { active: 0, inactive: 0, disconnected: 0, expired: 0, free: 0 }
    let totalCustomers = 0
    for (const r of statusCounts) { totalCustomers += r.c; sc[r.status] = r.c }
    // free = free-type package OR the Paid/Free connection dropdown (LEFT JOIN so
    // free connections without any package are counted too)
    const pkgFree = (db.prepare(`SELECT COUNT(*) AS c FROM customers c LEFT JOIN packages p ON p.id = c.package_id WHERE c.status = 'active' AND (p.type = 'free' OR c.connection_type = 'free')`).get() as any).c

    const billAgg = db.prepare(`SELECT COALESCE(SUM(total),0) AS billed, COALESCE(SUM(paid),0) AS paid
      FROM bills WHERE month = ? AND status != 'cancelled'`).get(month) as { billed: number; paid: number }
    const dueBills = db.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status != 'cancelled' AND status != 'paid'`).get(month) as { c: number }
    const paidCount = db.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status = 'paid'`).get(month) as { c: number }
    const totalDueAllTime = db.prepare(`SELECT COALESCE(SUM(total - paid),0) AS d FROM bills WHERE status != 'cancelled'`).get() as { d: number }
    // Old/opening dues carried into the software (customers.previous_due_bill).
    // Kept separate from bill dues because it is not generated by a bill row.
    const previousDue = db.prepare(`SELECT COALESCE(SUM(previous_due_bill),0) AS d FROM customers`).get() as { d: number }
    const monthCollection = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments
      WHERE payment_date LIKE ? || '%'`).get(month) as { a: number }
    const connectionFees = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM payments WHERE type = 'connection_fee'`).get() as { a: number }
    const newCustomers = db.prepare(`SELECT COUNT(*) AS c FROM customers WHERE connection_date LIKE ? || '%'`).get(month) as { c: number }
    const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'expense' AND date LIKE ? || '%'`).get(month) as { a: number }
    // Other income = manual income entries only. Customer collections are
    // already counted from payments above; their cashbook rows are linked to a
    // payment receipt and must not be counted a second time.
    const otherIncome = db.prepare(`SELECT COALESCE(SUM(t.amount),0) AS a FROM transactions t
      WHERE t.type = 'income' AND t.date LIKE ? || '%'
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.receipt_no = t.ref)`).get(month) as { a: number }

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
      previousDueBill: round2(previousDue.d),
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

  // ---- Collector Dashboard ----
  // Every statistic is scoped to the logged-in account's OWN collector profile
  // (resolved server-side from the session — never from the frontend), and only
  // KPI cards authorized via the permission system ('dashboard.kpi.*' keys, or
  // the legacy module key which implies all) are computed and returned.
  ipcMain.handle('dashboard:collectorStats', (e, month: string) => {
    // 'view' action so granular key holders (dashboard.view + dashboard.kpi.*)
    // pass — module-only checks would lock out restricted collector roles
    const s = requirePermission(e, 'dashboard', 'view')
    const db = getDb()
    const me = resolveSessionCollector(db, s)
    if (!me.locked || me.id == null) {
      // inactive profile → COLLECTOR_INACTIVE; Collector role without profile → NO_COLLECTOR_PROFILE
      throw new Error(me.error || 'NO_COLLECTOR_PROFILE')
    }
    const authorized = effectiveKpiCards(db, s.userId)
    const collector = db.prepare('SELECT col.id, col.target_amount, st.name AS label FROM collectors col JOIN staff st ON st.id = col.staff_id WHERE col.id = ?').get(me.id) as any
    if (!collector) throw new Error('NO_COLLECTOR_PROFILE')
    const cards = authorized
    if (!cards.length) return { collector: { id: collector.id, label: collector.label || '' }, cards: [], stats: {} }
    const m = String(month || today()).slice(0, 7)
    const stats: any = {}
    // scoped base: only this collector's payment records
    const sumWhere = (extra: string, ...args: any[]) => db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments WHERE collector_id = ? ${extra}`
    ).get(me.id, ...args) as { a: number }
    if (cards.includes('kpi_today')) stats.today = round2(sumWhere("AND payment_date = ?", today()).a)
    if (cards.includes('kpi_month')) stats.month = round2(sumWhere("AND payment_date LIKE ? || '%'", m).a)
    if (cards.includes('kpi_total')) stats.total = round2(sumWhere('').a)
    if (cards.some((c) => ['kpi_cash', 'kpi_bkash', 'kpi_nagad', 'kpi_rocket', 'kpi_bank'].includes(c))) {
      const byMethod = db.prepare(`SELECT method, COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a
        FROM payments WHERE collector_id = ? AND payment_date LIKE ? || '%' GROUP BY method`).all(me.id, m) as any[]
      const mm: Record<string, number> = {}
      for (const r of byMethod) mm[r.method] = round2(r.a)
      if (cards.includes('kpi_cash')) stats.cash = round2(mm['cash'] || 0)
      if (cards.includes('kpi_bkash')) stats.bkash = round2(mm['bkash'] || 0)
      if (cards.includes('kpi_nagad')) stats.nagad = round2(mm['nagad'] || 0)
      if (cards.includes('kpi_rocket')) stats.rocket = round2(mm['rocket'] || 0)
      if (cards.includes('kpi_bank')) stats.bank = round2(mm['bank'] || 0)
    }
    // Explicit customer assignments take priority; unassigned customers keep
    // falling back to legacy area assignment for existing installations.
    const assignedFilter = collectorCustomerWhere(me.id)
    const areaFilter = assignedFilter
    if (cards.includes('kpi_customers')) {
      stats.customers = (db.prepare(`SELECT COUNT(*) AS c FROM customers c WHERE c.status = 'active' AND ${areaFilter}`).get() as any).c
    }
    if (cards.includes('kpi_due')) {
      stats.due = round2((db.prepare(`SELECT COALESCE(SUM(b.total - b.paid),0) AS v FROM bills b
        JOIN customers c ON c.id = b.customer_id WHERE b.status != 'cancelled' AND ${areaFilter}`).get() as any).v)
    }
    if (cards.includes('kpi_target')) stats.target = round2(collector.target_amount || 0)
    if (cards.includes('kpi_performance')) {
      const target = round2(collector.target_amount || 0)
      const collected = round2(sumWhere("AND payment_date LIKE ? || '%'", m).a)
      stats.performance = target > 0 ? Math.min(999, Math.round((collected / target) * 100)) : 0
      stats.performanceCollected = collected
      stats.performanceTarget = target
    }
    if (cards.includes('kpi_history')) {
      stats.history = db.prepare(`SELECT p.id, p.receipt_no, p.amount, p.method, p.payment_date, p.type, c.name AS customer_name, c.code AS customer_code
        FROM payments p JOIN customers c ON c.id = p.customer_id
        WHERE p.collector_id = ? ORDER BY p.id DESC LIMIT 10`).all(me.id)
    }
    return { collector: { id: collector.id, label: collector.label || '' }, cards, stats }
  })
}

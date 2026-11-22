import { ipcMain } from 'electron'
import { CustomerFilters } from '../../shared/types'
import { getDb, logActivity, nextSeq, today } from '../db'
import { requirePermission } from './auth'

const CUSTOMER_SELECT = `
  SELECT c.*, c.customer_serial, a.name AS _area, z.name AS _zone, p.name AS _package, p.type AS _package_type,
    r.name AS _reseller, br.name AS _branch,
    COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled'), 0) AS total_due,
    (SELECT MAX(b.month) FROM bills b WHERE b.customer_id = c.id) AS last_bill_month
  FROM customers c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN zones z ON z.id = a.zone_id
  LEFT JOIN packages p ON p.id = c.package_id
  LEFT JOIN resellers r ON r.id = c.reseller_id
  LEFT JOIN branches br ON br.id = c.branch_id
`

export function registerCustomerIpc(): void {
  ipcMain.handle('customers:list', (e, params: CustomerFilters = {}) => {
    requirePermission(e, 'customers', 'view')
    const db = getDb()
    const page = Math.max(1, params.page || 1)
    const pageSize = params.all ? 100000 : Math.min(200, Math.max(5, params.pageSize || 20))
    const where: string[] = []
    const args: any[] = []
    if (params.search) {
      // area-wise serial numbers are searchable too (e.g. serial 5 finds
      // serial 5 in every area — the AREA column shows which is which)
      where.push(`(c.name LIKE ? OR c.mobile LIKE ? OR c.code LIKE ? OR c.address LIKE ? OR CAST(c.customer_serial AS TEXT) LIKE ?)`)
      const like = `%${params.search}%`
      args.push(like, like, like, like, like)
    }
    const status = params.status
    if (status === 'due') {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0`)
    } else if (status === 'paid') {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') = 0
        AND EXISTS (SELECT 1 FROM bills b WHERE b.customer_id = c.id)`)
    } else if (status === 'expired') {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') >
        (SELECT c.monthly_bill * 2)`)
    } else if (status === 'free') {
      where.push(`c.status = 'active' AND p.type = 'free'`)
    } else if (status) {
      where.push(`c.status = ?`)
      args.push(status)
    }
    if (params.areaId) { where.push('c.area_id = ?'); args.push(params.areaId) }
    if (params.packageId) { where.push('c.package_id = ?'); args.push(params.packageId) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM customers c LEFT JOIN packages p ON p.id = c.package_id ${whereSql}`).get(...args) as { c: number }).c
    const sort = params.sort === 'code' || params.sort === 'name' || params.sort === 'total_due' ? params.sort : 'c.code'
    const dir = params.dir === 'desc' ? 'DESC' : 'ASC'
    const rows = db.prepare(`${CUSTOMER_SELECT} ${whereSql} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize)
    return { rows, total, page, pageSize }
  })

  ipcMain.handle('customers:get', (e, id: number) => {
    requirePermission(e, 'customers', 'view')
    const db = getDb()
    const customer = db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id)
    if (!customer) return null
    const bills = db.prepare('SELECT * FROM bills WHERE customer_id = ? ORDER BY month DESC LIMIT 36').all(id)
    const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC, id DESC LIMIT 60').all(id)
    const connections = db.prepare('SELECT * FROM customer_connections WHERE customer_id = ? ORDER BY date DESC').all(id)
    const documents = db.prepare('SELECT * FROM customer_documents WHERE customer_id = ? ORDER BY id DESC').all(id)
    const complaints = db.prepare('SELECT * FROM complaints WHERE customer_id = ? ORDER BY id DESC LIMIT 20').all(id)
    return { customer, bills, payments, connections, documents, complaints }
  })

  ipcMain.handle('customers:create', (e, data: any) => {
    const s = requirePermission(e, 'customers', 'create')
    const db = getDb()
    if (!data.name || !data.mobile) throw new Error('REQUIRED:name,mobile')
    if (!/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error('INVALID_MOBILE')
    const code = nextSeq('customer_seq', 5, 'AVA-')
    const serial = data.customer_serial != null && String(data.customer_serial).trim() !== '' ? Math.trunc(Number(data.customer_serial)) : null
    if (serial != null && (isNaN(serial) || serial < 0)) throw new Error('INVALID_SERIAL')
    const r = db.prepare(`INSERT INTO customers
      (code, name, father_name, mobile, address, area_id, sub_area_id, road_id, branch_id, reseller_id,
       connection_date, package_id, monthly_bill, connection_fee, status, nid, note, customer_serial)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(code, data.name.trim(), data.father_name || null, String(data.mobile).trim(), data.address || null,
        data.area_id || null, data.sub_area_id || null, data.road_id || null, data.branch_id || null, data.reseller_id || null,
        data.connection_date || today(), data.package_id || null, Number(data.monthly_bill) || 0,
        Number(data.connection_fee) || 0, data.status || 'active', data.nid || null, data.note || null, serial)
    const customerId = Number(r.lastInsertRowid)
    db.prepare('INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)')
      .run(customerId, 'new', 'connection', data.connection_date || today(), 'New connection', s.username)
    logActivity(s.userId, s.username, 'create_customer', 'customers', code)
    return customerId
  })

  // Excel import: bulk create customers (no bills/payments generated).
  // Server-side validation: name required, mobile normalized (Bangla digits ok),
  // duplicates rejected (existing DB mobiles + duplicates inside the file).
  ipcMain.handle('customers:import', (e, rows: { name?: string; address?: string; mobile?: string; serial?: any; areaName?: string }[], areaId?: number) => {
    const s = requirePermission(e, 'customers', 'create')
    const db = getDb()
    const normalizeMobile = (m: any): string => {
      const bn = '০১২৩৪৫৬৭৮৯'
      let d = String(m || '').trim()
      d = d.replace(/[০-৯]/g, (c) => String(bn.indexOf(c)))
      d = d.replace(/[^\d]/g, '')
      if (d.length === 13 && d.startsWith('88')) d = d.slice(2)
      if (d.length === 11 && d.startsWith('1')) d = '0' + d
      return d
    }
    // area-wise serials: the same serial number exists in MANY areas — only
    // area_id + customer_serial together identify a customer for duplicates.
    const areas = db.prepare('SELECT id, name FROM areas').all() as any[]
    const areaByName = new Map<string, number>(areas.map((a) => [String(a.name).trim().toLowerCase(), a.id]))
    const parseSerial = (v: any): number | null => {
      const bn = '০১২৩৪৫৬৭৮৯'
      const d = String(v ?? '').trim().replace(/[০-৯]/g, (c) => String(bn.indexOf(c)))
      if (!d) return null
      const n = Number(d)
      return isNaN(n) || n < 0 ? null : Math.trunc(n)
    }
    // (area_id, customer_serial) pairs already in the database
    const dbSerials = new Set<string>(
      (db.prepare('SELECT area_id, customer_serial FROM customers WHERE customer_serial IS NOT NULL').all() as any[])
        .map((r) => `${r.area_id ?? 'x'}|${r.customer_serial}`)
    )
    const existing = new Set<string>((db.prepare('SELECT mobile FROM customers').all() as any[]).map((r) => normalizeMobile(r.mobile)))
    let imported = 0, duplicates = 0, invalid = 0
    const errors: string[] = []
    db.exec('BEGIN')
    try {
      const seenMobile = new Set<string>()
      const seenSerial = new Set<string>() // file-level: area|serial
      for (const row of rows || []) {
        const name = String(row?.name || '').trim()
        const address = String(row?.address || '').trim()
        const mobile = normalizeMobile(row?.mobile)
        const serial = parseSerial((row as any)?.serial)
        if (!name || !/^01[3-9]\d{8}$/.test(mobile)) { invalid++; errors.push(`${name || mobile || '(empty)'} — invalid`); continue }
        // resolve the row's area: selected Area (dropdown) wins, else the Area
        // column in the Excel file, matched by name against existing areas
        let rowAreaId: number | null = areaId ?? null
        const areaName = String((row as any)?.areaName || '').trim()
        if (rowAreaId == null && areaName) {
          rowAreaId = areaByName.get(areaName.toLowerCase()) ?? null
          if (rowAreaId == null) {
            invalid++; errors.push(`${name} (${mobile}) — area not found: ${areaName}`); continue
          }
        }
        const serialKey = `${rowAreaId ?? 'x'}|${serial ?? ''}`
        if (existing.has(mobile) || seenMobile.has(mobile)) { duplicates++; errors.push(`${name} (${mobile}) — duplicate mobile`); continue }
        if (serial != null && (dbSerials.has(serialKey) || seenSerial.has(serialKey))) {
          duplicates++
          errors.push(`${name} (${mobile}) — duplicate serial ${serial} in ${areaName || (rowAreaId ? areas.find((a) => a.id === rowAreaId)?.name : 'no area')}`)
          continue
        }
        seenMobile.add(mobile)
        if (serial != null) seenSerial.add(serialKey)
        const code = nextSeq('customer_seq', 5, 'AVA-')
        db.prepare(`INSERT INTO customers (code, name, mobile, address, area_id, connection_date, status, customer_serial) VALUES (?,?,?,?,?,?, 'active', ?)`)
          .run(code, name, mobile, address || null, rowAreaId, today(), serial)
        const customerId = Number((db.prepare('SELECT id FROM customers WHERE code = ?').get(code) as any).id)
        db.prepare('INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)')
          .run(customerId, 'new', 'connection', today(), 'Excel import', s.username)
        existing.add(mobile)
        if (serial != null) dbSerials.add(serialKey)
        imported++
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'import_customers', 'customers', `imported:${imported},duplicates:${duplicates},invalid:${invalid}`)
    return { imported, duplicates, invalid, total: (rows || []).length, errors: errors.slice(0, 20) }
  })

  ipcMain.handle('customers:update', (e, id: number, data: any) => {
    const s = requirePermission(e, 'customers', 'edit')
    const db = getDb()
    const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any
    if (!old) throw new Error('NOT_FOUND')
    if (data.mobile && !/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error('INVALID_MOBILE')
    db.prepare(`UPDATE customers SET name=?, father_name=?, mobile=?, address=?, area_id=?, sub_area_id=?, road_id=?,
      branch_id=?, reseller_id=?, connection_date=?, package_id=?, monthly_bill=?, connection_fee=?, status=?, nid=?, note=?, customer_serial=? WHERE id=?`)
      .run(data.name ?? old.name, data.father_name ?? old.father_name, data.mobile ?? old.mobile,
        data.address ?? old.address, data.area_id ?? old.area_id, data.sub_area_id ?? old.sub_area_id,
        data.road_id ?? old.road_id, data.branch_id ?? old.branch_id, data.reseller_id ?? old.reseller_id,
        data.connection_date ?? old.connection_date, data.package_id ?? old.package_id,
        data.monthly_bill ?? old.monthly_bill, data.connection_fee ?? old.connection_fee,
        data.status ?? old.status, data.nid ?? old.nid, data.note ?? old.note,
        data.customer_serial !== undefined ? (data.customer_serial === null || String(data.customer_serial).trim() === '' ? null : Math.trunc(Number(data.customer_serial)) || null) : old.customer_serial, id)
    // package change → upgrade/downgrade log
    if (data.package_id && data.package_id !== old.package_id) {
      const oldP = old.package_id ? db.prepare('SELECT name FROM packages WHERE id=?').get(old.package_id) as any : null
      const newP = db.prepare('SELECT name FROM packages WHERE id=?').get(data.package_id) as any
      const action = (newP?.price || 0) >= (oldP?.price || 0) ? 'upgrade' : 'downgrade'
      db.prepare('INSERT INTO customer_connections (customer_id, action, from_value, to_value, date, created_by) VALUES (?,?,?,?,?,?)')
        .run(id, action, oldP?.name || '-', newP?.name || '-', today(), s.username)
    }
    logActivity(s.userId, s.username, 'update_customer', 'customers', old.code)
    return true
  })

  ipcMain.handle('customers:setStatus', (e, id: number, status: string, note?: string) => {
    const s = requirePermission(e, 'customers', 'edit')
    const db = getDb()
    const allowed = ['active', 'inactive', 'disconnected', 'free', 'expired']
    if (!allowed.includes(status)) throw new Error('INVALID_STATUS')
    const actionMap: Record<string, string> = {
      disconnected: 'disconnect', inactive: 'temp_disconnect', active: 'reconnect'
    }
    db.prepare('UPDATE customers SET status = ? WHERE id = ?').run(status, id)
    db.prepare('INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)')
      .run(id, actionMap[status] || 'status_change', status, today(), note || '', s.username)
    logActivity(s.userId, s.username, 'customer_status', 'customers', `${id} -> ${status}`)
    return true
  })

  ipcMain.handle('customers:transfer', (e, id: number, data: { area_id: number; sub_area_id?: number; road_id?: number; address?: string }) => {
    const s = requirePermission(e, 'customers', 'edit')
    const db = getDb()
    const old = db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id) as any
    if (!old) throw new Error('NOT_FOUND')
    if (!data.area_id) throw new Error('REQUIRED:area_id')
    db.prepare('UPDATE customers SET area_id=?, sub_area_id=?, road_id=?, address=? WHERE id=?')
      .run(data.area_id, data.sub_area_id || null, data.road_id || null, data.address ?? old.address, id)
    const newArea = db.prepare('SELECT name FROM areas WHERE id = ?').get(data.area_id) as any
    db.prepare('INSERT INTO customer_connections (customer_id, action, from_value, to_value, date, note, created_by) VALUES (?,?,?,?,?,?,?)')
      .run(id, 'transfer', old._area || '-', newArea?.name || '-', today(), 'Area transfer', s.username)
    logActivity(s.userId, s.username, 'transfer_customer', 'customers', old.code)
    return true
  })

  ipcMain.handle('customers:shift', (e, id: number, address: string) => {
    const s = requirePermission(e, 'customers', 'edit')
    const db = getDb()
    db.prepare('UPDATE customers SET address = ? WHERE id = ?').run(address, id)
    db.prepare('INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)')
      .run(id, 'shifting', '', address, today(), 'Address shifting', s.username)
    logActivity(s.userId, s.username, 'shift_customer', 'customers', String(id))
    return true
  })

  ipcMain.handle('customers:bulkImport', (e, rows: any[]) => {
    const s = requirePermission(e, 'customers', 'create')
    const db = getDb()
    let imported = 0
    const errors: string[] = []
    db.exec('BEGIN')
    try {
      for (const [i, data] of rows.entries()) {
        try {
          if (!data.name || !data.mobile) throw new Error('name/mobile missing')
          if (!/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error(`invalid mobile: ${data.mobile}`)
          const code = nextSeq('customer_seq', 5, 'AVA-')
          db.prepare(`INSERT INTO customers (code, name, father_name, mobile, address, area_id, connection_date, package_id, monthly_bill, connection_fee, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(code, String(data.name).trim(), data.father_name || null, String(data.mobile).trim(), data.address || null,
              data.area_id || null, data.connection_date || today(), data.package_id || null,
              Number(data.monthly_bill) || 0, Number(data.connection_fee) || 0, 'active')
          imported++
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message}`)
        }
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'bulk_import', 'customers', `${imported} customers`)
    return { imported, errors }
  })

  ipcMain.handle('customers:dueList', (e) => {
    requirePermission(e, 'customers', 'view')
    return getDb().prepare(`${CUSTOMER_SELECT} WHERE c.status = 'active'
      AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0
      ORDER BY total_due DESC`).all()
  })

  ipcMain.handle('connections:history', (e, params: any = {}) => {
    requirePermission(e, 'connections')
    const db = getDb()
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(200, Math.max(5, params.pageSize || 20))
    const where: string[] = []
    const args: any[] = []
    if (params.search) {
      where.push('(c.name LIKE ? OR c.code LIKE ? OR ev.note LIKE ?)')
      const like = `%${params.search}%`
      args.push(like, like, like)
    }
    if (params.action) { where.push('ev.action = ?'); args.push(params.action) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM customer_connections ev JOIN customers c ON c.id = ev.customer_id ${whereSql}`).get(...args) as { c: number }).c
    const rows = db.prepare(`SELECT ev.*, c.code AS customer_code, c.name AS customer_name, a.name AS _area
      FROM customer_connections ev JOIN customers c ON c.id = ev.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      ${whereSql} ORDER BY ev.date DESC, ev.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize)
    return { rows, total, page, pageSize }
  })
}

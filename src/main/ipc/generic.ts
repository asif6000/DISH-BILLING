import { ipcMain } from 'electron'
import { ENTITIES, GENERIC_ENTITY_KEYS, FieldDef } from '../../shared/entities'
import { ListParams, ListResult } from '../../shared/types'
import { getDb, logActivity } from '../db'
import { requirePermission } from './auth'

const VALID_TYPE_RE = /^[a-zA-Z_]+$/

function entityDef(key: string) {
  const def = ENTITIES[key]
  if (!def || !GENERIC_ENTITY_KEYS.includes(key)) throw new Error('UNKNOWN_ENTITY')
  if (!VALID_TYPE_RE.test(def.table)) throw new Error('UNKNOWN_ENTITY')
  return def
}

// Decorate rows with human-readable labels for ref fields
function decorate(def: any, rows: any[]): any[] {
  const refFields = def.fields.filter((f: FieldDef) => f.type === 'ref' && f.refEntity)
  if (!refFields.length || !rows.length) return rows
  const db = getDb()
  for (const f of refFields) {
    const target = ENTITIES[f.refEntity!]
    if (!target || !VALID_TYPE_RE.test(target.table)) continue
    const ids = [...new Set(rows.map((r) => r[f.name]).filter((v) => v != null))]
    if (!ids.length) continue
    const ph = ids.map(() => '?').join(',')
    let rows2: any[]
    if (target.table === 'customers') {
      rows2 = db.prepare(`SELECT id, code || ' - ' || name AS label FROM customers WHERE id IN (${ph})`).all(...ids)
    } else {
      rows2 = db.prepare(`SELECT id, name AS label FROM ${target.table} WHERE id IN (${ph})`).all(...ids)
    }
    const map = new Map(rows2.map((r: any) => [r.id, r.label]))
    for (const r of rows) {
      r[`_${f.name}_label`] = r[f.name] != null ? map.get(r[f.name]) || null : null
    }
  }
  return rows
}

export function registerGenericIpc(): void {
  ipcMain.handle('db:list', (e, key: string, params: ListParams = {}): ListResult => {
    const def = entityDef(key)
    requirePermission(e, key)
    const db = getDb()
    const page = Math.max(1, params.page || 1)
    const pageSize = params.all ? 100000 : Math.min(200, Math.max(5, params.pageSize || 20))

    const where: string[] = []
    const args: any[] = []
    if (params.search) {
      const fields = def.searchFields
      if (fields.length) {
        where.push('(' + fields.map((f) => `${f} LIKE ?`).join(' OR ') + ')')
        const like = `%${params.search}%`
        fields.forEach(() => args.push(like))
      }
    }
    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v === '' || v === null || v === undefined) continue
        if (!VALID_TYPE_RE.test(k)) continue
        where.push(`${k} = ?`)
        args.push(v)
      }
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const sortField = params.sort && def.fields.some((f) => f.name === params.sort) ? params.sort : (def.defaultSort || 'id')
    const dir = params.dir === 'asc' ? 'ASC' : 'DESC'
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM ${def.table} ${whereSql}`).get(...args) as { c: number }).c
    const rows = db.prepare(`SELECT * FROM ${def.table} ${whereSql} ORDER BY ${sortField} ${dir} LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize)
    return { rows: decorate(def, rows), total, page, pageSize }
  })

  ipcMain.handle('db:get', (e, key: string, id: number) => {
    const def = entityDef(key)
    requirePermission(e, key)
    const row = getDb().prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id)
    return row ? decorate(def, [row])[0] : null
  })

  ipcMain.handle('db:create', (e, key: string, data: any) => {
    const def = entityDef(key)
    const s = requirePermission(e, key)
    const db = getDb()
    const fields = def.fields.filter((f) => !f.hideInForm || data[f.name] !== undefined)
    const names: string[] = []
    const values: any[] = []
    for (const f of fields) {
      if (data[f.name] === undefined || data[f.name] === null || data[f.name] === '') {
        if (f.required) throw new Error(`REQUIRED:${f.name}`)
        if (f.defaultValue !== undefined) values.push(f.defaultValue)
        else values.push(f.type === 'number' || f.type === 'money' ? 0 : null)
      } else {
        if (f.type === 'number' || f.type === 'money') {
          const n = Number(data[f.name])
          if (isNaN(n)) throw new Error(`INVALID_NUMBER:${f.name}`)
          if (f.min !== undefined && n < f.min) throw new Error(`MIN:${f.name}`)
          if (f.max !== undefined && n > f.max) throw new Error(`MAX:${f.name}`)
          values.push(n)
        } else values.push(data[f.name])
      }
      names.push(f.name)
    }
    if (!names.length) throw new Error('NO_FIELDS')
    const r = db.prepare(`INSERT INTO ${def.table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...values)
    logActivity(s.userId, s.username, 'create', key, String(r.lastInsertRowid))
    return r.lastInsertRowid
  })

  ipcMain.handle('db:update', (e, key: string, id: number, data: any) => {
    const def = entityDef(key)
    const s = requirePermission(e, key)
    const db = getDb()
    const sets: string[] = []
    const values: any[] = []
    for (const f of def.fields) {
      if (data[f.name] === undefined) continue
      let v: any = data[f.name]
      if (f.type === 'number' || f.type === 'money') {
        v = Number(v)
        if (isNaN(v)) throw new Error(`INVALID_NUMBER:${f.name}`)
        if (f.min !== undefined && v < f.min) throw new Error(`MIN:${f.name}`)
        if (f.max !== undefined && v > f.max) throw new Error(`MAX:${f.name}`)
      }
      if (v === '' && (f.type === 'ref')) v = null
      sets.push(`${f.name} = ?`)
      values.push(v)
    }
    if (!sets.length) throw new Error('NO_FIELDS')
    values.push(id)
    db.prepare(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    logActivity(s.userId, s.username, 'update', key, String(id))
    return true
  })

  ipcMain.handle('db:delete', (e, key: string, id: number) => {
    const def = entityDef(key)
    const s = requirePermission(e, key)
    getDb().prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id)
    logActivity(s.userId, s.username, 'delete', key, String(id))
    return true
  })

  // ref lists for dropdowns (full active lists)
  ipcMain.handle('db:reflist', (e, key: string) => {
    const def = ENTITIES[key]
    if (!def || !VALID_TYPE_RE.test(def.table)) throw new Error('UNKNOWN_ENTITY')
    requirePermission(e, key)
    const db = getDb()
    let sql: string
    if (def.table === 'customers') {
      sql = `SELECT id, code || ' - ' || name AS label FROM customers WHERE status != 'deleted' ORDER BY code`
    } else if (def.table === 'staff') {
      sql = `SELECT id, name || ' (' || designation || ')' AS label FROM staff WHERE status = 'active' ORDER BY name`
    } else if (def.table === 'collectors') {
      sql = `SELECT c.id, s.name AS label FROM collectors c JOIN staff s ON s.id = c.staff_id WHERE c.status = 'active' ORDER BY s.name`
    } else if (def.table === 'network_devices') {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM network_devices ORDER BY name`
    } else if (def.table === 'accounts') {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM accounts WHERE status = 'active' ORDER BY name`
    } else if (def.table === 'expense_categories') {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM expense_categories WHERE status = 'active' ORDER BY name`
    } else {
      sql = `SELECT id, name AS label FROM ${def.table} WHERE status = 'active' ORDER BY name`
    }
    return db.prepare(sql).all()
  })

  // collector area assignment
  ipcMain.handle('collector:assignAreas', (e, collectorId: number, areaIds: number[]) => {
    requirePermission(e, 'collectors')
    const db = getDb()
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM collector_areas WHERE collector_id = ?').run(collectorId)
      const ins = db.prepare('INSERT OR IGNORE INTO collector_areas (collector_id, area_id) VALUES (?,?)')
      for (const a of areaIds) ins.run(collectorId, a)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    return true
  })

  ipcMain.handle('collector:getAreas', (e, collectorId: number) => {
    requirePermission(e, 'collectors')
    return getDb().prepare('SELECT area_id FROM collector_areas WHERE collector_id = ?').all(collectorId)
  })
}

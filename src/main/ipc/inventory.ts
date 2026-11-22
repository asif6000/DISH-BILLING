import { ipcMain } from 'electron'
import { getDb, logActivity, nextSeq, today } from '../db'
import { requirePermission } from './auth'

export function registerInventoryIpc(): void {
  // create purchase with items in one transaction; updates stock.
  // Date/time: trusted backend timestamp (Asia/Dhaka) — the user never enters it.
  ipcMain.handle('purchases:create', (e, data: { supplier_id?: number; date?: string; paid?: number; note?: string; items: { product_id: number; qty: number; price: number; sale_price?: number }[] }) => {
    const s = requirePermission(e, 'inventory')
    const db = getDb()
    if (!data.items || !data.items.length) throw new Error('NO_ITEMS')
    const invoiceNo = 'PO-' + nextSeq('purchase_seq', 6)
    let total = 0
    for (const it of data.items) {
      const q = Number(it.qty), p = Number(it.price)
      if (!(q > 0) || !(p >= 0)) throw new Error('INVALID_ITEM')
      if (it.sale_price !== undefined && Number(it.sale_price) < 0) throw new Error('INVALID_ITEM')
      total += q * p
    }
    total = Math.round(total * 100) / 100
    // date = calendar day (keeps report range filters working), full timestamp saved separately
    const dhaka = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }) // 'YYYY-MM-DD HH:MM:SS'
    const date = (data.date || dhaka.slice(0, 10))
    db.exec('BEGIN')
    try {
      const r = db.prepare('INSERT INTO purchases (invoice_no, supplier_id, date, total, paid, status, note, created_local_time) VALUES (?,?,?,?,?,?,?,?)')
        .run(invoiceNo, data.supplier_id || null, date, total, Number(data.paid) || 0, 'completed', data.note || null, dhaka)
      const purchaseId = Number(r.lastInsertRowid)
      const insItem = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, qty, price) VALUES (?,?,?,?)')
      const updStock = db.prepare('UPDATE products SET stock = stock + ?, purchase_price = ?, sale_price = COALESCE(?, sale_price) WHERE id = ?')
      const insMove = db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, ref, date) VALUES (?,?,?,?,?,?)')
      for (const it of data.items) {
        insItem.run(purchaseId, it.product_id, Number(it.qty), Number(it.price))
        updStock.run(Number(it.qty), Number(it.price), it.sale_price !== undefined && it.sale_price !== null ? Number(it.sale_price) : null, it.product_id)
        insMove.run(it.product_id, 'in', Number(it.qty), 'Purchase', invoiceNo, date)
      }
      // payable/expense record (legacy paid field — hidden in UI, kept for old data)
      if (total > 0 && Number(data.paid) > 0) {
        const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
        if (account) {
          const cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Equipment Purchase' OR name = 'Cable Purchase' ORDER BY id LIMIT 1").get() as any
          db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
            .run(account.id, 'expense', cat ? cat.id : null, date, Number(data.paid), `Purchase ${invoiceNo}`, invoiceNo, s.username)
          db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(Number(data.paid), account.id)
        }
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'create_purchase', 'inventory', invoiceNo)
    return { id: 0, invoiceNo, total }
  })

  // full purchase list for history: purchase + first item + product (name/image/prices)
  ipcMain.handle('purchases:listFull', (e) => {
    requirePermission(e, 'inventory')
    return getDb().prepare(`SELECT p.id, p.invoice_no, p.date, p.created_local_time, p.total, p.paid,
        pi.qty, pi.price, pr.id AS product_id, pr.name AS product_name, pr.image AS product_image,
        pr.purchase_price, pr.sale_price
      FROM purchases p LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN products pr ON pr.id = pi.product_id
      ORDER BY p.id DESC LIMIT 300`).all()
  })

  // find product by name (case-insensitive) or create it — prevents duplicate products
  ipcMain.handle('products:findOrCreate', (e, data: { name: string; image?: string; salePrice?: number }) => {
    const s = requirePermission(e, 'inventory')
    const db = getDb()
    const name = String(data.name || '').trim()
    if (!name) throw new Error('MISSING_FIELDS')
    const found = db.prepare('SELECT id, name, image, purchase_price, sale_price FROM products WHERE name COLLATE NOCASE = ?').get(name) as any
    if (found) return { id: found.id, name: found.name, image: found.image, existed: true }
    const r = db.prepare("INSERT INTO products (name, category, unit, stock, min_stock, image, sale_price) VALUES (?, 'cable', 'pcs', 0, 5, ?, ?)")
      .run(name, data.image || null, data.salePrice !== undefined ? Number(data.salePrice) : 0)
    logActivity(s.userId, s.username, 'create_product', 'inventory', name)
    return { id: Number(r.lastInsertRowid), name, image: data.image || null, existed: false }
  })

  ipcMain.handle('purchases:get', (e, id: number) => {
    requirePermission(e, 'inventory')
    const db = getDb()
    const purchase = db.prepare(`SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`).get(id)
    const items = db.prepare(`SELECT pi.*, pr.name AS product_name, pr.unit FROM purchase_items pi
      LEFT JOIN products pr ON pr.id = pi.product_id WHERE pi.purchase_id = ?`).all(id)
    return { purchase, items }
  })

  ipcMain.handle('stock:move', (e, data: { product_id: number; type: 'in' | 'out' | 'adjust'; qty: number; reason?: string; ref?: string; date?: string }) => {
    const s = requirePermission(e, 'inventory')
    const db = getDb()
    const qty = Math.abs(Number(data.qty))
    if (!(qty > 0)) throw new Error('INVALID_QTY')
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(data.product_id) as any
    if (!product) throw new Error('NOT_FOUND')
    db.exec('BEGIN')
    try {
      let delta = qty
      if (data.type === 'out') delta = -qty
      if (data.type === 'adjust') delta = qty // adjust = set positive/negative via sign already included
      if (product.stock + delta < 0) throw new Error('INSUFFICIENT_STOCK')
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, data.product_id)
      db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, ref, date) VALUES (?,?,?,?,?,?)')
        .run(data.product_id, data.type, qty, data.reason || null, data.ref || null, data.date || today())
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    logActivity(s.userId, s.username, 'stock_move', 'inventory', `${data.type}:${qty}`)
    return true
  })
}

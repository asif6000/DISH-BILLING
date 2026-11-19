import { ipcMain } from 'electron'
import { getDb, logActivity, nextSeq, today } from '../db'
import { requirePermission } from './auth'

export function registerInventoryIpc(): void {
  // create purchase with items in one transaction; updates stock
  ipcMain.handle('purchases:create', (e, data: { supplier_id: number; date: string; paid: number; note?: string; items: { product_id: number; qty: number; price: number }[] }) => {
    const s = requirePermission(e, 'inventory')
    const db = getDb()
    if (!data.items || !data.items.length) throw new Error('NO_ITEMS')
    const invoiceNo = 'PO-' + nextSeq('purchase_seq', 6)
    let total = 0
    for (const it of data.items) {
      const q = Number(it.qty), p = Number(it.price)
      if (!(q > 0) || !(p >= 0)) throw new Error('INVALID_ITEM')
      total += q * p
    }
    total = Math.round(total * 100) / 100
    db.exec('BEGIN')
    try {
      const r = db.prepare('INSERT INTO purchases (invoice_no, supplier_id, date, total, paid, status, note) VALUES (?,?,?,?,?,?,?)')
        .run(invoiceNo, data.supplier_id || null, data.date || today(), total, Number(data.paid) || 0, 'completed', data.note || null)
      const purchaseId = Number(r.lastInsertRowid)
      const insItem = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, qty, price) VALUES (?,?,?,?)')
      const updStock = db.prepare('UPDATE products SET stock = stock + ?, purchase_price = ? WHERE id = ?')
      const insMove = db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, ref, date) VALUES (?,?,?,?,?,?)')
      for (const it of data.items) {
        insItem.run(purchaseId, it.product_id, Number(it.qty), Number(it.price))
        updStock.run(Number(it.qty), Number(it.price), it.product_id)
        insMove.run(it.product_id, 'in', Number(it.qty), 'Purchase', invoiceNo, data.date || today())
      }
      // payable/expense record
      if (total > 0) {
        const account = db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get() as any
        if (account && Number(data.paid) > 0) {
          const cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Equipment Purchase' OR name = 'Cable Purchase' ORDER BY id LIMIT 1").get() as any
          db.prepare('INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)')
            .run(account.id, 'expense', cat ? cat.id : null, data.date || today(), Number(data.paid), `Purchase ${invoiceNo}`, invoiceNo, s.username)
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

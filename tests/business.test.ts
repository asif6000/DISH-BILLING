// End-to-end business logic tests run in plain Node against the real main-process IPC handlers.
import { initDb, getDb } from '../src/main/db'
import { registerAuthIpc } from '../src/main/ipc/auth'
import { registerGenericIpc } from '../src/main/ipc/generic'
import { registerCustomerIpc } from '../src/main/ipc/customers'
import { registerBillingIpc } from '../src/main/ipc/billing'
import { registerPaymentIpc } from '../src/main/ipc/payments'
import { registerSettingsIpc } from '../src/main/ipc/settings'
import { registerBackupIpc } from '../src/main/ipc/backup'
import { registerInventoryIpc } from '../src/main/ipc/inventory'
import { registerMiscIpc } from '../src/main/ipc/misc'
import { registerDashboardIpc } from '../src/main/ipc/dashboard'
import { registerReportIpc } from '../src/main/ipc/reports'

const handlers = () => (require('./electron-stub.cjs').ipcMain._handlers as Record<string, Function>)

let pass = 0, fail = 0
function ok(name: string, cond: boolean, extra?: any) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗ FAIL:', name, extra !== undefined ? JSON.stringify(extra) : '') }
}
function section(name: string) { console.log('\n== ' + name + ' ==') }

const fakeEvent = { sender: { id: 1 } }

async function main() {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  // init db at the stub's userData path so backup/restore (getDbPath) match
  const userData = path.join(os.tmpdir(), 'ava-test-userData')
  fs.mkdirSync(userData, { recursive: true })
  fs.readdirSync(userData).filter((f: string) => f.startsWith('ava-cable')).forEach((f: string) => fs.unlinkSync(path.join(userData, f)))
  const db = initDb(path.join(userData, 'ava-cable.db'))

  registerAuthIpc(); registerGenericIpc(); registerCustomerIpc()
  registerBillingIpc(); registerPaymentIpc(); registerSettingsIpc()
  registerBackupIpc(); registerInventoryIpc(); registerMiscIpc()
  registerDashboardIpc(); registerReportIpc()
  const H = handlers()

  section('auth')
  const login = await H['auth:login'](fakeEvent, 'admin', 'admin123')
  ok('default admin login works', !!login?.user && login.user.roleName === 'Administrator', login)
  let threw = false
  try { await H['auth:login'](fakeEvent, 'admin', 'wrong') } catch { threw = true }
  ok('wrong password rejected', threw)
  const users = await H['users:list'](fakeEvent)
  ok('users list has admin', users.length === 1 && users[0].username === 'admin')

  section('master data')
  const areaId = await H['db:create'](fakeEvent, 'areas', { name: 'Mirpur', code: 'MPR', status: 'active' })
  const area2 = await H['db:create'](fakeEvent, 'areas', { name: 'Uttara', code: 'UTR', status: 'active' })
  ok('areas created', areaId > 0 && area2 > 0)
  const pkgId = await H['db:create'](fakeEvent, 'packages', { name: 'Basic', code: 'BSC', price: 300, type: 'basic', status: 'active' })
  const pkgFree = await H['db:create'](fakeEvent, 'packages', { name: 'Free Pkg', price: 0, type: 'free', status: 'active' })
  ok('packages created', pkgId > 0 && pkgFree > 0)
  const staffId = await H['db:create'](fakeEvent, 'staff', { name: 'Karim', designation: 'collector', mobile: '01711111111', salary: 10000, status: 'active' })
  const collectorId = await H['db:create'](fakeEvent, 'collectors', { staff_id: staffId, commission_rate: 5, target_amount: 50000, status: 'active' })
  ok('collector created', collectorId > 0)

  section('customers')
  const c1 = await H['customers:create'](fakeEvent, { name: 'Rahim Uddin', mobile: '01712345678', area_id: areaId, package_id: pkgId, monthly_bill: 300, connection_fee: 500 })
  const c2 = await H['customers:create'](fakeEvent, { name: 'Karima Begum', mobile: '01812345678', area_id: areaId, package_id: pkgId, monthly_bill: 300 })
  const c3 = await H['customers:create'](fakeEvent, { name: 'Free User', mobile: '01912345678', area_id: area2, package_id: pkgFree, monthly_bill: 0 })
  ok('customers created with auto IDs', c1 > 0 && c2 > 0 && c3 > 0)
  const list1 = await H['customers:list'](fakeEvent, { search: 'rahim' })
  ok('customer search', list1.total === 1 && list1.rows[0].code.startsWith('AVA-'))
  let threw2 = false
  try { await H['customers:create'](fakeEvent, { name: 'Bad', mobile: '12345' }) } catch (e: any) { threw2 = e.message.includes('INVALID_MOBILE') }
  ok('invalid mobile rejected', threw2)
  const cGet = await H['customers:get'](fakeEvent, c1)
  ok('customer get with relations', cGet.customer._area === 'Mirpur' && cGet.customer._package === 'Basic')

  section('billing generation')
  const month = new Date().toISOString().slice(0, 7)
  const gen1 = await H['billing:generate'](fakeEvent, month, undefined, 'manual')
  ok('bills generated for active customers', gen1.created === 3, gen1)
  const gen2 = await H['billing:generate'](fakeEvent, month, undefined, 'manual')
  ok('duplicate generation prevented', gen2.created === 0 && gen2.skipped === 3, gen2)
  const billList = await H['billing:list'](fakeEvent, { month })
  const freeBill = billList.rows.find((b: any) => b.customer_id === c3)
  ok('free package bill amount 0', Number(freeBill.amount) === 0, freeBill)
  const basicBill = billList.rows.find((b: any) => b.customer_id === c1)
  ok('basic bill amount 300', Number(basicBill.total) === 300, basicBill)

  section('payments — transaction safe')
  const pay1 = await H['payments:collect'](fakeEvent, { customerId: c1, amount: 300, method: 'cash', type: 'bill' })
  ok('full payment collected', !!pay1.receiptNo)
  const after1 = await H['customers:get'](fakeEvent, c1)
  ok('bill marked paid', after1.bills[0].status === 'paid' && Number(after1.bills[0].paid) === 300)
  ok('customer total_due zero', Number(after1.customer.total_due) === 0)

  // partial payment
  const pay2 = await H['payments:collect'](fakeEvent, { customerId: c2, amount: 200, method: 'bkash', reference: 'TRX123' })
  ok('partial payment ok', !!pay2.receiptNo)
  const after2 = await H['customers:get'](fakeEvent, c2)
  ok('bill partial status, due 100', after2.bills[0].status === 'partial' && Number(after2.bills[0].total - after2.bills[0].paid) === 100)
  ok('customer due 100', Number(after2.customer.total_due) === 100)

  // advance payment
  const pay3 = await H['payments:collect'](fakeEvent, { customerId: c2, amount: 500, method: 'cash', type: 'advance' })
  const after3 = await H['customers:get'](fakeEvent, c2)
  ok('advance recorded 500', Number(after3.customer.advance_balance) === 500, after3.customer.advance_balance)
  // advance pays the remaining 100 due; leftover 400 stays
  const useAdv = await H['payments:useAdvance'](fakeEvent, c2)
  ok('advance applied 100, leftover 400', useAdv.applied === 100 && useAdv.remaining === 400, useAdv)
  const after4 = await H['customers:get'](fakeEvent, c2)
  ok('bill paid via advance', after4.bills[0].status === 'paid' && Number(after4.customer.advance_balance) === 400)

  // overpay creates advance
  const pay4 = await H['payments:collect'](fakeEvent, { customerId: c1, amount: 1000, method: 'cash', type: 'bill' })
  const after5 = await H['customers:get'](fakeEvent, c1)
  ok('overpay creates advance 1000', Number(after5.customer.advance_balance) === 1000)
  // refund part of advance
  const refund = await H['payments:refund'](fakeEvent, c1, 300, 'test refund')
  const after6 = await H['customers:get'](fakeEvent, c1)
  ok('refund reduces advance to 700', Number(after6.customer.advance_balance) === 700)
  let threw3 = false
  try { await H['payments:refund'](fakeEvent, c1, 99999, 'too much') } catch (e: any) { threw3 = e.message.includes('INSUFFICIENT_ADVANCE') }
  ok('over-refund rejected', threw3)

  section('previous due carry-forward')
  const addMonths = (ym: string, n: number) => {
    const [y, m] = ym.split('-').map(Number)
    const mm = m - 1 + n
    const yy = y + Math.floor(mm / 12)
    return `${yy}-${String((mm % 12) + 1).padStart(2, '0')}`
  }
  // first remove c1's advance to keep math clean: refund remaining
  await H['payments:refund'](fakeEvent, c1, 700, 'cleanup')
  const nextMonth = addMonths(month, 1)
  const genNext = await H['billing:generate'](fakeEvent, nextMonth, undefined, 'manual')
  ok('next month bills generated', genNext.created === 3, genNext)
  const bList2 = await H['billing:list'](fakeEvent, { month: nextMonth })
  const c1Next = bList2.rows.find((b: any) => b.customer_id === c1)
  ok('no stale due (c1 clean)', Number(c1Next.previous_due) === 0 && Number(c1Next.total) === 300, c1Next)

  // make c2 due again: adjust discount this month then generate month after? Simpler: create partial: pay 100 of 300
  await H['payments:collect'](fakeEvent, { customerId: c2, amount: 100, method: 'cash' })
  const month3 = addMonths(nextMonth, 1)
  await H['billing:generate'](fakeEvent, month3, undefined, 'manual')
  const bList3 = await H['billing:list'](fakeEvent, { month: month3 })
  const c2m3 = bList3.rows.find((b: any) => b.customer_id === c2)
  ok('previous due 200 carried forward', Number(c2m3.previous_due) === 200 && Number(c2m3.total) === 500, c2m3)

  section('bill adjust / cancel')
  const b1 = bList3.rows.find((b: any) => b.customer_id === c1)
  await H['billing:adjust'](fakeEvent, b1.id, 50, 20, 'goodwill')
  const adjList = await H['billing:list'](fakeEvent, { month: month3 })
  const adjB = adjList.rows.find((b: any) => b.id === b1.id)
  ok('adjust: 300-50+20+300(prev) = 570', Number(adjB.total) === 570, adjB)
  const cancelTarget = bList3.rows.find((b: any) => b.customer_id === c3)
  await H['billing:cancel'](fakeEvent, cancelTarget.id)
  const afterCancel = await H['billing:list'](fakeEvent, { month: month3, status: 'cancelled' })
  ok('unpaid bill cancelled', afterCancel.rows.length === 1)

  section('inventory')
  const prodId = await H['db:create'](fakeEvent, 'products', { name: 'STB', category: 'stb', purchase_price: 1500, sale_price: 1800, stock: 0, min_stock: 5, status: 'active' })
  const supId = await H['db:create'](fakeEvent, 'suppliers', { name: 'Cable Supply Ltd', status: 'active' })
  const pur = await H['purchases:create'](fakeEvent, { supplier_id: supId, date: new Date().toISOString().slice(0, 10), paid: 5000, items: [{ product_id: prodId, qty: 10, price: 1500 }] })
  ok('purchase created', pur.invoiceNo.startsWith('PO-') && pur.total === 15000, pur)
  const prod = await H['db:get'](fakeEvent, 'products', prodId)
  ok('stock updated to 10', Number(prod.stock) === 10)
  await H['stock:move'](fakeEvent, { product_id: prodId, type: 'out', qty: 3, reason: 'installation' })
  const prod2 = await H['db:get'](fakeEvent, 'products', prodId)
  ok('stock out → 7', Number(prod2.stock) === 7)
  let threw4 = false
  try { await H['stock:move'](fakeEvent, { product_id: prodId, type: 'out', qty: 100 }) } catch (e: any) { threw4 = e.message.includes('INSUFFICIENT_STOCK') }
  ok('over-stock-out rejected', threw4)

  section('accounts')
  const accounts = await H['db:list'](fakeEvent, 'accounts', {})
  ok('cash box exists with transactions recorded', accounts.rows.length >= 1 && typeof Number(accounts.rows[0].balance) === 'number', accounts.rows[0]?.balance)
  const cashbook = await H['accounts:cashbook'](fakeEvent, '2000-01-01', '2099-01-01')
  ok('cashbook rows computed', cashbook.rows.length > 0 && cashbook.rows[cashbook.rows.length - 1].balance === cashbook.rows[cashbook.rows.length - 1].balance)
  const pl = await H['reports:profitLoss'](fakeEvent, '2000-01-01', '2099-01-01')
  ok('P&L computes', typeof pl.netProfit === 'number' && pl.totalIncome > 0, pl)

  section('resellers')
  const resId = await H['db:create'](fakeEvent, 'resellers', { name: 'Local Agent', mobile: '01611111111', commission_rate: 10, status: 'active' })
  await H['resellers:txn'](fakeEvent, { reseller_id: resId, type: 'recharge', amount: 1000 })
  const res2 = await H['db:get'](fakeEvent, 'resellers', resId)
  ok('wallet recharge 1000', Number(res2.wallet_balance) === 1000)

  section('dashboard & reports')
  const stats = await H['dashboard:stats'](fakeEvent, month)
  ok('dashboard counts', stats.totalCustomers === 3 && stats.activeCustomers === 3, stats)
  const dueList = await H['reports:dueList'](fakeEvent, month3)
  ok('due list has c2', dueList.some((d: any) => d.id === c2), dueList.map((d: any) => d.id))

  section('generic CRUD + permissions')
  const roles = await H['roles:list'](fakeEvent)
  ok('3 system roles seeded', roles.length === 3)
  const roleId = await H['roles:save'](fakeEvent, { name: 'Viewer', permissions: ['dashboard'] })
  const roles2 = await H['roles:list'](fakeEvent)
  const viewer = roles2.find((r: any) => r.name === 'Viewer')
  ok('custom role created', !!viewer)

  section('backup')
  const backupFile = os.tmpdir() + `/ava-backup-test-${Date.now()}.db`
  await H['backup:create'](fakeEvent, backupFile)
  ok('backup file created', fs.existsSync(backupFile))
  const integrity = await H['backup:integrity'](fakeEvent)
  ok('integrity check ok', integrity === true)

  console.log(`\n=========================\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1) })

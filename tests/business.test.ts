// End-to-end business logic tests run in plain Node against the real main-process IPC handlers.
import { initDb, getDb, getSetting } from '../src/main/db'
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
  ok('default admin login works as SUPER_ADMIN', !!login?.user && login.user.roleName === 'SUPER_ADMIN' && login.user.permissions.includes('all'), login)
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
  // Paid/Free connection dropdown: Paid keeps amounts, Free forces 0/0
  const cPaid = await H['customers:create'](fakeEvent, { name: 'Paid Conn', mobile: '01311111111', area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_fee: 400, connection_type: 'paid', note: 'old note kept' })
  const paidRow = await H['customers:get'](fakeEvent, cPaid)
  ok('paid connection saves amounts + type', paidRow.customer.monthly_bill === 250 && paidRow.customer.connection_fee === 400 && paidRow.customer.connection_type === 'paid' && paidRow.customer.note === 'old note kept', paidRow.customer)
  const cFree = await H['customers:create'](fakeEvent, { name: 'Free Conn', mobile: '01322222222', area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_fee: 400, connection_type: 'free', note: 'should be ignored for amounts' })
  const freeRow = await H['customers:get'](fakeEvent, cFree)
  ok('free connection forces ৳0 amounts + Free type', freeRow.customer.monthly_bill === 0 && freeRow.customer.connection_fee === 0 && freeRow.customer.connection_type === 'free', freeRow.customer)
  let threwConnType = false
  try { await H['customers:create'](fakeEvent, { name: 'Bad Type', mobile: '01333333333', connection_type: 'half' }) } catch (e: any) { threwConnType = e.message.includes('INVALID_CONNECTION_TYPE') }
  ok('invalid connection type rejected', threwConnType)
  // switching Free → Paid restores editable amounts; editing loads saved type
  await H['customers:update'](fakeEvent, cFree, { connection_type: 'paid', monthly_bill: 200, connection_fee: 100 })
  const switched = await H['customers:get'](fakeEvent, cFree)
  ok('free → paid switch saves new amounts', switched.customer.connection_type === 'paid' && switched.customer.monthly_bill === 200 && switched.customer.connection_fee === 100, switched.customer)
  await H['customers:update'](fakeEvent, cPaid, { connection_type: 'free', monthly_bill: 999, connection_fee: 999 })
  const toFree = await H['customers:get'](fakeEvent, cPaid)
  ok('paid → free switch zeroes amounts (no stale values)', toFree.customer.connection_type === 'free' && toFree.customer.monthly_bill === 0 && toFree.customer.connection_fee === 0, toFree.customer)
  ok('note data preserved through type changes', toFree.customer.note === 'old note kept', toFree.customer.note)
  // free list filter includes the new connection_type flag
  const freeList = await H['customers:list'](fakeEvent, { status: 'free', all: true })
  ok('free status filter follows connection_type', freeList.rows.some((r: any) => r.id === cPaid) && !freeList.rows.some((r: any) => r.id === cFree), freeList.rows.map((r: any) => r.id))
  // cleanup: remove the two dropdown-test customers so status counts in later
  // sections stay identical to before (also exercises bulk delete again)
  const delMany = await H['customers:deleteMany'](fakeEvent, [cPaid, cFree])
  ok('connection-type test customers cleaned up', delMany.deleted === 2, delMany)
  const cGet = await H['customers:get'](fakeEvent, c1)
  ok('customer get with relations', cGet.customer._area === 'Mirpur' && cGet.customer._package === 'Basic')

  section('billing generation')
  const month = new Date().toISOString().slice(0, 7)
  // Paid/Free dropdown: a free connection is created then billing must SKIP it
  const cFreeB = await H['customers:create'](fakeEvent, { name: 'Free Bill Skip', mobile: '01344444444', area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_type: 'free' })
  const gen1 = await H['billing:generate'](fakeEvent, month, undefined, 'manual')
  ok('bills generated for active customers (free connection skipped)', gen1.created === 3 && gen1.skipped === 1, gen1)
  const freeBills = await H['customers:get'](fakeEvent, cFreeB)
  ok('free connection has no bill at all', freeBills.bills.length === 0, freeBills.bills)
  await H['customers:delete'](fakeEvent, cFreeB)
  const gen2 = await H['billing:generate'](fakeEvent, month, undefined, 'manual')
  ok('duplicate generation prevented', gen2.created === 0 && gen2.skipped === 3, gen2)
  const billList = await H['billing:list'](fakeEvent, { month })
  const freeBill = billList.rows.find((b: any) => b.customer_id === c3)
  ok('free package bill amount 0', Number(freeBill.amount) === 0, freeBill)
  ok('bill rows carry connection_type', typeof billList.rows[0].connection_type === 'string', billList.rows[0])
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
  ok('system roles seeded (incl. SUPER_ADMIN)', roles.length === 4)

  section('dynamic permissions (RBAC delegation)')
  const managerRoleId = (roles as any[]).find((r: any) => r.name === 'Manager')!.id
  const adminRoleId = (roles as any[]).find((r: any) => r.name === 'Administrator')!.id
  // an ordinary ADMIN (Administrator role — NOT super) to test delegation rules
  const admin2Id = await H['users:create'](fakeEvent, { username: 'admin2', password: 'secret1', full_name: 'Admin Two', role_id: adminRoleId }) as number
  const admin2Login = await H['auth:login']({ sender: { id: 3 } } as any, 'admin2', 'secret1')
  ok('admin2 is not super', !admin2Login.user.permissions.includes('all'))
  const mgrUserId = await H['users:create']({ sender: { id: 3 } } as any, { username: 'mgr1', password: 'secret1', full_name: 'Manager One', role_id: managerRoleId }) as number
  ok('admin creates Manager user', mgrUserId > 0)
  await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [{ key: 'reports.view' }])
  const mgrPerms = await H['permissions:get'](fakeEvent, mgrUserId)
  ok('admin grants granular permission to Manager', (mgrPerms.grants as any[]).some((g) => g.permission_key === 'reports.view'))
  let delegErr = ''
  try { await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [{ key: 'security.manage' }]) } catch (e: any) { delegErr = String(e) }
  ok('admin cannot grant unheld permission', delegErr.includes('DELEGATION_DENIED'))
  const staffRoleId = (roles as any[]).find((r: any) => r.name === 'Collector')!.id
  await H['users:create']({ sender: { id: 3 } } as any, { username: 'col1', password: 'secret1', full_name: 'Collector One', role_id: staffRoleId })
  const mgrLogin = await H['auth:login']({ sender: { id: 2 } } as any, 'mgr1', 'secret1')
  ok('manager login has granular perm', mgrLogin.user.permissions.includes('reports.view'))
  let mgrGrantErr = ''
  try { await H['permissions:set']({ sender: { id: 2 } } as any, mgrUserId, [{ key: 'reports.view' }]) } catch (e: any) { mgrGrantErr = String(e) }
  ok('manager cannot manage permissions', mgrGrantErr.includes('PERMISSION_DENIED'))
  await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [])
  const mgrPerms2 = await H['permissions:get'](fakeEvent, mgrUserId)
  ok('permission revoked from manager', !(mgrPerms2.grants as any[]).some((g) => g.permission_key === 'reports.view'))
  const auditRows = await H['permissions:audit'](fakeEvent, mgrUserId)
  ok('permission audit trail recorded', auditRows.length >= 2)

  section('SUPER_ADMIN role visibility')
  const rolesSuper = await H['roles:list'](fakeEvent)
  ok('super sees SUPER_ADMIN role', (rolesSuper as any[]).some((r: any) => r.name === 'SUPER_ADMIN'))
  const rolesAdmin = await H['roles:list']({ sender: { id: 3 } } as any)
  ok('admin does NOT see SUPER_ADMIN role', !(rolesAdmin as any[]).some((r: any) => r.name === 'SUPER_ADMIN'))
  let roleEditErr = ''
  try { await H['roles:save']({ sender: { id: 3 } } as any, { name: 'X', permissions: ['all'] }) } catch (e: any) { roleEditErr = String(e) }
  ok('admin cannot create/edit roles (security-only)', roleEditErr.includes('PERMISSION_DENIED'))

  section('SUPER_ADMIN account visibility')
  const usersSuper = await H['users:list'](fakeEvent)
  ok('super sees the SUPER_ADMIN account', (usersSuper as any[]).some((u: any) => u.role_name === 'SUPER_ADMIN'))
  const usersAdmin = await H['users:list']({ sender: { id: 3 } } as any)
  ok('admin does NOT see SUPER_ADMIN account', !(usersAdmin as any[]).some((u: any) => u.role_name === 'SUPER_ADMIN'))
  const superUser = (usersSuper as any[]).find((u: any) => u.role_name === 'SUPER_ADMIN')!
  let editSuperErr = ''
  try { await H['users:update']({ sender: { id: 3 } } as any, superUser.id, { full_name: 'Hacked', status: 'inactive' }) } catch (e: any) { editSuperErr = String(e) }
  ok('admin cannot edit SUPER_ADMIN account', editSuperErr.includes('PERMISSION_DENIED'))
  let delSuperErr = ''
  try { await H['users:delete']({ sender: { id: 3 } } as any, superUser.id) } catch (e: any) { delSuperErr = String(e) }
  ok('admin cannot delete SUPER_ADMIN account', delSuperErr.includes('SUPER_ADMIN_UNDELETABLE'))

  section('collector ownership + dropdown')
  // admin2 (sender 3) creates two collectors via quick-add
  const colA = await H['collectors:quickAdd']({ sender: { id: 3 } } as any, 'Rahim', '01711111111')
  const colB = await H['collectors:quickAdd']({ sender: { id: 3 } } as any, 'Karim', '01822222222')
  ok('two collectors created by admin2', colA.id > 0 && colB.id > 0)
  const listA = await H['db:reflist']({ sender: { id: 3 } } as any, 'collectors')
  ok('admin2 sees own collectors with name+mobile',
    listA.some((c: any) => c.label.includes('Rahim') && c.label.includes('01711111111')) &&
    listA.some((c: any) => c.label.includes('Karim')))
  // super admin sees company-wide collectors too
  const listSuper = await H['db:reflist'](fakeEvent, 'collectors')
  ok('super admin sees all collectors', listSuper.some((c: any) => c.label.includes('Rahim')))
  // deactivate → disappears from dropdown
  await H['db:update']({ sender: { id: 3 } } as any, 'collectors', colB.id, { status: 'inactive' })
  const listA2 = await H['db:reflist']({ sender: { id: 3 } } as any, 'collectors')
  ok('deactivated collector hidden from dropdown', !listA2.some((c: any) => c.label.includes('Karim')) && listA2.some((c: any) => c.label.includes('Rahim')))

  section('purchase form v2 (manual product, auto timestamp)')
  const p1 = await H['products:findOrCreate'](fakeEvent, { name: 'Coaxial Cable 100m', salePrice: 2500 })
  ok('new product created from manual name', p1.id > 0 && p1.existed === false)
  const p1b = await H['products:findOrCreate'](fakeEvent, { name: 'coaxial cable 100M' })
  ok('existing product matched case-insensitively (no duplicate)', p1b.existed === true && p1b.id === p1.id)
  const pur2 = await H['purchases:create'](fakeEvent, { items: [{ product_id: p1.id, qty: 4, price: 2000, sale_price: 2500 }] })
  ok('purchase saved without date/paid fields', !!pur2.invoiceNo && pur2.total === 8000)
  const purList = await H['purchases:listFull'](fakeEvent)
  const purRow = (purList as any[]).find((x: any) => x.invoice_no === pur2.invoiceNo)
  ok('auto timestamp (Asia/Dhaka) saved', !!purRow && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(purRow.created_local_time || ''))
  ok('history shows product name/image/prices', !!purRow && purRow.product_name === 'Coaxial Cable 100m' && Number(purRow.sale_price) === 2500)
  const prodAfter = await H['db:get'](fakeEvent, 'products', p1.id)
  ok('stock increased by purchased qty', Number(prodAfter.stock) === 4)
  ok('sell price updated from purchase', Number(prodAfter.sale_price) === 2500)

  section('collection page (billing records with month range + collector filter)')
  // c1: bill 300 paid 300 (paid), c2: bill 300 paid 200 (partial) from earlier sections
  const curMonth = month
  const bl = await H['reports:billList'](fakeEvent, curMonth, { from: curMonth, to: curMonth })
  ok('billList range works (single month)', (bl as any[]).some((r: any) => r.name === 'Karima Begum' && r.status === 'paid' && Number(r.paid) === 300 && Number(r.currentDue) === 0))
  const blPaid = await H['reports:billList'](fakeEvent, curMonth, { from: curMonth, to: curMonth, status: 'paid' })
  ok('status filter works', (blPaid as any[]).every((r: any) => r.status === 'paid') && (blPaid as any[]).length > 0)

  section('expense management (auto date, main balance, edit/delete reversal)')
  const accRow = await H['db:list'](fakeEvent, 'accounts', { page: 1, pageSize: 5 })
  const accId = (accRow.rows as any[])[0].id
  const mbPre = await H['accounts:mainBalance'](fakeEvent)
  // income first to fund the balance
  await H['transactions:create'](fakeEvent, { account_id: accId, type: 'income', amount: 10000 })
  const mb0 = await H['accounts:mainBalance'](fakeEvent)
  ok('main balance computed from accounts', Number(mb0.balance) === Number(mbPre.balance) + 10000)
  // expense WITHOUT date/description → auto-generated, balance deducted
  const exp = await H['transactions:create'](fakeEvent, { account_id: accId, type: 'expense', amount: 2000, ref: 'EXP-1' })
  ok('expense saved without date/description', exp === true)
  const txnList = await H['transactions:list'](fakeEvent, { page: 1, pageSize: 5, filters: { type: 'expense' } })
  const expRow = (txnList.rows as any[])[0]
  ok('expense auto date/time (Asia/Dhaka) saved', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(expRow.created_local_time || ''))
  ok('expense auto description generated', !!expRow.description)
  const mb1 = await H['accounts:mainBalance'](fakeEvent)
  ok('main balance deducted by expense', Number(mb1.balance) === Number(mb0.balance) - 2000)
  // overdraw rejected
  let overErr = ''
  try { await H['transactions:create'](fakeEvent, { account_id: accId, type: 'expense', amount: 999999 }) } catch (e: any) { overErr = String(e) }
  ok('expense overdraw rejected', overErr.includes('INSUFFICIENT_BALANCE'))
  // edit: reverse old, apply new
  await H['transactions:update'](fakeEvent, expRow.id, { amount: 3000 })
  const mb2 = await H['accounts:mainBalance'](fakeEvent)
  ok('edit reverses old and applies new (10000-3000)', Number(mb2.balance) === Number(mb0.balance) - 3000)
  // delete: reverse deduction
  await H['transactions:delete'](fakeEvent, expRow.id)
  const mb3 = await H['accounts:mainBalance'](fakeEvent)
  ok('delete reverses deduction (back to start)', Number(mb3.balance) === Number(mb0.balance))
  // duplicate category prevented
  let dupErr = ''
  try { await H['db:create'](fakeEvent, 'expense_categories', { name: 'Staff Salary', type: 'expense' }) } catch (e: any) { dupErr = String(e) }
  ok('duplicate category name rejected', dupErr.includes('DUPLICATE_CATEGORY'))
  const newCat = await H['db:create'](fakeEvent, 'expense_categories', { name: 'Unique Test Cat', type: 'expense' })
  ok('new category created (dynamic)', newCat > 0)
  await H['db:update'](fakeEvent, 'expense_categories', newCat, { status: 'inactive' })
  const catsList = await H['db:reflist'](fakeEvent, 'expense_categories')
  ok('deactivated category hidden from dropdown', !catsList.some((c: any) => c.label.includes('Unique Test Cat')))

  section('collection history snapshots (due before/after)')
  // c1 currently has advance 700, zero bills due. Make a fresh due: pay 200 of a new bill
  const c4 = await H['customers:create'](fakeEvent, { name: 'History Test', mobile: '01600000000', area_id: areaId, package_id: pkgId, monthly_bill: 300 })
  await H['billing:generate'](fakeEvent, month, undefined, 'manual') // bills for all active customers
  const payH1 = await H['payments:collect'](fakeEvent, { customerId: c4, amount: 200, method: 'bkash', type: 'bill', collectorId: colA.id })
  const h1 = await H['payments:list'](fakeEvent, { search: payH1.receiptNo })
  const h1r = (h1.rows as any[])[0]
  ok('partial collection: previous due 300, remaining 100', Number(h1r.due_before) === 300 && Number(h1r.due_after) === 100)
  ok('collection history has customer name + area + collector', h1r.customer_name === 'History Test' && !!h1r._area && h1r._collector === 'Rahim')
  ok('collection has Asia/Dhaka timestamp', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(h1r.created_local_time || ''))
  // full payment → remaining due 0
  const payH2 = await H['payments:collect'](fakeEvent, { customerId: c4, amount: 100, method: 'cash', type: 'bill' })
  const h2 = await H['payments:list'](fakeEvent, { search: payH2.receiptNo })
  const h2r = (h2.rows as any[])[0]
  ok('full collection: remaining due 0', Number(h2r.due_before) === 100 && Number(h2r.due_after) === 0)
  // multiple collections keep accurate history (two separate records)
  const hist = await H['payments:list'](fakeEvent, { search: 'History Test' })
  ok('multiple collections for same customer in history', (hist.rows as any[]).length === 2)

  section('company profile (settings menu, role-based)')
  // Administrator (admin2, sender 3) — has company_profile permission → can update
  await H['settings:companyProfileUpdate']({ sender: { id: 3 } } as any, { company_name: 'AVA Cable Network', company_mobile: '01987654321' })
  const prof = await H['settings:companyProfile']({ sender: { id: 3 } } as any)
  ok('admin updated company profile (persists)', prof.company_name === 'AVA Cable Network' && prof.company_mobile === '01987654321')
  // Collector (mgr1 has Manager role without company_profile) — edit denied, view allowed
  const mgrSess = await H['auth:login']({ sender: { id: 4 } } as any, 'mgr1', 'secret1')
  let cpErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: 'Hacked Ltd' }) } catch (e: any) { cpErr = String(e) }
  ok('manager cannot edit company profile', cpErr.includes('PERMISSION_DENIED'))
  const prof2 = await H['settings:companyProfile']({ sender: { id: 4 } } as any)
  ok('manager can view company profile', prof2.company_name === 'AVA Cable Network')
  // legacy settings:setMany for company keys by admin also allowed, non-company keys denied
  let sysErr = ''
  try { await H['settings:set']({ sender: { id: 3 } } as any, 'late_fee', '99') } catch (e: any) { sysErr = String(e) }
  ok('admin cannot change system settings', sysErr.includes('PERMISSION_DENIED'))

  section('excel customer import')
  const imp = await H['customers:import'](fakeEvent, [
    { name: 'ইমপোর্ট গ্রাহক ১', address: 'কুষ্টিয়া', mobile: '০১৯১১২২৩৩৪৪' },
    { name: 'Import Customer 2', address: 'Kushtia', mobile: '01911223344' },
    { name: '', address: 'x', mobile: '01955556666' },
    { name: 'Bad Mobile', address: '', mobile: '12345' }
  ])
  ok('import: 1 imported (bn name+bn digits), 1 duplicate, 2 invalid', imp.imported === 1 && imp.duplicates === 1 && imp.invalid === 2)
  const impList = await H['customers:list'](fakeEvent, { search: 'ইমপোর্ট গ্রাহক' })
  const impRow = (impList.rows as any[])[0]
  ok('bangla name preserved + auto code + bn digits normalized', !!impRow && impRow.name === 'ইমপোর্ট গ্রাহক ১' && String(impRow.code).startsWith('AVA-') && impRow.mobile === '01911223344')
  // no bills/payments generated by import
  ok('import creates no bills', Number(impRow.total_due) === 0)

  section('payment collection with/without collector')
  const payC1 = await H['payments:collect']({ sender: { id: 3 } } as any, { customerId: c1, amount: 50, method: 'nagad', type: 'bill', collectorId: colA.id })
  const payRow = await H['payments:list']({ sender: { id: 3 } } as any, { search: payC1.receiptNo })
  ok('payment saved with collector id', payRow.rows[0]?.collector_id === colA.id)
  const payC2 = await H['payments:collect']({ sender: { id: 3 } } as any, { customerId: c1, amount: 50, method: 'rocket', type: 'bill', collectorId: null })
  const payRow2 = await H['payments:list']({ sender: { id: 3 } } as any, { search: payC2.receiptNo })
  ok('payment without collector has NULL collector_id', payRow2.rows[0]?.collector_id == null)
  ok('each payment appears exactly once in list', payRow.rows.length === 1 && payRow2.rows.length === 1)

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

  section('permission fix — Administrator save with granted permission')
  // (1) SUPER_ADMIN can edit the Administrator system role (was SYSTEM_ROLE_READONLY)
  const adminRole2 = (await H['roles:list'](fakeEvent) as any[]).find((r) => r.name === 'Administrator')!
  let adminRoleSaveErr = ''
  try { await H['roles:save'](fakeEvent, { id: adminRole2.id, name: 'Administrator', permissions: ['areas'] }) } catch (e: any) { adminRoleSaveErr = String(e) }
  ok('Administrator role permissions CAN be saved from Security → Roles', adminRoleSaveErr === '', adminRoleSaveErr)
  // 'all' can never be granted to a non-SUPER_ADMIN role
  let allErr = ''
  try { await H['roles:save'](fakeEvent, { id: adminRole2.id, name: 'Administrator', permissions: ['all'] }) } catch (e: any) { allErr = String(e) }
  ok("'all' reserved for SUPER_ADMIN role", allErr.includes('ALL_PERMISSION_RESERVED'))
  // SUPER_ADMIN role itself stays read-only
  const superRole = (await H['roles:list'](fakeEvent) as any[]).find((r) => r.name === 'SUPER_ADMIN')!
  let superErr = ''
  try { await H['roles:save'](fakeEvent, { id: superRole.id, name: 'SUPER_ADMIN', permissions: [] }) } catch (e: any) { superErr = String(e) }
  ok('SUPER_ADMIN role stays read-only', superErr.includes('SYSTEM_ROLE_READONLY'))

  // (2) Administrator user with View+Edit → can view AND save
  const admin3Id = await H['users:create'](fakeEvent, { username: 'admin3', password: 'secret1', full_name: 'Admin Three', role_id: adminRole2.id }) as number
  const admin3Login = await H['auth:login']({ sender: { id: 4 } } as any, 'admin3', 'secret1')
  ok('admin3 login carries effective role permissions', admin3Login.user.permissions.includes('areas'))
  const admin3List = await H['db:list']({ sender: { id: 4 } } as any, 'areas', {})
  ok('admin3 can view granted section', admin3List.total >= 1)
  const admin3Create = await H['db:create']({ sender: { id: 4 } } as any, 'areas', { name: 'Admin3 Area', status: 'active' })
  ok('admin3 can ADD with granted permission (Save works)', admin3Create > 0)
  const admin3Update = await H['db:update']({ sender: { id: 4 } } as any, 'areas', admin3Create, { name: 'Admin3 Area Renamed' })
  ok('admin3 can EDIT/UPDATE with granted permission', admin3Update === true)
  const admin3Del = await H['db:delete']({ sender: { id: 4 } } as any, 'areas', admin3Create)
  ok('admin3 can DELETE with granted permission', admin3Del === true)
  // not-super areas: security stays out of reach without the grant
  let admin3LogsErr = ''
  try { await H['logs:activity']({ sender: { id: 4 } } as any) } catch (e: any) { admin3LogsErr = String(e) }
  ok('admin3 without security grant cannot view logs', admin3LogsErr.includes('PERMISSION_DENIED'))

  // (3) View-only Administrator → can view but CANNOT save — WITHOUT re-login
  await H['roles:save'](fakeEvent, { id: adminRole2.id, name: 'Administrator', permissions: ['areas.view'] })
  const admin3Check = await H['auth:check']({ sender: { id: 4 } } as any)
  ok('live session refreshed after role change (no logout/login)', (admin3Check.user.permissions as string[]).includes('areas.view') && !(admin3Check.user.permissions as string[]).includes('areas'))
  const admin3List2 = await H['db:list']({ sender: { id: 4 } } as any, 'areas', {})
  ok('view-only admin can still VIEW', admin3List2.total >= 1)
  let admin3SaveErr = ''
  try { await H['db:create']({ sender: { id: 4 } } as any, 'areas', { name: 'Nope', status: 'active' }) } catch (e: any) { admin3SaveErr = String(e) }
  ok('view-only admin CANNOT save (Access Denied)', admin3SaveErr.includes('PERMISSION_DENIED:areas.create'))
  let admin3EditErr = ''
  try { await H['db:update']({ sender: { id: 4 } } as any, 'areas', areaId, { name: 'Nope' }) } catch (e: any) { admin3EditErr = String(e) }
  ok('view-only admin CANNOT edit', admin3EditErr.includes('PERMISSION_DENIED:areas.edit'))

  // (4) View + Edit → save works again immediately after the permission change
  await H['roles:save'](fakeEvent, { id: adminRole2.id, name: 'Administrator', permissions: ['areas.view', 'areas.edit'] })
  const admin3Update2 = await H['db:update']({ sender: { id: 4 } } as any, 'areas', areaId, { status: 'active' })
  ok('view+edit admin can SAVE after permission change', admin3Update2 === true)
  let admin3CreateErr2 = ''
  try { await H['db:create']({ sender: { id: 4 } } as any, 'areas', { name: 'Nope2', status: 'active' }) } catch (e: any) { admin3CreateErr2 = String(e) }
  ok('view+edit admin still cannot CREATE (no create grant)', admin3CreateErr2.includes('PERMISSION_DENIED:areas.create'))
  let admin3DelErr2 = ''
  try { await H['db:delete']({ sender: { id: 4 } } as any, 'areas', areaId) } catch (e: any) { admin3DelErr2 = String(e) }
  ok('view+edit admin cannot DELETE (no delete grant)', admin3DelErr2.includes('PERMISSION_DENIED:areas.delete'))

  // (5) Collector without permission → cannot access or save
  const colRoleId = (await H['roles:list'](fakeEvent) as any[]).find((r) => r.name === 'Collector')!.id
  await H['users:create'](fakeEvent, { username: 'col2', password: 'secret1', full_name: 'Collector Two', role_id: colRoleId })
  await H['auth:login']({ sender: { id: 5 } } as any, 'col2', 'secret1')
  let colViewErr = ''
  try { await H['db:list']({ sender: { id: 5 } } as any, 'staff', {}) } catch (e: any) { colViewErr = String(e) }
  ok('collector without permission CANNOT view', colViewErr.includes('PERMISSION_DENIED:staff'))
  let colSaveErr = ''
  try { await H['db:create']({ sender: { id: 5 } } as any, 'staff', { name: 'Nope' }) } catch (e: any) { colSaveErr = String(e) }
  ok('collector without permission CANNOT save', colSaveErr.includes('PERMISSION_DENIED:staff.create'))
  let colSecurityErr = ''
  try { await H['roles:save']({ sender: { id: 5 } } as any, { name: 'Hack', permissions: ['all'] }) } catch (e: any) { colSecurityErr = String(e) }
  ok('collector can never touch Security → Roles', colSecurityErr.includes('PERMISSION_DENIED:security'))

  // restore the Administrator role to its seeded permission set for other tests/users
  await H['roles:save'](fakeEvent, {
    id: adminRole2.id, name: 'Administrator',
    permissions: ['dashboard', 'areas', 'customers', 'billing', 'payments', 'collectors', 'cash_deposits', 'reports', 'messaging', 'complaints', 'packages', 'connections', 'messages', 'sms_templates', 'customer_documents', 'staff', 'resellers', 'inventory', 'accounts', 'users', 'company_profile']
  })

  section('company profile — Settings save fix')
  // admin3 (sender 4) holds the Administrator role with company_profile permission
  const coProfile = await H['settings:companyProfile']({ sender: { id: 4 } } as any)
  ok('company profile view loads for Administrator', !!coProfile && 'company_name' in coProfile)
  // Administrator CAN save company information (root-cause fix: previously PERMISSION_DENIED)
  await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, {
    company_name: 'AVA Test Cable Network', company_mobile: '01712345678',
    company_mobile_alt: '01812345678', company_email: 'info@avatest.com',
    company_address: 'Mirpur 10, Dhaka',
    company_logo: 'data:image/png;base64,iVBORw0KGgo='
  })
  const coAfter = await H['settings:companyProfile']({ sender: { id: 4 } } as any)
  ok('Administrator saved company name + mobile', coAfter.company_name === 'AVA Test Cable Network' && coAfter.company_mobile === '01712345678')
  ok('alternative mobile + email + logo saved', coAfter.company_mobile_alt === '01812345678' && coAfter.company_email === 'info@avatest.com' && coAfter.company_logo.startsWith('data:image/png'))
  // persistence: values come straight from the settings table (restart-safe)
  const persisted = getDb().prepare("SELECT value FROM settings WHERE key = 'company_name'").get() as any
  ok('company profile persisted in database', persisted?.value === 'AVA Test Cable Network')
  // re-save with same values = UPDATE (upsert, no duplicate rows)
  await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: 'AVA Test Cable Network 2', company_mobile: '01712345678' })
  const rows = getDb().prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'company_name'").get() as any
  ok('upsert creates no duplicate company records', rows.c === 1)
  const coAfter2 = await H['settings:companyProfile']({ sender: { id: 4 } } as any)
  ok('company profile updated (UPDATE path)', coAfter2.company_name === 'AVA Test Cable Network 2')
  // validation
  let emptyNameErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: '   ' }) } catch (e: any) { emptyNameErr = String(e) }
  ok('empty company name rejected', emptyNameErr.includes('REQUIRED:company_name'))
  let badEmailErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: 'X', company_email: 'not-an-email' }) } catch (e: any) { badEmailErr = String(e) }
  ok('invalid email rejected', badEmailErr.includes('INVALID_EMAIL'))
  let badMobileErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: 'X', company_mobile: '12345' }) } catch (e: any) { badMobileErr = String(e) }
  ok('invalid mobile rejected', badMobileErr.includes('INVALID_MOBILE'))
  let badLogoErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 4 } } as any, { company_name: 'X', company_logo: 'http://evil/x.png' }) } catch (e: any) { badLogoErr = String(e) }
  ok('non-data-url logo rejected', badLogoErr.includes('INVALID_LOGO'))
  // Collector/Manager without company_profile permission cannot save
  let colCoErr = ''
  try { await H['settings:companyProfileUpdate']({ sender: { id: 5 } } as any, { company_name: 'Hacked' }) } catch (e: any) { colCoErr = String(e) }
  ok('collector cannot edit company profile', colCoErr.includes('PERMISSION_DENIED:company_profile'))
  // company-only setMany now works for the company_profile holder (was the bug)
  await H['settings:setMany']({ sender: { id: 4 } } as any, { company_mobile: '01712345678', company_email: 'info@avatest.com' })
  ok('company-only setMany works for Administrator', true)
  let mixedErr = ''
  try { await H['settings:setMany']({ sender: { id: 4 } } as any, { company_mobile: '01712345678', late_fee: '99' }) } catch (e: any) { mixedErr = String(e) }
  ok('mixed/system keys still denied for Administrator', mixedErr.includes('PERMISSION_DENIED:settings'))
  // SUPER_ADMIN still saves everything incl. system settings
  await H['settings:setMany'](fakeEvent, { company_name: 'AVA Test Cable Network', late_fee: '10' })
  ok('SUPER_ADMIN saves company + system settings', getSetting('late_fee') === '10')
  // FIX: users holding the 'settings' MODULE key are full settings managers —
  // grant it to admin3 (sender 4) per-user and system settings must save
  let grantErr = ''
  try { await H['permissions:set'](fakeEvent, admin3Id, [{ key: 'settings' }]) } catch (e: any) { grantErr = String(e) }
  ok('settings grant accepted', grantErr === '', grantErr)
  const admin3Session = (await H['auth:check']({ sender: { id: 4 } } as any))?.user?.permissions || []
  ok('admin3 live session carries settings grant', admin3Session.includes('settings'), admin3Session)
  let sysSaveErr = ''
  try { await H['settings:setMany']({ sender: { id: 4 } } as any, { late_fee: '15', session_timeout: '240' }) } catch (e: any) { sysSaveErr = String(e) }
  ok('settings module key holder saves system settings', sysSaveErr === '' && getSetting('late_fee') === '15' && getSetting('session_timeout') === '240', sysSaveErr)
  let sysSetErr = ''
  try { await H['settings:set']({ sender: { id: 4 } } as any, 'permission_mode', 'open') } catch (e: any) { sysSetErr = String(e) }
  ok('settings key holder can save single system keys too', sysSetErr === '', sysSetErr)
  // print data: billing invoice + customer bill carry the saved company info
  const inv = await H['billing:invoice']({ sender: { id: 1 } } as any, b1.id)
  ok('invoice print data carries saved company name/mobile', inv.company.name === 'AVA Test Cable Network' && inv.company.mobile === '01712345678')
  ok('invoice print data carries email/alt mobile/logo', inv.company.email === 'info@avatest.com' && inv.company.mobile_alt === '01812345678' && !!inv.company.logo)
  const billData = await H['reports:customerBill']({ sender: { id: 1 } } as any, c1, month)
  ok('billing report (office/customer copy) carries company info', billData.company.name === 'AVA Test Cable Network' && billData.company.mobile === '01712345678')

  section('area-wise customer serial import')
  // serials are NOT globally unique — (area_id, serial) is the dedupe key;
  // the global ID stays the auto-generated AVA-XXXXX code
  const impSerial = await H['customers:import'](fakeEvent, [
    { name: 'AreaA S1', mobile: '01611100001', serial: 1, areaName: 'Mirpur' },
    { name: 'AreaA S2', mobile: '01611100002', serial: 2, areaName: 'Mirpur' },
    { name: 'AreaB S1', mobile: '01611100011', serial: 1, areaName: 'Uttara' },  // same serial 1, different area → OK
    { name: 'AreaB S2', mobile: '01611100012', serial: 25, areaName: 'Uttara' }, // serial range differs per area
    { name: 'AreaA DupS1', mobile: '01611100021', serial: 1, areaName: 'Mirpur' } // duplicate serial in SAME area
  ] as any)
  ok('same serial in different areas imports successfully', impSerial.imported === 4 && impSerial.duplicates === 1, impSerial)
  ok('duplicate serial in same area reported with warning', (impSerial.errors as string[]).some((x) => x.includes('duplicate serial 1 in Mirpur')), impSerial.errors)
  const serialRows = (await H['customers:list'](fakeEvent, { search: '016111000' })).rows as any[]
  const areaAS1 = serialRows.find((r) => r.name === 'AreaA S1')
  const areaBS1 = serialRows.find((r) => r.name === 'AreaB S1')
  ok('serials stored + area assignment preserved', areaAS1?.customer_serial === 1 && areaAS1?._area === 'Mirpur' && areaBS1?.customer_serial === 1 && areaBS1?._area === 'Uttara', serialRows.map((r) => [r.name, r._area, r.customer_serial]))
  ok('global customer IDs remain unique codes', new Set(serialRows.map((r) => r.code)).size === serialRows.length)
  // re-import the same serials → all duplicates (area+serial matches DB)
  const impSerial2 = await H['customers:import'](fakeEvent, [
    { name: 'AreaA S1 again', mobile: '01611100099', serial: 1, areaName: 'Mirpur' }
  ] as any)
  ok('re-import of same area+serial skipped as duplicate', impSerial2.imported === 0 && impSerial2.duplicates === 1, impSerial2)
  // serial search: finds serial in every area
  const serialSearch = (await H['customers:list'](fakeEvent, { search: '25' })).rows as any[]
  ok('search finds area-wise serial', serialSearch.some((r) => r.name === 'AreaB S2'), serialSearch.map((r) => r.name))
  // unknown area name in file → invalid with clear message
  const impBadArea = await H['customers:import'](fakeEvent, [
    { name: 'Bad Area', mobile: '01611100055', serial: 7, areaName: 'No Such Area' }
  ] as any)
  ok('unknown area in Excel reported', impBadArea.invalid === 1 && (impBadArea.errors as string[]).some((x) => x.includes('area not found')), impBadArea)
  // create/update with serial via the customer form path
  const serialCustomerId = await H['customers:create'](fakeEvent, { name: 'Form Serial', mobile: '01611100066', area_id: areaId, customer_serial: 15 })
  const serialGet = (await H['customers:get'](fakeEvent, serialCustomerId)).customer
  ok('customer form saves area-wise serial', serialGet.customer_serial === 15 && serialGet._area === 'Mirpur')
  await H['customers:update'](fakeEvent, serialCustomerId, { customer_serial: 16 })
  ok('customer serial editable', ((await H['customers:get'](fakeEvent, serialCustomerId)).customer).customer_serial === 16)

  // ==== migration v17: company_profile auto-restored on the Administrator role ====
  section('migration v17 - company_profile re-grant')
  const { MIGRATIONS } = require('../src/main/db/migrations')
  const adminRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'Administrator')
  // simulate an accidental Security → Roles edit that dropped company_profile
  await H['roles:save'](fakeEvent, { id: adminRole.id, name: 'Administrator', permissions: ['dashboard', 'customers'] })
  const beforeFix = (await H['roles:list'](fakeEvent)).find((r: any) => r.id === adminRole.id)
  ok('role edit dropped company_profile (pre-condition)', !String(beforeFix.permissions).includes('company_profile'), beforeFix.permissions)
  db.exec(MIGRATIONS[MIGRATIONS.length - 1]) // last entry = migration v17
  const afterFix = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.id === adminRole.id) as any).permissions)
  ok('migration v17 restored company_profile', afterFix.includes('company_profile') && afterFix.includes('dashboard'), afterFix)
  // idempotent: running it again must not duplicate the entry
  db.exec(MIGRATIONS[MIGRATIONS.length - 1]) // idempotency: same entry again
  const afterFix2 = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.id === adminRole.id) as any).permissions)
  ok('migration v17 is idempotent (no duplicates)', afterFix2.filter((k: string) => k === 'company_profile').length === 1, afterFix2)

  console.log(`\n=========================\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1) })

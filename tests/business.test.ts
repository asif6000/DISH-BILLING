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
import { registerAccountsIpc } from '../src/main/ipc/accounts'
import { registerImpersonationIpc } from '../src/main/ipc/impersonation'
import { registerSmsIpc } from '../src/main/ipc/sms'

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
  // each test run starts with no account workspaces (per-user data isolation)
  fs.rmSync(path.join(userData, 'workspaces'), { recursive: true, force: true })
  const db = initDb(path.join(userData, 'ava-cable.db'))

  registerAuthIpc(); registerGenericIpc(); registerCustomerIpc()
  registerBillingIpc(); registerPaymentIpc(); registerSettingsIpc()
  registerBackupIpc(); registerInventoryIpc(); registerMiscIpc()
  registerDashboardIpc(); registerReportIpc()
  registerAccountsIpc(); registerImpersonationIpc(); registerSmsIpc()
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
  await H['customers:setCollector'](fakeEvent, [c1], collectorId)
  const assignmentCounts = await H['customers:assignmentCounts'](fakeEvent)
  ok('administrator assigns customer explicitly to collector', (assignmentCounts as any[]).find((r) => r.id === collectorId)?.assigned === 1)

  section('previous due bill (opening balance)')
  await H['customers:update'](fakeEvent, c1, { previous_due_bill: 1250 })
  const cPrev = await H['customers:get'](fakeEvent, c1)
  ok('previous due bill saved as amount', Number(cPrev.customer.previous_due_bill) === 1250, cPrev.customer.previous_due_bill)
  const prevDueList = await H['customers:list'](fakeEvent, { previousDueOnly: true, all: true })
  ok('previous due filter returns the customer', (prevDueList.rows as any[]).some((r) => r.id === c1), prevDueList.total)
  const statsPrev = await H['dashboard:stats'](fakeEvent, new Date().toISOString().slice(0, 7))
  ok('dashboard previous due KPI sums opening dues', Number(statsPrev.previousDueBill) === 1250, statsPrev.previousDueBill)
  await H['customers:update'](fakeEvent, c1, { previous_due_bill: 0 })
  ok('previous due bill can be cleared', Number((await H['customers:get'](fakeEvent, c1)).customer.previous_due_bill) === 0)

  section('disconnected customer filter')
  const cDisc = await H['customers:create'](fakeEvent, { name: 'Disconnected Filter', mobile: '01399990001', area_id: areaId })
  await H['customers:setStatus'](fakeEvent, cDisc, 'inactive')
  const discInactive = await H['customers:list'](fakeEvent, { status: 'disconnected', all: true })
  ok('disconnected filter includes inactive customers', (discInactive.rows as any[]).some((r) => r.id === cDisc), discInactive.total)
  await H['customers:setStatus'](fakeEvent, cDisc, 'disconnected')
  const discReal = await H['customers:list'](fakeEvent, { status: 'disconnected', all: true })
  ok('disconnected filter includes disconnected customers', (discReal.rows as any[]).some((r) => r.id === cDisc), discReal.total)
  await H['customers:delete'](fakeEvent, cDisc)

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
  ok('P&L does not double-count customer payments as other income', Number(pl.otherIncome) === 0, pl.otherIncome)

  section('resellers')
  const resId = await H['db:create'](fakeEvent, 'resellers', { name: 'Local Agent', mobile: '01611111111', commission_rate: 10, status: 'active' })
  await H['resellers:txn'](fakeEvent, { reseller_id: resId, type: 'recharge', amount: 1000 })
  const res2 = await H['db:get'](fakeEvent, 'resellers', resId)
  ok('wallet recharge 1000', Number(res2.wallet_balance) === 1000)

  section('dashboard & reports')
  const stats = await H['dashboard:stats'](fakeEvent, month)
  ok('dashboard counts', stats.totalCustomers === 3 && stats.activeCustomers === 3, stats)
  ok('dashboard other income excludes collection cashbook rows', Number(stats.otherIncome) === 1000, stats.otherIncome)
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
  // Administrator holds every permission key (migration v26), so it may grant
  // whatever it holds — but the reserved 'all' key can never be delegated.
  await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [{ key: 'reports.view' }, { key: 'all' } as any])
  const mgrPermsAll = await H['permissions:get'](fakeEvent, mgrUserId)
  ok("admin cannot delegate the reserved 'all' permission", !(mgrPermsAll.grants as any[]).some((g: any) => g.permission_key === 'all'))
  await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [{ key: 'reports.view' }, { key: 'security.manage' }])
  const mgrPermsSec = await H['permissions:get'](fakeEvent, mgrUserId)
  ok('admin can grant a permission it holds (security.manage)', (mgrPermsSec.grants as any[]).some((g: any) => g.permission_key === 'security.manage'))
  await H['permissions:set']({ sender: { id: 3 } } as any, mgrUserId, [{ key: 'reports.view' }])
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
  ok("admin cannot grant the reserved 'all' to a role", roleEditErr.includes('ALL_PERMISSION_RESERVED'), roleEditErr)
  let roleSaveErr = ''
  let tmpRoleId = 0
  try { tmpRoleId = await H['roles:save']({ sender: { id: 3 } } as any, { name: 'Temp Role', permissions: ['customers.view'] }) as number } catch (e: any) { roleSaveErr = String(e) }
  ok('admin can manage roles (has security permission)', !roleSaveErr && tmpRoleId > 0, roleSaveErr || tmpRoleId)
  if (tmpRoleId) await H['roles:delete']({ sender: { id: 3 } } as any, tmpRoleId)

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

  section('Administrator = full permissions (migration v26)')
  const adminRoleFull = (await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'Administrator')
  const adminPerms: string[] = JSON.parse(adminRoleFull.permissions)
  const { PERMISSION_CATALOG, LEGACY_MODULES } = require('../src/shared/permissions')
  const { GENERIC_ENTITY_KEYS } = require('../src/shared/entities')
  const expectedKeys: string[] = [...PERMISSION_CATALOG.map((m: any) => m.module), ...LEGACY_MODULES, ...GENERIC_ENTITY_KEYS]
  const missingKeys = expectedKeys.filter((k: string) => !adminPerms.includes(k))
  ok('Administrator holds every module/entity permission', missingKeys.length === 0, missingKeys)
  ok("Administrator still never holds the reserved 'all'", !adminPerms.includes('all'))
  ok('Administrator has security + settings + automation + users', ['security', 'settings', 'automation', 'users'].every((k) => adminPerms.includes(k)), adminPerms)

  section('Administrator can manage every account except SUPER_ADMIN')
  // create another Administrator (previously FORBIDDEN_ROLE)
  const adminPeerId = await H['users:create']({ sender: { id: 3 } } as any, { username: 'adminpeer', password: 'secret1', full_name: 'Admin Peer', role_id: adminRoleFull.id }) as number
  ok('admin can create another Administrator account', adminPeerId > 0, adminPeerId)
  // ... and assign a different role to that account
  await H['users:update']({ sender: { id: 3 } } as any, adminPeerId, { full_name: 'Admin Peer', status: 'active', role_id: managerRoleId })
  const peerAfter = (await H['users:list'](fakeEvent)).find((u: any) => u.id === adminPeerId)
  ok('admin can change another account role', peerAfter?.role_name === 'Manager', peerAfter?.role_name)
  let selfRoleErr = ''
  try { await H['users:update']({ sender: { id: 3 } } as any, admin2Id, { full_name: 'Admin Two', status: 'active', role_id: managerRoleId }) } catch (e: any) { selfRoleErr = String(e) }
  ok('admin cannot change their own role (no self-lockout)', selfRoleErr.includes('CANNOT_CHANGE_OWN_ROLE'), selfRoleErr)
  const superRoleId = (db.prepare("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'").get() as any).id
  let superCreateErr = ''
  try { await H['users:create']({ sender: { id: 3 } } as any, { username: 'hacksuper', password: 'secret1', full_name: 'Hack', role_id: superRoleId }) } catch (e: any) { superCreateErr = String(e) }
  ok('admin cannot create a SUPER_ADMIN account', superCreateErr.includes('FORBIDDEN_ROLE'), superCreateErr)
  let superPromoteErr = ''
  try { await H['users:update']({ sender: { id: 3 } } as any, adminPeerId, { full_name: 'Admin Peer', status: 'active', role_id: superRoleId }) } catch (e: any) { superPromoteErr = String(e) }
  ok('admin cannot promote anyone to SUPER_ADMIN', superPromoteErr.includes('FORBIDDEN_ROLE'), superPromoteErr)
  // delete another Administrator (previously PERMISSION_DENIED)
  const delPeer = await H['users:delete']({ sender: { id: 3 } } as any, adminPeerId)
  ok('admin can delete another Administrator account', delPeer === true, delPeer)
  // Administrator holds the 'settings' module (migration v26) -> system settings save works
  const lateFeeBefore = getSetting('late_fee', '0')
  let sysErr2 = ''
  try { await H['settings:set']({ sender: { id: 3 } } as any, 'late_fee', lateFeeBefore) } catch (e: any) { sysErr2 = String(e) }
  ok('admin can change system settings (full permissions)', sysErr2 === '', sysErr2)

  section('Super Admin — user management + secure Login As User (impersonation)')
  const umSuper = await H['impersonation:users'](fakeEvent, { page: 1, pageSize: 50 })
  ok('super sees the merged user directory (local accounts always included)', (umSuper.rows as any[]).length >= 3 && (umSuper.rows as any[]).some((r) => r.source === 'local'), { rows: (umSuper.rows as any[]).length })
  const mgrRow = (umSuper.rows as any[]).find((r) => r.username === 'mgr1')
  ok('directory row has username/role/status/created date', !!mgrRow && mgrRow.role_name === 'Manager' && !!mgrRow.status && !!mgrRow.created_at, mgrRow)
  ok('active Manager can be impersonated', !!mgrRow && mgrRow.can_login_as === true, mgrRow?.block_reason)
  ok('filter counters returned with the directory', umSuper.statusCounts?.all === umSuper.total, { counts: umSuper.statusCounts, total: umSuper.total })
  const superRow = (umSuper.rows as any[]).find((r) => r.role_name === 'SUPER_ADMIN')
  ok('SUPER_ADMIN row is never impersonable', !!superRow && superRow.can_login_as === false && superRow.block_reason === 'SUPER_ADMIN', superRow)
  const umSearch = await H['impersonation:users'](fakeEvent, { search: 'mgr1', page: 1, pageSize: 20 })
  ok('directory search works', (umSearch.rows as any[]).length === 1 && (umSearch.rows as any[])[0].username === 'mgr1', umSearch.total)
  const umPage = await H['impersonation:users'](fakeEvent, { page: 2, pageSize: 5 })
  ok('directory pagination works', umPage.page === 2 && umPage.pageSize === 5 && (umPage.rows as any[]).length <= 5, { page: umPage.page, rows: (umPage.rows as any[]).length })
  let umAdminErr = ''
  try { await H['impersonation:users']({ sender: { id: 3 } } as any, {}) } catch (e: any) { umAdminErr = String(e) }
  ok('Administrator cannot use super-admin user management', umAdminErr.includes('PERMISSION_DENIED:impersonation'), umAdminErr)

  const mgrHashBefore = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get(mgrUserId) as any).password_hash
  await H['impersonation:start'](fakeEvent, mgrUserId)
  const impCheck = await H['auth:check'](fakeEvent)
  ok('impersonated session acts as the target user', impCheck.user?.username === 'mgr1' && impCheck.user?.roleName === 'Manager', impCheck.user?.username)
  ok('session remembers the originating super admin', impCheck.user?.impersonatedBy === 1 && impCheck.user?.impersonatedByName === 'admin', impCheck.user?.impersonatedByName)
  const impStatus = await H['impersonation:status'](fakeEvent)
  ok('impersonation status reports the active target', impStatus.active === true && impStatus.target?.username === 'mgr1', impStatus)
  let impPwErr = ''
  try { await H['auth:changePassword'](fakeEvent, 'x', 'newpass123') } catch (e: any) { impPwErr = String(e) }
  ok('password change blocked while impersonating', impPwErr.includes('IMPERSONATION_BLOCKED'), impPwErr)
  let impNestErr = ''
  try { await H['impersonation:start'](fakeEvent, admin2Id) } catch (e: any) { impNestErr = String(e) }
  ok('nested impersonation blocked', impNestErr.includes('IMPERSONATION_ALREADY_ACTIVE'), impNestErr)
  const mgrHashDuring = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get(mgrUserId) as any).password_hash
  ok('target credentials never touched', mgrHashDuring === mgrHashBefore)
  const auditDuring = db.prepare('SELECT * FROM impersonation_logs ORDER BY id DESC LIMIT 1').get() as any
  ok('audit row recorded on start', auditDuring?.super_admin_username === 'admin' && auditDuring?.target_username === 'mgr1' && !auditDuring?.ended_at, auditDuring)
  const back = await H['impersonation:stop'](fakeEvent)
  ok('Return to Super Admin restores the real session', back.user?.username === 'admin' && back.user?.permissions?.includes('all') && !back.user?.impersonatedBy, back.user?.username)
  const auditClosed = db.prepare('SELECT * FROM impersonation_logs ORDER BY id DESC LIMIT 1').get() as any
  ok('audit row closed with duration on return', !!auditClosed?.ended_at && auditClosed.end_reason === 'returned' && auditClosed.duration_seconds !== null, auditClosed)
  const mgrRelogin = await H['auth:login']({ sender: { id: 6 } } as any, 'mgr1', 'secret1')
  ok('target can still log in with the original password', mgrRelogin.user?.username === 'mgr1', mgrRelogin.user?.username)
  let selfImpErr = ''
  try { await H['impersonation:start'](fakeEvent, 1) } catch (e: any) { selfImpErr = String(e) }
  ok('super admin cannot impersonate itself', selfImpErr.includes('CANNOT_IMPERSONATE_SELF'), selfImpErr)
  const superIdForImp = (db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as any).id
  let superImpErr = ''
  try { await H['impersonation:start'](fakeEvent, superIdForImp) } catch (e: any) { superImpErr = String(e) }
  ok('no SUPER_ADMIN account can be impersonated', superImpErr.includes('CANNOT_IMPERSONATE_SELF') || superImpErr.includes('CANNOT_IMPERSONATE_SUPER_ADMIN'), superImpErr)
  let adminImpErr = ''
  try { await H['impersonation:start']({ sender: { id: 3 } } as any, mgrUserId) } catch (e: any) { adminImpErr = String(e) }
  ok('Administrator cannot impersonate anyone', adminImpErr.includes('PERMISSION_DENIED:impersonation'), adminImpErr)

  // an impersonated ADMINISTRATOR (the strongest non-super role) must still be
  // refused credential/account/role/backup writes — the explicit guard fires
  await H['impersonation:start'](fakeEvent, admin2Id)
  let impAdminUserErr = ''
  try { await H['users:update'](fakeEvent, mgrUserId, { full_name: 'Hacked', status: 'active' }) } catch (e: any) { impAdminUserErr = String(e) }
  ok('admin-level impersonation: user edits still blocked', impAdminUserErr.includes('IMPERSONATION_BLOCKED'), impAdminUserErr)
  let impAdminRoleErr = ''
  try { await H['roles:save'](fakeEvent, { name: 'X1', permissions: ['dashboard'] }) } catch (e: any) { impAdminRoleErr = String(e) }
  ok('admin-level impersonation: role edits still blocked', impAdminRoleErr.includes('IMPERSONATION_BLOCKED'), impAdminRoleErr)
  let impAdminPermErr = ''
  try { await H['permissions:set'](fakeEvent, mgrUserId, [{ key: 'all' }]) } catch (e: any) { impAdminPermErr = String(e) }
  ok('admin-level impersonation: permission writes still blocked', impAdminPermErr.includes('IMPERSONATION_BLOCKED'), impAdminPermErr)
  let impAdminBackupErr = ''
  try { await H['backup:restore'](fakeEvent) } catch (e: any) { impAdminBackupErr = String(e) }
  ok('admin-level impersonation: backup restore blocked', impAdminBackupErr.includes('IMPERSONATION_BLOCKED'), impAdminBackupErr)
  const backAdmin = await H['impersonation:stop'](fakeEvent)
  ok('second return to super admin works', backAdmin.user?.username === 'admin' && backAdmin.user?.permissions?.includes('all'), backAdmin.user?.username)
  const mgrUnchanged = (db.prepare('SELECT full_name FROM users WHERE id = ?').get(mgrUserId) as any).full_name
  ok('blocked edits changed nothing', mgrUnchanged === 'Manager One', mgrUnchanged)

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

  section('collector identity — auto selection + server-side ownership')
  const colC = await H['collectors:quickAdd']({ sender: { id: 3 } } as any, 'Jasim', '01933333333')
  // Collector account whose full name matches collector A's Staff name (legacy fallback)
  const rahimUserId = await H['users:create']({ sender: { id: 3 } } as any, { username: 'rahimcol', password: 'secret1', full_name: 'Rahim', role_id: staffRoleId }) as number
  await H['customers:setCollector'](fakeEvent, [c1], colA.id)
  await H['auth:login']({ sender: { id: 20 } } as any, 'rahimcol', 'secret1')
  const myA = await H['payments:myCollector']({ sender: { id: 20 } } as any)
  ok('collector auto-selects own collector profile', myA.locked === true && myA.collector?.id === colA.id && myA.collector?.label === 'Rahim', myA)
  const rahimCustomers = await H['customers:list']({ sender: { id: 20 } } as any, { all: true })
  ok('collector sees only explicitly assigned or area-assigned customers',
    (rahimCustomers.rows as any[]).some((r) => r.id === c1) && !(rahimCustomers.rows as any[]).some((r) => r.id === c2), rahimCustomers.rows.map((r: any) => r.id))
  // spoofed collector id in the request is ignored server-side
  const paySpoof = await H['payments:collect']({ sender: { id: 20 } } as any, { customerId: c1, amount: 77, method: 'cash', type: 'bill', collectorId: colC.id })
  const spoofRow = (await H['payments:list']({ sender: { id: 20 } } as any, { search: paySpoof.receiptNo })).rows[0]
  ok('collector cannot submit under another collector (server overrides id)', spoofRow?.collector_id === colA.id && spoofRow?._collector === 'Rahim', spoofRow)
  let unassignedErr = ''
  try { await H['payments:collect']({ sender: { id: 20 } } as any, { customerId: c2, amount: 5, method: 'cash', type: 'bill' }) } catch (e: any) { unassignedErr = String(e) }
  ok('collector cannot collect from an unassigned customer', unassignedErr.includes('CUSTOMER_NOT_ASSIGNED_TO_COLLECTOR'), unassignedErr)
  // Admin with the same name must NOT be locked (regression: name match used to lock admins)
  const adminRahimId = await H['users:create'](fakeEvent, { username: 'adminrahim', password: 'secret1', full_name: 'Rahim', role_id: adminRoleId }) as number
  await H['auth:login']({ sender: { id: 21 } } as any, 'adminrahim', 'secret1')
  const myAdmin = await H['payments:myCollector']({ sender: { id: 21 } } as any)
  ok('admin keeps manual collector selection (not locked)', myAdmin.locked === false, myAdmin)
  const payAdmin = await H['payments:collect']({ sender: { id: 21 } } as any, { customerId: c1, amount: 11, method: 'cash', type: 'bill', collectorId: colC.id })
  const adminRow = (await H['payments:list']({ sender: { id: 21 } } as any, { search: payAdmin.receiptNo })).rows[0]
  ok('admin can assign payment to any active collector', adminRow?.collector_id === colC.id && adminRow?._collector === 'Jasim', adminRow)
  // inactive linked profile blocks collection entirely
  const inactiveUserId = await H['users:create']({ sender: { id: 3 } } as any, { username: 'colinactive', password: 'secret1', full_name: 'Inactive Person', role_id: staffRoleId }) as number
  await H['users:linkCollector'](fakeEvent, inactiveUserId, colB.id)
  await H['auth:login']({ sender: { id: 22 } } as any, 'colinactive', 'secret1')
  const myInactive = await H['payments:myCollector']({ sender: { id: 22 } } as any)
  ok('inactive linked collector is locked + flagged', myInactive.locked === true && myInactive.error === 'COLLECTOR_INACTIVE', myInactive)
  let inactiveErr = ''
  try { await H['payments:collect']({ sender: { id: 22 } } as any, { customerId: c1, amount: 5, method: 'cash', type: 'bill' }) } catch (e: any) { inactiveErr = String(e) }
  ok('inactive collector cannot collect', inactiveErr.includes('COLLECTOR_INACTIVE'), inactiveErr)
  // Collector role without any profile: locked, never falls back to the manual list
  await H['users:create']({ sender: { id: 3 } } as any, { username: 'colnoprofile', password: 'secret1', full_name: 'No Profile', role_id: staffRoleId })
  await H['auth:login']({ sender: { id: 23 } } as any, 'colnoprofile', 'secret1')
  const myNone = await H['payments:myCollector']({ sender: { id: 23 } } as any)
  ok('collector without profile is locked (no manual fallback)', myNone.locked === true && myNone.error === 'NO_COLLECTOR_PROFILE', myNone)
  // explicit link (Security → Users) wins even when the names differ
  const linkedUserId = await H['users:create']({ sender: { id: 3 } } as any, { username: 'collinked', password: 'secret1', full_name: 'Different Name', role_id: staffRoleId }) as number
  await H['users:linkCollector'](fakeEvent, linkedUserId, colC.id)
  await H['auth:login']({ sender: { id: 24 } } as any, 'collinked', 'secret1')
  const myLinked = await H['payments:myCollector']({ sender: { id: 24 } } as any)
  ok('explicit user↔collector link wins over name matching', myLinked.locked === true && myLinked.collector?.id === colC.id, myLinked)
  // payment-scoped dropdown lists every active collector (admin), never inactive ones
  const payCols = await H['payments:collectors']({ sender: { id: 3 } } as any)
  ok('payment dropdown lists all active collectors only', payCols.some((c: any) => c.id === colA.id) && payCols.some((c: any) => c.id === colC.id) && !payCols.some((c: any) => c.id === colB.id), payCols)
  // collector-wise report totals match the saved payments
  const rahimPays = await H['payments:list']({ sender: { id: 3 } } as any, { all: true, collectorId: colA.id })
  const rahimSum = (rahimPays.rows as any[]).filter((p) => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0)
  const collectorReport = await H['reports:collector']({ sender: { id: 3 } } as any, '2000-01-01', '2099-12-31')
  const rahimReport = (collectorReport as any[]).find((r) => r.collector === 'Rahim')
  ok('collector-wise report totals match payment history', !!rahimReport && Math.abs(Number(rahimReport.collected) - rahimSum) < 0.01, { report: rahimReport?.collected, history: rahimSum })

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
  // legacy settings:set — Administrator now holds the 'settings' module (migration
  // v26), so system settings save works for it (manager/collector stay denied).
  const lateFeeBefore2 = getSetting('late_fee', '0')
  let sysErr = ''
  try { await H['settings:set']({ sender: { id: 3 } } as any, 'late_fee', lateFeeBefore2) } catch (e: any) { sysErr = String(e) }
  ok('admin can change system settings (settings module granted)', sysErr === '', sysErr)
  let mgrSysErr = ''
  try { await H['settings:set']({ sender: { id: 2 } } as any, 'late_fee', '99') } catch (e: any) { mgrSysErr = String(e) }
  ok('manager cannot change system settings', mgrSysErr.includes('PERMISSION_DENIED'), mgrSysErr)

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
  // role identity itself (not just permissions) must refresh live — otherwise a
  // promoted account keeps rendering the Collector dashboard after role change
  const collectorRoleForRefresh = (await H['roles:list'](fakeEvent) as any[]).find((r) => r.name === 'Collector')!
  await H['users:update'](fakeEvent, admin3Id, { full_name: 'Admin Three', status: 'active', role_id: collectorRoleForRefresh.id })
  const demotedCheck = await H['auth:check']({ sender: { id: 4 } } as any)
  ok('live session roleName follows role change (Collector)', demotedCheck.user.roleName === 'Collector', demotedCheck.user.roleName)
  await H['users:update'](fakeEvent, admin3Id, { full_name: 'Admin Three', status: 'active', role_id: adminRole2.id })
  const promotedCheck = await H['auth:check']({ sender: { id: 4 } } as any)
  ok('promoted account immediately reports Administrator role', promotedCheck.user.roleName === 'Administrator', promotedCheck.user.roleName)
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

  // ==== role management: add/edit/delete with description + safe reassignment ====
  section('role management — custom roles')
  const newRoleId = await H['roles:save'](fakeEvent, { name: 'Front Desk', description: 'Front desk operator', permissions: ['customers', 'payments.view', 'payments.collect'] })
  ok('custom role created with description + id returned', newRoleId > 0, newRoleId)
  const newRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.id === newRoleId)
  ok('custom role persists name/description/permissions', newRole?.description === 'Front desk operator' && JSON.parse(newRole.permissions).includes('payments.collect'), newRole)
  // edit: update description + permissions, count changes
  await H['roles:save'](fakeEvent, { id: newRoleId, name: 'Front Desk', description: 'Front desk (edited)', permissions: ['customers'] })
  const editedRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.id === newRoleId)
  ok('custom role edit works + count updates', editedRole?.description === 'Front desk (edited)' && JSON.parse(editedRole.permissions).length === 1, editedRole)
  // system roles protected: delete blocked, SUPER_ADMIN read-only
  const adminSys = (await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'Administrator')
  let sysDelErr = ''
  try { await H['roles:delete'](fakeEvent, adminSys.id) } catch (e: any) { sysDelErr = String(e) }
  ok('system role delete blocked', sysDelErr.includes('SYSTEM_ROLE_READONLY'), sysDelErr)
  // delete custom role with users → safe reassignment required
  const rUser = await H['users:create'](fakeEvent, { username: 'frontdesk1', password: 'secret1', full_name: 'FD One', role_id: newRoleId }) as number
  let inUseErr = ''
  try { await H['roles:delete'](fakeEvent, newRoleId) } catch (e: any) { inUseErr = String(e) }
  ok('deleting an in-use custom role blocked (ROLE_IN_USE)', inUseErr.includes('ROLE_IN_USE'), inUseErr)
  const collectorRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'Collector')
  const delRes = await H['roles:delete'](fakeEvent, newRoleId, collectorRole.id)
  ok('safe reassignment + delete works', delRes.reassigned === 1, delRes)
  const movedUser = (await H['users:list'](fakeEvent)).find((u: any) => u.id === rUser)
  ok('user moved to the reassignment target role', movedUser?.role_name === 'Collector', movedUser)
  // after deletion the role is gone
  const goneRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.id === newRoleId)
  ok('deleted custom role removed from list', !goneRole, goneRole)
  // empty name rejected on create
  let noNameErr = ''
  try { await H['roles:save'](fakeEvent, { name: '', permissions: [] }) } catch (e: any) { noNameErr = String(e) }
  ok('role name required', noNameErr.includes('REQUIRED:name'), noNameErr)
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
  const v17Idx = MIGRATIONS.findIndex((m: string) => m.includes('Version 17: re-grant company_profile'))
  db.exec(MIGRATIONS[v17Idx])
  const afterFix = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.id === adminRole.id) as any).permissions)
  ok('migration v17 restored company_profile', afterFix.includes('company_profile') && afterFix.includes('dashboard'), afterFix)
  // idempotent: running it again must not duplicate the entry
  db.exec(MIGRATIONS[v17Idx]) // idempotency: same entry again
  const afterFix2 = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.id === adminRole.id) as any).permissions)
  ok('migration v17 is idempotent (no duplicates)', afterFix2.filter((k: string) => k === 'company_profile').length === 1, afterFix2)

  // ==== migration v25: the reserved 'all' permission is SUPER_ADMIN-only ====
  section("migration v25 - reserved 'all' permission cleanup")
  const mgrRole = (await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'Manager')
  const mgrUser = (await H['users:list'](fakeEvent)).find((u: any) => u.username === 'mgr1')
  // simulate legacy/corrupted data: a non-super role holding 'all'
  db.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(JSON.stringify(['dashboard', 'all', 'users']), mgrRole.id)
  const v25Idx = MIGRATIONS.findIndex((m: string) => m.includes('Version 25: SECURITY FIX'))
  ok('migration v25 exists', v25Idx >= 0, { count: MIGRATIONS.length })
  db.exec(MIGRATIONS[v25Idx])
  const mgrAfter = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.id === mgrRole.id) as any).permissions)
  ok("manager role keeps real keys but loses 'all'", !mgrAfter.includes('all') && mgrAfter.includes('dashboard') && mgrAfter.includes('users'), mgrAfter)
  const superAfter = JSON.parse(((await H['roles:list'](fakeEvent)).find((r: any) => r.name === 'SUPER_ADMIN') as any).permissions)
  ok("SUPER_ADMIN keeps 'all'", superAfter.includes('all'), superAfter)
  // runtime guard: even bad data written AFTER the migration never grants super powers
  db.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(JSON.stringify(['all']), mgrRole.id)
  const { getEffectivePermissions } = require('../src/main/ipc/auth')
  ok("runtime guard: Manager never inherits 'all'", !getEffectivePermissions(mgrUser.id).includes('all'), getEffectivePermissions(mgrUser.id))
  db.exec(MIGRATIONS[v25Idx]) // idempotency: run again on cleaned/legacy data
  const mgrIdem = JSON.parse((db.prepare('SELECT permissions FROM roles WHERE id = ?').get(mgrRole.id) as any).permissions)
  ok('migration v25 is idempotent', Array.isArray(mgrIdem) && !mgrIdem.includes('all'), mgrIdem)

  // ==== customer ↔ collector assignment (filter bug + inline/create assignment) ====
  section('customers — collector assignment (filter, inline, create form)')
  // area scope: colA covers the Mirpur area → its unassigned customers are in scope
  await H['collector:assignAreas'](fakeEvent, colA.id, [areaId])
  const fArea = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, areaId, collectorId: colA.id })
  ok('collector filter includes area-scoped customers (was showing none)', fArea.total > 0 && (fArea.rows as any[]).every((r) => Number(r.area_id) === Number(areaId)), fArea.total)
  const otherArea = await H['db:create'](fakeEvent, 'areas', { name: 'Bogura', status: 'active' })
  const fOther = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, areaId: otherArea, collectorId: colA.id })
  ok('collector filter respects the area scope', fOther.total === 0, fOther.total)
  // explicit assignment from the New Connection form
  const cAssign = await H['customers:create'](fakeEvent, { name: 'Assign Me', mobile: '01799900011', area_id: areaId, collector_id: colA.id })
  const cAssigned = (await H['customers:get'](fakeEvent, cAssign)).customer
  ok('customer created with a collector is assigned', Number(cAssigned.collector_id) === Number(colA.id), cAssigned.collector_id)
  const fExplicit = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, areaId, collectorId: colA.id })
  ok('explicitly assigned customer appears in the collector filter', (fExplicit.rows as any[]).some((r) => r.id === cAssign))
  // inline change → another ACTIVE collector (colB is deactivated earlier)
  await H['customers:setCollector'](fakeEvent, [cAssign], colC.id)
  ok('inline assignment switches the collector', Number((await H['customers:get'](fakeEvent, cAssign)).customer.collector_id) === Number(colC.id))
  // form update → clear assignment
  await H['customers:update'](fakeEvent, cAssign, { collector_id: null })
  ok('customer form can clear the collector', !(await H['customers:get'](fakeEvent, cAssign)).customer.collector_id)
  let badColErr = ''
  try { await H['customers:create'](fakeEvent, { name: 'Bad Coll', mobile: '01799900012', area_id: areaId, collector_id: 999999 }) } catch (e: any) { badColErr = String(e) }
  ok('unknown collector rejected on create', badColErr.includes('COLLECTOR_NOT_FOUND'), badColErr)
  // a collector account can never assign somebody else through the form
  await H['auth:login']({ sender: { id: 7 } } as any, 'col1', 'secret1')
  const colMade = await H['customers:create']({ sender: { id: 7 } } as any, { name: 'By Collector', mobile: '01799900013', area_id: areaId, collector_id: colA.id })
  ok('collector account cannot assign a collector from the form', !(await H['customers:get'](fakeEvent, colMade)).customer.collector_id)

  // ==== login diagnostics + Supabase directory / local-account provisioning ====
  section('login diagnostics (why a sign-in fails)')
  const pendingUser = await H['users:create'](fakeEvent, { username: 'pend1', password: 'secret1', full_name: 'Pending One', role_id: staffRoleId }) as number
  db.prepare("UPDATE users SET status = 'pending' WHERE id = ?").run(pendingUser)
  let pendingErr = ''
  try { await H['auth:login']({ sender: { id: 8 } } as any, 'pend1', 'secret1') } catch (e: any) { pendingErr = String(e) }
  ok('pending account gets ACCOUNT_PENDING (not a blanket error)', pendingErr.includes('ACCOUNT_PENDING'), pendingErr)
  const helpUnknown = await H['auth:loginHelp'](null as any, 'no-such-user')
  ok('loginHelp reports a missing account', helpUnknown.local === null && helpUnknown.suggestion === null, helpUnknown)
  ok('loginHelp never returns credentials', !('password' in helpUnknown) && !('password_hash' in helpUnknown) && !('reset_hash' in helpUnknown), Object.keys(helpUnknown))
  // typing the full name instead of the username: suggest the real username
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run('বিনোদন কাবল নেটওয়ার্ক', mgrUserId)
  const helpByName = await H['auth:loginHelp'](null as any, 'বিনোদন কাবল নেটওয়ার্ক')
  ok('loginHelp suggests the username when a full name is typed', helpByName.suggestion === 'mgr1', helpByName.suggestion)
  // regression: when the typed text IS the username (and also the full name),
  // no useless "try that" hint — the real reason is the password
  await H['users:create'](fakeEvent, { username: 'nameonly', password: 'secret1', full_name: 'nameonly', role_id: staffRoleId })
  const helpExact = await H['auth:loginHelp'](null as any, 'nameonly')
  ok('no suggestion when the typed text is already the username', helpExact.suggestion === null && helpExact.local?.status === 'active', helpExact)

  section('Supabase directory + create the missing local account')
  // stub only the Supabase anon REST calls (the app calls global fetch in main)
  const realFetch = (global as any).fetch
  const rpcOk = (rows: any[]) => ({ ok: true, status: 200, json: async () => rows })
  ;(global as any).fetch = async (url: any) => {
    const u = String(url)
    if (u.includes('get_app_users_v2')) return rpcOk([
      { username: 'remoteuser', full_name: 'বিনোদন কাবল নেটওয়ার্ক', mobile: '01711112222', email: 'b@example.com', status: 'approved', role_name: 'Administrator', created_at: '2026-01-02T03:04:05Z', approved_at: '2026-01-03T00:00:00Z' },
      { username: 'remotePend', full_name: 'Remote Pending', mobile: '01711113333', email: null, status: 'pending', role_name: null, created_at: '2026-01-04T00:00:00Z', approved_at: null }
    ])
    return rpcOk([])
  }
  const umRemote = await H['impersonation:users'](fakeEvent, { page: 1, pageSize: 50 })
  const remoteRowUm = (umRemote.rows as any[]).find((r) => r.username === 'remoteuser')
  ok('Supabase users appear in the directory with email', !!remoteRowUm && remoteRowUm.email === 'b@example.com' && remoteRowUm.source === 'supabase', remoteRowUm)
  ok('email supported flag set when get_app_users_v2 exists', umRemote.emailSupported === true)
  ok('approved Supabase user without a local account cannot be impersonated yet', remoteRowUm.can_login_as === false && remoteRowUm.block_reason === 'NO_LOCAL_ACCOUNT', remoteRowUm?.block_reason)
  const umRemotePending = await H['impersonation:users'](fakeEvent, { search: 'remotePend', page: 1, pageSize: 20 })
  ok('status filter/search works on remote rows', (umRemotePending.rows as any[]).length === 1 && (umRemotePending.rows as any[])[0].status === 'pending', umRemotePending.total)
  let createLocalAdminErr = ''
  try { await H['accounts:createLocal']({ sender: { id: 3 } } as any, { username: 'remoteuser' }) } catch (e: any) { createLocalAdminErr = String(e) }
  ok('only a SUPER_ADMIN can create the local account', createLocalAdminErr.includes('PERMISSION_DENIED'), createLocalAdminErr)
  let createLocalPendErr = ''
  try { await H['accounts:createLocal'](fakeEvent, { username: 'remotePend' }) } catch (e: any) { createLocalPendErr = String(e) }
  ok('not-approved Supabase user cannot be provisioned', createLocalPendErr.includes('REMOTE_NOT_APPROVED'), createLocalPendErr)
  const made = await H['accounts:createLocal'](fakeEvent, { username: 'remoteuser' })
  ok('local account created from the approved Supabase user', !!made.tempPassword && made.tempPassword.length >= 6, { username: made.username })
  const madeRow = (await H['users:list'](fakeEvent)).find((u: any) => u.username === 'remoteuser')
  ok('provisioned account gets the Supabase role + active status', madeRow?.role_name === 'Administrator' && madeRow?.status === 'active', madeRow)
  const madeLogin = await H['auth:login']({ sender: { id: 9 } } as any, 'remoteuser', made.tempPassword)
  ok('user can sign in with the temporary password', madeLogin.user?.username === 'remoteuser')
  await H['auth:logout']({ sender: { id: 9 } } as any)
  const umAfterProvision = await H['impersonation:users'](fakeEvent, { search: 'remoteuser', page: 1, pageSize: 20 })
  ok('provisioned user becomes impersonable', (umAfterProvision.rows as any[])[0]?.can_login_as === true, (umAfterProvision.rows as any[])[0]?.block_reason)
  ;(global as any).fetch = realFetch

  section('every approved Supabase account can be used on this installation')
  const bcryptLib = require('bcryptjs')
  const resetHash = bcryptLib.hashSync('resetPass1', 10)
  const dirRows = [
    { username: 'provisionme', full_name: 'Provision Me', mobile: '01722223333', email: null, status: 'approved', role_name: 'Manager', created_at: '2026-02-01T00:00:00Z', approved_at: '2026-02-02T00:00:00Z' },
    { username: 'withreset', full_name: 'With Reset', mobile: '01722224444', email: null, status: 'approved', role_name: 'Collector', created_at: '2026-02-03T00:00:00Z', approved_at: '2026-02-04T00:00:00Z' },
    { username: 'notapproved', full_name: 'Not Approved', mobile: '01722225555', email: null, status: 'pending', role_name: null, created_at: '2026-02-05T00:00:00Z', approved_at: null }
  ]
  const statusRows = [
    { username: 'provisionme', status: 'approved', reset_hash: null, role_name: 'Manager' },
    { username: 'withreset', status: 'approved', reset_hash: resetHash, role_name: 'Collector' },
    { username: 'notapproved', status: 'pending', reset_hash: null, role_name: null }
  ]
  const stubSupabase = (dir: any[]) => {
    ;(global as any).fetch = async (url: any) => {
      const u = String(url)
      const ok = (rows: any[]) => ({ ok: true, status: 200, json: async () => rows })
      if (u.includes('get_app_users_v2')) return ok(dir)
      if (u.includes('get_app_user_status')) return ok(statusRows)
      return ok([])
    }
  }
  stubSupabase(dirRows)
  let syncAllAdminErr = ''
  try { await H['accounts:syncAllRemote']({ sender: { id: 3 } } as any) } catch (e: any) { syncAllAdminErr = String(e) }
  ok('only a SUPER_ADMIN can sync every Supabase account', syncAllAdminErr.includes('PERMISSION_DENIED'), syncAllAdminErr)
  const sync1 = await H['accounts:syncAllRemote'](fakeEvent)
  ok('sync provisions approved Supabase users only', (sync1.provisioned as string[]).includes('provisionme') && (sync1.provisioned as string[]).includes('withreset') && !(sync1.provisioned as string[]).includes('notapproved'), sync1)
  const provRow = (await H['users:list'](fakeEvent)).find((u: any) => u.username === 'provisionme')
  ok('provisioned account keeps the Supabase role', provRow?.role_name === 'Manager' && provRow?.status === 'active', provRow)
  const resetLogin = await H['auth:login']({ sender: { id: 10 } } as any, 'withreset', 'resetPass1')
  ok('developer-set reset password can sign in', resetLogin.user?.username === 'withreset')
  await H['auth:logout']({ sender: { id: 10 } } as any)
  let guessErr = ''
  try { await H['auth:login']({ sender: { id: 11 } } as any, 'provisionme', 'secret1') } catch (e: any) { guessErr = String(e) }
  ok('account without a reset password cannot be guessed in', guessErr.includes('INVALID_CREDENTIALS'), guessErr)
  const umProv = await H['impersonation:users'](fakeEvent, { search: 'provisionme', page: 1, pageSize: 20 })
  ok('provisioned account is impersonable (Login As User) without its password', (umProv.rows as any[])[0]?.can_login_as === true, (umProv.rows as any[])[0]?.block_reason)
  // auto-sync mode: a newly approved Supabase user is provisioned by the poll
  await H['settings:set'](fakeEvent, 'supabase_auto_provision', '1')
  stubSupabase([...dirRows, { username: 'autonew', full_name: 'Auto New', mobile: '01722226666', email: null, status: 'approved', role_name: 'Collector', created_at: '2026-02-06T00:00:00Z', approved_at: '2026-02-07T00:00:00Z' }])
  const autoRun = await H['accounts:checkRemote'](fakeEvent)
  ok('auto-sync provisions a newly approved user on the next poll', (autoRun.provisioned as string[]).includes('autonew'), autoRun.provisioned)
  ok('auto-synced account exists and is active', (await H['users:list'](fakeEvent)).some((u: any) => u.username === 'autonew' && u.status === 'active'))
  await H['settings:set'](fakeEvent, 'supabase_auto_provision', '0')
  ;(global as any).fetch = realFetch

  section('account switching — per-account DATA isolation (workspaces)')
  // the super admin's own data lives in the installation database
  const superCustomer = await H['customers:create'](fakeEvent, { name: 'Super Only', mobile: '01755550001', area_id: areaId })
  const mgrBId = await H['users:create'](fakeEvent, { username: 'mgrb', password: 'secret1', full_name: 'Manager B', role_id: managerRoleId }) as number

  // installation-level settings (subscription/security) live in the primary DB
  await H['settings:set'](fakeEvent, 'session_timeout_min', '480')

  // ---- switch into account A (mgr1) ----
  await H['impersonation:start'](fakeEvent, mgrUserId)
  const listA0 = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok('A workspace starts empty — super admin data is not visible', listA0.total === 0, listA0.total)
  const custA = await H['customers:create'](fakeEvent, { name: 'Customer A', mobile: '01755550002' })
  ok('A can create data in its own workspace', custA > 0)
  const listA1 = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok('A sees exactly its own customer', listA1.total === 1 && (listA1.rows as any[])[0].name === 'Customer A', listA1.total)
  const wsSettings = await H['settings:getAll'](fakeEvent)
  ok('installation settings (subscription/security) stay visible inside a workspace', wsSettings.session_timeout_min === '480', wsSettings.session_timeout_min)

  // ---- back to the super admin ----
  await H['impersonation:stop'](fakeEvent)
  const superList = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Super Only' })
  ok('returning reloads the super admin own data', (superList.rows as any[]).some((r) => r.id === superCustomer), superList.total)
  const superSeesA = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Customer A' })
  ok("A's data never leaks into the super admin database", superSeesA.total === 0, superSeesA.total)

  // ---- switch into account B ----
  await H['impersonation:start'](fakeEvent, mgrBId)
  const listB0 = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok("B's workspace has neither A's data nor the super admin's", listB0.total === 0, listB0.total)
  await H['customers:create'](fakeEvent, { name: 'Customer B', mobile: '01755550003' })
  const listB1 = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok('B sees exactly its own customer', listB1.total === 1 && (listB1.rows as any[])[0].name === 'Customer B', listB1.total)

  // ---- back to A: isolation survives repeated switching ----
  await H['impersonation:stop'](fakeEvent)
  await H['impersonation:start'](fakeEvent, mgrUserId)
  const listAAgain = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok('switching back to A shows only A data (persisted)', listAAgain.total === 1 && (listAAgain.rows as any[])[0].name === 'Customer A', listAAgain.total)
  ok('each account has its own database file', fs.existsSync(path.join(userData, 'workspaces')) && fs.readdirSync(path.join(userData, 'workspaces')).length >= 2, fs.existsSync(path.join(userData, 'workspaces')) ? fs.readdirSync(path.join(userData, 'workspaces')) : [])

  // ---- logout while impersonating must restore the installation database ----
  await H['auth:logout'](fakeEvent)
  await H['auth:login'](fakeEvent, 'admin', 'admin123')
  const superList2 = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Super Only' })
  ok('logout during impersonation returns to the super admin data', (superList2.rows as any[]).some((r) => r.id === superCustomer), superList2.total)
  const auditRowsWS = db.prepare('SELECT * FROM impersonation_logs ORDER BY id DESC LIMIT 6').all() as any[]
  ok('every switch is audited (start + closed row)', auditRowsWS.filter((a) => a.ended_at).length >= 3, auditRowsWS.length)

  // ---- renderer refresh (auth:check) must keep the target's workspace ----
  await H['impersonation:start'](fakeEvent, mgrUserId)
  await H['customers:create'](fakeEvent, { name: 'Survives Refresh', mobile: '01755550010' })
  const refreshed = await H['auth:check'](fakeEvent)
  ok('refresh keeps the impersonated identity', refreshed.user?.username === 'mgr1' && refreshed.user?.impersonatedBy === 1, refreshed.user?.username)
  const afterRefresh = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Survives Refresh' })
  ok('refresh keeps the target workspace (no fallback to company data)', afterRefresh.total === 1, afterRefresh.total)
  const companyDuringRefresh = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Super Only' })
  ok('refreshed impersonation still cannot see the super admin data', companyDuringRefresh.total === 0, companyDuringRefresh.total)
  await H['impersonation:stop'](fakeEvent)

  // ---- two windows: switching in one must never change the other's data ----
  const secondWindow = { sender: { id: 2 } }
  await H['auth:login'](secondWindow as any, 'admin', 'admin123')
  await H['impersonation:start'](fakeEvent, mgrUserId) // window 1 → A
  await H['customers:create'](fakeEvent, { name: 'Window One A', mobile: '01755550011' })
  await H['impersonation:start'](secondWindow as any, mgrBId) // window 2 → B
  await H['customers:create'](secondWindow as any, { name: 'Window Two B', mobile: '01755550012' })
  const w1List = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  const w2List = await H['customers:list'](secondWindow as any, { page: 1, pageSize: 50 })
  ok('window 1 keeps account A data while window 2 impersonates B', w1List.total >= 3 && (w1List.rows as any[]).some((r) => r.name === 'Window One A') && (w1List.rows as any[]).every((r) => r.name !== 'Window Two B'), w1List.total)
  ok('window 2 sees only account B data', w2List.total >= 2 && (w2List.rows as any[]).some((r) => r.name === 'Window Two B') && (w2List.rows as any[]).every((r) => r.name !== 'Window One A' && r.name !== 'Survives Refresh'), w2List.total)
  const w1Super = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Super Only' })
  ok('window 1 never sees company data while impersonating', w1Super.total === 0, w1Super.total)
  await H['impersonation:stop'](secondWindow as any)
  await H['impersonation:stop'](fakeEvent)
  await H['auth:logout'](secondWindow as any)
  const superAfterWindows = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50, search: 'Super Only' })
  ok('both windows return to the super admin data after stopping', superAfterWindows.total > 0, superAfterWindows.total)

  // ---- business settings are per workspace, installation settings are not ----
  await H['impersonation:start'](fakeEvent, mgrUserId)
  const settingsA = await H['settings:getAll'](fakeEvent)
  await H['impersonation:stop'](fakeEvent)
  await H['impersonation:start'](fakeEvent, mgrBId)
  const settingsB = await H['settings:getAll'](fakeEvent)
  await H['impersonation:stop'](fakeEvent)
  ok('each workspace has its own company profile settings', !!settingsA.company_name && !!settingsB.company_name && settingsA.company_name !== settingsB.company_name, { a: settingsA.company_name, b: settingsB.company_name })
  ok('installation security setting is shared, not per workspace', settingsA.session_timeout_min === '480' && settingsB.session_timeout_min === '480')

  // ---- Collector workspace bootstrap: a collector can act in its own scope ----
  await H['impersonation:start'](fakeEvent, rahimUserId)
  const colMe = await H['payments:myCollector'](fakeEvent)
  const colCustomers = await H['customers:list'](fakeEvent, { page: 1, pageSize: 50 })
  ok('collector workspace bootstraps its own collector identity', colMe.locked === true && !!colMe.collector?.id, colMe)
  ok('collector workspace starts without the company customers', colCustomers.total === 0, colCustomers.total)
  await H['impersonation:stop'](fakeEvent)

  // ==== SMS gateway + per-user SMS wallet (separate from money balances) ====
  section('SMS gateway + per-user SMS wallet')
  const SMS_ENV_KEYS = ['SMS_PROVIDER', 'SMS_GATEWAY_URL', 'SMS_SENDER_ID', 'SMS_API_KEY', 'SMS_API_SECRET', 'SMS_ENABLED', 'SMS_REFUND_ON_FAILED', 'SMS_BALANCE_URL', 'SMS_DLR_URL', 'SMS_LOW_BALANCE_THRESHOLD', 'SMS_EDGE_URL', 'SMS_EDGE_TOKEN']
  const savedSmsEnv = Object.fromEntries(SMS_ENV_KEYS.map((k) => [k, process.env[k]]))
  const realFetchSms = (global as any).fetch
  process.env.SMS_PROVIDER = 'bulksmsbd'
  process.env.SMS_GATEWAY_URL = 'https://gateway.test/api/smsapi'
  process.env.SMS_BALANCE_URL = 'https://gateway.test/api/getBalanceApi'
  process.env.SMS_DLR_URL = 'https://gateway.test/api/deliveryReportApi'
  process.env.SMS_SENDER_ID = 'AVA'
  process.env.SMS_API_KEY = 'test-api-key'
  process.env.SMS_API_SECRET = 'test-api-secret'
  delete process.env.SMS_ENABLED
  delete process.env.SMS_REFUND_ON_FAILED
  delete process.env.SMS_LOW_BALANCE_THRESHOLD
  delete process.env.SMS_EDGE_URL
  delete process.env.SMS_EDGE_TOKEN

  let smsFetchMode: 'ok' | 'fail' = 'ok'
  let smsDlrMode: 'DELIVERED' | 'FAILED' = 'DELIVERED'
  let smsProviderBalance: 'ok' | 'zero' = 'ok'
  let smsProviderCode: number | null = null
  let smsEdgeCalls = 0
  let lastEdgeBody: any = null
  let smsFetchCalls = 0
  let lastSmsUrl: URL | null = null
  let lastBulkUrl: URL | null = null
  let lastBulkBody: URLSearchParams | null = null
  const jsonResponse = (body: any) => ({
    ok: true, status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  })
  ;(global as any).fetch = async (input: any, init?: any) => {
    const url = new URL(String(input))
    smsFetchCalls++
    if (url.hostname === 'edge.test') {
      smsEdgeCalls++
      const body = JSON.parse(String(init?.body || '{}'))
      lastEdgeBody = body
      if (body.action === 'balance') return jsonResponse({ ok: true, balance: 5000, unit: 'currency', raw: '{"balance":5000}' })
      if (body.action === 'dlr') return jsonResponse({ ok: true, provider_status: smsDlrMode, raw: JSON.stringify({ status: smsDlrMode }) })
      if (body.action === 'send') {
        if (smsProviderCode) return jsonResponse({ ok: false, error: `${smsProviderCode}: Provider balance is insufficient` })
        return jsonResponse({ ok: true, response_code: '202', status: 'submitted', provider_message_id: 'edge-' + smsEdgeCalls, raw: '{"response_code":202}' })
      }
      return jsonResponse({ ok: false, error: 'UNKNOWN_ACTION' })
    }
    if (url.pathname.endsWith('/getBalanceApi')) {
      return jsonResponse(smsProviderBalance === 'zero' ? { balance: 0, currency: 'BDT' } : { balance: 5000, currency: 'BDT' })
    }
    if (url.pathname.endsWith('/deliveryReportApi')) {
      return jsonResponse({ status: smsDlrMode, sms_id: url.searchParams.get('sms_id') })
    }
    if (url.pathname.endsWith('/smsapimany')) {
      lastBulkUrl = url
      lastBulkBody = new URLSearchParams(String(init?.body || ''))
      if (smsProviderCode) return jsonResponse({ response_code: smsProviderCode, error_message: 'Balance Insufficient' })
      return jsonResponse({ response_code: 202, success_message: 'SMS Submitted Successfully', error_message: '', sms_id: 'bulk-' + smsFetchCalls })
    }
    lastSmsUrl = url
    if (smsFetchMode === 'fail') {
      return { ok: false, status: 502, json: async () => ({ error: 'gateway down' }), text: async () => 'gateway down' }
    }
    if (smsProviderCode) {
      return jsonResponse({ response_code: smsProviderCode, success_message: '', error_message: 'Balance Insufficient' })
    }
    return jsonResponse({
      response_code: 202,
      success_message: 'SMS Submitted Successfully',
      error_message: '',
      sms_id: 'gw-' + smsFetchCalls
    })
  }

  // Collector has the seeded messaging + sms module keys.
  const smsUser1Id = await H['users:create'](fakeEvent, { username: 'smsuser1', password: 'secret1', full_name: 'SMS User One', role_id: staffRoleId }) as number
  const smsUser2Id = await H['users:create'](fakeEvent, { username: 'smsuser2', password: 'secret1', full_name: 'SMS User Two', role_id: staffRoleId }) as number
  const walletRowsForNewUsers = Number((db.prepare('SELECT COUNT(*) AS c FROM sms_wallets WHERE user_id IN (?,?)').get(smsUser1Id, smsUser2Id) as any).c)
  ok('every new account gets its own real 0-SMS wallet row automatically', walletRowsForNewUsers === 2, walletRowsForNewUsers)
  const smsU1 = { sender: { id: 30 } }
  const smsU2 = { sender: { id: 31 } }
  await H['auth:login'](smsU1 as any, 'smsuser1', 'secret1')
  await H['auth:login'](smsU2 as any, 'smsuser2', 'secret1')

  const gatewayData = {
    provider: 'bulksmsbd', gatewayUrl: 'https://gateway.test/api/smsapi',
    balanceUrl: 'https://gateway.test/api/getBalanceApi', dlrUrl: 'https://gateway.test/api/deliveryReportApi',
    senderId: 'AVA', enabled: true, refundOnFailed: true, lowBalanceThreshold: 100
  }
  const mbBeforeSms = await H['accounts:mainBalance'](fakeEvent)
  const cfg0 = await H['sms:admin:configSet'](fakeEvent, gatewayData)
  ok('Super Admin can configure the BulkSMSBD gateway', cfg0.provider === 'bulksmsbd' && cfg0.enabled === true && cfg0.configured === true && !!cfg0.balanceUrl && !!cfg0.dlrUrl, cfg0)
  ok('gateway config never exposes the API key/secret', !('apiKey' in cfg0) && !('apiSecret' in cfg0) && cfg0.apiKeyConfigured === true && cfg0.apiSecretConfigured === true, cfg0)

  const smsPackageId = await H['sms:admin:packageSave'](fakeEvent, { name: 'Starter 100', smsCount: 100, price: 500, status: 'active', description: '100 SMS' })
  ok('Super Admin creates a real SMS package', smsPackageId > 0)
  const packagesForUser = await H['sms:packages'](smsU1 as any)
  const hasPlan = (count: number, price: number) => packagesForUser.some((p: any) => Number(p.sms_count) === count && Number(p.price) === price)
  ok('default SMS plans: 1,000 / 5,000 / 10,000 at 0.42 per SMS', hasPlan(1000, 420) && hasPlan(5000, 2100) && hasPlan(10000, 4200), packagesForUser)
  ok('user can see active SMS packages', packagesForUser.some((p: any) => p.id === smsPackageId && Number(p.sms_count) === 100))

  const w0 = await H['sms:wallet'](smsU1 as any)
  ok('new user starts with a real 0 SMS balance (no fake credit)', w0.balance === 0 && w0.totalPurchased === 0 && w0.totalUsed === 0 && w0.lowBalance === true && w0.lowThreshold === 100, w0)
  let noIdemErr = ''
  try { await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'No idempotency key' }) } catch (e: any) { noIdemErr = String(e) }
  ok('duplicate protection requires an explicit idempotency key', noIdemErr.includes('IDEMPOTENCY_KEY_REQUIRED') && smsFetchCalls === 0, { noIdemErr, smsFetchCalls })
  let noBalanceErr = ''
  try { await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'No balance', clientRequestId: 'sms-nobalance' }) } catch (e: any) { noBalanceErr = String(e) }
  ok('send is blocked before the gateway when the wallet is empty', noBalanceErr.includes('SMS_BALANCE_INSUFFICIENT') && smsFetchCalls === 0, { noBalanceErr, smsFetchCalls })

  const purchase = await H['sms:createPurchase'](smsU1 as any, { packageId: smsPackageId, method: 'bkash', trxId: 'SMS-TRX-001', note: 'real bKash payment' })
  ok('user can submit a package purchase request', purchase.purchase?.status === 'pending' && purchase.purchase?.smsCount === 100, purchase)
  const wBeforeVerify = await H['sms:wallet'](smsU1 as any)
  ok('purchase request does NOT credit before verification', wBeforeVerify.balance === 0, wBeforeVerify.balance)
  const purchaseDup = await H['sms:createPurchase'](smsU1 as any, { packageId: smsPackageId, method: 'bkash', trxId: 'SMS-TRX-001' })
  ok('duplicate purchase request does not create a second request', purchaseDup.duplicate === true && purchaseDup.purchase.id === purchase.purchase.id, purchaseDup)

  const verified = await H['sms:admin:verifyPurchase'](fakeEvent, purchase.purchase.id, 'approve', 'verified against bKash statement')
  ok('verified payment credits exactly the package SMS', verified.credited === 100 && verified.wallet.balance === 100, verified)
  const verifiedAgain = await H['sms:admin:verifyPurchase'](fakeEvent, purchase.purchase.id, 'approve')
  ok('duplicate payment callback cannot double-credit', verifiedAgain.already === true && verifiedAgain.wallet.balance === 100, verifiedAgain)
  const purchaseLedger = Number((db.prepare("SELECT COUNT(*) AS c FROM sms_transactions WHERE user_id = ? AND type = 'purchase'").get(smsUser1Id) as any).c)
  ok('exactly one purchase ledger row exists', purchaseLedger === 1, purchaseLedger)

  const out1 = await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'Hello from AVA', clientRequestId: 'sms-send-1' })
  ok('SMS is sent through the server-side BulkSMSBD gateway', out1.status === 'sent' && out1.smsCount === 1 && !!out1.providerMessageId && !!out1.requestId, out1)
  ok('gateway response/request ID are stored', !!out1.gatewayResponse && String(out1.gatewayResponse).includes('202') && out1.requestId?.startsWith('SMS-'), out1)
  const out1Row = db.prepare('SELECT status, delivered_at FROM sms_messages WHERE id = ?').get(out1.messageId) as any
  ok('response 202 is recorded as SUBMITTED, never auto-delivered', out1Row?.status === 'sent' && !out1Row?.delivered_at, out1Row)
  ok('BulkSMSBD receives normalized recipient, message and text encoding',
    lastSmsUrl?.searchParams.get('number') === '8801712345678' &&
    lastSmsUrl?.searchParams.get('message') === 'Hello from AVA' &&
    lastSmsUrl?.searchParams.get('senderid') === 'AVA' &&
    lastSmsUrl?.searchParams.get('type') === 'text' &&
    lastSmsUrl?.searchParams.get('api_key') === 'test-api-key', lastSmsUrl?.toString())
  const wAfter1 = await H['sms:wallet'](smsU1 as any)
  ok('SMS balance deducted by the exact segment count', wAfter1.balance === 99 && wAfter1.totalUsed === 1 && wAfter1.lowBalance === true, wAfter1)
  ok('wallet exposes submitted/delivered/failed counters separately', wAfter1.statusCounts?.submitted === 1 && wAfter1.statusCounts?.delivered === 0 && wAfter1.statusCounts?.failed === 0, wAfter1.statusCounts)

  const balBeforeProviderZero = wAfter1.balance
  smsProviderBalance = 'zero'
  let providerZeroErr = ''
  try { await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'Provider balance guard', clientRequestId: 'sms-provider-zero' }) } catch (e: any) { providerZeroErr = String(e) }
  const balAfterProviderZero = (await H['sms:wallet'](smsU1 as any)).balance
  const providerZeroRows = Number((db.prepare("SELECT COUNT(*) AS c FROM sms_messages WHERE idempotency_key LIKE '%sms-provider-zero%'").get() as any).c)
  ok('insufficient shared provider balance blocks before any wallet debit', providerZeroErr.includes('SMS_PROVIDER_BALANCE_INSUFFICIENT') && balAfterProviderZero === balBeforeProviderZero && providerZeroRows === 0, { providerZeroErr, balBeforeProviderZero, balAfterProviderZero, providerZeroRows })
  smsProviderBalance = 'ok'

  const balBefore1007 = (await H['sms:wallet'](smsU1 as any)).balance
  smsProviderCode = 1007
  const code1007 = await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'Provider code mapping', clientRequestId: 'sms-code-1007' })
  const balAfter1007 = (await H['sms:wallet'](smsU1 as any)).balance
  ok('BulkSMSBD error codes are mapped and the failed send is refunded', code1007.status === 'failed' && String(code1007.error).includes('1007') && code1007.refunded === true && balAfter1007 === balBefore1007, { code1007, balBefore1007, balAfter1007 })
  smsProviderCode = null
  const messageCountBeforeDup = Number((db.prepare('SELECT COUNT(*) AS c FROM sms_messages WHERE user_id = ?').get(smsUser1Id) as any).c)
  const outDup = await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'Hello from AVA', clientRequestId: 'sms-send-1' })
  const wAfterDup = await H['sms:wallet'](smsU1 as any)
  ok('duplicate send request is idempotent (no second debit)', outDup.duplicate === true && wAfterDup.balance === 99, { outDup, wAfterDup })
  const messageCount = Number((db.prepare('SELECT COUNT(*) AS c FROM sms_messages WHERE user_id = ?').get(smsUser1Id) as any).c)
  ok('duplicate send created no extra message row', messageCount === messageCountBeforeDup, { messageCount, messageCountBeforeDup })

  const unicodeText = 'ক'.repeat(80)
  const out2 = await H['sms:send'](smsU1 as any, { recipient: '01812345678', message: unicodeText, clientRequestId: 'sms-send-2' })
  ok('Bangla unicode message uses type=unicode and correct segments', out2.status === 'sent' && out2.smsCount === 2 && out2.encoding === 'unicode' && lastSmsUrl?.searchParams.get('type') === 'unicode', { out2, type: lastSmsUrl?.searchParams.get('type') })

  const wBeforeFail = await H['sms:wallet'](smsU1 as any)
  smsFetchMode = 'fail'
  const outFail = await H['sms:send'](smsU1 as any, { recipient: '01912345678', message: 'This should fail', clientRequestId: 'sms-send-fail' })
  const wAfterFail = await H['sms:wallet'](smsU1 as any)
  ok('provider failure is stored as failed', outFail.status === 'failed' && !!outFail.error, outFail)
  ok('failed SMS is refunded by the configured policy', outFail.refunded === true && wAfterFail.balance === wBeforeFail.balance, { before: wBeforeFail.balance, after: wAfterFail.balance, outFail })
  const refundLedger = Number((db.prepare("SELECT COUNT(*) AS c FROM sms_transactions WHERE user_id = ? AND type = 'refund'").get(smsUser1Id) as any).c)
  ok('every provider failure/refund is recorded in the wallet ledger', refundLedger === 2, refundLedger)
  smsFetchMode = 'ok'

  const wu2 = await H['sms:wallet'](smsU2 as any)
  const mu2 = await H['sms:messages'](smsU2 as any, { page: 1, pageSize: 50 })
  const tu2 = await H['sms:transactions'](smsU2 as any, { page: 1, pageSize: 50 })
  ok('another user has an independent zero wallet', wu2.balance === 0 && wu2.totalPurchased === 0, wu2)
  ok('another user cannot see the first user SMS history', mu2.total === 0 && tu2.total === 0, { messages: mu2.total, tx: tu2.total })
  let adminDenied = ''
  try { await H['sms:admin:wallets'](smsU2 as any, {}) } catch (e: any) { adminDenied = String(e) }
  ok('non-super user cannot open SMS admin/wallets', adminDenied.includes('PERMISSION_DENIED'), adminDenied)

  const adminWallets = await H['sms:admin:wallets'](fakeEvent, { search: 'smsuser' })
  ok('Super Admin sees every user SMS wallet', (adminWallets.rows as any[]).length === 2 && (adminWallets.rows as any[]).some((r) => r.userId === smsUser1Id && r.balance === wAfterFail.balance), adminWallets)
  const adminU1 = (adminWallets.rows as any[]).find((r) => r.userId === smsUser1Id)
  ok('Super Admin sees each user’s submitted/delivered/failed counters', adminU1?.statusCounts?.submitted === 2 && adminU1?.statusCounts?.failed === 2 && adminU1?.statusCounts?.delivered === 0, adminU1?.statusCounts)
  const adminTx = await H['sms:admin:transactions'](fakeEvent, { userId: smsUser1Id, page: 1, pageSize: 50 })
  ok('Super Admin sees user SMS transactions', adminTx.total >= 4 && (adminTx.rows as any[]).every((r) => r.userId === smsUser1Id), adminTx.total)
  const adminMsgs = await H['sms:admin:messages'](fakeEvent, { userId: smsUser1Id, page: 1, pageSize: 50 })
  ok('Super Admin sees all SMS statuses', adminMsgs.rows.some((r: any) => r.status === 'sent') && adminMsgs.rows.some((r: any) => r.status === 'failed'), adminMsgs.rows.map((r: any) => r.status))
  const storedOut1 = adminMsgs.rows.find((r: any) => r.id === out1.messageId)
  ok('message history stores recipient/message/count/request/gateway response',
    storedOut1?.recipient === '8801712345678' && storedOut1?.message === 'Hello from AVA' &&
    storedOut1?.smsCount === 1 && !!storedOut1?.requestId && !!storedOut1?.gatewayResponse,
    storedOut1)

  const adj1 = await H['sms:admin:adjust'](fakeEvent, smsUser2Id, 10, 'manual correction', 'adj-request-1')
  const adj2 = await H['sms:admin:adjust'](fakeEvent, smsUser2Id, 10, 'manual correction', 'adj-request-1')
  ok('Super Admin balance adjustment is atomic + audited', adj1.wallet.balance === 10 && adj1.transaction.type === 'adjustment', adj1)
  ok('duplicate adjustment request does not double-add', adj2.duplicate === true && adj2.wallet.balance === 10, adj2)
  let negErr = ''
  try { await H['sms:admin:adjust'](fakeEvent, smsUser2Id, -20, 'too much', 'adj-request-2') } catch (e: any) { negErr = String(e) }
  ok('adjustment can never make the SMS wallet negative', negErr.includes('SMS_BALANCE_CANNOT_BE_NEGATIVE'), negErr)

  const walletBeforeProviderPurchase = (await H['sms:wallet'](smsU1 as any)).balance
  const providerPurchase = await H['sms:admin:providerPurchase'](fakeEvent, {
    provider: 'bulksmsbd', smsCount: 1000, amount: 1200, method: 'bank', trxId: 'PROV-TRX-001', note: 'shared gateway top-up'
  })
  const providerPurchaseDup = await H['sms:admin:providerPurchase'](fakeEvent, {
    provider: 'bulksmsbd', smsCount: 1000, amount: 1200, method: 'bank', trxId: 'PROV-TRX-001'
  })
  const providerPurchaseList = await H['sms:admin:providerPurchases'](fakeEvent, { page: 1, pageSize: 20 })
  ok('Super Admin can record a real provider credit purchase', providerPurchase.purchase?.smsCount === 1000 && providerPurchase.purchase?.amount === 1200, providerPurchase)
  ok('duplicate provider purchase cannot be recorded twice', providerPurchaseDup.duplicate === true && providerPurchaseList.total === 1, { providerPurchaseDup, total: providerPurchaseList.total })
  ok('provider purchase never touches an individual user wallet', (await H['sms:wallet'](smsU1 as any)).balance === walletBeforeProviderPurchase)

  const balBeforeGw = (await H['sms:wallet'](smsU1 as any)).balance
  const gwBal = await H['sms:admin:gatewayBalance'](fakeEvent)
  const balAfterGw = (await H['sms:wallet'](smsU1 as any)).balance
  ok('BulkSMSBD Balance Check API returns the provider balance', gwBal.balance === 5000 && gwBal.provider === 'bulksmsbd', gwBal)
  ok('gateway balance check does not touch a user wallet', balAfterGw === balBeforeGw, { balBeforeGw, balAfterGw })

  const balBeforeTest = (await H['sms:wallet'](smsU1 as any)).balance
  const gwTest = await H['sms:admin:testGateway'](fakeEvent, '01712345678')
  const balAfterTest = (await H['sms:wallet'](smsU1 as any)).balance
  ok('Super Admin gateway test uses the real BulkSMSBD adapter', gwTest.ok === true && !!gwTest.providerMessageId, gwTest)
  ok('gateway test does not debit any wallet', balAfterTest === balBeforeTest, { balBeforeTest, balAfterTest })

  smsDlrMode = 'DELIVERED'
  const dlrDelivered = await H['sms:admin:checkDelivery'](fakeEvent, out1.messageId)
  ok('delivery report updates sent → delivered', dlrDelivered.status === 'delivered' && !!dlrDelivered.deliveredAt && !!dlrDelivered.deliveryCheckedAt, dlrDelivered)
  ok('delivery report stores provider response and request ID', !!dlrDelivered.requestId && String(dlrDelivered.gatewayResponse).includes('DELIVERED'), dlrDelivered)
  const balAfterDelivered = (await H['sms:wallet'](smsU1 as any)).balance
  let deliveredDowngradeErr = ''
  try { await H['sms:admin:updateStatus'](fakeEvent, out1.messageId, 'failed') } catch (e: any) { deliveredDowngradeErr = String(e) }
  ok('a delivered SMS can never be downgraded to failed/refunded', deliveredDowngradeErr.includes('SMS_ALREADY_DELIVERED') && (await H['sms:wallet'](smsU1 as any)).balance === balAfterDelivered, deliveredDowngradeErr)

  smsDlrMode = 'FAILED'
  const balBeforeDlrFail = (await H['sms:wallet'](smsU1 as any)).balance
  const dlrFailed = await H['sms:admin:checkDelivery'](fakeEvent, out2.messageId)
  const balAfterDlrFail = (await H['sms:wallet'](smsU1 as any)).balance
  ok('failed delivery applies the refund policy', dlrFailed.status === 'failed' && dlrFailed.refunded === true && balAfterDlrFail === balBeforeDlrFail + Number(out2.smsCount), { dlrFailed, balBeforeDlrFail, balAfterDlrFail })
  await H['sms:admin:checkDelivery'](fakeEvent, out2.messageId)
  ok('repeated DLR failure cannot refund twice', (await H['sms:wallet'](smsU1 as any)).balance === balAfterDlrFail)
  let failedUpgradeErr = ''
  try { await H['sms:admin:updateStatus'](fakeEvent, out2.messageId, 'delivered') } catch (e: any) { failedUpgradeErr = String(e) }
  ok('a failed/refunded SMS cannot be flipped back to a free delivered SMS', /SMS_ALREADY_(FAILED|REFUNDED)/.test(failedUpgradeErr), failedUpgradeErr)
  smsDlrMode = 'DELIVERED'

  const out3 = await H['sms:send'](smsU1 as any, { recipient: '01612345678', message: 'DLR sync message', clientRequestId: 'sms-send-3' })
  const sync = await H['sms:admin:syncDelivery'](fakeEvent, { limit: 25 })
  const out3Row = (await H['sms:messages'](smsU1 as any, { page: 1, pageSize: 50 })).rows.find((r: any) => r.id === out3.messageId)
  ok('Super Admin can sync pending delivery reports', sync.checked >= 1 && sync.delivered >= 1 && sync.errors === 0, sync)
  ok('synced delivery report is persisted', out3Row?.status === 'delivered' && !!out3Row?.deliveryCheckedAt, out3Row)

  const manual = await H['sms:admin:updateStatus'](fakeEvent, out3.messageId, 'delivered')
  ok('manual delivery override remains available', manual.status === 'delivered', manual)

  const balBeforeNoRefund = (await H['sms:wallet'](smsU1 as any)).balance
  await H['sms:admin:configSet'](fakeEvent, { ...gatewayData, refundOnFailed: false })
  smsFetchMode = 'fail'
  const noRefund = await H['sms:send'](smsU1 as any, { recipient: '01799999999', message: 'Policy test', clientRequestId: 'sms-norefund' })
  const balAfterNoRefund = (await H['sms:wallet'](smsU1 as any)).balance
  ok('refund policy can be disabled by the Super Admin', noRefund.status === 'failed' && noRefund.refunded === false && balAfterNoRefund === balBeforeNoRefund - Number(noRefund.smsCount), { noRefund, balBeforeNoRefund, balAfterNoRefund })
  smsFetchMode = 'ok'
  await H['sms:admin:configSet'](fakeEvent, gatewayData)

  // Optional secure proxy mode: the desktop never sees the provider API key.
  process.env.SMS_EDGE_URL = 'https://edge.test/bulksmsbd'
  process.env.SMS_EDGE_TOKEN = 'edge-secret-token'
  const edgeWalletBefore = (await H['sms:wallet'](smsU1 as any)).balance
  const edgeSend = await H['sms:send'](smsU1 as any, { recipient: '01712345678', message: 'Via Supabase Edge Function', clientRequestId: 'sms-edge-1' })
  const edgeRequestBody = lastEdgeBody
  ok('Supabase Edge Function mode sends through the secure proxy', edgeSend.status === 'sent' && String(edgeSend.providerMessageId || '').startsWith('edge-') && edgeRequestBody?.action === 'send', { edgeSend, edgeRequestBody })
  ok('provider API key is never sent by the desktop in Edge mode', !('api_key' in (edgeRequestBody || {})) && !('senderid' in (edgeRequestBody || {})), edgeRequestBody)
  const edgeBalance = await H['sms:admin:gatewayBalance'](fakeEvent)
  ok('provider balance is also routed through the Edge Function', edgeBalance.balance === 5000 && lastEdgeBody?.action === 'balance', edgeBalance)
  ok('Edge-mode send still debits only the exact user wallet parts', (await H['sms:wallet'](smsU1 as any)).balance === edgeWalletBefore - 1)
  delete process.env.SMS_EDGE_URL
  delete process.env.SMS_EDGE_TOKEN

  // Personalized bulk endpoint (BulkSMSBD smsapimany).
  const bulkWalletBefore = (await H['sms:wallet'](smsU1 as any)).balance
  const bulkMessages = [
    { recipient: '01712345678', message: 'ক'.repeat(80) },
    { recipient: '01812345678', message: 'ক'.repeat(80) }
  ]
  const bulk = await H['sms:sendBulk'](smsU1 as any, { messages: bulkMessages, clientRequestId: 'sms-bulk-1' })
  const bulkWalletAfter = (await H['sms:wallet'](smsU1 as any)).balance
  const bulkPayload = JSON.parse(String(lastBulkBody?.get('messages') || '[]'))
  ok('personalized bulk SMS uses the official smsapimany endpoint', !!lastBulkUrl && lastBulkUrl.pathname.endsWith('/smsapimany') && lastBulkBody?.get('senderid') === 'AVA', { url: lastBulkUrl?.toString(), senderid: lastBulkBody?.get('senderid') })
  ok('bulk batch sends every recipient/message and adds 202 as submitted', bulk.status === 'sent' && bulk.count === 2 && bulk.totalSms === 4 && bulk.messages?.length === 2 && bulk.messages.every((m: any) => m.status === 'sent'), bulk)
  ok('bulk payload contains all personalized recipients', bulkPayload.length === 2 && bulkPayload[0].to === '8801712345678' && bulkPayload[1].to === '8801812345678', bulkPayload)
  ok('bulk wallet debit equals the exact total billable parts', bulkWalletAfter === bulkWalletBefore - 4, { bulkWalletBefore, bulkWalletAfter })
  const bulkDup = await H['sms:sendBulk'](smsU1 as any, { messages: bulkMessages, clientRequestId: 'sms-bulk-1' })
  ok('duplicate bulk request is idempotent (no second debit)', bulkDup.duplicate === true && (await H['sms:wallet'](smsU1 as any)).balance === bulkWalletAfter, bulkDup)

  const mbAfterSms = await H['accounts:mainBalance'](fakeEvent)
  ok('SMS wallet is completely separate from the main financial balance', mbAfterSms.balance === mbBeforeSms.balance, { before: mbBeforeSms.balance, after: mbAfterSms.balance })

  const walletBeforeImp = await H['sms:wallet'](smsU1 as any)
  await H['impersonation:start'](fakeEvent, smsUser1Id)
  const impWallet = await H['sms:wallet'](fakeEvent)
  const impMsgs = await H['sms:messages'](fakeEvent, { page: 1, pageSize: 50 })
  ok('Login As User shows that user’s SMS wallet', impWallet.userId === smsUser1Id && impWallet.balance === walletBeforeImp.balance, impWallet)
  ok('Login As User SMS history is scoped to the target user', impMsgs.total > 0 && (impMsgs.rows as any[]).every((r) => r.userId === smsUser1Id), impMsgs.total)
  await H['impersonation:stop'](fakeEvent)

  const auditActions = (db.prepare("SELECT action FROM activity_logs WHERE module = 'sms'").all() as any[]).map((r) => r.action)
  ok('SMS audit log covers purchase/usage/refund/adjustment/config/provider',
    ['sms_purchase_verified', 'sms_sent', 'sms_failed', 'sms_refunded', 'sms_balance_adjusted', 'sms_gateway_config_saved', 'sms_gateway_balance_checked', 'sms_delivery_checked', 'sms_delivery_synced', 'sms_provider_purchase_recorded', 'sms_provider_balance_insufficient', 'sms_bulk_sent'].every((a) => auditActions.includes(a)), auditActions)

  ;(global as any).fetch = realFetchSms
  for (const k of SMS_ENV_KEYS) {
    if (savedSmsEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedSmsEnv[k] as string
  }
  await H['auth:logout'](smsU1 as any)
  await H['auth:logout'](smsU2 as any)

  // ==== due reminders: generate, dedupe, edit, empty state ====
  section('due reminders — generate + duplicate prevention')
  // due month: bills for c1 (fully paid above), c2 (partial: due 100), and a new
  // customer with unpaid bill + one with no mobile
  const rMonth = '2026-10'
  const cNoMob = await H['customers:create'](fakeEvent, { name: 'No Mobile', mobile: '01355500001', area_id: areaId, monthly_bill: 200 })
  const cUnpaid = await H['customers:create'](fakeEvent, { name: 'Unpaid One', mobile: '01355500002', area_id: areaId, monthly_bill: 250 })
  await H['customers:update'](fakeEvent, cNoMob, { mobile: '' })
  await H['billing:generate'](fakeEvent, rMonth, undefined, 'manual')
  // make cNoMob have no mobile (already empty above); cUnpaid gets a bill with no payment
  // partial: c2 already has due from the earlier month test? use bills of rMonth for c2
  const tpl = await H['db:create'](fakeEvent, 'sms_templates', { name: 'Due Reminder T', type: 'due_reminder', content: 'Dear {{name}}, your {{month}} bill due_amount is {{due_amount}}. - {{company}}', status: 'active' })
  const g1 = await H['messages:composeDue'](fakeEvent, tpl, rMonth)
  ok('composeDue returns totals (created+skipped match due customers)', g1.total > 0 && g1.created + g1.skipped === g1.total, g1)
  const rem1 = (await H['db:list'](fakeEvent, 'messages', { page: 1, all: true, filters: { type: 'due_reminder' } })).rows
  ok('every due customer has a reminder', rem1.length >= g1.created, rem1.length)
  const noMob = rem1.find((m: any) => m.customer_id === cNoMob)
  ok('customer without mobile skipped', !noMob, noMob)
  const un = rem1.find((m: any) => m.customer_id === cUnpaid)
    const unBillDue = Math.round((un && (await H['customers:get'](fakeEvent, cUnpaid)).bills.find((b: any) => b.month === rMonth).total) - (await H['customers:get'](fakeEvent, cUnpaid)).bills.find((b: any) => b.month === rMonth).paid)
  ok('unpaid customer included with real due amount', !!un && un.text.includes(String(unBillDue)), { text: un?.text, due: unBillDue })
  ok('due_amount placeholder replaced', un?.text.includes('Dear Unpaid One') && un.text.includes(rMonth), un?.text)
  // partial payment: pay part of cUnpaid's bill, regenerate — draft reminder updates, not duplicates
  const unpaidBill = (await H['customers:get'](fakeEvent, cUnpaid)).bills.find((b: any) => b.month === rMonth)
  await H['payments:collect'](fakeEvent, { customerId: cUnpaid, amount: 100, method: 'cash', type: 'bill', billId: unpaidBill.id })
  const g2 = await H['messages:composeDue'](fakeEvent, tpl, rMonth)
  ok('regenerate: existing drafts UPDATED not duplicated', g2.updated >= 1 && g2.created === 0, g2)
  const rem2 = (await H['db:list'](fakeEvent, 'messages', { page: 1, all: true, filters: { type: 'due_reminder' } })).rows
  ok('no duplicate rows after repeat clicks', rem2.length === rem1.length, { before: rem1.length, after: rem2.length })
  const un2 = rem2.find((m: any) => m.customer_id === cUnpaid)
    const ub2 = (await H['customers:get'](fakeEvent, cUnpaid)).bills.find((b: any) => b.month === rMonth)
  const unBillDue2 = Math.round(ub2.total - ub2.paid)
  ok('updated reminder carries new remaining due', un2?.text.includes(String(unBillDue2)) && unBillDue2 === 165, { text: un2?.text, due: unBillDue2 })
  // sent reminders keep history and are never re-created
  const markTarget = rem2.find((m: any) => m.customer_id === cUnpaid)
  await H['messages:markSent'](fakeEvent, markTarget.id)
  await H['payments:collect'](fakeEvent, { customerId: cUnpaid, amount: 50, method: 'cash', type: 'bill', billId: unpaidBill.id })
  const g3 = await H['messages:composeDue'](fakeEvent, tpl, rMonth)
  ok('sent reminder skipped (history preserved)', g3.created === 0 && g3.skipped >= 1, g3)
  // edit message text
  const draft = rem2.find((m: any) => m.status !== 'sent')
  await H['db:update'](fakeEvent, 'messages', draft.id, { text: 'Custom reminder text' })
  const edited = (await H['db:get'](fakeEvent, 'messages', draft.id))
  ok('reminder text editable', edited.text === 'Custom reminder text', edited)
  // empty state: month with no dues
  const g4 = await H['messages:composeDue'](fakeEvent, tpl, '2099-01')
  ok('empty month → zero due customers', g4.total === 0 && g4.created === 0, g4)
  // invalid month rejected
  let badMonthErr = ''
  try { await H['messages:composeDue'](fakeEvent, tpl, '2099-1') } catch (e: any) { badMonthErr = String(e) }
  ok('invalid month rejected', badMonthErr.includes('INVALID_MONTH'), badMonthErr)

  console.log(`\n=========================\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1) })

import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { I18nProvider, useI18n } from './lib/i18n'
import { ToastProvider, useToast } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import SubscriptionGate from './pages/SubscriptionGate'
import UpdateGate from './pages/UpdateGate'
import Dashboard from './pages/Dashboard'
import SupportNumbers from './pages/SupportNumbers'
import Tutorial from './pages/Tutorial'
import CustomersPage from './pages/Customers'
import CustomerProfile from './pages/CustomerProfile'
import BillingPage from './pages/Billing'
import CollectPayment from './pages/CollectPayment'
import PaymentsHistory, { CollectionHistory } from './pages/PaymentsHistory'
import ReportsPage from './pages/Reports'
import BillReport from './pages/BillReport'
import CashbookPage from './pages/Cashbook'
import SettingsPage from './pages/Settings'
import SecurityPage from './pages/Security'
import AutomationPage from './pages/Automation'
import { EntityPage } from './components/EntityPage'
import { UserInfo } from '@shared/types'
import { errMsg } from './lib/api'
import { PermProvider } from './lib/perms'
import { monthStartEnd, thisMonth, prevMonth } from './lib/format'
import { AreasCollection } from './pages/Reports'
import { ConnectionsPage } from './pages/Connections'
import { CustomersOps } from './pages/CustomersOps'
import { ResellerWallet } from './pages/ResellersPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { TransfersPage, TransactionPages } from './pages/TransactionPages'
import { MessagesPages } from './pages/MessagesPages'
import { CollectorAssign } from './pages/CollectorAssign'
import { DailyPaymentsPage } from './pages/DailyPayments'
import { RenewalsPage } from './pages/Renewals'
import SubscriptionRenewalPage from './pages/SubscriptionRenewal'
import { ImportExportPage } from './pages/ImportExport'

function AppInner() {
  const { t } = useI18n()
  const toast = useToast()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [sub, setSub] = useState<any>(null)
  const [upd, setUpd] = useState<any>(null)

  const refreshSub = () => window.api.subscription.status().then(setSub).catch(() => {})

  useEffect(() => {
    refreshSub()
    window.api.updater.status().then(setUpd).catch(() => {})
    const offUpd = window.api.updater.onStatus((s: any) => setUpd(s))
    window.api.auth.check().then((r: any) => setUser(r.user)).finally(() => setChecking(false))
    const off = window.api.auth.onExpired(() => {
      setUser(null)
      toast.push('error', t('sessionExpired'))
    })
    // live permission sync: Security → Roles / per-user grants push an event,
    // re-check the session so updated permissions apply WITHOUT logout/login
    const offPerms = window.api.auth.onPermissionsUpdated(() => {
      window.api.auth.check().then((r: any) => { if (r?.user) setUser(r.user) }).catch(() => {})
    })
    // session keepalive ping every 2 min
    const ping = setInterval(() => window.api.auth.ping().catch(() => {}), 120_000)
    // re-check subscription every 30 min (handles expiry while app is open)
    const subPing = setInterval(refreshSub, 30 * 60_000)
    return () => { off(); offUpd(); offPerms(); clearInterval(ping); clearInterval(subPing) }
  }, [])

  const updPending = upd && ['available', 'downloading', 'downloaded'].includes(upd.state)

  if (checking) return <div className="h-full flex items-center justify-center text-slate-400">{t('loading')}</div>
  // forced update before anything else (login blocked until installed)
  if (updPending) return <UpdateGate />
  if (sub?.state === 'expired') return <SubscriptionGate onActivated={refreshSub} />
  if (!user) return <Login onLogin={(u) => { setUser(u); refreshSub() }} />

  const E = (entity: string, titleKey: string, props?: any) => <EntityPage entity={entity} title={t(titleKey)} {...props} />

  return (
    <PermProvider user={user}>
    <HashRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={() => window.api.auth.logout().then(() => setUser(null))} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pppoe" element={E('pppoe_users', 'm_pppoe')} />
          <Route path="/pppoe/active" element={<EntityPage entity="pppoe_users" title={t('m_pppoe_active')} fixedFilters={{ status: 'active' }} />} />
          <Route path="/cashier" element={<CashbookPage />} />
          <Route path="/support-numbers" element={<SupportNumbers />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Areas */}
          <Route path="/areas" element={E('areas', 'areas_all')} />
          <Route path="/zones" element={E('zones', 'areas_zones')} />
          <Route path="/sub-areas" element={E('sub_areas', 'areas_sub')} />
          <Route path="/roads" element={E('roads', 'areas_roads')} />
          <Route path="/areas/customers" element={<CustomersPage titleKey="areas_customers" />} />
          <Route path="/areas/collection" element={<AreasCollection />} />

          {/* Network */}
          <Route path="/network" element={E('network_devices', 'network_devices')} />
          <Route path="/network/faults" element={E('network_faults', 'network_faults')} />

          {/* Customers */}
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/new" element={<CustomersPage mode="new" titleKey="customers_new" />} />
          <Route path="/customers/profile/:id" element={<CustomerProfile />} />
          <Route path="/customers/documents" element={E("customer_documents", "customers_documents")} />
          <Route path="/customers/history" element={<ConnectionsPage mode="history" />} />
          <Route path="/customers/import" element={<ImportExportPage mode="import" />} />
          <Route path="/customers/export" element={<ImportExportPage mode="export" />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/customers/transfer" element={<CustomersOps mode="transfer" />} />
          <Route path="/customers/shift" element={<CustomersOps mode="shift" />} />
          <Route path="/connections/history" element={<ConnectionsPage mode="history" />} />

          {/* Billing */}
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/generate" element={<BillingPage mode="generate" />} />
          <Route path="/billing/history" element={<BillingPage mode="history" />} />
          <Route path="/discounts" element={E('discounts', 'billing_discounts')} />

          {/* Payments */}
          <Route path="/payments/collect" element={<CollectPayment />} />
          <Route path="/payments/renewal" element={<RenewalsPage />} />
          <Route path="/payments" element={<PaymentsHistory />} />
          <Route path="/payments/history" element={<CollectionHistory />} />
          <Route path="/payments/daily" element={<DailyPaymentsPage />} />
          <Route path="/payments/refund" element={<CollectPayment mode="refund" />} />

          {/* Packages */}
          <Route path="/packages" element={E('packages', 'packages_all')} />

          {/* Staff */}
          <Route path="/staff" element={E('staff', 'staff_all')} />
          <Route path="/attendance" element={E('attendance', 'staff_attendance')} />
          <Route path="/leaves" element={E('leaves', 'staff_leaves')} />
          <Route path="/salaries" element={E('salaries', 'staff_salary')} />

          {/* Collectors */}
          <Route path="/collectors" element={E('collectors', 'collectors_all')} />
          <Route path="/collectors/assign" element={<CollectorAssign />} />
          <Route path="/collectors/report" element={<ReportsPage tab="collector" />} />
          <Route path="/deposits" element={E('cash_deposits', 'collectors_deposit')} />

          {/* Resellers */}
          <Route path="/resellers" element={E('resellers', 'resellers_all')} />
          <Route path="/resellers/wallet" element={<ResellerWallet />} />

          {/* Messages */}
          <Route path="/messages" element={<MessagesPages mode="compose" />} />
          <Route path="/messages/reminders" element={<MessagesPages mode="reminders" />} />
          <Route path="/messages/history" element={<MessagesPages mode="history" />} />
          <Route path="/templates" element={E('sms_templates', 'messages_templates')} />

          {/* Complaints */}
          <Route path="/complaints" element={<ComplaintsPage />} />

          {/* Inventory */}
          <Route path="/products" element={E('products', 'inventory_products')} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/suppliers" element={E('suppliers', 'inventory_suppliers')} />

          {/* Accounts */}
          <Route path="/accounts" element={E('accounts', 'accounts_bank')} />
          <Route path="/accounts/cashbook" element={<CashbookPage />} />
          <Route path="/accounts/income" element={<TransactionPages type="income" />} />
          <Route path="/accounts/expense" element={<TransactionPages type="expense" />} />
          <Route path="/expenses/add" element={<TransactionPages type="expense" mode="add" />} />
          <Route path="/expenses" element={<TransactionPages type="expense" />} />
          <Route path="/expense-categories" element={E('expense_categories', 'expenses_categories')} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/accounts/receivables" element={<ReceivablesPage />} />
          <Route path="/accounts/pl" element={<ReportsPage tab="pl" />} />

          {/* Reports / Marketing / Automation / Branches / Security */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/bills" element={<BillReport />} />
          <Route path="/leads" element={E('leads', 'marketing_leads')} />
          <Route path="/followups" element={E('followups', 'marketing_followup')} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/branches" element={E('branches', 'branches_all')} />
          <Route path="/security/users" element={<SecurityPage tab="users" />} />
          <Route path="/security/roles" element={<SecurityPage tab="roles" />} />
          <Route path="/security/logs" element={<SecurityPage tab="logs" />} />
          <Route path="/security/logins" element={<SecurityPage tab="logins" />} />
          <Route path="/security/backup" element={<SecurityPage tab="backup" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/subscription" element={<SubscriptionRenewalPage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
    </PermProvider>
  )
}

function StockPage() {
  return <EntityPage entity="stock_movements" title="Stock In / Out" subtitle="Stock movement ledger" />
}

function ComplaintsPage() {
  return <EntityPage entity="complaints" title="Complaints" subtitle="Manage customer complaints" />
}

function ReceivablesPage() {
  const [rows, setRows] = useState<any[]>([])
  React.useEffect(() => {
    window.api.reports.dueList(thisMonth()).then(setRows).catch(() => {})
  }, [])
  return <EntityPageLikeTable rows={rows} titleKey="accounts_receivables" />
}

function EntityPageLikeTable({ rows, titleKey }: { rows: any[]; titleKey: string }) {
  const { t } = useI18n()
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t(titleKey)}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
            <th className="table-th">{t('customerCode')}</th><th className="table-th">{t('name')}</th>
            <th className="table-th">{t('area')}</th><th className="table-th text-right">{t('due')}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="table-td">{r.code}</td><td className="table-td">{r.name}</td>
                <td className="table-td">{r.area || '-'}</td><td className="table-td text-right">{r.total_due}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </I18nProvider>
  )
}

import React, { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { money, monthStartEnd, thisMonth, exportExcel, pdfExport, prevMonth } from '../lib/format'
import { PageHeader, useToast } from '../components/ui'
import { DataTable, Column } from '../components/DataTable'
import { errMsg } from '../lib/api'

const TABS = ['dueList', 'areaCollection', 'collector', 'reseller', 'package', 'daily', 'pl'] as const
type Tab = typeof TABS[number]

export default function ReportsPage({ tab: initial }: { tab?: string }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>((initial as Tab) || 'dueList')
  const [month, setMonth] = useState(thisMonth())
  const { from, to } = monthStartEnd(month)
  const [data, setData] = useState<any[]>([])
  const [pl, setPl] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setTab((initial as Tab) || 'dueList') }, [initial])

  useEffect(() => {
    setLoading(true)
    const map: Record<Tab, Promise<any>> = {
      dueList: window.api.reports.dueList(month),
      areaCollection: window.api.reports.areaCollection(month),
      collector: window.api.reports.collector(from, to),
      reseller: window.api.reports.reseller(month),
      package: window.api.reports.package(month),
      daily: window.api.payments.daily(from, to),
      pl: window.api.reports.profitLoss(from, to)
    }
    Promise.all([map[tab]]).then(([r]) => {
      if (tab === 'pl') { setPl(r); setData([]) } else { setData(r as any[]) }
    }).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [tab, month])

  const colDefs: Record<Tab, Column[]> = {
    dueList: [
      { key: 'code', label: t('customerCode'), className: 'font-mono text-xs' },
      { key: 'name', label: t('name') },
      { key: 'mobile', label: t('mobile') },
      { key: 'area', label: t('area') },
      { key: 'advance_balance', label: t('advance'), align: 'right', render: (r) => money(r.advance_balance) },
      { key: 'month_due', label: `${t('due')} (${month})`, align: 'right', render: (r) => money(r.month_due) },
      { key: 'total_due', label: t('totalDue'), align: 'right', render: (r) => <b className="text-red-600">{money(r.total_due)}</b> }
    ],
    areaCollection: [
      { key: 'area', label: t('area') },
      { key: 'customers', label: t('customers'), align: 'right' },
      { key: 'billed', label: t('monthlyBilling'), align: 'right', render: (r) => money(r.billed) },
      { key: 'collected', label: t('collection'), align: 'right', render: (r) => <b className="text-emerald-600">{money(r.collected)}</b> },
      { key: 'dueAmt', label: t('due'), align: 'right', render: (r) => money(Math.max(0, r.billed - r.collected)) }
    ],
    collector: [
      { key: 'collector', label: t('collectors_all').replace(/s$/, '') },
      { key: 'target_amount', label: t('target'), align: 'right', render: (r) => money(r.target_amount) },
      { key: 'collected', label: t('collection'), align: 'right', render: (r) => <b>{money(r.collected)}</b> },
      { key: 'payments', label: '#', align: 'right' },
      { key: 'commission_rate', label: '%', align: 'right' },
      { key: 'commission', label: t('commission'), align: 'right', render: (r) => money(r.commission) }
    ],
    reseller: [
      { key: 'name', label: t('name') },
      { key: 'company', label: 'Company' },
      { key: 'customers', label: t('customers'), align: 'right' },
      { key: 'billed', label: t('monthlyBilling'), align: 'right', render: (r) => money(r.billed) },
      { key: 'collected', label: t('collection'), align: 'right', render: (r) => money(r.collected) },
      { key: 'wallet_balance', label: t('walletBalance'), align: 'right', render: (r) => money(r.wallet_balance) }
    ],
    package: [
      { key: 'name', label: t('package') },
      { key: 'type', label: t('type') },
      { key: 'price', label: t('price'), align: 'right', render: (r) => money(r.price) },
      { key: 'customers', label: t('customers'), align: 'right' },
      { key: 'active_customers', label: t('active'), align: 'right' }
    ],
    daily: [
      { key: 'date', label: t('date') },
      { key: 'collected', label: t('collection'), align: 'right', render: (r) => money(r.collected) },
      { key: 'refunded', label: t('payments_refund'), align: 'right', render: (r) => r.refunded ? money(r.refunded) : '-' }
    ],
    pl: []
  }

  return (
    <div>
      <PageHeader
        title={t('reports')}
        actions={
          <>
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-secondary btn-sm" onClick={() => setMonth(prevMonth(month))}>← {t('billing_previous')}</button>
          </>
        }
      />
      <div className="flex gap-1 mb-4 flex-wrap">
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${tab === tb ? 'bg-brand-600 text-white' : 'card hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {tb === 'dueList' ? t('dueListReport')
              : tb === 'areaCollection' ? t('areaWiseCollection')
              : tb === 'collector' ? t('collectorReport')
              : tb === 'reseller' ? t('reports_reseller')
              : tb === 'package' ? t('reports_package')
              : tb === 'daily' ? t('reports_dailyCollection')
              : t('profitLoss')}
          </button>
        ))}
      </div>

      {tab === 'pl' && pl && <PLView pl={pl} month={month} />}
      {tab !== 'pl' && (
        <DataTable columns={colDefs[tab]} rows={data} loading={loading} exportName={`report-${tab}-${month}`} />
      )}
    </div>
  )
}

function PLView({ pl, month }: { pl: any; month: string }) {
  const { t, lang } = useI18n()
  const Row = ({ label, value, bold, color }: any) => (
    <div className={`flex justify-between py-2 px-3 border-b border-slate-100 dark:border-slate-800 ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span><span className={color || ''}>{value}</span>
    </div>
  )
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card overflow-hidden">
        <h3 className="px-4 pt-3 font-semibold text-sm">{t('profitLoss')} — {month}</h3>
        <div className="mt-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-700">{t('income')}</div>
          <Row label={t('collection')} value={'৳ ' + money(pl.collections)} />
          {pl.incomeBreakdown.filter((r: any) => r.category).map((r: any) => (
            <Row key={r.category} label={r.category + ' (' + t('otherIncome') + ')'} value={'৳ ' + money(r.amount)} />
          ))}
          <Row label={t('total')} value={'৳ ' + money(pl.totalIncome)} bold color="text-emerald-600" />
        </div>
        <div>
          <div className="bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-700">{t('expense')}</div>
          {pl.expenseBreakdown.map((r: any) => (
            <Row key={r.category || 'other'} label={r.category || t('other')} value={'৳ ' + money(r.amount)} />
          ))}
          <Row label={t('total')} value={'৳ ' + money(pl.totalExpenses)} bold color="text-red-600" />
        </div>
        <div className="px-3 py-3 bg-slate-50 dark:bg-slate-800/50 flex justify-between font-bold text-lg">
          <span>{t('netProfit')}</span>
          <span className={pl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>৳ {money(pl.netProfit)}</span>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3">{t('balanceSheet')}</h3>
        <BalanceSheet />
      </div>
    </div>
  )
}

function BalanceSheet() {
  const { t } = useI18n()
  const [bs, setBs] = useState<any>(null)
  useEffect(() => { window.api.reports.balanceSheet().then(setBs).catch(() => {}) }, [])
  if (!bs) return null
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr className="bg-blue-50 dark:bg-blue-900/20"><td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-blue-700">{t('accounts_balance')} — Assets</td></tr>
        <tr><td className="table-td">{t('cash')} / {t('bank')}</td><td className="table-td text-right">{money(bs.assets.cash)}</td></tr>
        <tr><td className="table-td">{t('accounts_receivables')}</td><td className="table-td text-right">{money(bs.assets.receivables)}</td></tr>
        <tr><td className="table-td">{t('inventory_products')}</td><td className="table-td text-right">{money(bs.assets.inventory)}</td></tr>
        <tr className="bg-red-50 dark:bg-red-900/20"><td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-red-700">Liabilities</td></tr>
        <tr><td className="table-td">{t('accounts_payables')}</td><td className="table-td text-right">{money(bs.liabilities.supplierPayable)}</td></tr>
        <tr><td className="table-td">{t('advance')} ({t('customers')})</td><td className="table-td text-right">{money(bs.liabilities.customerAdvances)}</td></tr>
        <tr className="border-t-2 border-slate-200 font-bold"><td className="table-td">Equity</td><td className="table-td text-right">{money(bs.equity)}</td></tr>
      </tbody>
    </table>
  )
}

// standalone area collection page
export function AreasCollection() {
  const { t } = useI18n()
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<any[]>([])
  useEffect(() => { window.api.reports.areaCollection(month).then(setData).catch(() => {}) }, [month])
  return (
    <div>
      <PageHeader title={t('areaWiseCollection')}
        actions={<input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />} />
      <DataTable columns={[
        { key: 'area', label: t('area') },
        { key: 'customers', label: t('customers'), align: 'right' },
        { key: 'billed', label: t('monthlyBilling'), align: 'right', render: (r) => money(r.billed) },
        { key: 'collected', label: t('collection'), align: 'right', render: (r) => <b className="text-emerald-600">{money(r.collected)}</b> },
        { key: 'dueAmt', label: t('due'), align: 'right', render: (r) => money(Math.max(0, r.billed - r.collected)) }
      ]} rows={data} exportName={`area-collection-${month}`} />
    </div>
  )
}

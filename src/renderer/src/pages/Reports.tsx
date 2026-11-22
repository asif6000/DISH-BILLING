import React, { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { money, monthStartEnd, thisMonth, exportExcel, pdfExport, prevMonth, dateFmt } from '../lib/format'
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
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  // customer-wise due balance (always loaded for the printable section)
  const [dueData, setDueData] = useState<any[]>([])
  useEffect(() => { window.api.reports.dueList(month).then(setDueData).catch(() => setDueData([])) }, [month])

  useEffect(() => { setTab((initial as Tab) || 'dueList') }, [initial])

  useEffect(() => { window.api.settings.getAll().then(setCompany).catch(() => {}) }, [])

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

  const tabTitle = tab === 'dueList' ? t('dueListReport')
    : tab === 'areaCollection' ? t('areaWiseCollection')
    : tab === 'collector' ? t('collectorReport')
    : tab === 'reseller' ? t('reports_reseller')
    : tab === 'package' ? t('reports_package')
    : tab === 'daily' ? t('reports_dailyCollection')
    : t('profitLoss')

  // top 3 collectors by collected amount (only for the collector tab)
  const top3 = tab === 'collector'
    ? [...data].sort((a, b) => (b.collected || 0) - (a.collected || 0)).filter((r) => (r.collected || 0) > 0).slice(0, 3)
    : []

  return (
    <div>
      {/* A4 printable document (visible only during print) */}
      <div className="print-area">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          {company?.company_logo && <img src={company.company_logo} alt="logo" style={{ height: 40, objectFit: 'contain' }} />}
          <div style={{ fontSize: 18, fontWeight: 700 }}>{company?.company_name || company?.company_name_bn || 'AVA Cable Management'}</div>
          {company?.company_address && <div style={{ fontSize: 11 }}>{company.company_address}</div>}
          {company?.company_mobile && <div style={{ fontSize: 11 }}>{company.company_mobile}{company?.company_mobile_alt ? ` / ${company.company_mobile_alt}` : ''}</div>}
          {company?.company_email && <div style={{ fontSize: 11 }}>{company.company_email}</div>}
        </div>
        <div style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', padding: '6px 0', marginBottom: 10, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
          {tabTitle} — {month}
        </div>
        {top3.length > 0 && (
          <table style={{ marginBottom: 12 }}>
            <thead>
              <tr><th style={{ width: 60 }}>Rank</th><th>{t('collectors_all').replace(/s$/, '')}</th><th style={{ textAlign: 'right' }}>{t('collection')}</th><th style={{ textAlign: 'right' }}>#</th></tr>
            </thead>
            <tbody>
              {top3.map((r, i) => (
                <tr key={i}><td style={{ fontWeight: 700 }}>{i + 1}</td><td>{r.collector}</td><td style={{ textAlign: 'right' }}>{money(r.collected)}</td><td style={{ textAlign: 'right' }}>{r.payments}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'pl' && pl ? (
          <table>
            <tbody>
              <tr><th>{t('income')}</th><th></th></tr>
              <tr><td>{t('collection')}</td><td>{money(pl.collections)}</td></tr>
              {pl.incomeBreakdown.filter((r: any) => r.category).map((r: any, i: number) => <tr key={i}><td>{r.category}</td><td>{money(r.amount)}</td></tr>)}
              <tr><td style={{ fontWeight: 700 }}>{t('total')}</td><td style={{ fontWeight: 700 }}>{money(pl.totalIncome)}</td></tr>
              <tr><th>{t('expense')}</th><th></th></tr>
              {pl.expenseBreakdown.map((r: any, i: number) => <tr key={i}><td>{r.category || t('other')}</td><td>{money(r.amount)}</td></tr>)}
              <tr><td style={{ fontWeight: 700 }}>{t('total')}</td><td style={{ fontWeight: 700 }}>{money(pl.totalExpenses)}</td></tr>
              <tr><td style={{ fontWeight: 700 }}>{t('netProfit')}</td><td style={{ fontWeight: 700 }}>{money(pl.netProfit)}</td></tr>
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr>{colDefs[tab].map((c) => <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.label}</th>)}</tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>{colDefs[tab].map((c) => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{String(typeof c.render === 'function' ? c.render(r) : r[c.key] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
        {dueData.length > 0 && tab !== 'dueList' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t('customerDueBalance')}</div>
            <table>
              <thead><tr><th>{t('customerCode')}</th><th>{t('name')}</th><th>{t('area')}</th><th style={{ textAlign: 'right' }}>{t('due')} ({month})</th><th style={{ textAlign: 'right' }}>{t('totalDue')}</th></tr></thead>
              <tbody>
                {dueData.map((r: any, i: number) => (
                  <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.area || '-'}</td><td style={{ textAlign: 'right' }}>{money(r.month_due)}</td><td style={{ textAlign: 'right' }}>{money(r.total_due)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>{t('date')}: {dateFmt(new Date().toISOString().slice(0, 10))}</span>
          <span style={{ textAlign: 'center' }}>................................<br />{t('signature')}</span>
        </div>
      </div>

      <div className="no-print">
      <PageHeader
        title={t('reports')}
        actions={
          <>
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-secondary btn-sm" onClick={() => setMonth(prevMonth(month))}>← {t('billing_previous')}</button>
            <button className="btn-primary btn-sm" onClick={() => window.print()} title="Print A4"><Printer size={14} /> {t('print')} A4</button>
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

      {tab === 'collector' && top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {top3.map((r, i) => (
            <div key={i} className={`card p-4 flex items-center gap-3 ${i === 0 ? 'ring-2 ring-amber-400' : ''}`}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl font-extrabold text-white shrink-0 ${
                i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' : i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' : 'bg-gradient-to-br from-orange-300 to-orange-500'}`}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{i === 0 ? '🥇 Top' : i === 1 ? '🥈 2nd' : '🥉 3rd'}</div>
                <div className="font-bold truncate">{r.collector}</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold">৳ {money(r.collected)}</div>
                <div className="text-[11px] text-slate-400">{r.payments} {t('payment').toLowerCase()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pl' && pl && <PLView pl={pl} month={month} />}
      {tab !== 'pl' && (
        <DataTable columns={colDefs[tab]} rows={data} loading={loading} exportName={`report-${tab}-${month}`} />
      )}
      </div>
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
  const [company, setCompany] = useState<any>(null)
  useEffect(() => { window.api.reports.areaCollection(month).then(setData).catch(() => {}) }, [month])
  useEffect(() => { window.api.settings.getAll().then(setCompany).catch(() => {}) }, [])
  const cols = [
    { key: 'area', label: t('area') },
    { key: 'customers', label: t('customers'), align: 'right' as const },
    { key: 'billed', label: t('monthlyBilling'), align: 'right' as const },
    { key: 'collected', label: t('collection'), align: 'right' as const },
    { key: 'dueAmt', label: t('due'), align: 'right' as const }
  ]
  const total = { customers: data.reduce((s, r) => s + (r.customers || 0), 0), billed: data.reduce((s, r) => s + (r.billed || 0), 0), collected: data.reduce((s, r) => s + (r.collected || 0), 0) }
  return (
    <div>
      {/* A4 printable document (visible only during print) */}
      <div className="print-area">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          {company?.company_logo && <img src={company.company_logo} alt="logo" style={{ height: 40, objectFit: 'contain' }} />}
          <div style={{ fontSize: 18, fontWeight: 700 }}>{company?.company_name || company?.company_name_bn || 'AVA Cable Management'}</div>
          {company?.company_address && <div style={{ fontSize: 11 }}>{company.company_address}</div>}
          {company?.company_mobile && <div style={{ fontSize: 11 }}>{company.company_mobile}{company?.company_mobile_alt ? ` / ${company.company_mobile_alt}` : ''}</div>}
          {company?.company_email && <div style={{ fontSize: 11 }}>{company.company_email}</div>}
        </div>
        <div style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', padding: '6px 0', marginBottom: 10, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
          {t('areaWiseCollection')} — {month}
        </div>
        <table>
          <thead><tr>{cols.map((c) => <th key={c.key} style={{ textAlign: c.align }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.key === 'dueAmt' ? money(Math.max(0, r.billed - r.collected)) : c.key === 'billed' || c.key === 'collected' ? money(r[c.key]) : r[c.key]}</td>)}</tr>
            ))}
            <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
              <td>{t('total')}</td><td style={{ textAlign: 'right' }}>{total.customers}</td>
              <td style={{ textAlign: 'right' }}>{money(total.billed)}</td><td style={{ textAlign: 'right' }}>{money(total.collected)}</td>
              <td style={{ textAlign: 'right' }}>{money(Math.max(0, total.billed - total.collected))}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>{t('date')}: {dateFmt(new Date().toISOString().slice(0, 10))}</span>
          <span style={{ textAlign: 'center' }}>................................<br />{t('signature')}</span>
        </div>
      </div>

      <div className="no-print">
      <PageHeader title={t('areaWiseCollection')}
        actions={
          <>
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-primary btn-sm" onClick={() => window.print()} title="Print A4"><Printer size={14} /> {t('print')} A4</button>
          </>
        } />
      <DataTable columns={cols} rows={data} exportName={`area-collection-${month}`} />
      </div>
    </div>
  )
}

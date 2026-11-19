import React, { useEffect, useState } from 'react'
import {
  Users, UserCheck, UserX, AlertCircle, Clock, Gift, UserPlus, DollarSign,
  Receipt, Banknote, TrendingUp, Wallet, ArrowRight
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { useI18n, monthLabel } from '../lib/i18n'
import { money, dateFmt, thisMonth, prevMonth } from '../lib/format'
import { StatusBadge, PageHeader } from '../components/ui'
import { errMsg } from '../lib/api'

const CARD_STYLES = [
  'bg-blue-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500', 'bg-red-500',
  'bg-slate-500', 'bg-fuchsia-500', 'bg-indigo-500', 'bg-cyan-600',
  'bg-violet-500', 'bg-green-600', 'bg-orange-500', 'bg-rose-500', 'bg-lime-600'
]

export default function Dashboard() {
  const { t, lang } = useI18n()
  const [month, setMonth] = useState(thisMonth())
  const [stats, setStats] = useState<any>(null)
  const [daily, setDaily] = useState<any[]>([])
  const [revenue, setRevenue] = useState<any[]>([])
  const [growth, setGrowth] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [recent, setRecent] = useState<any>(null)
  const nav = useNavigate()

  useEffect(() => {
    window.api.dashboard.stats(month).then(setStats).catch((e) => console.error(errMsg(e)))
    window.api.dashboard.dailyCollection(month).then(setDaily).catch(() => {})
    window.api.dashboard.areaStats(month).then(setAreas).catch(() => {})
  }, [month])

  useEffect(() => {
    window.api.dashboard.monthlyRevenue().then(setRevenue).catch(() => {})
    window.api.dashboard.customerGrowth().then(setGrowth).catch(() => {})
    window.api.dashboard.recent().then(setRecent).catch(() => {})
  }, [])

  if (!stats) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>

  const cards = [
    { icon: Users, label: t('totalCustomers'), value: stats.totalCustomers, to: '/customers' },
    { icon: UserCheck, label: t('activeCustomers'), value: stats.activeCustomers, to: '/customers?status=active' },
    { icon: DollarSign, label: t('paidCustomers'), value: stats.paidCustomers, to: '/customers?status=paid' },
    { icon: AlertCircle, label: t('dueCustomers'), value: stats.dueCustomers, to: '/customers?status=due' },
    { icon: Clock, label: t('expiredCustomers'), value: stats.expiredCustomers, to: '/customers?status=expired' },
    { icon: UserX, label: t('inactiveCustomers'), value: stats.inactiveCustomers, to: '/customers?status=inactive' },
    { icon: Gift, label: t('freeCustomers'), value: stats.freeCustomers, to: '/customers?status=free' },
    { icon: UserPlus, label: t('newCustomers'), value: stats.newCustomers, to: '/customers?status=active' },
    { icon: Receipt, label: t('connectionFees'), value: money(stats.connectionFees), to: '/payments?type=connection_fee' },
    { icon: Wallet, label: t('monthlyBilling'), value: money(stats.totalBilled), to: '/billing' },
    { icon: Banknote, label: t('totalCollection'), value: money(stats.totalCollection), to: '/payments' },
    { icon: AlertCircle, label: t('totalDue'), value: money(stats.totalDue), to: '/reports' },
    { icon: TrendingUp, label: t('totalExpenses'), value: money(stats.totalExpenses), to: '/accounts/expense' },
    { icon: TrendingUp, label: t('netProfit'), value: money(stats.netProfit), to: '/reports' }
  ]

  return (
    <div>
      <PageHeader
        title={t('dashboard')}
        subtitle={`${monthLabel(month, lang)}`}
        actions={
          <div className="flex gap-2">
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-secondary btn-sm" onClick={() => setMonth(prevMonth(month))}>{'←'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setMonth(thisMonth())}>{t('billing_current')}</button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        {cards.map((c, i) => (
          <button key={i} onClick={() => nav(c.to)}
            className={`${CARD_STYLES[i % CARD_STYLES.length]} text-white rounded-xl p-3.5 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all`}>
            <div className="flex items-center justify-between">
              <c.icon size={20} className="opacity-80" />
            </div>
            <div className="text-xl font-bold mt-2 truncate" title={String(c.value)}>{c.value}</div>
            <div className="text-[11px] opacity-90 mt-0.5 leading-tight">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">{t('dailyCollection')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={daily.map((d) => ({ ...d, label: lang === 'bn' ? Number(d.day) : Number(d.day) }))}>
              <defs><linearGradient id="dc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: any) => '৳ ' + money(v)} labelFormatter={(l) => `${month}-${String(l).padStart(2, '0')}`} />
              <Area type="monotone" dataKey="amount" name={t('collection')} stroke="#6366f1" fill="url(#dc)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">{t('monthlyRevenue')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenue.map((r) => ({ ...r, label: r.month.slice(5) + '/' + r.month.slice(2, 4) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: any) => '৳ ' + money(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="billed" name={t('monthlyBilling')} fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collection" name={t('collection')} fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">{t('customerGrowth')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growth.map((g: any) => ({ ...g, label: g.month.slice(5) + '/' + g.month.slice(2, 4) }))}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="new_count" name={t('newCustomers')} stroke="#10b981" fill="url(#cg)" strokeWidth={2} />
              <Area type="monotone" dataKey="total" name={t('totalCustomers')} stroke="#6366f1" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">{t('areaWiseStats')}</h3>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left py-1.5">{t('area')}</th>
                  <th className="text-right py-1.5">{t('customers')}</th>
                  <th className="text-right py-1.5">{t('collection')}</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.area} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-1.5">{a.area}</td>
                    <td className="py-1.5 text-right">{a.customers}</td>
                    <td className="py-1.5 text-right font-medium text-emerald-600 dark:text-emerald-400">{money(a.collection)}</td>
                  </tr>
                ))}
                {!areas.length && <tr><td colSpan={3} className="py-6 text-center text-slate-400">{t('noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t('recentPayments')}</h3>
            <Link to="/payments" className="text-xs text-brand-600 flex items-center gap-1">{t('view')} <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2">
            {(recent?.payments || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.customer_name}</div>
                  <div className="text-[11px] text-slate-400">{p.receipt_no} · {dateFmt(p.payment_date)} · {p.method}</div>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap ml-2">৳ {money(p.amount)}</span>
              </div>
            ))}
            {!(recent?.payments || []).length && <p className="text-sm text-slate-400 py-4 text-center">{t('noData')}</p>}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t('recentCustomers')}</h3>
            <Link to="/customers" className="text-xs text-brand-600 flex items-center gap-1">{t('view')} <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2">
            {(recent?.customers || []).map((c: any) => (
              <Link key={c.id} to={`/customers/profile/${c.id}`} className="flex items-center justify-between text-sm border-b border-slate-50 dark:border-slate-800/50 pb-1.5 hover:text-brand-600">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-[11px] text-slate-400">{c.code} · {dateFmt(c.connection_date)}</div>
                </div>
                <StatusBadge value={c.status} label={t(c.status) !== c.status ? t(c.status) : c.status} />
              </Link>
            ))}
            {!(recent?.customers || []).length && <p className="text-sm text-slate-400 py-4 text-center">{t('noData')}</p>}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t('pendingComplaints')} <span className="badge bg-red-100 text-red-600 ml-1">{recent?.pendingComplaints || 0}</span></h3>
            <Link to="/complaints?status=pending" className="text-xs text-brand-600 flex items-center gap-1">{t('view')} <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2">
            {(recent?.complaints || []).map((c: any) => (
              <div key={c.id} className="text-sm border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{c.customer_name}</span>
                  <StatusBadge value={c.status} label={t(c.status)} />
                </div>
                <div className="text-[11px] text-slate-400 truncate">{t(c.type) !== c.type ? t(c.type) : c.type} · {dateFmt(c.created_at)}</div>
              </div>
            ))}
            {!(recent?.complaints || []).length && <p className="text-sm text-slate-400 py-4 text-center">{t('noData')}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

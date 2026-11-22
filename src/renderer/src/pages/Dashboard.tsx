import React, { useEffect, useState } from 'react'
import {
  Users, UserCheck, UserX, AlertCircle, Clock, Gift, UserPlus, DollarSign,
  Receipt, Banknote, TrendingUp, Wallet, ArrowRight
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { useI18n, monthLabel } from '../lib/i18n'
import { money, dateFmt, thisMonth, prevMonth } from '../lib/format'
import { StatusBadge, PageHeader } from '../components/ui'
import { errMsg } from '../lib/api'

// icon chip accents for the stat cards (cycled)
const ACCENTS = [
  'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
  'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400',
  'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
  'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
  'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
  'bg-lime-100 text-lime-600 dark:bg-lime-500/20 dark:text-lime-400'
]

// re-render charts when the app toggles light/dark
function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const ob = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => ob.disconnect()
  }, [])
  return dark
}

export default function Dashboard() {
  const { t, lang } = useI18n()
  const isDark = useIsDark()
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

  const grid = isDark ? '#334155' : '#e2e8f0'
  const tick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 10, fontSize: 12, color: isDark ? '#e2e8f0' : '#0f172a'
  }

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

  // customer status donut
  const donut = [
    { name: t('activeCustomers'), value: Number(stats.activeCustomers) || 0, color: '#10b981' },
    { name: t('dueCustomers'), value: Number(stats.dueCustomers) || 0, color: '#ef4444' },
    { name: t('expiredCustomers'), value: Number(stats.expiredCustomers) || 0, color: '#f59e0b' },
    { name: t('inactiveCustomers'), value: Number(stats.inactiveCustomers) || 0, color: '#94a3b8' },
    { name: t('freeCustomers'), value: Number(stats.freeCustomers) || 0, color: '#8b5cf6' }
  ].filter((d) => d.value > 0)
  const totalCustomers = donut.reduce((s, d) => s + d.value, 0)

  const CardTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full bg-brand-500 inline-block" />{children}
    </h3>
  )

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

      {/* KPI: total due balance */}
      <button onClick={() => nav('/customers?status=due')}
        className="w-full mb-5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white p-5 text-left shadow-lg shadow-red-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/70">{t('totalDueBalance')}</div>
            <div className="text-4xl font-extrabold mt-1">৳ {money(stats.totalDue)}</div>
            <div className="text-xs text-white/70 mt-1">{t('dueCustomers')}: <b>{stats.dueCustomers}</b> · {t('totalBilled')}: ৳{money(stats.totalBilled)} · {t('totalCollection')}: ৳{money(stats.totalCollection)}</div>
          </div>
          <div className="text-2xl opacity-80">→</div>
        </div>
      </button>

      {/* Stat cards — clean SaaS style */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        {cards.map((c, i) => (
          <button key={i} onClick={() => nav(c.to)}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ACCENTS[i % ACCENTS.length]} transition-transform group-hover:scale-110`}>
              <c.icon size={18} />
            </div>
            <div className="text-xl font-bold mt-2.5 truncate text-slate-800 dark:text-slate-100" title={String(c.value)}>{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <CardTitle>{t('dailyCollection')}</CardTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={daily}>
              <defs><linearGradient id="dc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="day" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} width={60} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => '৳ ' + money(v)} labelFormatter={(l) => `${month}-${String(l).padStart(2, '0')}`} />
              <Area type="monotone" dataKey="amount" name={t('collection')} stroke="#6366f1" fill="url(#dc)" strokeWidth={2.5} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <CardTitle>{t('monthlyRevenue')}</CardTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenue.map((r) => ({ ...r, label: r.month.slice(5) + '/' + r.month.slice(2, 4) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={tick} width={60} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => '৳ ' + money(v)} cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="billed" name={t('monthlyBilling')} fill={isDark ? '#475569' : '#cbd5e1'} radius={[5, 5, 0, 0]} />
              <Bar dataKey="collection" name={t('collection')} fill="#10b981" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <CardTitle>{t('customerGrowth')}</CardTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growth.map((g: any) => ({ ...g, label: g.month.slice(5) + '/' + g.month.slice(2, 4) }))}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={tick} width={50} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="new_count" name={t('newCustomers')} stroke="#10b981" fill="url(#cg)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="total" name={t('totalCustomers')} stroke="#6366f1" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* customer status donut */}
        <div className="card p-4">
          <CardTitle>{t('totalCustomers')}</CardTitle>
          {totalCustomers > 0 ? (
            <div className="flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={280} height={230}>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3} strokeWidth={0}>
                      {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => v + ' ' + t('customer')} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 38 }}>
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{totalCustomers}</div>
                    <div className="text-[10px] text-slate-400">{t('totalCustomers')}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-slate-400 py-16 text-center">{t('noData')}</p>}
        </div>
        {/* area-wise — horizontal bar chart */}
        <div className="card p-4 xl:col-span-2">
          <CardTitle>{t('areaWiseStats')}</CardTitle>
          {areas.length ? (
            <ResponsiveContainer width="100%" height={Math.max(200, areas.length * 34)}>
              <BarChart data={areas} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" tick={tick} width={110} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => n === 'collection' ? '৳ ' + money(v) : v} cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.1)' }} />
                <Bar dataKey="collection" name={t('collection')} fill="#10b981" radius={[0, 6, 6, 0]} barSize={16} />
                <Bar dataKey="customers" name={t('customers')} fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 py-10 text-center">{t('noData')}</p>}
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

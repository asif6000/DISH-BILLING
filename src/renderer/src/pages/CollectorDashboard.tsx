import React, { useEffect, useState } from 'react'
import {
  Banknote, Building, CalendarDays, Wallet, Smartphone, Landmark,
  Users, AlertCircle, Target, Gauge, ArrowRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n, monthLabel } from '../lib/i18n'
import { money, dateFmt, thisMonth, prevMonth } from '../lib/format'
import { PageHeader } from '../components/ui'
import { errMsg } from '../lib/api'
import { useUser } from '../lib/perms'

// same icon-chip accents as the admin dashboard (design preserved)
const ACCENTS = [
  'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
  'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400',
  'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
  'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
  'bg-lime-100 text-lime-600 dark:bg-lime-500/20 dark:text-lime-400'
]

// KPI card definitions (key → icon/label) — keys mirror the permission catalog
const CARDS: Record<string, { icon: any; en: string; bn: string }> = {
  kpi_today: { icon: CalendarDays, en: "Today's Collection", bn: 'আজকের কালেকশন' },
  kpi_month: { icon: Wallet, en: "This Month's Collection", bn: 'এই মাসের কালেকশন' },
  kpi_total: { icon: Banknote, en: 'Total Collection', bn: 'সর্বমোট কালেকশন' },
  kpi_cash: { icon: Banknote, en: 'Cash Collection', bn: 'নগদ কালেকশন' },
  kpi_bkash: { icon: Smartphone, en: 'bKash Collection', bn: 'বিকাশ কালেকশন' },
  kpi_nagad: { icon: Smartphone, en: 'Nagad Collection', bn: 'নগদ (ন্যাগাদ) কালেকশন' },
  kpi_rocket: { icon: Smartphone, en: 'Rocket Collection', bn: 'রকেট কালেকশন' },
  kpi_bank: { icon: Landmark, en: 'Bank Collection', bn: 'ব্যাংক কালেকশন' },
  kpi_customers: { icon: Users, en: 'Assigned Customers', bn: 'অ্যাসাইন করা গ্রাহক' },
  kpi_due: { icon: AlertCircle, en: 'Due in My Areas', bn: 'আমার এরিয়ার বকেয়া' },
  kpi_target: { icon: Target, en: 'Collection Target', bn: 'কালেকশন টার্গেট' },
  kpi_performance: { icon: Gauge, en: 'Performance', bn: 'পারফরম্যান্স' }
}

const METHOD_PREFIX = ['kpi_cash', 'kpi_bkash', 'kpi_nagad', 'kpi_rocket', 'kpi_bank']

export default function CollectorDashboard() {
  const { t, lang } = useI18n()
  const user = useUser()
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // re-fetch when live permission updates arrive (admin changed KPI access)
  const permSig = JSON.stringify(user?.permissions || [])

  useEffect(() => {
    // admin saved KPI overrides → backend pushes permissions:updated → refetch now
    const off = window.api.auth.onPermissionsUpdated(() => {
      window.api.dashboard.collectorStats(month).then((r) => setData(r)).catch(() => {})
    })
    return () => { try { off && (off as any)() } catch { /* noop */ } }
  }, [month])

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    window.api.dashboard.collectorStats(month)
      .then((r: any) => { if (alive) setData(r) })
      .catch((e) => { if (alive) { setError(errMsg(e)); setData(null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [month, permSig])

  const Building_ = Building
  if (loading) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>

  if (error) {
    return (
      <div>
        <PageHeader title={t('dashboard')} subtitle={monthLabel(month, lang)} />
        <div className="card p-8 text-center max-w-lg mx-auto mt-6">
          <Building size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-red-500">{error}</p>
          {error.includes('NO_COLLECTOR_PROFILE') && (
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>{lang === 'bn' ? 'আপনার অ্যাকাউন্টের Full Name:' : 'This account\'s Full Name:'} <b className="font-mono text-slate-700 dark:text-slate-200">{user?.fullName || '—'}</b></p>
              <p>{lang === 'bn'
                ? 'সমাধান: Security → Users-এ এই অ্যাকাউন্ট এডিট করে "Collector প্রোফাইল লিংক" সিলেক্ট করে সেভ করুন — অথবা Staff/Collector পেজে এই নামের (Full Name) একজন সক্রিয় কালেক্টর তৈরি করুন।'
                : 'Fix: edit this account in Security → Users and pick a "Linked collector profile" — or create an active Collector whose Staff name matches this Full Name.'}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const cards = data?.cards || []
  const stats = data?.stats || {}

  const cardValue = (key: string): React.ReactNode => {
    if (key === 'kpi_performance') {
      const pct = stats.performance || 0
      return (
        <div>
          <div className="text-xl font-bold mt-2.5 text-slate-800 dark:text-slate-100">{pct}%</div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      )
    }
    if (key === 'kpi_customers' || key === 'kpi_target') return stats[key === 'kpi_customers' ? 'customers' : 'target']
    if (METHOD_PREFIX.includes(key)) return money(stats[key.replace('kpi_', '')])
    if (key === 'kpi_due') return '৳ ' + money(stats.due)
    return '৳ ' + money(stats[key.replace('kpi_', '')])
  }

  return (
    <div>
      <PageHeader
        title={t('dashboard')}
        subtitle={`${data?.collector?.label || ''} · ${monthLabel(month, lang)}`}
        actions={
          <div className="flex gap-2">
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn-secondary btn-sm" onClick={() => setMonth(prevMonth(month))}>{'←'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setMonth(thisMonth())}>{t('billing_current')}</button>
          </div>
        }
      />

      {!cards.length ? (
        <div className="card p-10 text-center mt-2">
          <Building size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium">{lang === 'bn' ? 'আপনার জন্য কোনো ড্যাশবোর্ড কার্ড অনুমোদিত নয়' : 'No dashboard cards are authorized for your account'}</p>
          <p className="text-xs text-slate-400 mt-1">{lang === 'bn' ? 'কোন কার্ড দেখানো হবে তা অ্যাডমিন নির্ধারণ করেন — অ্যাডমিনের সাথে যোগাযোগ করুন' : 'An administrator decides which cards you can see — contact your administrator'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
          {cards.map((key: string, i: number) => {
            const def = CARDS[key]
            if (!def) return null
            const Icon = def.icon
            return (
              <div key={key}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ACCENTS[i % ACCENTS.length]}`}>
                  <Icon size={18} />
                </div>
                {cardValue(key)}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{lang === 'bn' ? def.bn : def.en}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* my collection history — collector-scoped, only when authorized */}
      {cards.includes('kpi_history') && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{lang === 'bn' ? 'আমার সাম্প্রতিক কালেকশন' : 'My Recent Collections'}</h3>
            <Link to="/payments/history" className="text-xs text-brand-600 flex items-center gap-1">{t('view')} <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2">
            {(stats.history || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-50 dark:border-slate-800/50 pb-1.5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.customer_name} <span className="font-mono text-[10px] text-slate-400">{p.customer_code}</span></div>
                  <div className="text-[11px] text-slate-400">{p.receipt_no} · {dateFmt(p.payment_date)} · {p.method}</div>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap ml-2">৳ {money(p.amount)}</span>
              </div>
            ))}
            {!(stats.history || []).length && (
              <p className="text-sm text-slate-400 py-4 text-center">
                {lang === 'bn' ? 'এখনো কোনো কালেকশন নেই — Payment Collection পেজ থেকে কালেকশন নিন' : 'No collections yet — collect payments from the Payment Collection page'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { ShieldCheck, Phone, Copy, KeyRound, CheckCircle2, Send, AlertTriangle } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast } from '../components/ui'
import { errMsg } from '../lib/api'

// App's own yearly subscription (৳10,000) — renew anytime via bKash/Nagad.
// Renewing early never loses days: approval extends from the current expiry.
export default function SubscriptionRenewalPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [s, setS] = useState<any>(null)
  const [company, setCompany] = useState('')
  const [mobile, setMobile] = useState('')
  const [method, setMethod] = useState('bkash')
  const [trxId, setTrxId] = useState('')
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = () => window.api.subscription.status().then(setS).catch(() => {})
  useEffect(() => { load() }, [])

  // live countdown (updates every second)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // check Supabase every 60s so an approved payment activates even without sending from here
  useEffect(() => {
    const id = window.setInterval(() => { window.api.subscription.checkRemote().then((st: any) => setS(st)).catch(() => {}) }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  // after sending a renewal request: poll Supabase every 60s until approved
  useEffect(() => {
    if (!sent) return
    const id = window.setInterval(async () => {
      const st: any = await window.api.subscription.checkRemote().catch(() => null)
      if (st) {
        setS(st)
        if (st.state === 'active') { toast.push('success', t('subActivated') + ' — ' + st.expire); load() }
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [sent])

  const copy = (n: string) => { navigator.clipboard?.writeText(n); toast.push('success', t('subCopied')) }

  const sendRequest = async () => {
    if (!mobile.trim() || !trxId.trim()) return
    setBusy(true); setSendErr('')
    try {
      await window.api.subscription.sendRequest({ mobile, method, trxId, companyName: company })
      setSent(true)
      setTrxId('')
    } catch (e) {
      const m = errMsg(e)
      setSendErr(m.includes('SUPABASE_NOT_CONFIGURED') || m.includes('Failed to fetch') || m.includes('net::')
        ? t('subOffline') : m)
    } finally { setBusy(false) }
  }

  const activate = async () => {
    if (!code.trim()) return
    setBusy(true); setErr('')
    try {
      const r: any = await window.api.subscription.activate(code)
      toast.push('success', t('subActivated') + ' — ' + r.expire)
      setCode('')
      load()
    } catch (e) {
      const m = errMsg(e)
      setErr(m.includes('INVALID_CODE') ? t('subInvalidCode') : m)
    } finally { setBusy(false) }
  }

  if (!s) return <div className="text-slate-400">{t('loading')}</div>

  const msLeft = s.expire ? new Date(s.expire + 'T23:59:59').getTime() - now : 0
  const cd = msLeft > 0 ? {
    d: Math.floor(msLeft / 86_400_000),
    h: Math.floor((msLeft % 86_400_000) / 3_600_000),
    m: Math.floor((msLeft % 3_600_000) / 60_000),
    s: Math.floor((msLeft % 60_000) / 1000)
  } : null
  const badgeCls = s.state === 'expiring' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : s.state === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'

  const payNum = (label: string, num: string) => (
    <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <Phone size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
          <div className="font-mono font-bold text-lg">{num}</div>
        </div>
      </div>
      <button className="btn-secondary btn-sm shrink-0" onClick={() => copy(num)} title={t('subCopy')}>
        <Copy size={14} />
      </button>
    </div>
  )

  return (
    <div>
      <PageHeader title={t('nav_subscription')} />

      {/* current status */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`badge ${badgeCls} flex items-center gap-1`}>
            <ShieldCheck size={13} />
            {s.state === 'expired' ? t('expired') : s.state === 'expiring' ? t('subExpiring') : t('active')}
          </span>
          <span className="text-slate-500">{t('subActiveUntil')} <b className="font-mono">{s.expire}</b></span>
          <span className="text-slate-500">· {t('subDaysLeft')}: <b>{s.daysLeft}</b></span>
        </div>
        {s.state === 'expiring' && (
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> {t('subExpiring')} {t('subRenewNow')}!
          </p>
        )}
        {cd && (
          <div className="mt-3 rounded-xl bg-slate-900 dark:bg-slate-900/80 text-white px-4 py-3 flex flex-wrap items-center justify-center gap-2 font-mono text-lg">
            <span className="text-[11px] font-sans text-slate-400 mr-1">{t('subTimeLeft')}</span>
            <span><b className="text-brand-400 text-2xl">{String(cd.d).padStart(2, '0')}</b> <span className="text-[11px] text-slate-400">{t('uDays')}</span></span>
            <span className="text-slate-600">:</span>
            <span><b className="text-brand-400 text-2xl">{String(cd.h).padStart(2, '0')}</b> <span className="text-[11px] text-slate-400">{t('uHours')}</span></span>
            <span className="text-slate-600">:</span>
            <span><b className="text-brand-400 text-2xl">{String(cd.m).padStart(2, '0')}</b> <span className="text-[11px] text-slate-400">{t('uMin')}</span></span>
            <span className="text-slate-600">:</span>
            <span><b className="text-emerald-400 text-2xl">{String(cd.s).padStart(2, '0')}</b> <span className="text-[11px] text-slate-400">{t('uSec')}</span></span>
          </div>
        )}
      </div>

      {/* payment info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-4">
          <div className="text-center rounded-xl bg-brand-600/10 border border-brand-500/20 p-4 mb-4">
            <div className="text-xs uppercase tracking-wide text-brand-600 dark:text-brand-400">{t('subFee')}</div>
            <div className="text-3xl font-extrabold mt-1">৳ 10,000 <span className="text-base font-semibold text-slate-400">/ {t('months')}</span></div>
          </div>
          <p className="text-sm text-slate-500 mb-2">{t('subPayVia')}</p>
          <div className="space-y-2">
            {payNum('bKash', '01331707900')}
            {payNum('Nagad', '01616595386')}
          </div>
        </div>

        {/* renewal request */}
        <div className="card p-4">
          {!sent ? (
            <>
              <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Send size={14} className="text-brand-600" /> {t('subSendTitle')}</h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">{t('subSendDesc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className="input" placeholder={t('subCompanyName')} value={company} onChange={(e) => setCompany(e.target.value)} />
                <input className="input" placeholder={t('mobile') + ' *'} value={mobile} onChange={(e) => setMobile(e.target.value)} />
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="bkash">bKash — 01331707900</option>
                  <option value="nagad">Nagad — 01616595386</option>
                </select>
                <input className="input" placeholder={t('subTrxId') + ' *'} value={trxId} onChange={(e) => setTrxId(e.target.value)} />
              </div>
              <button className="btn-primary w-full mt-2" onClick={sendRequest} disabled={busy || !mobile.trim() || !trxId.trim()}>
                <Send size={14} /> {t('subSendBtn')}
              </button>
              {sendErr && <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">{sendErr}</p>}
            </>
          ) : (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 p-4">
              <p className="text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2 leading-relaxed">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {t('subSent')}
              </p>
              <p className="text-slate-400 text-xs mt-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t('subWaiting')}
              </p>
            </div>
          )}

          {/* offline fallback */}
          <div className="mt-5 border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /> {t('subOr')} <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <label className="label"><KeyRound size={13} className="inline mr-1 -mt-0.5" />{t('subCode')}</label>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono uppercase tracking-widest" placeholder="XXXXXXXX" value={code} maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && activate()} />
              <button className="btn-primary whitespace-nowrap" onClick={activate} disabled={busy || !code.trim()}>
                <CheckCircle2 size={15} /> {t('subActivateBtn')}
              </button>
            </div>
            {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-4">{t('renewalNote')}</p>
    </div>
  )
}

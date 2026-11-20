import React, { useEffect, useRef, useState } from 'react'
import { Tv, Phone, Copy, KeyRound, CheckCircle2, AlertTriangle, Send, WifiOff } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { errMsg } from '../lib/api'

// Shown full-screen when the yearly subscription has expired (blocks the app).
// Yearly fee 10,000 BDT — bKash 01331707900 / Nagad 01616595386.
// Online flow: submit TrxID → developer approves in the admin panel (Supabase)
// → app activates automatically. Offline fallback: 8-char activation code.
export default function SubscriptionGate({ onActivated }: { onActivated: () => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // payment request form
  const [company, setCompany] = useState('')
  const [mobile, setMobile] = useState('')
  const [method, setMethod] = useState('bkash')
  const [trxId, setTrxId] = useState('')
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const pollRef = useRef<number | null>(null)

  // online/offline indicator
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // after sending a request: poll Supabase every 60s until approved
  useEffect(() => {
    if (!sent) return
    const check = async () => {
      const s: any = await window.api.subscription.checkRemote().catch(() => null)
      if (s && s.state !== 'expired') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        onActivated()
      }
    }
    pollRef.current = window.setInterval(check, 60_000)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [sent])

  const activate = async () => {
    if (!code.trim()) return
    setBusy(true); setErr('')
    try {
      await window.api.subscription.activate(code)
      onActivated()
    } catch (e) {
      const m = errMsg(e)
      setErr(m.includes('INVALID_CODE') ? t('subInvalidCode') : m)
    } finally { setBusy(false) }
  }

  const sendRequest = async () => {
    if (!mobile.trim() || !trxId.trim()) return
    setBusy(true); setSendErr('')
    try {
      await window.api.subscription.sendRequest({ mobile, method, trxId, companyName: company })
      setSent(true)
    } catch (e) {
      const m = errMsg(e)
      setSendErr(m.includes('SUPABASE_NOT_CONFIGURED')
        ? (t('subOffline') + ' — ' + t('subOr') + ': ' + t('subCode'))
        : m.includes('SUPABASE_') || m.includes('fetch') ? t('subOffline') : m)
    } finally { setBusy(false) }
  }

  const copy = (num: string) => { navigator.clipboard?.writeText(num) }

  const payNum = (label: string, num: string) => (
    <div className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
      <div className="flex items-center gap-3">
        <Phone size={18} className="text-emerald-400 shrink-0" />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
          <div className="font-mono font-bold text-lg text-white tracking-wider">{num}</div>
        </div>
      </div>
      <button className="btn-secondary btn-sm shrink-0" onClick={() => copy(num)} title={t('subCopy')}>
        <Copy size={14} />
      </button>
    </div>
  )

  const inputCls = 'input bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500'

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-auto">
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Tv size={18} className="text-brand-400 shrink-0" />
              <span className="text-slate-300 text-sm truncate">AVA Cable Management</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">{t('subTitle')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('subDesc')}</p>

          <div className="my-5 rounded-xl bg-brand-600/15 border border-brand-500/30 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-brand-300">{t('subFee')}</div>
            <div className="text-3xl font-extrabold text-white mt-1">৳ 10,000 <span className="text-base font-semibold text-slate-400">/ {t('subFee').toLowerCase().includes('বার্ষিক') ? 'বছর' : 'year'}</span></div>
          </div>

          <p className="text-sm text-slate-300 mb-2">{t('subPayVia')}</p>
          <div className="space-y-2">
            {payNum('bKash', '01331707900')}
            {payNum('Nagad', '01616595386')}
          </div>

          {/* ---- online approval request ---- */}
          <div className="mt-6 border-t border-white/10 pt-5">
            {!sent ? (
              <>
                <h2 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                  <Send size={14} className="text-brand-400" /> {t('subSendTitle')}
                </h2>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">{t('subSendDesc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={inputCls} placeholder={t('subCompanyName')} value={company} onChange={(e) => setCompany(e.target.value)} />
                  <input className={inputCls} placeholder={t('mobile') + ' *'} value={mobile} onChange={(e) => setMobile(e.target.value)} />
                  <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="bkash">bKash — 01331707900</option>
                    <option value="nagad">Nagad — 01616595386</option>
                  </select>
                  <input className={inputCls} placeholder={t('subTrxId') + ' *'} value={trxId} onChange={(e) => setTrxId(e.target.value)} />
                </div>
                <button className="btn-primary w-full mt-2" onClick={sendRequest} disabled={busy || !mobile.trim() || !trxId.trim()}>
                  <Send size={14} /> {t('subSendBtn')}
                </button>
                {sendErr && (
                  <p className="text-amber-400 text-xs mt-2 flex items-center gap-1.5">
                    <WifiOff size={12} className="shrink-0" /> {sendErr}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <p className="text-emerald-300 text-sm flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {t('subSent')}
                </p>
                <p className="text-slate-400 text-xs mt-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {t('subWaiting')}
                </p>
              </div>
            )}
          </div>

          {/* ---- offline fallback: activation code ---- */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="flex-1 h-px bg-white/10" /> {t('subOr')} <span className="flex-1 h-px bg-white/10" />
            </div>
            <label className="label text-slate-300"><KeyRound size={13} className="inline mr-1 -mt-0.5" />{t('subCode')}</label>
            <div className="flex gap-2">
              <input
                className="input flex-1 font-mono uppercase tracking-widest bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500"
                placeholder="XXXXXXXX"
                value={code}
                maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && activate()}
              />
              <button className="btn-primary whitespace-nowrap" onClick={activate} disabled={busy || !code.trim()}>
                <CheckCircle2 size={16} /> {t('subActivateBtn')}
              </button>
            </div>
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        </div>
        <p className="text-center text-slate-500 text-[11px] mt-3">100% Offline · AVA Cable Management System</p>
      </div>
    </div>
  )
}

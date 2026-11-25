// Collector select with one-step quick-add (creates staff + collector record).
// Used in CollectPayment page and BillCollectModal.
import React, { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { Modal } from './ui'
import { errMsg } from '../lib/api'

export function useCollectors() {
  const [list, setList] = useState<{ id: number; label: string }[]>([])
  const reload = () => window.api.db.reflist('collectors').then((r: any) => setList(r || [])).catch(() => setList([]))
  useEffect(() => { reload() }, [])
  // auto-refresh when the window regains focus (e.g. a collector was just
  // created in another page/tab) — no page reload needed, no duplicates (SQL is deduped)
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  return { list, reload }
}

// Payment-form collector list. Uses the payment-scoped endpoint (any user who
// may collect can load it — no 'collectors' module grant needed) and falls back
// to the management list for older builds. This is what removes the misleading
// "No active collectors found" message for payment users.
export function usePaymentCollectors() {
  const [list, setList] = useState<{ id: number; label: string }[]>([])
  const reload = () => {
    const load = window.api.payments.collectors
      ? window.api.payments.collectors()
      : window.api.db.reflist('collectors')
    load.then((r: any) => setList(r || [])).catch(() => {
      window.api.db.reflist('collectors').then((r: any) => setList(r || [])).catch(() => setList([]))
    })
  }
  useEffect(() => { reload() }, [])
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  return { list, reload }
}

export function CollectorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { t, lang } = useI18n()
  const { list, reload } = usePaymentCollectors()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // locked identity: the backend resolves the logged-in account's own collector
  // profile — collector accounts get their name auto-selected, read-only, and
  // can never pick (or quick-add) another collector. Admins keep the dropdown.
  // `locked` is separate from `me`: a Collector account without a profile is
  // still locked (the dropdown must NOT fall back to the manual list).
  const [me, setMe] = useState<{ id: number; label: string } | null>(null)
  const [locked, setLocked] = useState(false)
  const [lockErr, setLockErr] = useState('')
  useEffect(() => {
    let alive = true
    window.api.payments.myCollector().then((r: any) => {
      if (!alive) return
      if (!r?.locked) { setLocked(false); return }
      setLocked(true)
      if (r.collector) { setMe(r.collector); onChange(String(r.collector.id)) }
      else if (r.error) setLockErr(r.error)
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const add = async () => {
    if (!name.trim()) return
    setBusy(true); setErr('')
    try {
      const created = await window.api.collectors.quickAdd(name, mobile)
      await reload()
      onChange(String(created.id))
      setOpen(false); setName(''); setMobile('')
    } catch (e) { setErr(errMsg(e)) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{label || `${t('collectors_all').replace(/s$/, '')} (${lang === 'bn' ? 'ঐচ্ছিক' : 'optional'})`}</label>
        {!locked && (
          <button className="text-xs text-brand-600 hover:underline" onClick={() => setOpen(true)}>
            {lang === 'bn' ? '+ কালেক্টর যোগ করুন' : '+ Add collector'}
          </button>
        )}
      </div>
      {locked ? (
        me ? (
          <select className="input bg-slate-50 dark:bg-slate-800" value={String(me.id)} disabled>
            <option value={me.id}>{me.label}</option>
          </select>
        ) : (
          <select className="input bg-slate-50 dark:bg-slate-800" value="" disabled>
            <option value="">{lang === 'bn' ? '— কালেক্টর পাওয়া যায়নি —' : '— no collector profile —'}</option>
          </select>
        )
      ) : (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {list.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      {lockErr && (
        <p className="text-[11px] text-red-500 mt-1">
          {lockErr === 'NO_COLLECTOR_PROFILE'
            ? (lang === 'bn' ? 'এই অ্যাকাউন্টের সাথে কোনো কালেক্টর প্রোফাইল যুক্ত নেই — অ্যাডমিনের সাথে যোগাযোগ করুন' : 'No collector profile is linked to this account — contact an administrator')
            : lockErr === 'AMBIGUOUS_COLLECTOR'
              ? (lang === 'bn' ? 'একই নামে একাধিক কালেক্টর আছে — অ্যাডমিনের সাথে যোগাযোগ করুন' : 'Multiple collectors match this account — contact an administrator')
              : (lang === 'bn' ? 'আপনার কালেক্টর প্রোফাইল নিষ্ক্রিয় — পেমেন্ট নেওয়া যাচ্ছে না' : 'Your collector profile is inactive — collection is disabled')}
        </p>
      )}
      {!list.length && !locked && !lockErr && (
        <p className="text-[11px] text-amber-600 mt-1">
          {lang === 'bn' ? 'কোনো সক্রিয় কালেক্টর নেই — উপরের "+ কালেক্টর যোগ করুন" বাটনে নাম লিখে সাথে সাথে যোগ করুন' : 'No active collectors found. Please create a Collector first." — use "+ Add collector" above'}
        </p>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={lang === 'bn' ? 'কালেক্টর যোগ করুন' : 'Add Collector'} width="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="label">{t('name')} <span className="text-red-500">*</span></label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">{t('mobile')}</label>
            <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button className="btn-primary w-full" onClick={add} disabled={busy || !name.trim()}>
            {busy ? '...' : t('saved') === 'Saved' ? 'Add' : (lang === 'bn' ? 'যোগ করুন' : 'Add')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

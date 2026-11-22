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

export function CollectorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { t, lang } = useI18n()
  const { list, reload } = useCollectors()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

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
        <button className="text-xs text-brand-600 hover:underline" onClick={() => setOpen(true)}>
          {lang === 'bn' ? '+ কালেক্টর যোগ করুন' : '+ Add collector'}
        </button>
      </div>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {list.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      {!list.length && (
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

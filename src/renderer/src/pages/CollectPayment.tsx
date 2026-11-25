import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, Smartphone, Building, RefreshCw } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { money, todayStr } from '../lib/format'
import { Modal, useToast, PageHeader } from '../components/ui'
import { CollectorPicker } from '../components/CollectorPicker'
import { errMsg } from '../lib/api'

export default function CollectPayment({ mode }: { mode?: 'refund' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const nav = useNavigate()
  const [f, setF] = useState<any>({
    customerId: '', amount: '', method: 'cash', reference: '', note: '', date: todayStr(), type: mode === 'refund' ? 'refund' : 'bill', collectorId: ''
  })
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [attempted, setAttempted] = useState(false)
  // collector auto-selection is server-driven: CollectorPicker resolves the
  // logged-in account's own collector profile via payments:myCollector and
  // locks the field for collector accounts (no client-side name guessing)

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      window.api.customers.list({ page: 1, pageSize: 15, search }).then((r: any) => { if (alive) setCustomers(r.rows) }).catch(() => {})
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [search])

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))

  const methods = [
    { value: 'cash', label: t('cash'), icon: Banknote },
    { value: 'bkash', label: t('bkash'), icon: Smartphone },
    { value: 'nagad', label: t('nagad'), icon: Smartphone },
    { value: 'rocket', label: t('rocket'), icon: Smartphone },
    { value: 'bank', label: t('bank'), icon: Building }
  ]

  const submit = async () => {
    setAttempted(true)
    setFormErr('')
    // clear validation messages — never fail silently
    if (!selected) { setFormErr(lang === 'bn' ? 'আগে বাম দিকের লিস্ট থেকে গ্রাহক নির্বাচন করুন' : 'Select a customer from the list on the left first'); return }
    const amt = Number(f.amount)
    if (!amt || amt <= 0) { setFormErr(lang === 'bn' ? 'সঠিক পরিমাণ দিন (০ এর বেশি)' : 'Enter a valid amount (greater than zero)'); return }
    if (!f.date || isNaN(new Date(f.date).getTime())) { setFormErr(lang === 'bn' ? 'সঠিক তারিখ দিন' : 'Enter a valid date'); return }
    if (!f.method) { setFormErr(lang === 'bn' ? 'পেমেন্ট পদ্ধতি নির্বাচন করুন' : 'Select a payment method'); return }
    if (!f.type) { setFormErr(lang === 'bn' ? 'পেমেন্ট ধরন নির্বাচন করুন' : 'Select a payment type'); return }
    setBusy(true)
    try {
      let result: any
      if (mode === 'refund') {
        result = await window.api.payments.refund(selected.id, amt, f.note || '')
      } else {
        result = await window.api.payments.collect({
          customerId: selected.id, amount: amt, method: f.method, reference: f.reference,
          note: f.note, date: f.date, type: f.type, collectorId: f.collectorId || null
        })
      }
      // payment saved — show success notification with receipt number.
      // NO automatic receipt popup/print: users print receipts manually from
      // Collection History or the Monthly Bill Statement (kept intact).
      toast.push('success', `${t('saved')} — ${t('receipt')}: ${result.receiptNo}`)
      // reset but keep the locked-in collector identity (server enforces it anyway)
      setF((x: any) => ({ customerId: '', amount: '', method: 'cash', reference: '', note: '', date: todayStr(), type: mode === 'refund' ? 'refund' : 'bill', collectorId: x.collectorId }))
      setSelected(null)
      setSearch('')
    } catch (e) {
      toast.push('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title={mode === 'refund' ? t('payments_refund') : t('payments_collect')}
        subtitle={mode === 'refund'
          ? (lang === 'bn' ? 'গ্রাহকের অগ্রিম ব্যালেন্স থেকে ফেরত দিন' : 'Refund from customer advance balance')
          : (lang === 'bn' ? 'বিল বা অগ্রিম পেমেন্ট গ্রহণ করুন — ট্রানজেকশন সেফ' : 'Receive bill or advance payments — transaction safe')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* customer picker */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">{t('selectCustomer')}</h3>
          <input className="input mb-2" placeholder={t('search') + ' (name / code / mobile)'} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {customers.map((c) => (
              <button key={c.id} onClick={() => { setSelected(c); setFormErr(''); if (!f.amount) set('amount', mode === 'refund' ? c.advance_balance : c.total_due) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${selected?.id === c.id ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} ${attempted && !selected ? 'ring-1 ring-amber-300' : ''}`}>
                <span><b>{c.name}</b> <span className="opacity-60 font-mono text-xs">{c.code}</span></span>
                <span className="text-xs">
                  {mode === 'refund'
                    ? (lang === 'bn' ? 'অগ্রিম: ' : 'Adv: ') + money(c.advance_balance)
                    : (lang === 'bn' ? 'বকেয়া: ' : 'Due: ') + money(c.total_due)}
                </span>
              </button>
            ))}
            {!customers.length && <p className="text-sm text-slate-400 text-center py-6">{t('noData')}</p>}
          </div>
        </div>

        {/* payment form */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">{mode === 'refund' ? t('refundAdvance') : t('payment')}</h3>
          {selected && (
            <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              <b>{selected.name}</b> <span className="font-mono text-xs text-slate-400">{selected.code}</span>
              <div className="text-xs text-slate-500 mt-0.5">{selected.mobile} · {selected._area || '-'} · {t('due')}: ৳{money(selected.total_due)} · {t('advance')}: ৳{money(selected.advance_balance)}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('amount')} <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" className="input" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('date')}</label>
              <input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            {mode !== 'refund' && (
              <>
                <div className="col-span-2">
                  <label className="label">{t('method')}</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {methods.map((m) => (
                      <button key={m.value} onClick={() => set('method', m.value)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[11px] transition ${f.method === m.value ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <m.icon size={16} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">{t('type')}</label>
                  <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
                    <option value="bill">{t('bill')}</option>
                    <option value="advance">{t('advance')}</option>
                    <option value="connection_fee">{t('connectionFees')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('reference')}</label>
                  <input className="input" placeholder="TrxID" value={f.reference} onChange={(e) => set('reference', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <CollectorPicker label={`${t('collectors_all').replace(/s$/, '')} (${lang === 'bn' ? 'ঐচ্ছিক' : 'optional'})`}
                    value={f.collectorId || ''} onChange={(v) => set('collectorId', v)} />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="label">{t('note')}</label>
              <input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 items-center">
            {formErr && <span className="text-xs text-red-500 mr-auto">⚠ {formErr}</span>}
            <button className="btn-primary" onClick={submit} disabled={busy}>
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? (lang === 'bn' ? 'প্রসেসিং...' : 'Processing...') : (mode === 'refund' ? t('refundAdvance') : t('collectNow'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

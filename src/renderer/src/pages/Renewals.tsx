import React, { useEffect, useState } from 'react'
import { Search, CalendarCheck, RefreshCw } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, Modal } from '../components/ui'
import { errMsg } from '../lib/api'

interface Row {
  id: number
  code: string
  name: string
  mobile: string
  status: string
  monthly_bill: number
  validity_till: string | null
  package: string | null
  area: string | null
}

const FILTERS: { key: string; labelKey: string }[] = [
  { key: 'all', labelKey: 'renewalAll' },
  { key: 'expired', labelKey: 'renewalExpired' },
  { key: 'expiring7', labelKey: 'renewalExpiring7' },
  { key: 'expiring30', labelKey: 'renewalExpiring30' }
]

function daysLeft(validity: string | null): number | null {
  if (!validity) return null
  return Math.ceil((new Date(validity + 'T23:59:59').getTime() - Date.now()) / 86_400_000)
}

export function RenewalsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('expired')
  const [busy, setBusy] = useState(false)

  // renew dialog
  const [sel, setSel] = useState<Row | null>(null)
  const [months, setMonths] = useState(1)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const load = () => {
    window.api.renewal.list({ q, filter }).then((r: any) => setRows(r)).catch(() => {})
  }
  useEffect(load, [q, filter])

  const openRenew = (r: Row) => {
    setSel(r)
    setMonths(1)
    setAmount(String(r.monthly_bill || 0))
    setMethod('cash')
    setReference('')
    setNote('')
  }

  const renew = async () => {
    if (!sel) return
    setBusy(true)
    try {
      const r: any = await window.api.renewal.renew({ customerId: sel.id, months, amount: Number(amount), method, reference, note })
      toast.push('success', `${t('renewalDone')}: ${r.validityTill} (${r.receiptNo})`)
      setSel(null)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBusy(false) }
  }

  const validityCell = (r: Row) => {
    const d = daysLeft(r.validity_till)
    if (d === null) return <span className="text-slate-400">—</span>
    const cls = d < 0 ? 'text-red-600 font-semibold' : d <= 7 ? 'text-amber-600 font-semibold' : ''
    return <span className={cls}>{r.validity_till}</span>
  }

  const monthOptions = [1, 2, 3, 6, 12]

  return (
    <div>
      <PageHeader
        title={t('payments_renewal')}
        actions={<button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>}
      />

      {/* filters + search */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {FILTERS.map((f) => (
          <button key={f.key}
            className={`btn-sm rounded-full px-3 py-1.5 border text-xs font-medium transition ${filter === f.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400'}`}
            onClick={() => setFilter(f.key)}>
            {t(f.labelKey)}
          </button>
        ))}
        <div className="relative ml-auto w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-8" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">{t('renewalNote')}</p>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('customerCode')}</th>
              <th className="table-th">{t('name')}</th>
              <th className="table-th">{t('mobile')}</th>
              <th className="table-th">{t('area')}</th>
              <th className="table-th">{t('package')}</th>
              <th className="table-th text-right">{t('monthlyBill')}</th>
              <th className="table-th">{t('validityTill')}</th>
              <th className="table-th text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="table-td font-mono">{r.code}</td>
                <td className="table-td">{r.name}</td>
                <td className="table-td">{r.mobile}</td>
                <td className="table-td">{r.area || '—'}</td>
                <td className="table-td">{r.package || '—'}</td>
                <td className="table-td text-right">৳{r.monthly_bill}</td>
                <td className="table-td">{validityCell(r)}</td>
                <td className="table-td text-center">
                  <button className="btn-primary btn-sm" onClick={() => openRenew(r)}>
                    <CalendarCheck size={13} /> {t('renew')}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} className="table-td text-center py-10 text-slate-400">{t('noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* renew dialog */}
      {sel && (
        <Modal open={!!sel} onClose={() => setSel(null)} title={`${t('renew')} — ${sel.name} (${sel.code})`}>
          <div className="space-y-3">
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>{t('package')}: <b>{sel.package || '—'}</b></span>
              <span>{t('monthlyBill')}: <b>৳{sel.monthly_bill}</b></span>
              <span>{t('validityTill')}: <b>{sel.validity_till || '—'}</b></span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('months')}</label>
                <select className="input" value={months} onChange={(e) => {
                  const m = Number(e.target.value)
                  setMonths(m)
                  setAmount(String((sel.monthly_bill || 0) * m))
                }}>
                  {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('amount')}</label>
                <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('method')}</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">{t('cash')}</option>
                  <option value="bkash">{t('bkash')}</option>
                  <option value="nagad">{t('nagad')}</option>
                  <option value="rocket">{t('rocket')}</option>
                  <option value="bank">{t('bank')}</option>
                </select>
              </div>
              <div>
                <label className="label">{t('reference')}</label>
                <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">{t('note')}</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
              {t('renewalNote')}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setSel(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={renew} disabled={busy || !Number(amount)}>
                <CalendarCheck size={15} /> {t('renew')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

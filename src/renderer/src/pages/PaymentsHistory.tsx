// Collection Report — displays the customer's MONTHLY BILLING records with the
// same billing data and calculations as the Bill Report page, using the exact
// same table design, summary cards and A4 print templates (buildBillHtml).
// The old "Collect Bill" button is removed; collection happens via the payment form.
import React, { useCallback, useEffect, useState } from 'react'
import { Eye, Printer, FileText, FileDown } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { Modal, useToast, useReflist } from '../components/ui'
import { money, thisMonth, monthLabel, monthStartEnd } from '../lib/format'
import { errMsg } from '../lib/api'
import { receiptHTML, thermalReceiptHTML } from '../lib/printDocs'
import { buildBillHtml } from './BillReport'

type Copy = 'office' | 'customer' | 'both'

export default function PaymentsHistory() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const areas = useReflist('areas')
  const collectors = useReflist('collectors')
  const m = thisMonth()
  const [f, setF] = useState({ from: m, to: m, q: '', areaId: '', collectorId: '', status: 'all' })
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    window.api.reports.billList(m, { ...f })
      .then(setRows).catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [f.from, f.to, f.q, f.areaId, f.collectorId, f.status])
  useEffect(() => { load() }, [f.from, f.to])
  useEffect(() => { const id = setTimeout(load, 300); return () => clearTimeout(id) }, [f.q, f.areaId, f.collectorId, f.status])

  const reset = () => setF({ from: m, to: m, q: '', areaId: '', collectorId: '', status: 'all' })

  const monthForPrint = f.from
  const openPrint = async (r: any, copy: Copy) => {
    try {
      const info = await window.api.reports.customerBill(r.id, monthForPrint)
      await window.api.print.preview(buildBillHtml(info, copy), `${info.customer.name} — ${monthLabel(monthForPrint)}`)
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  const savePdf = async (r: any, copy: Copy) => {
    try {
      const info = await window.api.reports.customerBill(r.id, monthForPrint)
      const path = await window.api.print.savePdf(buildBillHtml(info, copy), `${info.customer.code}-${monthForPrint}-${copy}.pdf`)
      if (path) toast.push('success', (lang === 'bn' ? 'PDF সেভ হয়েছে: ' : 'PDF saved: ') + path)
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  const openView = async (r: any) => {
    try { setView(await window.api.reports.customerBill(r.id, monthForPrint)) } catch (e) { toast.push('error', errMsg(e)) }
  }

  const statusBadge = (s: string) => s === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : s === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">{t('collectionReportTitle')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{lang === 'bn' ? 'গ্রাহকের মাসিক বিল রেকর্ড — বিল রিপোর্টের একই হিসাব ও প্রিন্ট ডিজাইন' : 'Customer monthly billing records — same calculations and print design as Bill Report'}</p>
      </div>
      {/* Filters — same card design as Bill Report */}
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="label">{t('from')} ({lang === 'bn' ? 'বিল মাস' : 'billing month'})</label>
          <input type="month" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('to')} ({lang === 'bn' ? 'বিল মাস' : 'billing month'})</label>
          <input type="month" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('search')}</label>
          <input className="input" placeholder={t('searchCustomerPlaceholder')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('area')}</label>
          <select className="input" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>
            <option value="">—</option>
            {areas.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('collectors_all').replace(/s$/, '')}</label>
          <select className="input" value={f.collectorId} onChange={(e) => setF({ ...f, collectorId: e.target.value })}>
            <option value="">—</option>
            {collectors.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('paymentStatus')}</label>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="all">{t('all')}</option>
            <option value="paid">{t('paid')}</option>
            <option value="partial">{t('partial')}</option>
            <option value="due">{t('due')}</option>
          </select>
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>{t('search')}</button>
        <button className="btn-secondary" onClick={reset}>{t('reset')}</button>
      </div>
      {/* Summary cards — same Stat design as Bill Report */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={t('customers')} value={rows.length} />
        <Stat label={t('totalPayable')} value={money(rows.reduce((s, r) => s + r.totalPayable, 0))} />
        <Stat label={t('paidAmount')} value={money(rows.reduce((s, r) => s + r.paid, 0))} />
        <Stat label={t('currentDue')} value={money(rows.reduce((s, r) => s + Math.max(0, r.currentDue), 0))} tone="text-red-600" />
      </div>
      {/* Table — identical to the Bill Report table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="p-2 text-left">SL</th>
              <th className="p-2 text-left">{t('customerCode')}</th>
              <th className="p-2 text-left">{t('name')}</th>
              <th className="p-2 text-left">{t('address')}</th>
              <th className="p-2 text-left">{t('mobile')}</th>
              <th className="p-2 text-right">{t('monthlyBill')}</th>
              <th className="p-2 text-right">{t('previousDue')}</th>
              <th className="p-2 text-right">{t('totalPayable')}</th>
              <th className="p-2 text-right">{t('paidAmount')}</th>
              <th className="p-2 text-right">{t('currentDue')}</th>
              <th className="p-2 text-left">{t('paymentStatus')}</th>
              <th className="p-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="p-2 text-slate-400">{i + 1}</td>
                <td className="p-2 font-mono text-xs">{r.code}</td>
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-xs text-slate-500 max-w-[140px] truncate">{r.address || '-'}</td>
                <td className="p-2">{r.mobile}</td>
                <td className="p-2 text-right">{money(r.month_bill)}</td>
                <td className="p-2 text-right">{money(r.prev_due)}</td>
                <td className="p-2 text-right font-semibold">{money(r.totalPayable)}</td>
                <td className="p-2 text-right text-emerald-600">{money(r.paid)}</td>
                <td className={`p-2 text-right font-semibold ${r.currentDue > 0 ? 'text-red-600' : ''}`}>{money(r.currentDue)}</td>
                <td className="p-2"><span className={`badge ${statusBadge(r.status)}`}>{t(r.status)}</span></td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <IconBtn title={t('view')} onClick={() => openView(r)}><Eye size={14} /></IconBtn>
                    <IconBtn title={t('printOfficeCopy')} onClick={() => openPrint(r, 'office')}><Printer size={14} /></IconBtn>
                    <IconBtn title={t('printCustomerCopy')} onClick={() => openPrint(r, 'customer')}><FileText size={14} /></IconBtn>
                    <IconBtn title={t('printBothCopies')} onClick={() => openPrint(r, 'both')}><Printer size={14} className="text-brand-600" /></IconBtn>
                    <IconBtn title={t('downloadPdf')} onClick={() => savePdf(r, 'both')}><FileDown size={14} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={12} className="p-6 text-center text-slate-400">{t('noData')}</td></tr>}
          </tbody>
        </table>
      </div>
      {view && <BillViewModal info={view} onClose={() => setView(null)} onPrint={openPrint} onSavePdf={savePdf} />}
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: any; tone?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
    </div>
  )
}

function IconBtn({ title, onClick, children }: any) {
  return <button title={title} onClick={onClick} className="btn-secondary btn-sm" style={{ padding: '5px 7px' }}>{children}</button>
}

// bill details modal — same as Bill Report's ViewModal (payments history included)
function BillViewModal({ info, onClose, onPrint, onSavePdf }: any) {
  const { t } = useI18n()
  const f = info.figures
  return (
    <Modal open onClose={onClose} title={`${info.customer.name} — ${monthLabel(info.month)}`} width="max-w-2xl">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-slate-400">{t('customerCode')}:</span> <b className="font-mono">{info.customer.code}</b></div>
          <div><span className="text-slate-400">{t('mobile')}:</span> {info.customer.mobile}</div>
          <div><span className="text-slate-400">{t('address')}:</span> {info.customer.address || '-'}</div>
          <div><span className="text-slate-400">{t('area')}:</span> {info.customer.area_name || '-'}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KV label={t('monthlyBill')} value={money(f.monthBill)} />
          <KV label={t('previousDue')} value={money(f.prevDue)} />
          <KV label={t('totalPayable')} value={money(f.totalPayable)} />
          <KV label={t('paidAmount')} value={money(f.paid)} />
          <KV label={t('currentDue')} value={money(f.currentDue)} />
          <KV label={t('paymentStatus')} value={t(f.status)} />
          <KV label={t('additionalCharge')} value={money(f.additional)} />
          <KV label={t('discount')} value={money(f.discount)} />
        </div>
        <div>
          <h4 className="font-semibold mb-1">{t('payments')}</h4>
          {info.payments.length ? (
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left p-1.5">{t('receiptNo')}</th><th className="text-left p-1.5">{t('date')}</th>
                <th className="text-right p-1.5">{t('amount')}</th><th className="text-left p-1.5">{t('paymentMethod')}</th>
                <th className="text-left p-1.5">{t('trxId')}</th><th className="text-left p-1.5">{t('collectedBy')}</th>
              </tr></thead>
              <tbody>
                {info.payments.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="p-1.5 font-mono">{p.receipt_no}</td>
                    <td className="p-1.5">{p.payment_date}</td>
                    <td className="p-1.5 text-right">{money(p.amount)}</td>
                    <td className="p-1.5">{p.method}</td>
                    <td className="p-1.5">{p.reference || '-'}</td>
                    <td className="p-1.5">{p.collected_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-slate-400 text-xs">{t('noData')}</p>}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button className="btn-secondary" onClick={() => onPrint({ id: info.customer.id }, 'office')}><Printer size={15} /> {t('printOfficeCopy')}</button>
          <button className="btn-secondary" onClick={() => onPrint({ id: info.customer.id }, 'customer')}><FileText size={15} /> {t('printCustomerCopy')}</button>
          <button className="btn-primary" onClick={() => onPrint({ id: info.customer.id }, 'both')}><Printer size={15} /> {t('printBothCopies')}</button>
          <button className="btn-secondary" onClick={() => onSavePdf({ id: info.customer.id }, 'both')}><FileDown size={15} /> {t('downloadPdf')}</button>
        </div>
      </div>
    </Modal>
  )
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-2"><div className="text-[10px] text-slate-400">{label}</div><div className="font-semibold">{value}</div></div>
  )
}

// ================= Bill Collection History =================
// Full collection ledger: customer name, area, collected amount, due
// before/after (snapshots saved at collection time), collector name, method.
export function CollectionHistory() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const { from, to } = monthStartEnd(thisMonth())
  const [f, setF] = useState({ from, to, q: '', collectorId: '' })
  const [rows, setRows] = useState<any[]>([])
  const [sum, setSum] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const collectors = useReflist('collectors')
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    window.api.payments.list({ page, pageSize, from: f.from, to: f.to, search: f.q, collectorId: f.collectorId || undefined })
      .then((r: any) => { setRows(r.rows); setSum(r.sum); setTotal(r.total) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, f.from, f.to, f.q, f.collectorId])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [f.from, f.to, f.q, f.collectorId])

  const receipt = async (id: number, thermal = false) => {
    try {
      const d = await window.api.payments.receipt(id)
      await window.api.print.preview(thermal ? thermalReceiptHTML(d.payment, d.customer, d.company) : receiptHTML(d.payment, d.customer, d.company), t('receipt') + ' ' + d.payment.receipt_no)
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  const pdf = async (id: number) => {
    try {
      const d = await window.api.payments.receipt(id)
      const path = await window.api.print.savePdf(receiptHTML(d.payment, d.customer, d.company), `${d.payment.receipt_no}.pdf`)
      if (path) toast.push('success', (lang === 'bn' ? 'PDF সেভ হয়েছে: ' : 'PDF saved: ') + path)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const BN_METHODS: Record<string, string> = { cash: 'নগদ (ক্যাশ)', bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', bank: 'ব্যাংক' }
  const TYPES: Record<string, string> = { bill: 'বিল', advance: 'অগ্রিম', connection_fee: 'সংযোগ ফি', refund: 'রিফান্ড' }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">{lang === 'bn' ? 'বিল কালেকশন হিস্ট্রি' : 'Bill Collection History'}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{lang === 'bn' ? 'প্রতিটি কালেকশনের পূর্ণ বিবরণ — গ্রাহক, এরিয়া, কালেক্টেড টাকা, বকেয়া আগে/পরে, কালেক্টর' : 'Every collection with customer, area, collected amount, due before/after, collector'}</p>
      </div>
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <div><label className="label">{t('from')}</label><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label">{t('to')}</label><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        <div><label className="label">{t('search')}</label><input className="input" placeholder={t('searchCustomerPlaceholder') + ' / ' + t('receiptNo')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
        <div><label className="label">{t('collectors_all').replace(/s$/, '')}</label>
          <select className="input" value={f.collectorId} onChange={(e) => setF({ ...f, collectorId: e.target.value })}>
            <option value="">—</option>
            {collectors.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <button className="btn-secondary" onClick={() => setF({ from, to, q: '', collectorId: '' })}>{t('reset')}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-3"><div className="text-xs text-slate-500">{t('totalCollection')}</div><div className="text-lg font-bold text-emerald-600">৳ {money(sum)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট লেনদেন' : 'Total Transactions'}</div><div className="text-lg font-bold">{total}</div></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="p-2 text-left">SL</th>
              <th className="p-2 text-left">{lang === 'bn' ? 'তারিখ ও সময়' : 'Date & Time'}</th>
              <th className="p-2 text-left">{t('name')}</th>
              <th className="p-2 text-left">{t('area')}</th>
              <th className="p-2 text-right">{lang === 'bn' ? 'কালেক্টেড' : 'Collected'}</th>
              <th className="p-2 text-right">{lang === 'bn' ? 'পূর্বের বকেয়া' : 'Previous Due'}</th>
              <th className="p-2 text-right">{lang === 'bn' ? 'অবশিষ্ট বকেয়া' : 'Remaining Due'}</th>
              <th className="p-2 text-left">{t('collectors_all').replace(/s$/, '')}</th>
              <th className="p-2 text-left">{t('method')}</th>
              <th className="p-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="p-2 text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                <td className="p-2 text-xs">{String(r.created_local_time || r.payment_date || '').replace('T', ' ')}</td>
                <td className="p-2 font-medium">{r.customer_name} <span className="opacity-50 font-mono text-xs">{r.customer_code}</span></td>
                <td className="p-2">{r._area || '—'}</td>
                <td className={`p-2 text-right font-semibold ${r.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>{r.type === 'refund' ? '-' : ''}{money(r.amount)}</td>
                <td className="p-2 text-right">{r.due_before != null ? money(r.due_before) : '—'}</td>
                <td className="p-2 text-right font-semibold">{r.due_after != null ? money(r.due_after) : '—'}</td>
                <td className="p-2">{r._collector || r.created_by || '—'}</td>
                <td className="p-2">{BN_METHODS[r.method] || r.method}<span className="text-slate-400 text-xs"> · {TYPES[r.type] || r.type}</span></td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <button className="btn-secondary btn-sm" style={{ padding: '5px 7px' }} title={t('print') + ' A4'} onClick={() => receipt(r.id)}><Printer size={13} /></button>
                    <button className="btn-secondary btn-sm" style={{ padding: '5px 7px' }} title="Thermal" onClick={() => receipt(r.id, true)}>🖨</button>
                    <button className="btn-secondary btn-sm" style={{ padding: '5px 7px' }} title={t('downloadPdf')} onClick={() => pdf(r.id)}><FileDown size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={10} className="p-6 text-center text-slate-400">{t('noData')}</td></tr>}
          </tbody>
        </table>
        {total > pageSize && (
          <div className="flex items-center justify-between p-2 text-xs text-slate-500">
            <span>{t('showing')} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t('of')} {total}</span>
            <div className="flex gap-1">
              <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
              <button className="btn-secondary btn-sm" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

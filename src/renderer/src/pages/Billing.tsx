import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Zap, Printer, Pencil, XCircle, Banknote } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useI18n, monthLabel } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, PageHeader, useReflist } from '../components/ui'
import { money, thisMonth, prevMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { invoiceHTML } from '../lib/printDocs'

export default function BillingPage({ mode }: { mode?: 'generate' | 'history' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [month, setMonth] = useState(params.get('month') || thisMonth())
  const statusParam = params.get('status') || ''
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [sums, setSums] = useState({ total: 0, paid: 0, due: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(!!mode)
  const [adjusting, setAdjusting] = useState<any>(null)
  const [cancelling, setCancelling] = useState<any>(null)
  const areas = useReflist('areas')

  const load = useCallback(() => {
    setLoading(true)
    window.api.billing.list({ page, pageSize: 20, month: mode === 'history' ? undefined : month, status: statusParam || undefined, search })
      .then((r: any) => { setRows(r.rows); setTotal(r.total); setSums(r.sums) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, month, statusParam, search, mode])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [month, statusParam, search])

  const generate = async (m: string, areaId?: number) => {
    try {
      const r = await window.api.billing.generate(m, areaId, 'manual')
      toast.push('success', `${monthLabel(m, lang)}: ${r.created} ${lang === 'bn' ? 'বিল তৈরি হয়েছে' : 'bills generated'}, ${r.skipped} ${lang === 'bn' ? 'ইতিমধ্যে আছে' : 'skipped'}`)
      setGenOpen(false)
      setMonth(m)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const printInvoice = async (billId: number) => {
    try {
      const d = await window.api.billing.invoice(billId)
      await window.api.print.preview(invoiceHTML(d.bill, d.customer, d.company), t('invoice') + ' ' + d.bill.invoice_no)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const columns: Column[] = [
    { key: 'month', label: t('month') },
    { key: 'invoice_no', label: t('invoiceNo'), className: 'font-mono text-xs' },
    { key: 'customer_code', label: t('customerCode'), className: 'font-mono text-xs' },
    { key: 'customer_name', label: t('name') },
    { key: '_area', label: t('area') },
    { key: 'amount', label: t('billAmount'), align: 'right', render: (r) => money(r.amount) },
    { key: 'discount', label: t('discount'), align: 'right', render: (r) => r.discount ? money(r.discount) : '-' },
    { key: 'previous_due', label: t('previousDue'), align: 'right', render: (r) => r.previous_due ? money(r.previous_due) : '-' },
    { key: 'total', label: t('netTotal'), align: 'right', render: (r) => <b>{money(r.total)}</b> },
    { key: 'paid', label: t('paid'), align: 'right', render: (r) => <span className="text-emerald-600 dark:text-emerald-400">{money(r.paid)}</span> },
    { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> }
  ]

  return (
    <div>
      <PageHeader
        title={t('billing_monthly')}
        subtitle={mode === 'history'
          ? t('billing_history')
          : `${monthLabel(month, lang)} — ${t('totalBilled')}: ৳${money(sums.total)} · ${t('totalPaid')}: ৳${money(sums.paid)} · ${t('totalDueAmt')}: ৳${money(sums.due)}`}
        actions={
          <>
            {mode !== 'history' && (
              <>
                <input type="month" className="input w-40" value={month} onChange={(e) => { setMonth(e.target.value); setParams(e.target.value === thisMonth() ? {} : { month: e.target.value }) }} />
                <button className="btn-secondary btn-sm" onClick={() => setMonth(prevMonth(month))}>{t('billing_previous')}</button>
                {['', 'due', 'partial', 'paid'].map((s) => (
                  <button key={s} className={`btn-sm ${statusParam === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setParams(s ? { status: s } : {})}>{s ? t(s) : t('all')}</button>
                ))}
              </>
            )}
            <button className="btn-primary" onClick={() => setGenOpen(true)}><Zap size={16} /> {t('generateBills')}</button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={20}
        onPage={setPage}
        search={search}
        onSearch={setSearch}
        loading={loading}
        exportName={`bills-${month}`}
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm text-emerald-600" title={t('print')} onClick={() => printInvoice(r.id)}><Printer size={13} /></button>
            <button className="btn-secondary btn-sm" title={t('billing_adjust')} onClick={() => setAdjusting(r)}><Pencil size={13} /></button>
            {r.paid == 0 && r.status !== 'cancelled' && (
              <button className="btn-secondary btn-sm text-red-600" title={t('cancel')} onClick={() => setCancelling(r)}><XCircle size={13} /></button>
            )}
          </div>
        )}
      />

      <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} onGenerate={generate} areas={areas} />
      {adjusting && <AdjustModal bill={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); load() }} />}
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => window.api.billing.cancel(cancelling.id).then(() => { toast.push('success', t('saved')); load() }).catch((e) => toast.push('error', errMsg(e)))}
        title={t('cancel')}
        message={`${cancelling?.invoice_no} — ${t('confirmDelete')}`}
      />
    </div>
  )
}

function GenerateModal({ open, onClose, onGenerate, areas }: {
  open: boolean; onClose: () => void; onGenerate: (m: string, areaId?: number) => void; areas: any[]
}) {
  const { t, lang } = useI18n()
  const [m, setM] = useState(thisMonth())
  const [areaId, setAreaId] = useState('')
  return (
    <Modal open={open} onClose={onClose} title={t('generateBills')}>
      <p className="text-sm text-slate-500 mb-4">{lang === 'bn'
        ? 'প্রতিটি সক্রিয় গ্রাহকের জন্য মাসিক বিল তৈরি হবে। আগে থেকে তৈরি বিল বাদ যাবে (ডুপ্লিকেট হবে না)। পূর্বের বকেয়া স্বয়ংক্রিয়ভাবে যুক্ত হবে।'
        : 'Monthly bills will be generated for every active customer. Existing bills are skipped (no duplicates). Previous dues carry forward automatically.'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('month')}</label>
          <input type="month" className="input" value={m} onChange={(e) => setM(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('area')}</label>
          <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">{t('all')}</option>
            {areas.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={() => onGenerate(m, areaId ? Number(areaId) : undefined)}><Zap size={15} /> {t('generate')}</button>
      </div>
    </Modal>
  )
}

function AdjustModal({ bill, onClose, onSaved }: { bill: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [discount, setDiscount] = useState(String(bill.discount || ''))
  const [lateFee, setLateFee] = useState(String(bill.late_fee || ''))
  const [reason, setReason] = useState('')
  const total = Math.max(0, Number(bill.amount || 0) - (Number(discount) || 0) + (Number(bill.previous_due) || 0) + (Number(lateFee) || 0))

  const save = async () => {
    try {
      await window.api.billing.adjust(bill.id, Number(discount) || 0, Number(lateFee) || 0, reason)
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <Modal open onClose={onClose} title={`${t('billing_adjust')} — ${bill.invoice_no}`}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">{t('billAmount')}</label><input className="input bg-slate-100" value={money(bill.amount)} disabled /></div>
        <div><label className="label">{t('previousDue')}</label><input className="input bg-slate-100" value={money(bill.previous_due)} disabled /></div>
        <div><label className="label">{t('discount')}</label><input type="number" min="0" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        <div><label className="label">{t('lateFee')}</label><input type="number" min="0" className="input" value={lateFee} onChange={(e) => setLateFee(e.target.value)} /></div>
        <div className="col-span-2"><label className="label">{t('reason')} ({t('discount')})</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="col-span-2 text-right font-semibold">{t('netTotal')}: <span className="text-brand-600">৳ {money(total)}</span></div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={save}>{t('save')}</button>
      </div>
    </Modal>
  )
}

import React, { useCallback, useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { StatusBadge, useToast, PageHeader } from '../components/ui'
import { money, monthStartEnd, thisMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { receiptHTML, thermalReceiptHTML } from '../lib/printDocs'

export default function PaymentsHistory() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [params] = useSearchParams()
  const { from, to } = monthStartEnd(thisMonth())
  const [f, setF] = useState({ from: from, to: to, method: params.get('method') || '', type: params.get('type') || '' })
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [sum, setSum] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    window.api.payments.list({ page, pageSize: 20, from: f.from, to: f.to, method: f.method || undefined, search })
      .then((r: any) => { setRows(r.rows); setTotal(r.total); setSum(r.sum) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, f.from, f.to, f.method, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [f.from, f.to, f.method, search])

  const printReceipt = async (id: number, thermal = false) => {
    try {
      const d = await window.api.payments.receipt(id)
      await window.api.print.preview(
        thermal ? thermalReceiptHTML(d.payment, d.customer, d.company) : receiptHTML(d.payment, d.customer, d.company),
        t('receipt') + ' ' + d.payment.receipt_no
      )
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const columns: Column[] = [
    { key: 'payment_date', label: t('date') },
    { key: 'receipt_no', label: t('receiptNo'), className: 'font-mono text-xs' },
    { key: 'customer_code', label: t('customerCode'), className: 'font-mono text-xs' },
    { key: 'customer_name', label: t('name') },
    { key: '_area', label: t('area') },
    { key: 'amount', label: t('amount'), align: 'right', render: (r) => <b className={r.type === 'refund' ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}>{r.type === 'refund' ? '-' : ''}{money(r.amount)}</b> },
    { key: 'method', label: t('method'), render: (r) => <StatusBadge value={r.method} label={t(r.method) !== r.method ? t(r.method) : r.method} /> },
    { key: 'type', label: t('type'), render: (r) => t(r.type) !== r.type ? t(r.type) : r.type },
    { key: 'reference', label: t('reference'), render: (r) => r.reference || '-' },
    { key: '_collector', label: t('collectors_all').replace(/s$/, ''), render: (r) => r._collector || '-' }
  ]

  return (
    <div>
      <PageHeader title={t('payments_history')} subtitle={`${t('collection')}: ৳${money(sum)}`} />
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
        exportName="payments"
        extraToolbar={
          <div className="flex gap-2">
            <input type="date" className="input w-36" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <input type="date" className="input w-36" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <select className="input w-32" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              <option value="">{t('method')}: {t('all')}</option>
              {['cash', 'bkash', 'nagad', 'rocket', 'bank'].map((m) => <option key={m} value={m}>{t(m)}</option>)}
            </select>
          </div>
        }
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm text-emerald-600" title={t('print') + ' A4'} onClick={() => printReceipt(r.id)}><Printer size={13} /></button>
            <button className="btn-secondary btn-sm" title="Thermal 58/80" onClick={() => printReceipt(r.id, true)}>🖨</button>
          </div>
        )}
      />
    </div>
  )
}

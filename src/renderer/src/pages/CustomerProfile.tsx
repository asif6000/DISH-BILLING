import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, FileDown } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { money, dateFmt } from '../lib/format'
import { StatusBadge, Modal, useToast, ConfirmDialog, useReflist } from '../components/ui'
import { CustomerForm } from './Customers'
import { errMsg } from '../lib/api'

export default function CustomerProfile() {
  const { id } = useParams()
  const { t } = useI18n()
  const toast = useToast()
  const nav = useNavigate()
  const [data, setData] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [tab, setTab] = useState<'bills' | 'payments' | 'history' | 'documents'>('bills')
  const areas = useReflist('areas')
  const packages = useReflist('packages')

  const load = () => {
    window.api.customers.get(Number(id)).then(setData).catch((e) => toast.push('error', errMsg(e)))
  }
  useEffect(() => { load() }, [id])

  if (!data) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>
  const c = data.customer

  const quickPay = async (amount: number, method: string) => {
    try {
      const r = await window.api.payments.collect({ customerId: c.id, amount, method, type: 'bill' })
      toast.push('success', `${t('receipt')} ${r.receiptNo}`)
      setPayModal(false)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => nav(-1)} className="btn-secondary btn-sm"><ArrowLeft size={14} /></button>
        <h1 className="text-xl font-bold">{c.name} <span className="text-sm font-mono text-slate-400">{c.code}</span></h1>
        <StatusBadge value={c.status} label={t(c.status)} />
        <div className="flex-1" />
        <button className="btn-secondary btn-sm" onClick={() => setEditOpen(true)}><Pencil size={13} /> {t('edit')}</button>
        {Number(c.total_due) > 0 && <button className="btn-success btn-sm" onClick={() => setPayModal(true)}>{t('collectNow')}</button>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card p-4 xl:col-span-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">{t('customerInfo')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
            <Info label={t('fatherName')} value={c.father_name} />
            <Info label={t('mobile')} value={c.mobile} />
            <Info label={t('address')} value={c.address} />
            <Info label={t('area')} value={c._area} />
            <Info label={t('package')} value={c._package} />
            <Info label={t('connectionType')} value={
              c.connection_type === 'free'
                ? <span className="badge bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">{t('free')}</span>
                : t('connectionPaid')
            } />
            <Info label={t('connectionDate')} value={dateFmt(c.connection_date)} />
            <Info label={t('monthlyBill')} value={'৳ ' + money(c.monthly_bill)} />
            <Info label={t('previousDueBill')} value={'৳ ' + money(c.previous_due_bill)} />
            <Info label={t('connectionFee')} value={'৳ ' + money(c.connection_fee)} />
            <Info label={t('note')} value={c.note} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">{t('billsSummary')}</h3>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500">{t('totalDue')}</span>
              <span className={`font-bold ${Number(c.total_due) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>৳ {money(c.total_due)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500">{t('previousDueBill')}</span>
              <span className={`font-bold ${Number(c.previous_due_bill) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>৳ {money(c.previous_due_bill)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500">{t('advanceBalance')}</span>
              <span className="font-bold text-brand-600">৳ {money(c.advance_balance)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">{t('monthlyBill')}</span>
              <span className="font-bold">৳ {money(c.monthly_bill)}</span>
            </div>
          </div>
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">{t('actions')}</h3>
            <Link to="/payments/collect" className="btn-secondary btn-sm w-full justify-start">{t('collectPayment')}</Link>
            <button
              className="btn-secondary btn-sm w-full justify-start"
              onClick={() => window.api.payments.useAdvance(c.id)
                .then((r: any) => { toast.push('success', `${t('useAdvance')}: ৳${money(r.applied)}`); load() })
                .catch((e) => toast.push('error', errMsg(e)))}>
              {t('useAdvance')}
            </button>
            <button
              className="btn-secondary btn-sm w-full justify-start"
              onClick={() => window.api.customers.setStatus(c.id, c.status === 'active' ? 'inactive' : 'active')
                .then(() => { toast.push('success', t('saved')); load() })
                .catch((e) => toast.push('error', errMsg(e)))}>
              {c.status === 'active' ? t('connections_disconnect') : t('connections_reconnect')}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['bills', 'payments', 'history', 'documents'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === tb ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'}`}>
            {tb === 'bills' ? t('billing_monthly') : tb === 'payments' ? t('payments_history') : tb === 'history' ? t('customers_history') : t('customers_documents')}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {tab === 'bills' && (
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('month')}</th><th className="table-th">{t('invoiceNo')}</th>
              <th className="table-th text-right">{t('billAmount')}</th><th className="table-th text-right">{t('discount')}</th>
              <th className="table-th text-right">{t('previousDue')}</th><th className="table-th text-right">{t('netTotal')}</th>
              <th className="table-th text-right">{t('paid')}</th><th className="table-th">{t('statusCol')}</th>
            </tr></thead>
            <tbody>
              {data.bills.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="table-td">{b.month}</td>
                  <td className="table-td font-mono text-xs">{b.invoice_no}</td>
                  <td className="table-td text-right">{money(b.amount)}</td>
                  <td className="table-td text-right">{money(b.discount)}</td>
                  <td className="table-td text-right">{money(b.previous_due)}</td>
                  <td className="table-td text-right font-semibold">{money(b.total)}</td>
                  <td className="table-td text-right text-emerald-600">{money(b.paid)}</td>
                  <td className="table-td"><StatusBadge value={b.status} label={t(b.status)} /></td>
                </tr>
              ))}
              {!data.bills.length && <tr><td colSpan={8} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
            </tbody>
          </table>
        )}
        {tab === 'payments' && (
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('date')}</th><th className="table-th">{t('receiptNo')}</th>
              <th className="table-th text-right">{t('amount')}</th><th className="table-th">{t('method')}</th>
              <th className="table-th">{t('type')}</th><th className="table-th">{t('note')}</th>
            </tr></thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="table-td">{dateFmt(p.payment_date)}</td>
                  <td className="table-td font-mono text-xs">{p.receipt_no}</td>
                  <td className={`table-td text-right font-semibold ${p.type === 'refund' ? 'text-red-600' : 'text-emerald-600'}`}>{p.type === 'refund' ? '-' : ''}{money(p.amount)}</td>
                  <td className="table-td">{p.method}</td>
                  <td className="table-td">{t(p.type) !== p.type ? t(p.type) : p.type}</td>
                  <td className="table-td text-xs">{p.note || p.reference || '-'}</td>
                </tr>
              ))}
              {!data.payments.length && <tr><td colSpan={6} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
            </tbody>
          </table>
        )}
        {tab === 'history' && (
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('date')}</th><th className="table-th">{t('type')}</th>
              <th className="table-th">{t('from')} → {t('to')}</th><th className="table-th">{t('note')}</th>
            </tr></thead>
            <tbody>
              {data.connections.map((h: any) => (
                <tr key={h.id}>
                  <td className="table-td">{dateFmt(h.date)}</td>
                  <td className="table-td">{h.action}</td>
                  <td className="table-td">{h.from_value || '-'} → {h.to_value || '-'}</td>
                  <td className="table-td text-xs">{h.note || '-'}</td>
                </tr>
              ))}
              {!data.connections.length && <tr><td colSpan={4} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
            </tbody>
          </table>
        )}
        {tab === 'documents' && (
          <table className="w-full">
            <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('date')}</th><th className="table-th">{t('name')}</th>
              <th className="table-th">{t('note')}</th>
            </tr></thead>
            <tbody>
              {data.documents.map((d: any) => (
                <tr key={d.id}><td className="table-td">{dateFmt(d.date)}</td><td className="table-td">{d.title}</td><td className="table-td text-xs">{d.note || '-'}</td></tr>
              ))}
              {!data.documents.length && <tr><td colSpan={3} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editOpen && <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load() }} areas={areas} packages={packages} editing={c} />}

      {/* Quick pay */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title={t('collectPayment')}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('due') + ' (৳' + money(c.total_due) + ')', amount: Number(c.total_due) },
            { label: t('monthlyBill') + ' (৳' + money(c.monthly_bill) + ')', amount: Number(c.monthly_bill) }
          ].map((o, i) => (
            <button key={i} className="btn-secondary" onClick={() => quickPay(o.amount, 'cash')}>{o.label}</button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm font-medium break-words">{value || '-'}</div>
    </div>
  )
}

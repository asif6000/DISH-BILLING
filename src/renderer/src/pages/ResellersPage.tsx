import React, { useEffect, useState } from 'react'
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { money, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'
import { EntityPage } from '../components/EntityPage'

export function ResellersPage() {
  return <EntityPage entity="resellers" title="Resellers" />
}

export function ResellerWallet() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [modal, setModal] = useState<null | 'recharge' | 'payment'>(null)
  const [form, setForm] = useState({ amount: '', note: '', date: todayStr() })

  const load = () => window.api.db.list('resellers', { page: 1, pageSize: 100 }).then((r: any) => setRows(r.rows)).catch(() => {})
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (sel) window.api.resellers.txns(sel.id).then(setTxns).catch(() => {})
    else setTxns([])
  }, [sel])

  const submit = async () => {
    if (!sel || !Number(form.amount)) return
    try {
      await window.api.resellers.txn({ reseller_id: sel.id, type: modal, amount: Number(form.amount), note: form.note, date: form.date })
      toast.push('success', t('saved'))
      setModal(null)
      setForm({ amount: '', note: '', date: todayStr() })
      load()
      const r2 = await window.api.db.get('resellers', sel.id)
      setSel(r2)
      window.api.resellers.txns(sel.id).then(setTxns).catch(() => {})
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('resellers_wallet')} subtitle={t('resellers_recharge')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="overflow-y-auto max-h-[520px]">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setSel(r)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 transition ${sel?.id === r.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-[11px] text-slate-400">{r.mobile} · {r._status}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${Number(r.wallet_balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>৳ {money(r.wallet_balance)}</div>
                  <div className="text-[11px] text-slate-400">{r.commission_rate || 0}%</div>
                </div>
              </button>
            ))}
            {!rows.length && <p className="text-sm text-slate-400 text-center py-8">{t('noData')}</p>}
          </div>
        </div>
        <div className="card p-4">
          {sel ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{sel.name}</div>
                  <div className="text-xs text-slate-400">{sel.mobile}</div>
                </div>
                <div className="text-2xl font-bold text-emerald-600">৳ {money(sel.wallet_balance)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button className="btn-success" onClick={() => setModal('recharge')}><ArrowUpCircle size={15} /> {t('walletRecharge')}</button>
                <button className="btn-danger" onClick={() => setModal('payment')}><ArrowDownCircle size={15} /> {t('resellers_payment')}</button>
              </div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{t('txnHistory')}</h4>
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {txns.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <div>
                      <span className={`font-medium ${['recharge', 'commission'].includes(tx.type) ? 'text-emerald-600' : 'text-red-600'}`}>
                        {['recharge', 'commission'].includes(tx.type) ? '+' : '-'}৳{money(tx.amount)}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">{tx.type} · {tx.date}</span>
                    </div>
                    <span className="text-xs text-slate-400 truncate max-w-[40%]">{tx.note || ''}</span>
                  </div>
                ))}
                {!txns.length && <p className="text-xs text-slate-400 text-center py-4">{t('noData')}</p>}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-16">
              <Wallet size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{lang === 'bn' ? 'রিসেলার নির্বাচন করুন' : 'Select a reseller'}</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'recharge' ? t('walletRecharge') : t('resellers_payment')} width="max-w-sm">
        <div className="space-y-3">
          <div><label className="label">{t('amount')} <span className="text-red-500">*</span></label>
            <input type="number" min="1" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus /></div>
          <div><label className="label">{t('date')}</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">{t('note')}</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
          <button className="btn-primary" onClick={submit}>{t('save')}</button>
        </div>
      </Modal>
    </div>
  )
}

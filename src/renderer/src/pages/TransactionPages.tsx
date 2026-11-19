import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, useToast, PageHeader, useReflist } from '../components/ui'
import { money, todayStr, monthStartEnd, thisMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { FieldInput } from '../components/EntityPage'
import { ENTITIES } from '@shared/entities'

// Income/Expense transactions pages (bespoke create through transactions:create)
export function TransactionPages({ type, mode }: { type: 'income' | 'expense'; mode?: 'add' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const { from, to } = monthStartEnd(thisMonth())
  const [f, setF] = useState({ from, to })
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(mode === 'add')

  const load = () => {
    setLoading(true)
    window.api.db.list('transactions', { page, pageSize: 20, search, filters: { type } })
      .then((r: any) => { setRows(r.rows); setTotal(r.total) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => { load() }, [page, search, type])
  React.useEffect(() => { setPage(1) }, [search])

  const columns: Column[] = [
    { key: 'date', label: t('date') },
    { key: '_account_id_label', label: t('accounts_bank'), render: (r) => r._account_id_label || '-' },
    { key: '_category_id_label', label: t('expenses_categories'), render: (r) => r._category_id_label || '-' },
    { key: 'description', label: t('description') },
    { key: 'amount', label: t('amount'), align: 'right', render: (r) => <b className={type === 'income' ? 'text-emerald-600' : 'text-red-600'}>{money(r.amount)}</b> },
    { key: 'ref', label: t('reference'), render: (r) => r.ref || '-' }
  ]

  return (
    <div>
      <PageHeader
        title={type === 'income' ? t('accounts_income') : t('accounts_expense')}
        actions={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={16} /> {t('add')}</button>}
      />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={20} onPage={setPage}
        search={search} onSearch={setSearch} loading={loading} exportName={`${type}s`} />
      {addOpen && <TxnModal type={type} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load() }} />}
    </div>
  )
}

function TxnModal({ type, onClose, onSaved }: { type: 'income' | 'expense'; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [form, setForm] = useState({ account_id: '', category_id: '', date: todayStr(), amount: '', description: '' })
  const [busy, setBusy] = useState(false)
  const cats = useReflist('expense_categories')
  const accounts = useReflist('accounts')

  const submit = async () => {
    if (!form.account_id || !form.amount || !form.description) {
      toast.push('error', lang === 'bn' ? 'সব ঘর পূরণ করুন' : 'Fill all required fields')
      return
    }
    setBusy(true)
    try {
      await window.api.transactions.create({
        account_id: Number(form.account_id), type, category_id: form.category_id ? Number(form.category_id) : null,
        date: form.date, amount: Number(form.amount), description: form.description
      })
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={(type === 'income' ? t('income') : t('expense')) + ' — ' + t('add')} width="max-w-md">
      <div className="space-y-3">
        <div>
          <label className="label">{t('accounts_bank')} <span className="text-red-500">*</span></label>
          <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
            <option value="">—</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('expenses_categories')}</label>
          <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">—</option>
            {cats.filter((c) => !c.label.includes(type === 'income' ? 'expense' : 'income')).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('date')}</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('amount')} <span className="text-red-500">*</span></label>
            <input type="number" min="1" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">{t('description')} <span className="text-red-500">*</span></label>
          <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{t('save')}</button>
      </div>
    </Modal>
  )
}

// Account transfers page
export function TransfersPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ from_account_id: '', to_account_id: '', amount: '', date: todayStr(), note: '' })
  const accounts = useReflist('accounts')
  const [tick, setTick] = useState(0)

  React.useEffect(() => {
    window.api.db.list('account_transfers', { page: 1, pageSize: 100 }).then((r: any) => setRows(r.rows)).catch(() => {})
  }, [tick])

  const submit = async () => {
    try {
      await window.api.accountTransfers.create({
        from_account_id: Number(form.from_account_id), to_account_id: Number(form.to_account_id),
        amount: Number(form.amount), date: form.date, note: form.note
      })
      toast.push('success', t('saved'))
      setOpen(false)
      setTick((x) => x + 1)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('accounts_transfer')}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {t('add')}</button>} />
      <DataTable columns={[
        { key: 'date', label: t('date') },
        { key: '_from_account_id_label', label: t('from'), render: (r) => r._from_account_id_label || '-' },
        { key: '_to_account_id_label', label: t('to'), render: (r) => r._to_account_id_label || '-' },
        { key: 'amount', label: t('amount'), align: 'right', render: (r) => <b>{money(r.amount)}</b> },
        { key: 'note', label: t('note'), render: (r) => r.note || '-' }
      ]} rows={rows} exportName="account-transfers" />
      <Modal open={open} onClose={() => setOpen(false)} title={t('accounts_transfer')} width="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="label">{t('from')} <span className="text-red-500">*</span></label>
            <select className="input" value={form.from_account_id} onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('to')} <span className="text-red-500">*</span></label>
            <select className="input" value={form.to_account_id} onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t('amount')} <span className="text-red-500">*</span></label>
              <input type="number" min="1" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label className="label">{t('date')}</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div><label className="label">{t('note')}</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
          <button className="btn-primary" onClick={submit}>{t('save')}</button>
        </div>
      </Modal>
    </div>
  )
}

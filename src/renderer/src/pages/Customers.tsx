import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Eye, Wallet, Power, RefreshCw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, PageHeader } from '../components/ui'
import { money, dateFmt, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'
import { useReflist } from '../components/ui'

export default function CustomersPage({ titleKey, mode }: { titleKey?: string; mode?: 'new' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [params] = useSearchParams()
  const statusParam = params.get('status') || 'all'
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(!!mode)
  const [toggling, setToggling] = useState<any>(null)
  const [areas] = [useReflist('areas')]
  const [packages] = [useReflist('packages')]

  const filters = useMemo(() => {
    const f: Record<string, any> = {}
    if (!['all', 'due', 'paid', 'expired', 'free'].includes(statusParam)) f.status = statusParam
    return f
  }, [statusParam])

  const load = useCallback(() => {
    setLoading(true)
    window.api.customers.list({ page, pageSize: 20, search, status: statusParam === 'all' ? undefined : statusParam })
      .then((r: any) => { setRows(r.rows); setTotal(r.total) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, search, statusParam])

  useEffect(() => { load() }, [load])

  useEffect(() => { setPage(1) }, [statusParam, search])

  const statusLabel = (s: string) => {
    if (s === 'due' || s === 'paid' || s === 'expired' || s === 'free' || s === 'all') return s
    const labels: Record<string, string> = { active: t('active'), inactive: t('inactive'), disconnected: t('disconnected') }
    return labels[s] || s
  }

  const columns: Column[] = [
    { key: 'code', label: t('customerCode'), className: 'font-mono text-xs' },
    { key: 'name', label: t('name'), render: (r) => (
      <Link to={`/customers/profile/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.name}</Link>
    )},
    { key: 'mobile', label: t('mobile') },
    { key: 'address', label: t('address'), render: (r) => <span className="text-xs">{r.address ? r.address.slice(0, 28) : '-'}</span> },
    { key: '_area', label: t('area') },
    { key: '_package', label: t('package') },
    { key: 'monthly_bill', label: t('monthlyBill'), align: 'right', render: (r) => money(r.monthly_bill) },
    { key: 'total_due', label: t('due'), align: 'right', render: (r) => (
      <span className={Number(r.total_due) > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>{money(r.total_due)}</span>
    )},
    { key: 'advance_balance', label: t('advance'), align: 'right', render: (r) => r.advance_balance ? money(r.advance_balance) : '-' },
    { key: 'connection_date', label: t('connectionDate'), render: (r) => dateFmt(r.connection_date) },
    { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> }
  ]

  return (
    <div>
      <PageHeader
        title={titleKey ? t(titleKey) : t('customers_all')}
        subtitle={`${total} ${lang === 'bn' ? 'জন গ্রাহক' : 'customers'}${statusParam !== 'all' ? ` — ${statusLabel(statusParam)}` : ''}`}
        actions={
          <button className="btn-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> {t('customers_new')}</button>
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
        exportName={`customers-${statusParam}`}
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <Link to={`/customers/profile/${r.id}`} className="btn-secondary btn-sm" title={t('profile')}><Eye size={13} /></Link>
            {r.status === 'active' ? (
              <button className="btn-secondary btn-sm text-amber-600" title={t('connections_disconnect')}
                onClick={() => setToggling({ ...r, to: 'inactive' })}><Power size={13} /></button>
            ) : (
              <button className="btn-secondary btn-sm text-emerald-600" title={t('connections_reconnect')}
                onClick={() => setToggling({ ...r, to: 'active' })}><RefreshCw size={13} /></button>
            )}
          </div>
        )}
      />

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} areas={areas} packages={packages} />

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          window.api.customers.setStatus(toggling.id, toggling.to)
            .then(() => { toast.push('success', t('saved')); load() })
            .catch((e) => toast.push('error', errMsg(e)))
        }}
        title={toggling?.to === 'inactive' ? t('connections_disconnect') : t('connections_reconnect')}
        message={`${toggling?.name} — ${toggling?.code}`}
      />
    </div>
  )
}

// ---------- Customer Form ----------
export function CustomerForm({ open, onClose, onSaved, areas, packages, editing }: {
  open: boolean; onClose: () => void; onSaved: () => void
  areas: { id: number; label: string }[]; packages: { id: number; label: string }[]; editing?: any
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(editing ? { ...editing } : {
      name: '', father_name: '', mobile: '', address: '', area_id: '', sub_area_id: '', road_id: '',
      package_id: '', monthly_bill: '', connection_fee: '', connection_date: todayStr(), nid: '', note: '', status: 'active'
    })
    setErr({})
  }, [open, editing])

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.name?.trim()) e.name = t('required')
    if (!/^01[3-9]\d{8}$/.test(String(f.mobile || '').trim())) e.mobile = t('required') + ' (01XXXXXXXXX)'
    setErr(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const data = { ...f, area_id: f.area_id || null, package_id: f.package_id || null, sub_area_id: f.sub_area_id || null, road_id: f.road_id || null }
    try {
      if (editing) await window.api.customers.update(editing.id, data)
      else await window.api.customers.create(data)
      toast.push('success', t('saved'))
      onSaved()
    } catch (err) {
      toast.push('error', errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: string, label: string, node: React.ReactNode, span = 1) => (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label className="label">{label}{(key === 'name' || key === 'mobile') && <span className="text-red-500"> *</span>}</label>
      {node}
      {err[key] && <p className="text-xs text-red-500 mt-0.5">{err[key]}</p>}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('edit') + ' — ' + t('customer') : t('customers_new')} width="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{t('customerInfo')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('name', t('name'), <input className="input" value={f.name || ''} onChange={(e) => set('name', e.target.value)} autoFocus />)}
          {field('father_name', t('fatherName'), <input className="input" value={f.father_name || ''} onChange={(e) => set('father_name', e.target.value)} />)}
          {field('mobile', t('mobile'), <input className="input" placeholder="01XXXXXXXXX" value={f.mobile || ''} onChange={(e) => set('mobile', e.target.value)} />)}
          {field('nid', 'NID', <input className="input" value={f.nid || ''} onChange={(e) => set('nid', e.target.value)} />)}
          {field('address', t('address'), <textarea className="input min-h-[60px]" value={f.address || ''} onChange={(e) => set('address', e.target.value)} />, 2)}
          {field('area_id', t('area'), (
            <select className="input" value={f.area_id ?? ''} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">—</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          ))}
          {field('note', t('note'), <input className="input" value={f.note || ''} onChange={(e) => set('note', e.target.value)} />)}
        </div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mt-4 mb-2">{t('connectionInfo')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('package_id', t('package'), (
            <select className="input" value={f.package_id ?? ''} onChange={(e) => {
              set('package_id', e.target.value)
              const p = packages.find((x) => String(x.id) === e.target.value)
              // keep user-set monthly_bill if present
              if (p && !f.monthly_bill) set('monthly_bill', '')
            }}>
              <option value="">—</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          ))}
          {field('connection_date', t('connectionDate'), <input type="date" className="input" value={f.connection_date || ''} onChange={(e) => set('connection_date', e.target.value)} />)}
          {field('monthly_bill', t('monthlyBill'), <input type="number" min="0" step="0.01" className="input" value={f.monthly_bill ?? ''} onChange={(e) => set('monthly_bill', e.target.value)} />)}
          {field('connection_fee', t('connectionFee'), <input type="number" min="0" step="0.01" className="input" value={f.connection_fee ?? ''} onChange={(e) => set('connection_fee', e.target.value)} />)}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('loading') : t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

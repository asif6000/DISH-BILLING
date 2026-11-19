import React, { useCallback, useEffect, useState } from 'react'
import { Power, RefreshCw, ArrowLeftRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, PageHeader, useReflist } from '../components/ui'
import { money, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'

// Connections list = customers with connection actions
export function ConnectionsPage({ mode }: { mode?: 'history' }) {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<any>(null) // {customer, type}
  const [transferring, setTransferring] = useState<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    window.api.customers.list({ page, pageSize: 20, search }).then((r: any) => { setRows(r.rows); setTotal(r.total) }).catch(() => {}).finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  if (mode === 'history') {
    // show all connection events across customers
    return <ConnectionHistory />
  }

  const act = (status: string) => {
    window.api.customers.setStatus(action.customer.id, status)
      .then(() => { toast.push('success', t('saved')); setAction(null); load() })
      .catch((e) => toast.push('error', errMsg(e)))
  }

  return (
    <div>
      <PageHeader title={t('connections_all')} subtitle={t('customers_history') + ' → ' + t('connections_history')} />
      <DataTable
        columns={[
          { key: 'code', label: t('customerCode'), className: 'font-mono text-xs' },
          { key: 'name', label: t('name'), render: (r) => <Link className="text-brand-600 hover:underline" to={`/customers/profile/${r.id}`}>{r.name}</Link> },
          { key: 'mobile', label: t('mobile') },
          { key: '_area', label: t('area') },
          { key: 'connection_date', label: t('connectionDate') },
          { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> }
        ]}
        rows={rows} total={total} page={page} pageSize={20} onPage={setPage} search={search} onSearch={setSearch}
        loading={loading} exportName="connections"
        actions={(r) => (
          <div className="flex justify-end gap-1">
            {r.status !== 'active'
              ? <button className="btn-secondary btn-sm text-emerald-600" title={t('connections_reconnect')} onClick={() => setAction({ customer: r, type: 'reconnect' })}><RefreshCw size={13} /></button>
              : <>
                  <button className="btn-secondary btn-sm text-amber-600" title={t('customers_inactive')} onClick={() => setAction({ customer: r, type: 'temp' })}><Power size={13} /></button>
                  <button className="btn-secondary btn-sm text-red-600" title={t('connections_disconnect')} onClick={() => setAction({ customer: r, type: 'perm' })}><PowerOff size={13} /></button>
                </>}
            <button className="btn-secondary btn-sm text-brand-600" title={t('transferCustomer')} onClick={() => setTransferring(r)}><ArrowLeftRight size={13} /></button>
          </div>
        )}
      />
      <ConfirmDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={() => act(action.type === 'reconnect' ? 'active' : action.type === 'temp' ? 'inactive' : 'disconnected')}
        title={action?.type === 'reconnect' ? t('connections_reconnect') : t('connections_disconnect')}
        message={`${action?.customer?.name} (${action?.customer?.code})`}
      />
      {transferring && <TransferModal customer={transferring} onClose={() => setTransferring(null)} onSaved={() => { setTransferring(null); load() }} />}
    </div>
  )
}

function PowerOff({ size }: { size: number }) {
  return <Power size={size} className="rotate-180" />
}

export function ConnectionHistory() {
  const { t } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    window.api.customers.connectionsHistory({ page, pageSize: 20, search })
      .then((r: any) => { setRows(r.rows); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader title={t('connections_history')} />
      <DataTable
        columns={[
          { key: 'date', label: t('date') },
          { key: 'customer_code', label: t('customerCode'), className: 'font-mono text-xs' },
          { key: 'customer_name', label: t('name') },
          { key: '_area', label: t('area') },
          { key: 'action', label: t('type'), render: (r) => <StatusBadge value={r.action} label={r.action} /> },
          { key: 'from_value', label: t('from'), render: (r) => r.from_value || '-' },
          { key: 'to_value', label: t('to'), render: (r) => r.to_value || '-' },
          { key: 'note', label: t('note'), render: (r) => r.note || '-' },
          { key: 'created_by', label: t('username'), render: (r) => r.created_by || '-' }
        ]}
        rows={rows} total={total} page={page} pageSize={20} onPage={setPage} search={search} onSearch={setSearch}
        loading={loading} exportName="connection-history"
      />
    </div>
  )
}

export function TransferModal({ customer, onClose, onSaved }: { customer: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [f, setF] = useState({ area_id: '', sub_area_id: '', address: '' })
  const areas = useReflist('areas')
  const subAreas = useReflist('sub_areas')

  const save = async () => {
    try {
      await window.api.customers.transfer(customer.id, {
        area_id: f.area_id || customer.area_id,
        sub_area_id: f.sub_area_id || null,
        address: f.address || customer.address
      })
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <Modal open onClose={onClose} title={`${t('transferCustomer')} — ${customer.name} (${customer.code})`}>
      <div className="space-y-3">
        <div>
          <label className="label">{t('newArea')} *</label>
          <select className="input" value={f.area_id} onChange={(e) => setF({ ...f, area_id: e.target.value })}>
            <option value="">{customer._area || '—'}</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('areas_sub')}</label>
          <select className="input" value={f.sub_area_id} onChange={(e) => setF({ ...f, sub_area_id: e.target.value })}>
            <option value="">—</option>
            {subAreas.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('newAddress')}</label>
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={customer.address} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={save}>{t('save')}</button>
      </div>
    </Modal>
  )
}

// Shift-only page (address change)
export function ShiftPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [address, setAddress] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      window.api.customers.list({ page: 1, pageSize: 10, search }).then((r: any) => setCustomers(r.rows)).catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const save = async () => {
    if (!sel) return
    try {
      await window.api.customers.shift(sel.id, address)
      toast.push('success', t('saved'))
      setSel(null)
      setAddress('')
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('shiftCustomer')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <input className="input mb-2" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {customers.map((c) => (
              <button key={c.id} onClick={() => { setSel(c); setAddress(c.address || '') }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sel?.id === c.id ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <b>{c.name}</b> <span className="opacity-60 font-mono text-xs">{c.code}</span>
                <div className="text-xs opacity-70 truncate">{c.address || '-'}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <label className="label">{t('newAddress')}</label>
          <textarea className="input min-h-[100px]" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!sel} />
          <button className="btn-primary mt-3 w-full" onClick={save} disabled={!sel || !address}>{t('save')}</button>
        </div>
      </div>
    </div>
  )
}

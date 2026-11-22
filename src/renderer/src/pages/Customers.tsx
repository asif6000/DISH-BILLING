import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Eye, Wallet, Power, RefreshCw, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, PageHeader } from '../components/ui'
import { money, dateFmt, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'
import { useReflist } from '../components/ui'
import { useCan } from '../lib/perms'

export default function CustomersPage({ titleKey, mode }: { titleKey?: string; mode?: 'new' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const can = useCan()
  const canCreate = can('customers', 'create')
  const canEdit = can('customers', 'edit')
  const [params] = useSearchParams()
  const statusParam = params.get('status') || 'all'
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(!!mode)
  const [importOpen, setImportOpen] = useState(false)
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
        <div className="flex gap-2">
          {canCreate && <button className="btn-secondary" onClick={() => setImportOpen(true)}><FileSpreadsheet size={16} className="text-emerald-600" /> {t('importExcel')}</button>}
          {canCreate && <button className="btn-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> {t('customers_new')}</button>}
        </div>
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
              canEdit && <button className="btn-secondary btn-sm text-amber-600" title={t('connections_disconnect')}
                onClick={() => setToggling({ ...r, to: 'inactive' })}><Power size={13} /></button>
            ) : (
              canEdit && <button className="btn-secondary btn-sm text-emerald-600" title={t('connections_reconnect')}
                onClick={() => setToggling({ ...r, to: 'active' })}><RefreshCw size={13} /></button>
            )}
          </div>
        )}
      />

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} areas={areas} packages={packages} />
      {importOpen && <ExcelImportModal areas={areas} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load() }} />}

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

// ================= Excel Import (Bangla + English headers) =================
const HEADER_MAP: Record<string, 'name' | 'address' | 'mobile'> = {
  'নাম': 'name', 'name': 'name', 'গ্রাহকের নাম': 'name', 'customer name': 'name', 'customer': 'name',
  'ঠিকানা': 'address', 'address': 'address',
  'যোগাযোগ': 'mobile', 'মোবাইল': 'mobile', 'মোবাইল নম্বর': 'mobile', 'mobile': 'mobile', 'phone': 'mobile', 'contact': 'mobile', 'mobile number': 'mobile'
}

function normalizeMobile(m: any): string {
  const bn = '০১২৩৪৫৬৭৮৯'
  let d = String(m || '').trim()
  d = d.replace(/[০-৯]/g, (c) => String(bn.indexOf(c)))
  d = d.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('88')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('1')) d = '0' + d
  return d
}

interface ImportRow { name: string; address: string; mobile: string; status: 'valid' | 'duplicate' | 'invalid'; reason: string }

function ExcelImportModal({ areas, onClose, onDone }: { areas: { id: number; label: string }[]; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [areaId, setAreaId] = useState('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name); setResult(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', codepage: 65001 })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
      if (!raw.length) throw new Error(lang === 'bn' ? 'ফাইল খালি' : 'File is empty')
      // find header row (the row that maps to at least name + mobile columns)
      let headerIdx = -1
      let cols: Record<number, string> = {}
      for (let i = 0; i < Math.min(10, raw.length); i++) {
        const c: Record<number, string> = {}
        let hits = 0
        raw[i].forEach((cell: any, j: number) => {
          const key = HEADER_MAP[String(cell).trim().toLowerCase()]
          if (key && !Object.values(c).includes(key)) { c[j] = key; hits++ }
        })
        if (hits >= 2) { headerIdx = i; cols = c; break }
      }
      if (headerIdx < 0) throw new Error(lang === 'bn' ? 'কলাম হেডার পাওয়া যায়নি — নাম/ঠিকানা/যোগাযোগ আছে কিনা দেখুন' : 'Headers not found — need Name/Address/Mobile columns')
      const out: ImportRow[] = []
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const r = raw[i]
        if (!r || !r.some((c: any) => String(c).trim())) continue // blank rows skipped safely
        const nameCol = Number(Object.entries(cols).find(([, v]) => v === 'name')?.[0] ?? -1)
        const addrCol = Number(Object.entries(cols).find(([, v]) => v === 'address')?.[0] ?? -1)
        const mobCol = Number(Object.entries(cols).find(([, v]) => v === 'mobile')?.[0] ?? -1)
        const name = String(r[nameCol] || '').trim()
        const address = String(r[addrCol] || '').trim()
        const mobile = normalizeMobile(r[mobCol])
        let status: ImportRow['status'] = 'valid'; let reason = ''
        if (!name || !/^01[3-9]\d{8}$/.test(mobile)) { status = 'invalid'; reason = lang === 'bn' ? 'নাম বা মোবাইল সঠিক নয়' : 'Invalid name or mobile' }
        out.push({ name, address, mobile, status, reason })
      }
      // duplicate detection: inside file + against existing customers
      const list = await window.api.customers.list({ page: 1, pageSize: 100000 })
      const existing = new Set<string>((list.rows as any[]).map((c: any) => normalizeMobile(c.mobile)))
      const seen = new Set<string>()
      for (const r of out) {
        if (r.status !== 'valid') continue
        if (existing.has(r.mobile)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? 'ডাটাবেসে আছে' : 'Already in database' }
        else if (seen.has(r.mobile)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? 'ফাইলে ডুপ্লিকেট' : 'Duplicate in file' }
        else seen.add(r.mobile)
      }
      setRows(out)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const confirmImport = async () => {
    const valid = rows.filter((r) => r.status === 'valid').map((r) => ({ name: r.name, address: r.address, mobile: r.mobile }))
    if (!valid.length) { toast.push('error', lang === 'bn' ? 'ইমপোর্ট করার মতো কোনো সঠিক রেকর্ড নেই' : 'No valid records to import'); return }
    setBusy(true)
    try {
      const res = await window.api.customers.import(valid, areaId ? Number(areaId) : undefined)
      setResult(res)
      toast.push('success', (lang === 'bn' ? 'ইমপোর্ট সম্পন্ন: ' : 'Import done: ') + res.imported)
      onDone()
    } catch (e) { toast.push('error', errMsg(e)) } finally { setBusy(false) }
  }

  const badge = (s: string) => s === 'valid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : s === 'duplicate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

  return (
    <Modal open onClose={onClose} title={t('importExcel')} width="max-w-3xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{lang === 'bn' ? 'Excel ফাইল (.xlsx / .xls / .csv)' : 'Excel file (.xlsx / .xls / .csv)'}</label>
            <input type="file" accept=".xlsx,.xls,.csv" className="input" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="label">{t('area')} ({lang === 'bn' ? 'ঐচ্ছিক' : 'optional'})</label>
            <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">—</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>
        {fileName && <p className="text-xs text-slate-400">{lang === 'bn' ? 'ফাইল' : 'File'}: {fileName} · {lang === 'bn' ? 'কলাম স্বয়ংক্রিয়ভাবে চেনা হয় (বাংলা/ইংরেজি)' : 'headers auto-detected (Bangla/English)'}</p>}
        {rows.length > 0 && !result && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'মোট রেকর্ড' : 'Total'}</div><div className="font-bold">{rows.length}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'সঠিক' : 'Valid'}</div><div className="font-bold text-emerald-600">{rows.filter((r) => r.status === 'valid').length}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'ডুপ্লিকেট' : 'Duplicates'}</div><div className="font-bold text-amber-600">{rows.filter((r) => r.status === 'duplicate').length}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'অবৈধ' : 'Invalid'}</div><div className="font-bold text-red-600">{rows.filter((r) => r.status === 'invalid').length}</div></div>
            </div>
            <div className="max-h-64 overflow-y-auto card">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-2 text-left">SL</th><th className="p-2 text-left">{t('name')}</th>
                  <th className="p-2 text-left">{t('address')}</th><th className="p-2 text-left">{t('mobile')}</th>
                  <th className="p-2 text-left">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="p-2 text-slate-400">{i + 1}</td>
                      <td className="p-2">{r.name || '—'}</td>
                      <td className="p-2 text-xs">{r.address || '—'}</td>
                      <td className="p-2 font-mono text-xs">{r.mobile || '—'}</td>
                      <td className="p-2"><span className={`badge ${badge(r.status)}`}>{r.reason || r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
              <button className="btn-primary" onClick={confirmImport} disabled={busy}>
                {busy ? (lang === 'bn' ? 'ইমপোর্ট হচ্ছে...' : 'Importing...') : `${t('importExcel')} (${rows.filter((r) => r.status === 'valid').length})`}
              </button>
            </div>
          </>
        )}
        {result && (
          <div className="card p-4 space-y-2">
            <h4 className="font-semibold text-sm">{lang === 'bn' ? 'ইমপোর্ট ফলাফল' : 'Import Summary'}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'মোট' : 'Total'}</div><div className="font-bold">{result.total}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'সফল' : 'Imported'}</div><div className="font-bold text-emerald-600">{result.imported}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'ডুপ্লিকেট (বাদ)' : 'Duplicates skipped'}</div><div className="font-bold text-amber-600">{result.duplicates}</div></div>
              <div className="card p-2"><div className="text-[10px] text-slate-400">{lang === 'bn' ? 'অবৈধ (বাদ)' : 'Invalid skipped'}</div><div className="font-bold text-red-600">{result.invalid}</div></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="text-[11px] text-slate-400 max-h-24 overflow-y-auto">
                {result.errors.map((x: string, i: number) => <p key={i}>• {x}</p>)}
              </div>
            )}
            <button className="btn-primary w-full" onClick={onDone}>{lang === 'bn' ? 'ঠিক আছে' : 'Done'}</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

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

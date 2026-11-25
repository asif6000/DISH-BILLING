import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Eye, Wallet, Power, RefreshCw, FileSpreadsheet, Trash2, UserCheck } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from '../components/DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, PageHeader } from '../components/ui'
import { money, dateFmt, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'
import { useReflist } from '../components/ui'
import { useCan, useUser } from '../lib/perms'
import { usePaymentCollectors } from '../components/CollectorPicker'

export default function CustomersPage({ titleKey, mode }: { titleKey?: string; mode?: 'new' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const can = useCan()
  const user = useUser()
  const isCollectorAccount = user?.roleName === 'Collector'
  const canCreate = can('customers', 'create')
  const canEdit = can('customers', 'edit')
  const canDelete = can('customers', 'delete')
  const [params] = useSearchParams()
  const statusParam = params.get('status') || 'all'
  const previousDueParam = params.get('previousDue') === '1'
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(!!mode)
  const [importOpen, setImportOpen] = useState(false)
  const [toggling, setToggling] = useState<any>(null)
  // delete: single-row (deleting) and multi-select (bulk) with confirm dialogs
  const [selected, setSelected] = useState<number[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignmentCollector, setAssignmentCollector] = useState('')
  const [assignmentConfirm, setAssignmentConfirm] = useState(false)
  const { list: collectorOptions } = usePaymentCollectors()
  const [deleting, setDeleting] = useState<any>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  // Area filter dropdown (between Search and the Excel/PDF/CSV buttons)
  const [areaFilter, setAreaFilter] = useState('')
  const [collectorFilter, setCollectorFilter] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [areas] = [useReflist('areas')]
  const [packages] = [useReflist('packages')]

  const filters = useMemo(() => {
    const f: Record<string, any> = {}
    if (!['all', 'due', 'paid', 'expired', 'free'].includes(statusParam)) f.status = statusParam
    return f
  }, [statusParam])

  const load = useCallback(() => {
    setLoading(true)
    window.api.customers.list({
      page, pageSize: 20, search,
      status: statusParam === 'all' ? undefined : statusParam,
      areaId: areaFilter ? Number(areaFilter) : undefined,
      collectorId: collectorFilter ? Number(collectorFilter) : undefined,
      dueOnly,
      previousDueOnly: previousDueParam
    })
      .then((r: any) => { setRows(r.rows); setTotal(r.total); setSelected([]) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, search, statusParam, areaFilter, collectorFilter, dueOnly, previousDueParam])

  useEffect(() => { load() }, [load])

  useEffect(() => { setPage(1) }, [statusParam, search, areaFilter, collectorFilter, dueOnly, previousDueParam])

  // administrators can assign/change/remove the collector inline (collector
  // accounts can never reassign customers — the backend enforces this too)
  const canAssignCollector = canEdit && !isCollectorAccount
  const assignOneCollector = async (row: any, value: string) => {
    setAssigningId(row.id)
    try {
      await window.api.customers.setCollector([row.id], value ? Number(value) : null)
      toast.push('success', lang === 'bn' ? 'কালেক্টর আপডেট হয়েছে' : 'Collector updated')
      load()
    } catch (e) {
      toast.push('error', errMsg(e))
    } finally {
      setAssigningId(null)
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'due' || s === 'paid' || s === 'expired' || s === 'free' || s === 'all') return s
    const labels: Record<string, string> = { active: t('active'), inactive: t('inactive'), disconnected: t('disconnected') }
    return labels[s] || s
  }

  const columns: Column[] = [
    { key: 'code', label: t('customerCode'), className: 'font-mono text-xs', render: (r) => (
      <div>
        <span className="font-mono text-xs">{r.code}</span>
        {/* area-wise serial: the same serial can exist in other areas — the
            AREA column next to it shows which area this serial belongs to */}
        {r.customer_serial != null && (
          <div className="text-[10px] text-slate-400">{lang === 'bn' ? 'ক্রমিক' : 'Serial'} {r.customer_serial}</div>
        )}
      </div>
    )},
    { key: 'name', label: t('name'), render: (r) => (
      <Link to={`/customers/profile/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.name}</Link>
    )},
    { key: 'mobile', label: t('mobile') },
    { key: 'address', label: t('address'), render: (r) => <span className="text-xs">{r.address ? r.address.slice(0, 28) : '-'}</span> },
    { key: '_area', label: t('area') },
    { key: '_package', label: t('package') },
    { key: '_collector_name', label: lang === 'bn' ? 'নির্ধারিত কালেক্টর' : 'Assigned Collector', render: (r) => {
      // inline assignment: assign / change / remove the collector straight from the
      // list row. Collector accounts are locked and only see a badge.
      if (!canAssignCollector) {
        return r._collector_name
          ? <span className="text-xs font-medium text-brand-600">{r._collector_name}</span>
          : <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Unassigned'}</span>
      }
      const known = collectorOptions.some((c: any) => Number(c.id) === Number(r.collector_id))
      return (
        <select
          className="input !py-1 !text-xs !w-44"
          value={r.collector_id ?? ''}
          disabled={assigningId === r.id}
          title={lang === 'bn' ? 'কালেক্টর অ্যাসাইন করুন' : 'Assign collector'}
          onChange={(e) => assignOneCollector(r, e.target.value)}
        >
          <option value="">{lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Unassigned'}</option>
          {r.collector_id && !known && <option value={r.collector_id}>{r._collector_name || `#${r.collector_id}`}</option>}
          {collectorOptions.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )
    } },
    { key: 'assignment_status', label: lang === 'bn' ? 'অ্যাসাইনমেন্ট স্ট্যাটাস' : 'Assignment', render: (r) => (
      r.collector_id
        ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{lang === 'bn' ? 'Assigned' : 'Assigned'}</span>
        : <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{lang === 'bn' ? 'Unassigned' : 'Unassigned'}</span>
    ) },
    { key: 'monthly_bill', label: t('monthlyBill'), align: 'right', render: (r) => money(r.monthly_bill) },
    { key: 'previous_due_bill', label: t('previousDueBill'), align: 'right', render: (r) => (
      Number(r.previous_due_bill) > 0
        ? <span className="font-semibold text-amber-600 dark:text-amber-400">{money(r.previous_due_bill)}</span>
        : '-'
    )},
    { key: 'total_due', label: t('due'), align: 'right', render: (r) => (
      <span className={Number(r.total_due) > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>{money(r.total_due)}</span>
    )},
    { key: 'advance_balance', label: t('advance'), align: 'right', render: (r) => r.advance_balance ? money(r.advance_balance) : '-' },
    { key: 'connection_date', label: t('connectionDate'), render: (r) => dateFmt(r.connection_date) },
    { key: 'status', label: t('statusCol'), render: (r) => (
      <div className="flex items-center gap-1">
        <StatusBadge value={r.status} label={t(r.status)} />
        {r.connection_type === 'free' && (
          <span className="badge bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" title={t('connectionType')}>{t('free')}</span>
        )}
      </div>
    ) }
  ]

  return (
    <div>
      <PageHeader
        title={titleKey ? t(titleKey) : t('customers_all')}
        subtitle={`${total} ${lang === 'bn' ? 'জন গ্রাহক' : 'customers'}${statusParam !== 'all' ? ` — ${statusLabel(statusParam)}` : ''}`}
        actions={
        <div className="flex gap-2">
          {canDelete && selected.length > 0 && (
            <>
              <button className="btn-secondary !border-red-300 dark:!border-red-900 text-red-600 dark:text-red-400" onClick={() => setBulkDeleting(true)}>
                <Trash2 size={16} /> {t('deleteSelected')} ({selected.length})
              </button>
              <button className="btn-secondary" onClick={() => setSelected([])}>{t('cancel')}</button>
            </>
          )}
          {canEdit && !isCollectorAccount && selected.length > 0 && (
            <button className="btn-secondary" onClick={() => setAssignOpen(true)}>
              <UserCheck size={16} /> {lang === 'bn' ? 'কালেক্টর নির্ধারণ' : 'Assign Collector'} ({selected.length})
            </button>
          )}
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
        exportName={`customers-${statusParam}${areaFilter ? `-area${areaFilter}` : ''}`}
        emptyText={areaFilter ? (lang === 'bn' ? 'এই এরিয়ায় কোনো গ্রাহক নেই' : 'No customers in this area') : undefined}
        selectable={canDelete}
        selectedIds={selected}
        onToggleRow={(id, checked) => setSelected((s) => checked ? [...s, id] : s.filter((x) => x !== id))}
        onToggleAllPage={(checked) => setSelected((s) => {
          const ids = rows.map((r) => r.id)
          return checked ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x))
        })}
        extraToolbar={
          <>
            <select className="input !w-44 !py-1.5" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} title={t('area')}>
              <option value="">{lang === 'bn' ? 'সব এরিয়া' : 'All Areas'}</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            {!isCollectorAccount && (
              <select className="input !w-44 !py-1.5" value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)} title={lang === 'bn' ? 'কালেক্টর' : 'Collector'}>
                <option value=""> {lang === 'bn' ? 'সব কালেক্টর' : 'All Collectors'}</option>
                {collectorOptions.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
              {lang === 'bn' ? 'শুধু বকেয়া' : 'Due customers'}
            </label>
            {canDelete && rows.length > 0 && selected.length < total && (
              <button className="btn-secondary !py-1.5 text-xs" title={lang === 'bn' ? `সব ${total} জন নির্বাচন করুন (সব পেজ)` : `Select all ${total} customers (all pages)`}
                onClick={async () => {
                  try {
                    const r = await window.api.customers.list({
                      page: 1, all: true, search,
                      status: statusParam === 'all' ? undefined : statusParam,
                      areaId: areaFilter ? Number(areaFilter) : undefined,
                      collectorId: collectorFilter ? Number(collectorFilter) : undefined,
                      dueOnly
                    })
                    setSelected((r.rows as any[]).map((x) => x.id))
                  } catch (e) { toast.push('error', errMsg(e)) }
                }}>
                {t('selectAll')}
              </button>
            )}
          </>
        }
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
            {canDelete && <button className="btn-secondary btn-sm text-red-600" title={t('delete')} onClick={() => setDeleting(r)}><Trash2 size={13} /></button>}
          </div>
        )}
      />

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load() }} areas={areas} packages={packages} />
      {importOpen && <ExcelImportModal areas={areas} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load() }} />}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)}
        title={lang === 'bn' ? 'নির্বাচিত গ্রাহককে কালেক্টর দিন' : 'Assign selected customers'}
        width="max-w-sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {selected.length} {lang === 'bn' ? 'জন গ্রাহক নির্বাচন করা হয়েছে' : 'customer(s) selected'}
          </p>
          <div>
            <label className="label">{lang === 'bn' ? 'কালেক্টর' : 'Collector'}</label>
            <select className="input" value={assignmentCollector} onChange={(e) => setAssignmentCollector(e.target.value)}>
              <option value="">— {lang === 'bn' ? 'অ্যাসাইনমেন্ট সরান' : 'Remove assignment'} —</option>
              {collectorOptions.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAssignOpen(false)}>{t('cancel')}</button>
            <button className="btn-primary" onClick={() => setAssignmentConfirm(true)}>
              <UserCheck size={15} /> {lang === 'bn' ? 'Confirm Assignment' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={assignmentConfirm}
        onClose={() => setAssignmentConfirm(false)}
        onConfirm={() => {
          window.api.customers.setCollector(selected, assignmentCollector ? Number(assignmentCollector) : null)
            .then(() => {
              toast.push('success', t('saved'))
              setAssignmentConfirm(false)
              setAssignOpen(false)
              setAssignmentCollector('')
              setSelected([])
              load()
            })
            .catch((e) => toast.push('error', errMsg(e)))
        }}
        title={lang === 'bn' ? 'কালেক্টর অ্যাসাইনমেন্ট নিশ্চিত করুন' : 'Confirm Collector Assignment'}
        message={assignmentCollector
          ? `${selected.length} ${lang === 'bn' ? 'জন গ্রাহক নির্বাচিত কালেক্টরে অ্যাসাইন হবে। পূর্বের অ্যাসাইনমেন্ট পরিবর্তন হবে।' : 'selected customer(s) will be reassigned to this collector. Existing assignments will change.'}`
          : `${selected.length} ${lang === 'bn' ? 'জন গ্রাহকের কালেক্টর অ্যাসাইনমেন্ট সরানো হবে।' : 'selected customer(s) will become unassigned.'}`}
      />

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

      {/* single-row delete */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          window.api.customers.remove(deleting.id)
            .then(() => { toast.push('success', t('deleted')); setDeleting(null); load() })
            .catch((e) => toast.push('error', errMsg(e)))
        }}
        title={t('delete')}
        message={`${deleting?.name} — ${deleting?.code}\n${t('deleteCustomerWarning')}`}
      />

      {/* bulk delete (selected rows / select all) */}
      <ConfirmDialog
        open={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={() => {
          window.api.customers.deleteMany(selected)
            .then((res: any) => {
              toast.push('success', `${res?.deleted ?? 0} ${lang === 'bn' ? 'জন মুছে ফেলা হয়েছে' : 'customer(s) deleted'}`)
              setBulkDeleting(false)
              load()
            })
            .catch((e) => toast.push('error', errMsg(e)))
        }}
        title={t('deleteSelected')}
        message={`${selected.length} ${lang === 'bn' ? 'জন গ্রাহক নির্বাচিত' : 'customers selected'}\n${t('deleteCustomerWarning')}`}
      />
    </div>
  )
}

// ---------- Customer Form ----------

// ================= Excel Import (Bangla + English headers) =================
const HEADER_MAP: Record<string, 'name' | 'address' | 'mobile' | 'serial' | 'area'> = {
  'নাম': 'name', 'name': 'name', 'গ্রাহকের নাম': 'name', 'customer name': 'name', 'customer': 'name',
  'ঠিকানা': 'address', 'address': 'address',
  'যোগাযোগ': 'mobile', 'মোবাইল': 'mobile', 'মোবাইল নম্বর': 'mobile', 'mobile': 'mobile', 'phone': 'mobile', 'contact': 'mobile', 'mobile number': 'mobile',
  // area-wise customer serial (NOT globally unique — same serial can exist in many areas)
  'ক্রমিক': 'serial', 'ক্রম': 'serial', 'সিরিয়াল': 'serial', 'serial': 'serial', 'serial no': 'serial', 'serial number': 'serial', 'sl': 'serial', 'sl no': 'serial',
  // area name column (used when no Area is selected in the dropdown)
  'এরিয়া': 'area', 'এরিয়ার নাম': 'area', 'area': 'area', 'area name': 'area', 'zone': 'area'
}

function normalizeSerial(v: any): number | null {
  const bn = '০১২৩৪৫৬৭৮৯'
  const d = String(v ?? '').trim().replace(/[০-৯]/g, (c) => String(bn.indexOf(c)))
  if (!d) return null
  const n = Number(d)
  return isNaN(n) || n < 0 ? null : Math.trunc(n)
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

interface ImportRow { name: string; address: string; mobile: string; serial: number | null; areaName: string; areaId: number | null; status: 'valid' | 'duplicate' | 'invalid'; reason: string }

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
        const serialCol = Number(Object.entries(cols).find(([, v]) => v === 'serial')?.[0] ?? -1)
        const areaCol = Number(Object.entries(cols).find(([, v]) => v === 'area')?.[0] ?? -1)
        const name = String(r[nameCol] || '').trim()
        const address = String(r[addrCol] || '').trim()
        const mobile = normalizeMobile(r[mobCol])
        const serial = normalizeSerial(r[serialCol])
        const areaName = String(r[areaCol] || '').trim()
        // resolve area per-row: selected Area (dropdown) wins, else the Area
        // column matched against existing areas by name
        let rowAreaId: number | null = areaId ? Number(areaId) : null
        let areaNote = ''
        if (rowAreaId == null && areaName) {
          const hit = areas.find((a: any) => String(a.label || '').trim().toLowerCase() === areaName.toLowerCase())
          if (hit) { rowAreaId = hit.id; areaNote = areaName }
        }
        let status: ImportRow['status'] = 'valid'; let reason = ''
        if (!name || !/^01[3-9]\d{8}$/.test(mobile)) { status = 'invalid'; reason = lang === 'bn' ? 'নাম বা মোবাইল সঠিক নয়' : 'Invalid name or mobile' }
        else if (serialCol >= 0 && serial == null && String(r[serialCol] ?? '').trim()) { status = 'invalid'; reason = lang === 'bn' ? 'ক্রমিক সঠিক নয়' : 'Invalid serial' }
        out.push({ name, address, mobile, serial, areaName: areaNote || areaName, areaId: rowAreaId, status, reason })
      }
      // duplicate detection: inside file + against existing customers
      // mobile-based: global; serial-based: area_id + customer_serial pair
      // (the same serial exists in many areas — only the combination is unique)
      const list = await window.api.customers.list({ page: 1, pageSize: 100000 })
      const existing = new Set<string>((list.rows as any[]).map((c: any) => normalizeMobile(c.mobile)))
      const dbSerials = new Set<string>((list.rows as any[]).filter((c: any) => c.customer_serial != null).map((c: any) => `${c.area_id ?? 'x'}|${c.customer_serial}`))
      const seenMobile = new Set<string>()
      const seenSerial = new Set<string>()
      for (const r of out) {
        if (r.status !== 'valid') continue
        const serialKey = `${r.areaId ?? 'x'}|${r.serial ?? ''}`
        if (existing.has(r.mobile)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? 'ডাটাবেসে আছে (মোবাইল)' : 'Already in database' }
        else if (seenMobile.has(r.mobile)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? 'ফাইলে ডুপ্লিকেট (মোবাইল)' : 'Duplicate in file' }
        else if (r.serial != null && dbSerials.has(serialKey)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? `এরিয়ায় ক্রমিক ${r.serial} আগেই আছে` : `Serial ${r.serial} already in this area` }
        else if (r.serial != null && seenSerial.has(serialKey)) { r.status = 'duplicate'; r.reason = lang === 'bn' ? `ফাইলে এরিয়ার ক্রমিক ${r.serial} ডুপ্লিকেট` : `Duplicate serial ${r.serial} in area` }
        else {
          seenMobile.add(r.mobile)
          if (r.serial != null) seenSerial.add(serialKey)
        }
      }
      setRows(out)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const confirmImport = async () => {
    const valid = rows.filter((r) => r.status === 'valid').map((r) => ({ name: r.name, address: r.address, mobile: r.mobile, serial: r.serial, areaName: r.areaId == null ? r.areaName : undefined }))
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
                  <th className="p-2 text-left">{lang === 'bn' ? 'ক্রমিক' : 'Serial'}</th>
                  <th className="p-2 text-left">{t('area')}</th>
                  <th className="p-2 text-left">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="p-2 text-slate-400">{i + 1}</td>
                      <td className="p-2">{r.name || '—'}</td>
                      <td className="p-2 text-xs">{r.address || '—'}</td>
                      <td className="p-2 font-mono text-xs">{r.mobile || '—'}</td>
                      <td className="p-2 font-mono text-xs">{r.serial ?? '—'}</td>
                      <td className="p-2 text-xs">{r.areaId ? (areas.find((a: any) => a.id === r.areaId)?.label || r.areaName || '—') : (r.areaName || '—')}</td>
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
  const { t, lang } = useI18n()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const { list: collectorOptions } = usePaymentCollectors()
  const user = useUser()
  const isCollectorAccount = user?.roleName === 'Collector'

  useEffect(() => {
    if (!open) return
    setF(editing ? { ...editing, collector_id: editing.collector_id ?? '' } : {
      name: '', father_name: '', mobile: '', address: '', area_id: '', sub_area_id: '', road_id: '',
      package_id: '', monthly_bill: '', connection_fee: '', previous_due_bill: '', connection_date: todayStr(), nid: '', note: '', status: 'active', customer_serial: '',
      // Paid/Free dropdown — Paid is the default for new connections;
      // existing rows load their saved type (old rows fall back to Paid)
      connection_type: 'paid',
      // optional collector assignment from the New Connection form
      collector_id: ''
    })
    if (editing) setF((x: any) => ({ ...x, connection_type: editing.connection_type || 'paid' }))
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
    // Free connection: force both amounts to 0 so hidden fields can never
    // submit stale values (backend re-enforces this as well)
    const isFree = f.connection_type === 'free'
    const data = { ...f, area_id: f.area_id || null, package_id: f.package_id || null, sub_area_id: f.sub_area_id || null, road_id: f.road_id || null,
      collector_id: f.collector_id ? Number(f.collector_id) : null,
      monthly_bill: isFree ? 0 : f.monthly_bill, connection_fee: isFree ? 0 : f.connection_fee }
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
          {field('previous_due_bill', t('previousDueBill'), (
            <input type="number" min="0" step="0.01" className="input" value={f.previous_due_bill ?? ''}
              onChange={(e) => set('previous_due_bill', e.target.value)} />
          ))}
          {field('address', t('address'), <textarea className="input min-h-[60px]" value={f.address || ''} onChange={(e) => set('address', e.target.value)} />, 2)}
          {field('area_id', t('area'), (
            <select className="input" value={f.area_id ?? ''} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">—</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          ))}
          {field('customer_serial', lang === 'bn' ? 'ক্রমিক (এরিয়া অনুযায়ী)' : 'Serial (per area)', <input type="number" className="input" value={f.customer_serial ?? ''} onChange={(e) => set('customer_serial', e.target.value)} />)}
          {field('connection_type', t('connectionType'), (
            <select className="input" value={f.connection_type || 'paid'} onChange={(e) => set('connection_type', e.target.value)}>
              <option value="paid">{t('connectionPaid')}</option>
              <option value="free">{t('free')}</option>
            </select>
          ))}
          {/* collector assignment (admin/manager only — collectors are locked to
              their own profile and the backend ignores it for them) */}
          {!isCollectorAccount && field('collector_id', lang === 'bn' ? 'কালেক্টর (ঐচ্ছিক)' : 'Collector (optional)', (
            <select className="input" value={f.collector_id ?? ''} onChange={(e) => set('collector_id', e.target.value)}>
              <option value="">{lang === 'bn' ? '— অ্যাসাইন করা হয়নি —' : '— unassigned —'}</option>
              {f.collector_id && !collectorOptions.some((c: any) => Number(c.id) === Number(f.collector_id)) && (
                <option value={f.collector_id}>{f._collector_name || `#${f.collector_id}`}</option>
              )}
              {collectorOptions.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          ))}
          {editing && field('note', t('note'), <input className="input" value={f.note || ''} onChange={(e) => set('note', e.target.value)} />, 2)}
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
          {f.connection_type !== 'free' && field('monthly_bill', t('monthlyBill'), <input type="number" min="0" step="0.01" className="input" value={f.monthly_bill ?? ''} onChange={(e) => set('monthly_bill', e.target.value)} />)}
          {f.connection_type !== 'free' && field('connection_fee', t('connectionFee'), <input type="number" min="0" step="0.01" className="input" value={f.connection_fee ?? ''} onChange={(e) => set('connection_fee', e.target.value)} />)}
          {f.connection_type === 'free' && (
            <div className="sm:col-span-2 text-xs text-slate-500 bg-sky-50 dark:bg-sky-900/20 rounded-lg p-2.5">
              {lang === 'bn'
                ? 'ফ্রি কানেকশন: মাসিক বিল ও কানেকশন ফি প্রযোজ্য নয় — উভয়ই ৳0 হিসেবে সেভ হবে এবং মাসিক বিল জেনারেট হবে না।'
                : 'Free connection: Monthly Bill & Connection Fee do not apply — both save as ৳0 and no monthly bill is generated.'}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('loading') : t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

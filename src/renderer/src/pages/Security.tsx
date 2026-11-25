import React, { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, KeyRound, Download, Upload, HardDrive, LayoutDashboard } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge, ConfirmDialog } from '../components/ui'
import { DataTable, Column } from '../components/DataTable'
import { money, dateFmt } from '../lib/format'
import { errMsg } from '../lib/api'
import { PERMISSION_CATALOG } from '@shared/permissions'
import { KpiPermissionsModal } from '../components/KpiPermissionsModal'
import { useCollectors } from '../components/CollectorPicker'
import { useCan } from '../lib/perms'

const TABS = ['users', 'roles', 'logs', 'logins', 'backup'] as const
type Tab = typeof TABS[number]

export default function SecurityPage({ tab: initial }: { tab?: string }) {
  const { t, lang } = useI18n()
  const can = useCan()
  const canSecurity = can('security')
  // User Management lives under /security/users but is protected by the
  // 'users' permission — an account with users.access must not be blocked by
  // the broader Security guard (this caused a false "no permission" page for
  // Administrators whose role grants users but not security).
  const canUsers = can('users')
  const allowedTabs = TABS.filter((tb) => tb === 'users' ? (canUsers || canSecurity) : canSecurity)
  const requested = initial as Tab | undefined
  const [tab, setTab] = useState<Tab>(requested && allowedTabs.includes(requested) ? requested : (allowedTabs[0] || 'users'))
  useEffect(() => {
    setTab(requested && allowedTabs.includes(requested) ? requested : (allowedTabs[0] || 'users'))
  }, [initial, canSecurity, canUsers])

  // direct-URL guard: Users needs users.access; Roles/Logs/Backup need the
  // security module. The backend denies every action anyway — this keeps the
  // UI honest without blocking a legitimate User Manager.
  if (requested ? !allowedTabs.includes(requested) : !allowedTabs.length) {
    return (
      <div>
        <PageHeader title={t('nav_security')} />
        <div className="card p-6 text-center text-sm text-slate-500">
          {lang === 'bn' ? 'আপনার এই অংশের অনুমতি নেই।' : 'You do not have permission for this section.'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('nav_security')} />
      <div className="flex gap-1 mb-4 flex-wrap">
        {allowedTabs.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${tab === tb ? 'bg-brand-600 text-white' : 'card hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {tb === 'users' ? t('security_users') : tb === 'roles' ? t('security_roles') : tb === 'logs' ? t('security_logs') : tb === 'logins' ? t('security_logins') : t('security_backup')}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'logins' && <LoginsTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  )
}

function UsersTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [deleting, setDeleting] = useState<any>(null)
  const [permUser, setPermUser] = useState<any>(null)
  const [kpiUser, setKpiUser] = useState<any>(null)

  const load = () => {
    window.api.users.list().then(setRows).catch((e) => toast.push('error', errMsg(e)))
    window.api.roles.list().then(setRoles).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex justify-end mb-3 gap-2">
        <button className="btn-secondary" onClick={() => setPwOpen(true)}><KeyRound size={15} /> {t('changePassword')}</button>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}><Plus size={16} /> {t('add')}</button>
      </div>
      <DataTable columns={[
        { key: 'username', label: t('username'), className: 'font-mono' },
        { key: 'full_name', label: t('name') },
        { key: 'mobile', label: t('mobile') },
        { key: 'role_name', label: t('role') },
        { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> },
        { key: 'last_login', label: t('security_logins'), render: (r) => r.last_login ? String(r.last_login).slice(0, 16) : '-' }
      ]} rows={rows} exportName="users"
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm" title={lang === 'bn' ? 'ড্যাশবোর্ড KPI পারমিশন' : 'Dashboard KPI permissions'} onClick={() => setKpiUser(r)}><LayoutDashboard size={13} /></button>
            <button className="btn-secondary btn-sm" title={t('permissionTitle')} onClick={() => setPermUser(r)}><KeyRound size={13} /></button>
            <button className="btn-secondary btn-sm" onClick={() => { setEditing(r); setOpen(true) }}><Pencil size={13} /></button>
            <button className="btn-secondary btn-sm text-red-600" onClick={() => setDeleting(r)}><Trash2 size={13} /></button>
          </div>
        )} />
      <UserModal open={open} onClose={() => setOpen(false)} editing={editing} roles={roles} onSaved={() => { setOpen(false); load() }} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => window.api.users.delete(deleting.id).then(() => { toast.push('success', t('deleted')); load() }).catch((e) => toast.push('error', errMsg(e)))}
        title={t('delete')} message={`${deleting?.username} — ${t('confirmDelete')}`} />
      {permUser && <PermissionModal user={permUser} onClose={() => setPermUser(null)} />}
      {kpiUser && <KpiPermissionsModal user={kpiUser} onClose={() => setKpiUser(null)} />}
    </div>
  )
}

// ================= Dynamic Permission Management (delegation-aware) =================
function PermissionModal({ user, onClose }: any) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [data, setData] = useState<any>(null)
  const [grants, setGrants] = useState<Record<string, boolean>>({})
  const [delegable, setDelegable] = useState<Record<string, boolean>>({})
  const [audit, setAudit] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [isSuper, setIsSuper] = useState(false)

  const load = () => {
    window.api.users.permsGet(user.id).then((r: any) => {
      setData(r)
      const g: Record<string, boolean> = {}
      const d: Record<string, boolean> = {}
      for (const gr of r.grants || []) { g[gr.permission_key] = true; d[gr.permission_key] = !!gr.can_delegate }
      setGrants(g); setDelegable(d)
    }).catch((e) => toast.push('error', errMsg(e)))
    window.api.users.permsAudit(user.id).then(setAudit).catch(() => setAudit([]))
  }
  useEffect(() => {
    window.api.auth.check().then((r: any) => setIsSuper(!!r?.user?.permissions?.includes('all'))).catch(() => {})
    if (user) load()
  }, [user])

  const save = async () => {
    setBusy(true)
    try {
      const list = Object.keys(grants).filter((k) => grants[k]).map((k) => ({ key: k, canDelegate: delegable[k] !== false }))
      await window.api.users.permsSet(user.id, list)
      toast.push('success', t('saved'))
      load()
    } catch (e) { toast.push('error', errMsg(e)) } finally { setBusy(false) }
  }

  if (!data) return null
  return (
    <Modal open onClose={onClose} title={`${t('permissionTitle')} — ${data.user.username} (${data.user.role_name})`} width="max-w-3xl">
      <div className="space-y-3">
        {data.user.role_name === 'SUPER_ADMIN' ? (
          <p className="text-sm text-slate-400">{lang === 'bn' ? 'SUPER_ADMIN এর ক্ষমতা পরিবর্তন করা যায় না' : 'SUPER_ADMIN permissions cannot be modified'}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-xs text-slate-400">{lang === 'bn' ? 'Role থেকে পাওয়া:' : 'From role:'}</span>
              {(data.rolePermissions || []).map((p: string) => <span key={p} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px]">{p}</span>)}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {PERMISSION_CATALOG.map((m) => (
                <div key={m.module} className="card p-3">
                  <div className="font-semibold text-sm mb-2">{lang === 'bn' ? m.labelBn : m.label}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {m.actions.map((a) => {
                      const key = `${m.module}.${a.key}`
                      const fromRole = (data.rolePermissions || []).includes(m.module) || (data.rolePermissions || []).includes(key)
                      return (
                        <label key={key} className={`flex items-center gap-2 text-xs p-2 rounded border ${fromRole ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'} cursor-pointer`}>
                          <input type="checkbox" disabled={fromRole}
                            checked={fromRole || !!grants[key]}
                            onChange={(e) => setGrants((g) => ({ ...g, [key]: e.target.checked }))} />
                          <span className="truncate">{lang === 'bn' ? a.labelBn : a.label}</span>
                          {fromRole && <span className="text-[9px] text-emerald-600">role</span>}
                        </label>
                      )
                    })}
                  </div>
                  {isSuper && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                      <input type="checkbox" checked={Object.keys(delegable).some((k) => k.startsWith(m.module + '.')) ? m.actions.every((a) => delegable[`${m.module}.${a.key}`] !== false) : true}
                        onChange={(e) => {
                          const nd = { ...delegable }
                          for (const a of m.actions) nd[`${m.module}.${a.key}`] = e.target.checked
                          setDelegable(nd)
                        }} />
                      {lang === 'bn' ? 'এই মডিউল delegate করতে পারবে (staff-কে দেওয়ার ক্ষমতা)' : 'Can delegate this module to their staff'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? '...' : t('save')}</button>
            </div>
          </>
        )}
        <div>
          <h4 className="font-semibold text-sm mb-1">{t('permissionHistory')}</h4>
          {audit.length ? (
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="p-1 text-slate-400">{String(a.created_at).slice(0, 16)}</td>
                      <td className="p-1 font-mono">{a.permission_key}</td>
                      <td className={`p-1 font-semibold ${a.action === 'grant' ? 'text-emerald-600' : 'text-red-600'}`}>{a.action}</td>
                      <td className="p-1 text-slate-400">{a.actor || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-slate-400">{t('noData')}</p>}
        </div>
      </div>
    </Modal>
  )
}

function UserModal({ open, onClose, editing, roles, onSaved }: any) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [isSuper, setIsSuper] = useState(false)
  useEffect(() => { window.api.auth.check().then((r: any) => setIsSuper(!!r?.user?.permissions?.includes('all'))).catch(() => {}) }, [])
  // RBAC: ADMIN (non-super) can only create/edit MANAGER & COLLECTOR accounts.
  // Role/status edits are SUPER_ADMIN privileges — hidden from the form too.
  const roleOptions = isSuper ? roles : roles.filter((r: any) => r.name === 'Manager' || r.name === 'Collector')

  useEffect(() => {
    if (!open) return
    setF(editing ? { ...editing, password: '' } : { username: '', full_name: '', mobile: '', password: '', role_id: '', status: 'active' })
  }, [open, editing])
  // active collectors for the optional explicit user↔collector link
  const { list: collectors } = useCollectors()

  const submit = async () => {
    if (!f.username || !f.full_name || (!editing && !f.password) || !f.role_id) {
      toast.push('error', lang === 'bn' ? 'সব ঘর পূরণ করুন' : 'Fill all required fields')
      return
    }
    setBusy(true)
    try {
      const savedId: number = editing ? editing.id : await window.api.users.create(f)
      if (editing) await window.api.users.update(editing.id, f)
      // explicit link (optional) — the collector dashboard uses this identity
      await window.api.users.linkCollector(savedId, f.collector_id ? Number(f.collector_id) : null)
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={(editing ? t('edit') : t('add')) + ' — ' + t('users')} width="max-w-md">
      <div className="space-y-3">
        <div><label className="label">{t('username')} <span className="text-red-500">*</span></label>
          <input className="input" value={f.username || ''} disabled={!!editing} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div><label className="label">{t('name')} <span className="text-red-500">*</span></label>
          <input className="input" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><label className="label">{t('mobile')}</label>
          <input className="input" value={f.mobile || ''} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
        <div><label className="label">{editing ? t('newPassword') : t('password')}{!editing && <span className="text-red-500"> *</span>}</label>
          <input type="password" className="input" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={editing ? '(unchanged)' : 'min 6 chars'} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t('role')} <span className="text-red-500">*</span></label>
            <select className="input" value={f.role_id || ''} onChange={(e) => setF({ ...f, role_id: e.target.value })} disabled={!isSuper && !!editing}>
              <option value="">—</option>
              {roleOptions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {!isSuper && <p className="text-[10px] text-slate-400">{lang === 'bn' ? 'Admin শুধু Manager/Collector তৈরি করতে পারে' : 'Admin can only create Manager/Collector accounts'}</p>}
          </div>
          <div><label className="label">{t('statusCol')}</label>
            <select className="input" value={f.status || 'active'} onChange={(e) => setF({ ...f, status: e.target.value })} disabled={!isSuper && !!editing}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
              {isSuper && <option value="suspended">{lang === 'bn' ? 'স্থগিত' : 'Suspended'}</option>}
            </select></div>
        </div>
        <div>
          <label className="label">{lang === 'bn' ? 'Collector প্রোফাইল লিংক' : 'Linked collector profile'} <span className="text-[10px] text-slate-400">({lang === 'bn' ? 'ঐচ্ছিক' : 'optional'})</span></label>
          <select className="input" value={f.collector_id || ''} onChange={(e) => setF({ ...f, collector_id: e.target.value })}>
            <option value="">—</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <p className="text-[10px] text-slate-400 mt-0.5">{lang === 'bn'
            ? 'Collector ড্যাশবোর্ড ও কালেকশনের জন্য এই অ্যাকাউন্ট যে collector-এর, সেটি। না দিলে নাম মিলিয়ে (Full Name = Staff name) যুক্ত হয়।'
            : 'Which collector this account collects as (dashboard + payments). If empty, the legacy full-name match is used.'}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{t('save')}</button>
      </div>
    </Modal>
  )
}

function ChangePasswordModal({ open, onClose }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const [f, setF] = useState({ old: '', nw: '', nw2: '' })
  const submit = async () => {
    if (f.nw !== f.nw2) { toast.push('error', 'Password mismatch'); return }
    try {
      await window.api.auth.changePassword(f.old, f.nw)
      toast.push('success', t('saved'))
      onClose()
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('changePassword')} width="max-w-sm">
      <div className="space-y-3">
        <div><label className="label">{t('oldPassword')}</label>
          <input type="password" className="input" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} /></div>
        <div><label className="label">{t('newPassword')}</label>
          <input type="password" className="input" value={f.nw} onChange={(e) => setF({ ...f, nw: e.target.value })} /></div>
        <div><label className="label">{t('newPassword')} (confirm)</label>
          <input type="password" className="input" value={f.nw2} onChange={(e) => setF({ ...f, nw2: e.target.value })} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={submit}>{t('save')}</button>
      </div>
    </Modal>
  )
}

// Module permission keys for the role editor — legacy module keys not part of
// PERMISSION_CATALOG (bespoke IPC modules / entity pages).
const EXTRA_MODULES = [
  'connections', 'zones', 'sub_areas', 'roads', 'network_devices', 'network_faults',
  'attendance', 'leaves', 'salaries', 'cash_deposits', 'products', 'suppliers',
  'purchases', 'stock_movements', 'transactions', 'expense_categories', 'account_transfers',
  'discounts', 'customer_documents', 'branches', 'leads', 'followups', 'sms_templates',
  'messages', 'automation', 'settings'
].filter((m) => !PERMISSION_CATALOG.some((c) => c.module === m))

function RolesTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState('')
  // safe deletion: role assigned to users → pick a target role to reassign them
  const [deleting, setDeleting] = useState<any>(null)
  const [reassignTo, setReassignTo] = useState('')

  const load = () => window.api.roles.list().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  // SUPER_ADMIN keeps its exclusive full-access role — read-only for everyone.
  const readOnly = open && editing?.name === 'SUPER_ADMIN'
  const isSystem = !!editing?.is_system

  const toggle = (key: string) => setPerms((s) => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    // a module key dominates its granular keys — adding/removing it also
    // drops the now-redundant 'module.action' keys so the set stays clean
    for (const k of [...n]) if (k.startsWith(key + '.')) n.delete(k)
    return n
  })

  const hasAccess = (mod: string) => perms.has(mod)
  const actionChecked = (mod: string, action: string) => perms.has(mod) || perms.has(`${mod}.${action}`)

  const save = async () => {
    if (!isSystem && !String(editing?.name || '').trim()) { toast.push('error', t('required')); return }
    try {
      // 'all' is reserved for SUPER_ADMIN — never grantable from the editor
      const list = [...perms].filter((k) => k !== 'all')
      // guard against accidentally wiping a system role's access
      if (isSystem && list.length === 0 && !window.confirm(lang === 'bn'
        ? 'সতর্কতা: কোনো permission নির্বাচন করা হয়নি — এই system role-এর সব অ্যাক্সেস হারাবে। নিশ্চিত?'
        : 'Warning: no permissions selected — this system role will lose ALL access. Continue?')) return
      await window.api.roles.save({ id: editing?.id, name: editing?.name || 'New Role', description, permissions: list })
      toast.push('success', t('saved'))
      setOpen(false)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const doDelete = async (reassign?: number) => {
    try {
      const res = await window.api.roles.delete(deleting.id, reassign)
      toast.push('success', (res?.reassigned ? `${res.reassigned} ${lang === 'bn' ? 'ইউজার রিঅ্যাসাইন হয়েছে — ' : 'user(s) reassigned — '}` : '') + t('deleted'))
      setDeleting(null)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => { setEditing({ name: '' }); setDescription(''); setPerms(new Set()); setOpen(true) }}><Plus size={16} /> {t('add')}</button>
      </div>
      <DataTable columns={[
        { key: 'name', label: t('role') },
        { key: 'description', label: 'Description', render: (r) => r.description || '-' },
        { key: 'permCount', label: t('permissions'), render: (r) => (JSON.parse(r.permissions || '[]').length) },
        { key: 'is_system', label: 'System', render: (r) => r.is_system ? '✓' : '-' }
      ]} rows={rows}
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm" disabled={r.name === 'SUPER_ADMIN'}
              onClick={() => { setEditing(r); setPerms(new Set(JSON.parse(r.permissions || '[]'))); setDescription(r.description || ''); setOpen(true) }}><Pencil size={13} /></button>
            {!r.is_system && <button className="btn-secondary btn-sm text-red-600" onClick={() => { setDeleting(r); setReassignTo('') }}><Trash2 size={13} /></button>}
          </div>
        )} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('security_roles')} width="max-w-2xl">
        {readOnly ? (
          <p className="text-sm text-slate-500 py-4">{lang === 'bn' ? 'SUPER_ADMIN role সম্পূর্ণ ক্ষমতার অধিকারী — এটি পরিবর্তন করা যায় না।' : 'The SUPER_ADMIN role holds full access and cannot be modified.'}</p>
        ) : (
          <>
            <div><label className="label">{t('role')}</label>
              <input className="input" value={editing?.name || ''} disabled={isSystem}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              {isSystem && <p className="text-[10px] text-slate-400 mt-1">{lang === 'bn' ? 'System role — শুধু permissions পরিবর্তন করা যাবে' : 'System role — only its permissions can be edited'}</p>}
            </div>
            <div className="mt-2"><label className="label">{lang === 'bn' ? 'বিবরণ' : 'Description'}</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={lang === 'bn' ? 'এই role-এর কাজ কী (ঐচ্ছিক)' : 'What this role is for (optional)'} />
            </div>
            <div className="flex items-center justify-between mt-3 mb-1">
              <label className="label mb-0">{t('permissions')}</label>
              <div className="flex gap-1 items-center">
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 px-2">{lang === 'bn' ? 'নির্বাচিত' : 'Selected'}: {perms.size}</span>
                <button type="button" className="btn-secondary btn-sm"
                  onClick={() => setPerms(new Set([...PERMISSION_CATALOG.map((m) => m.module), ...EXTRA_MODULES]))}>{lang === 'bn' ? 'সব সিলেক্ট' : 'Select all'}</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setPerms(new Set())}>{lang === 'bn' ? 'ক্লিয়ার' : 'Deselect all'}</button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">{lang === 'bn'
              ? 'মডিউল = পুরো অংশ। আলাদা action (দেখা/তৈরি/সম্পাদনা/মুছে ফেলা) দিলে শুধু সেই কাজটি অনুমোদিত হবে।'
              : 'Module = full section. Individual actions (View/Create/Edit/Delete) grant only that action.'}</p>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {PERMISSION_CATALOG.map((m) => (
                <div key={m.module} className="card p-2.5">
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${hasAccess(m.module) ? 'text-brand-700 dark:text-brand-400' : ''}`}>
                    <input type="checkbox" checked={hasAccess(m.module)} className="w-3.5 h-3.5"
                      onChange={() => toggle(m.module)} />
                    {lang === 'bn' ? m.labelBn : m.label}
                    <span className="font-mono text-[9px] text-slate-400">{m.module}</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-1.5 ml-6">
                    {m.actions.map((a) => {
                      const key = `${m.module}.${a.key}`
                      const checked = actionChecked(m.module, a.key)
                      return (
                        <label key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer ${checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <input type="checkbox" checked={checked} className="w-3 h-3"
                            onChange={() => toggle(key)} />
                          <span className="truncate">{lang === 'bn' ? a.labelBn : a.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="card p-2.5">
                <div className="text-xs font-semibold mb-1.5">{lang === 'bn' ? 'অন্যান্য অংশ (legacy)' : 'Other sections (legacy)'}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXTRA_MODULES.map((m) => (
                    <label key={m} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] cursor-pointer ${perms.has(m) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="checkbox" checked={perms.has(m)} className="w-3 h-3"
                        onChange={() => toggle(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-amber-600 mt-2">{lang === 'bn'
              ? "'all' (সম্পূর্ণ ক্ষমতা) শুধুই SUPER_ADMIN role-এর জন্য — অন্য role-এ দেওয়া যায় না।"
              : "'all' (full access) is exclusive to the SUPER_ADMIN role and cannot be granted here."}</p>
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={save}>{t('save')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* delete confirm → safe reassignment when the role has users */}
      <ConfirmDialog
        open={!!deleting && !deleting._inUse}
        onClose={() => setDeleting(null)}
        onConfirm={() => doDelete()}
        title={t('delete')}
        message={`${deleting?.name} — ${t('confirmDelete')}`}
      />
      <Modal open={!!deleting?._inUse} onClose={() => setDeleting(null)} title={t('delete') + ' — ' + (deleting?.name || '')} width="max-w-md">
        <div className="space-y-3">
          <p className="text-sm">{lang === 'bn'
            ? 'এই role এখনো ইউজারদের কাছে assigned — মুছতে হলে তাদের অন্য একটি role-এ সরিয়ে নিন।'
            : 'This role is still assigned to users — reassign them to another role before deleting.'}</p>
          <div>
            <label className="label">{lang === 'bn' ? 'নতুন role (ইউজারদের জন্য)' : 'New role for these users'} *</label>
            <select className="input" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">—</option>
              {rows.filter((r) => r.id !== deleting?.id).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleting(null)}>{t('cancel')}</button>
            <button className="btn-danger" disabled={!reassignTo} onClick={() => doDelete(Number(reassignTo))}>{t('delete')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function LogsTab() {
  const { t } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { window.api.logs.activity(300).then(setRows).catch(() => {}) }, [])
  return <DataTable columns={[
    { key: 'created_at', label: t('date'), render: (r) => String(r.created_at).slice(0, 19) },
    { key: 'username', label: t('username'), className: 'font-mono text-xs' },
    { key: 'action', label: 'Action' },
    { key: 'module', label: 'Module' },
    { key: 'details', label: 'Details', render: (r) => r.details || '-' }
  ]} rows={rows} exportName="activity-logs" />
}

function LoginsTab() {
  const { t } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { window.api.logs.logins(300).then(setRows).catch(() => {}) }, [])
  return <DataTable columns={[
    { key: 'login_at', label: t('login'), render: (r) => String(r.login_at).slice(0, 19) },
    { key: 'logout_at', label: t('logout'), render: (r) => r.logout_at ? String(r.logout_at).slice(0, 19) : '-' },
    { key: 'username', label: t('username'), className: 'font-mono text-xs' },
    { key: 'full_name', label: t('name'), render: (r) => r.full_name || '-' },
    { key: 'success', label: t('statusCol'), render: (r) => <StatusBadge value={r.success ? 'paid' : 'due'} label={r.success ? 'OK' : 'FAIL'} /> }
  ]} rows={rows} exportName="login-history" />
}

function BackupTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [backups, setBackups] = useState<any[]>([])
  const [restore, setRestore] = useState<any>(null)
  const [dir, setDir] = useState('')

  const load = () => {
    window.api.backup.list().then(setBackups).catch(() => {})
    window.api.backup.dir().then(setDir).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex justify-between items-start mb-3 gap-4 flex-wrap">
        <p className="text-xs text-slate-500 max-w-xl">
          <b>{t('restoreWarn')}</b><br />
          <b>{t('databasePath')}:</b> <span className="font-mono">{dir}</span>
        </p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => window.api.backup.create().then((p: any) => { if (p) { toast.push('success', String(p)); load() } }).catch((e) => toast.push('error', errMsg(e)))}>
            <Download size={15} /> {t('backupCreate')}
          </button>
          <button className="btn-secondary" onClick={() => window.api.backup.restore().then((p: any) => { if (p) { toast.push('success', t('restore') + ' ✓'); load() } }).catch((e) => toast.push('error', errMsg(e)))}>
            <Upload size={15} /> {t('backupRestore')}
          </button>
        </div>
      </div>
      <DataTable columns={[
        { key: 'name', label: t('backup'), className: 'font-mono text-xs' },
        { key: 'date', label: t('date'), render: (r) => String(r.date).slice(0, 19) },
        { key: 'size', label: 'Size (KB)', align: 'right', render: (r) => (r.size / 1024).toFixed(1) }
      ]} rows={backups} exportName="backups"
        actions={(r) => (
          <button className="btn-secondary btn-sm text-amber-600" onClick={() => setRestore(r)}><HardDrive size={13} /> {t('restore')}</button>
        )} />
      <ConfirmDialog
        open={!!restore}
        onClose={() => setRestore(null)}
        onConfirm={() => window.api.backup.restore(restore.path).then(() => { toast.push('success', t('restore') + ' ✓'); load() }).catch((e) => toast.push('error', errMsg(e)))}
        title={t('restore')}
        message={`${restore?.name}\n\n${t('restoreWarn')}`}
      />
    </div>
  )
}

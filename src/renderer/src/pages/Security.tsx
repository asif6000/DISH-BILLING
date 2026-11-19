import React, { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, KeyRound, Download, Upload, HardDrive } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge, ConfirmDialog } from '../components/ui'
import { DataTable, Column } from '../components/DataTable'
import { money, dateFmt } from '../lib/format'
import { errMsg } from '../lib/api'
import { useReflist } from '../components/ui'

const TABS = ['users', 'roles', 'logs', 'logins', 'backup'] as const
type Tab = typeof TABS[number]

// Module permission keys for role editor
const PERM_MODULES = [
  'all', 'dashboard', 'customers', 'billing', 'payments', 'connections', 'packages', 'areas',
  'zones', 'sub_areas', 'roads', 'network_devices', 'network_faults', 'staff', 'attendance',
  'leaves', 'salaries', 'collectors', 'cash_deposits', 'resellers', 'messaging', 'complaints',
  'products', 'suppliers', 'purchases', 'stock_movements', 'accounts', 'transactions',
  'expense_categories', 'account_transfers', 'discounts', 'customer_documents', 'branches',
  'leads', 'followups', 'sms_templates', 'messages', 'reports', 'automation', 'settings', 'security'
]

export default function SecurityPage({ tab: initial }: { tab?: string }) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>((initial as Tab) || 'users')
  useEffect(() => { setTab((initial as Tab) || 'users') }, [initial])

  return (
    <div>
      <PageHeader title={t('nav_security')} />
      <div className="flex gap-1 mb-4 flex-wrap">
        {TABS.map((tb) => (
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
            <button className="btn-secondary btn-sm" onClick={() => { setEditing(r); setOpen(true) }}><Pencil size={13} /></button>
            <button className="btn-secondary btn-sm text-red-600" onClick={() => setDeleting(r)}><Trash2 size={13} /></button>
          </div>
        )} />
      <UserModal open={open} onClose={() => setOpen(false)} editing={editing} roles={roles} onSaved={() => { setOpen(false); load() }} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => window.api.users.delete(deleting.id).then(() => { toast.push('success', t('deleted')); load() }).catch((e) => toast.push('error', errMsg(e)))}
        title={t('delete')} message={`${deleting?.username} — ${t('confirmDelete')}`} />
    </div>
  )
}

function UserModal({ open, onClose, editing, roles, onSaved }: any) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [f, setF] = useState<any>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(editing ? { ...editing, password: '' } : { username: '', full_name: '', mobile: '', password: '', role_id: '', status: 'active' })
  }, [open, editing])

  const submit = async () => {
    if (!f.username || !f.full_name || (!editing && !f.password) || !f.role_id) {
      toast.push('error', lang === 'bn' ? 'সব ঘর পূরণ করুন' : 'Fill all required fields')
      return
    }
    setBusy(true)
    try {
      if (editing) await window.api.users.update(editing.id, f)
      else await window.api.users.create(f)
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
            <select className="input" value={f.role_id || ''} onChange={(e) => setF({ ...f, role_id: e.target.value })}>
              <option value="">—</option>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select></div>
          <div><label className="label">{t('statusCol')}</label>
            <select className="input" value={f.status || 'active'} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select></div>
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

function RolesTab() {
  const { t } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [perms, setPerms] = useState<Set<string>>(new Set())

  const load = () => window.api.roles.list().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async () => {
    try {
      await window.api.roles.save({ id: editing?.id, name: editing?.name || 'New Role', permissions: [...perms] })
      toast.push('success', t('saved'))
      setOpen(false)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => { setEditing({ name: '' }); setPerms(new Set()); setOpen(true) }}><Plus size={16} /> {t('add')}</button>
      </div>
      <DataTable columns={[
        { key: 'name', label: t('role') },
        { key: 'permCount', label: t('permissions'), render: (r) => (JSON.parse(r.permissions || '[]').length) },
        { key: 'is_system', label: 'System', render: (r) => r.is_system ? '✓' : '-' }
      ]} rows={rows}
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm" onClick={() => { setEditing(r); setPerms(new Set(JSON.parse(r.permissions || '[]'))); setOpen(true) }}><Pencil size={13} /></button>
            {!r.is_system && <button className="btn-secondary btn-sm text-red-600" onClick={() => window.api.roles.delete(r.id).then(load).catch((e) => toast.push('error', errMsg(e)))}><Trash2 size={13} /></button>}
          </div>
        )} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('security_roles')} width="max-w-lg">
        <div><label className="label">{t('role')}</label>
          <input className="input" value={editing?.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-2 mt-3 max-h-64 overflow-y-auto">
          {PERM_MODULES.map((m) => (
            <label key={m} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs cursor-pointer ${perms.has(m) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="checkbox" checked={perms.has(m)} className="w-3.5 h-3.5"
                onChange={() => setPerms((s) => { const n = new Set(s); n.has(m) ? n.delete(m) : n.add(m); return n })} />
              {m}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
          <button className="btn-primary" onClick={save}>{t('save')}</button>
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

import React, { useCallback, useEffect, useState } from 'react'
import { UserCheck, RefreshCw, ShieldAlert, LogIn, ArrowLeftRight } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { errMsg, clearClientAccountState } from '../lib/api'
import { useIsSuper } from '../lib/perms'

// Super Admin → User Management (Supabase directory ∪ local accounts) with the
// secure "Login As User" action. Every rule is enforced in the main process:
// this page only reflects what the backend allows (requirement 11/12).
interface ManagedUser {
  id: string
  username: string
  full_name: string | null
  mobile: string | null
  email: string | null
  role_name: string | null
  status: string | null
  local_user_id: number | null
  local_status: string | null
  trial_ends: string | null
  last_login: string | null
  created_at: string | null
  source: 'supabase' | 'local'
  can_login_as: boolean
  block_reason: string | null
}

interface AuditRow {
  id: number
  super_admin_username: string
  target_username: string
  target_role: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  end_reason: string | null
}

const STATUS_TABS = ['all', 'approved', 'pending', 'rejected'] as const

export default function UserManagementPage() {
  const { lang } = useI18n()
  const toast = useToast()
  const isSuper = useIsSuper()
  const bn = lang === 'bn'

  const [rows, setRows] = useState<ManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [role, setRole] = useState<string>('all')
  const [roles, setRoles] = useState<string[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [configured, setConfigured] = useState(true)
  const [emailSupported, setEmailSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [confirmUser, setConfirmUser] = useState<ManagedUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [createLocal, setCreateLocal] = useState<ManagedUser | null>(null)
  const [tempCred, setTempCred] = useState<{ username: string; tempPassword: string } | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    window.api.impersonation.users({ page, pageSize, search, status, role })
      .then((r: any) => {
        setRows(r.rows || [])
        setTotal(r.total || 0)
        setRoles(r.roles || [])
        setStatusCounts(r.statusCounts || {})
        setConfigured(!!r.configured)
        setEmailSupported(!!r.emailSupported)
        setError(r.error || null)
      })
      .catch((e) => { setError(errMsg(e)); toast.push('error', errMsg(e)) })
      .finally(() => setLoading(false))
  }, [page, pageSize, search, status, role, toast])

  useEffect(() => { if (isSuper) load() }, [isSuper, load])
  useEffect(() => {
    if (!isSuper) return
    window.api.settings.getAll()
      .then((s: any) => setAutoSync(String(s?.supabase_auto_provision || '0') === '1'))
      .catch(() => {})
  }, [isSuper])

  const toggleAutoSync = async (v: boolean) => {
    setAutoSync(v)
    try {
      await window.api.settings.set('supabase_auto_provision', v ? '1' : '0')
      toast.push('success', v
        ? (bn ? 'অটো-সিঙ্ক চালু: নতুন approved Supabase ইউজার নিজেই লোকাল অ্যাকাউন্ট পাবে' : 'Auto-sync on: newly approved Supabase users get a local account automatically')
        : (bn ? 'অটো-সিঙ্ক বন্ধ' : 'Auto-sync off'))
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const syncAll = async () => {
    setSyncing(true)
    try {
      const r: any = await window.api.userAccounts.syncAllRemote()
      const n = r?.provisioned?.length ?? 0
      toast.push('success', bn
        ? `${n} টি লোকাল অ্যাকাউন্ট তৈরি হয়েছে (Supabase মোট: ${r?.total ?? 0})`
        : `${n} local account(s) created (Supabase total: ${r?.total ?? 0})`)
      load()
    } catch (e) {
      toast.push('error', errMsg(e))
    } finally { setSyncing(false) }
  }
  useEffect(() => {
    if (!isSuper) return
    window.api.impersonation.audit(50).then(setAudit).catch(() => {})
  }, [isSuper, confirmUser])

  if (!isSuper) {
    return (
      <div>
        <PageHeader title={bn ? 'ইউজার ম্যানেজমেন্ট' : 'User Management'} />
        <div className="card p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <ShieldAlert size={16} /> {bn ? 'শুধুমাত্র SUPER_ADMIN এই পেজ ব্যবহার করতে পারেন।' : 'Only the SUPER_ADMIN can use this page.'}
        </div>
      </div>
    )
  }

  const reasonText: Record<string, string> = {
    NO_LOCAL_ACCOUNT: bn ? 'এই ইনস্টলে লোকাল অ্যাকাউন্ট নেই' : 'No local account on this installation',
    NOT_ACTIVE: bn ? 'অ্যাকাউন্ট সক্রিয় নয়' : 'Account is not active',
    SUPER_ADMIN: bn ? 'SUPER_ADMIN অ্যাকাউন্টে প্রবেশ করা যায় না' : 'SUPER_ADMIN cannot be impersonated',
    SELF: bn ? 'নিজের অ্যাকাউন্ট' : 'Your own account',
    TRIAL_EXPIRED: bn ? 'ট্রায়াল/সাবস্ক্রিপশন শেষ' : 'Trial/subscription expired'
  }

  const startImpersonation = async (u: ManagedUser) => {
    if (!u.local_user_id) return
    setBusy(true)
    try {
      await window.api.impersonation.start(u.local_user_id)
      setConfirmUser(null)
      toast.push('success', bn ? `${u.username} হিসেবে লগইন হয়েছে` : `Logged in as ${u.username}`)
      // full reload: menus, dashboard and permissions must come from the new
      // session context (no client-side state leaks from the super admin)
      clearClientAccountState()
      window.location.reload()
    } catch (e) {
      toast.push('error', errMsg(e))
      setBusy(false)
    }
  }

  const makeLocalAccount = async () => {
    if (!createLocal) return
    setBusy(true)
    try {
      const r: any = await window.api.userAccounts.createLocal({ username: createLocal.username, roleName: createLocal.role_name || undefined })
      setCreateLocal(null)
      setTempCred({ username: r.username, tempPassword: r.tempPassword })
      load()
    } catch (e) {
      toast.push('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'username', label: bn ? 'ইউজার নেম' : 'User Name', className: 'font-mono' },
    { key: 'full_name', label: bn ? 'নাম' : 'Name', render: (r: ManagedUser) => r.full_name || '-' },
    {
      key: 'email', label: 'Email',
      render: (r: ManagedUser) => r.email || (emailSupported ? '-' : <span className="text-[10px] text-slate-400">{bn ? 'কলাম নেই' : 'not in project'}</span>)
    },
    { key: 'mobile', label: bn ? 'মোবাইল' : 'Mobile', render: (r: ManagedUser) => r.mobile || '-' },
    {
      key: 'role_name', label: bn ? 'রোল' : 'Role',
      render: (r: ManagedUser) => r.role_name
        ? <span className="font-medium">{r.role_name}</span>
        : <span className="text-slate-400 text-xs">{bn ? '(সেট নেই)' : '(not set)'}</span>
    },
    {
      key: 'status', label: bn ? 'অ্যাকাউন্ট স্ট্যাটাস' : 'Account Status',
      render: (r: ManagedUser) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge value={String(r.status || 'pending')} label={String(r.status || '-')} />
          {r.local_status && r.local_status !== 'not_registered' && (
            <span className="text-[10px] text-slate-400">{bn ? 'লোকাল' : 'local'}: {r.local_status}</span>
          )}
        </div>
      )
    },
    {
      key: 'created_at', label: bn ? 'তৈরির তারিখ' : 'Created Date',
      render: (r: ManagedUser) => r.created_at ? String(r.created_at).slice(0, 10) : '-'
    }
  ]

  return (
    <div>
      <PageHeader
        title={bn ? 'ইউজার ম্যানেজমেন্ট (সুপার অ্যাডমিন)' : 'User Management (Super Admin)'}
        subtitle={bn
          ? 'Supabase-এর সব অ্যাকাউন্ট + এই ইনস্টলের লোকাল অ্যাকাউন্ট। পাসওয়ার্ড ছাড়াই নিরাপদে "Login As User" করুন।'
          : 'All Supabase accounts + this installation’s local accounts. Secure "Login As User" without passwords.'}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500" title={bn ? 'নতুন approved Supabase ইউজার এলে নিজেই লোকাল অ্যাকাউন্ট তৈরি হবে (৩০ সেকেন্ডে)' : 'Newly approved Supabase users get a local account automatically (within 30s)'}>
              <input type="checkbox" checked={autoSync} className="w-3.5 h-3.5" onChange={(e) => toggleAutoSync(e.target.checked)} />
              {bn ? 'অটো-সিঙ্ক' : 'Auto-sync'}
            </label>
            <button className="btn-primary" onClick={syncAll} disabled={syncing} title={bn ? 'Supabase-এর সব approved ইউজারের লোকাল অ্যাকাউন্ট তৈরি করুন' : 'Create the local account for every approved Supabase user'}>
              <UserCheck size={15} /> {syncing ? '…' : (bn ? 'সব Approved ইউজার সিঙ্ক' : 'Sync all approved')}
            </button>
            <button className="btn-secondary" onClick={() => { load(); window.api.impersonation.audit(50).then(setAudit).catch(() => {}) }}>
              <RefreshCw size={15} /> {bn ? 'রিফ্রেশ' : 'Refresh'}
            </button>
          </div>
        }
      />

      {!configured && (
        <div className="mb-3 card px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-2">
          <ShieldAlert size={15} />
          {bn
            ? 'Supabase কনফিগার করা নেই — শুধু এই ইনস্টলের লোকাল অ্যাকাউন্ট দেখানো হচ্ছে (Settings → Supabase)।'
            : 'Supabase is not configured — showing local accounts of this installation only (Settings → Supabase).'}
        </div>
      )}
      {error && (
        <div className="mb-3 card px-4 py-2.5 text-xs text-red-600 border border-red-200 dark:border-red-800">
          {bn ? 'Supabase থেকে ইউজার লিস্ট আনা যায়নি: ' : 'Could not load the Supabase user list: '}{error}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {STATUS_TABS.map((st) => (
          <button key={st} onClick={() => { setStatus(st); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${status === st ? 'bg-brand-600 text-white' : 'card hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {st === 'all' ? (bn ? 'সব' : 'All') : st} {`(${statusCounts[st] ?? 0})`}
          </button>
        ))}
        <select className="input max-w-[190px]" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}>
          <option value="all">{bn ? 'সব রোল' : 'All roles'}</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">
          {bn ? 'সোর্স' : 'Source'}: Supabase {configured ? '✓' : '—'} · local ✓
        </span>
      </div>

      <DataTable
        columns={columns as any}
        rows={rows}
        loading={loading}
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={setPage}
        exportName="supabase-users"
        emptyText={bn ? 'কোনো ইউজার পাওয়া যায়নি' : 'No users found'}
        actions={(r: ManagedUser) => (
          <div className="flex items-center justify-end gap-1">
            {r.block_reason === 'NO_LOCAL_ACCOUNT' && r.status === 'approved' && (
              <button className="btn-secondary btn-sm" title={bn ? 'এই ইনস্টলে লোকাল অ্যাকাউন্ট তৈরি করুন' : 'Create the missing local account'}
                onClick={() => setCreateLocal(r)}>
                <UserCheck size={13} /> {bn ? 'Create local account' : 'Create local account'}
              </button>
            )}
            <button
              className="btn-secondary btn-sm"
              disabled={!r.can_login_as}
              title={r.can_login_as ? (bn ? 'এই ইউজার হিসেবে লগইন' : 'Log in as this user') : (reasonText[r.block_reason || ''] || r.block_reason || '')}
              onClick={() => setConfirmUser(r)}
            >
              <LogIn size={13} /> {bn ? 'Login As User' : 'Login As User'}
            </button>
          </div>
        )}
      />

      {/* impersonation audit trail */}
      <div className="mt-5">
        <PageHeader title={bn ? 'ইম্পারসোনেশন অডিট লগ' : 'Impersonation Audit Log'}
          subtitle={bn ? 'কে কার অ্যাকাউন্টে কখন ঢুকেছিল' : 'Who entered which account and when'} />
        <DataTable
          columns={[
            { key: 'started_at', label: bn ? 'শুরু' : 'Started', render: (r: AuditRow) => String(r.started_at).slice(0, 19) },
            { key: 'ended_at', label: bn ? 'শেষ' : 'Ended', render: (r: AuditRow) => r.ended_at ? String(r.ended_at).slice(0, 19) : <span className="text-amber-600 text-xs">{bn ? 'চলছে' : 'active'}</span> },
            { key: 'super_admin_username', label: 'Super Admin', className: 'font-mono text-xs' },
            { key: 'target_username', label: bn ? 'টার্গেট ইউজার' : 'Target user', className: 'font-mono text-xs' },
            { key: 'target_role', label: bn ? 'রোল' : 'Role', render: (r: AuditRow) => r.target_role || '-' },
            { key: 'duration_seconds', label: bn ? 'সময় (সেকেন্ড)' : 'Duration (s)', align: 'right' as const, render: (r: AuditRow) => r.duration_seconds ?? '-' },
            { key: 'end_reason', label: bn ? 'শেষের কারণ' : 'End reason', render: (r: AuditRow) => r.end_reason || '-' }
          ]}
          rows={audit}
          emptyText={bn ? 'এখনো কোনো ইম্পারসোনেশন হয়নি' : 'No impersonation has happened yet'}
        />
      </div>

      {/* create the missing local account for a Supabase-approved user */}
      <Modal open={!!createLocal} onClose={() => setCreateLocal(null)} title={bn ? 'লোকাল অ্যাকাউন্ট তৈরি' : 'Create local account'} width="max-w-md">
        <div className="space-y-3 text-sm">
          <p>
            {bn ? 'Supabase-এ ' : 'The Supabase account '}<b className="font-mono">{createLocal?.username}</b>{bn ? ' approved, কিন্তু এই ইনস্টলে এই ইউজারের লোকাল অ্যাকাউন্ট নেই।' : ' is approved but has no local account on this installation.'}
          </p>
          <p className="text-slate-500 text-xs">
            {bn
              ? 'তৈরি হলে একটি অস্থায়ী পাসওয়ার্ড দেখানো হবে (একবারই) — ইউজারকে দিয়ে দিন, পরে সে নিজে বদলাতে পারবে। Supabase-এর role সেট থাকলে সেটাই বসবে, না থাকলে Collector।'
              : 'A temporary password is shown ONCE — share it with the user; they can change it later. The Supabase role is applied when set, otherwise Collector.'}
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setCreateLocal(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
            <button className="btn-primary" disabled={busy} onClick={makeLocalAccount}>
              <UserCheck size={15} /> {busy ? '…' : (bn ? 'তৈরি করুন' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* temporary password — shown once */}
      <Modal open={!!tempCred} onClose={() => setTempCred(null)} title={bn ? 'অস্থায়ী পাসওয়ার্ড' : 'Temporary password'} width="max-w-md">
        <div className="space-y-3 text-sm">
          <p>{bn ? 'লোকাল অ্যাকাউন্ট তৈরি হয়েছে: ' : 'Local account created: '}<b className="font-mono">{tempCred?.username}</b></p>
          <div className="flex items-center gap-2">
            <code className="flex-1 card px-3 py-2 font-mono text-base select-all">{tempCred?.tempPassword}</code>
            <button className="btn-secondary btn-sm" onClick={() => { if (tempCred) { navigator.clipboard?.writeText(tempCred.tempPassword); toast.push('success', bn ? 'কপি হয়েছে' : 'Copied') } }}>
              {bn ? 'কপি' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-amber-600">
            {bn ? 'এই পাসওয়ার্ডটি আর দেখানো হবে না — এখনই ইউজারকে জানিয়ে দিন।' : 'This password will not be shown again — share it with the user now.'}
          </p>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setTempCred(null)}>{bn ? 'ঠিক আছে' : 'Done'}</button>
          </div>
        </div>
      </Modal>

      {/* confirm */}
      <Modal open={!!confirmUser} onClose={() => setConfirmUser(null)} title={bn ? 'Login As User' : 'Login As User'} width="max-w-md">
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <ArrowLeftRight size={16} className="mt-0.5 text-brand-600 shrink-0" />
            <p>
              {bn ? 'আপনি ' : 'You will enter the account of '}
              <b className="font-mono">{confirmUser?.username}</b>
              {confirmUser?.role_name ? <> ({confirmUser.role_name})</> : null}
              {bn
                ? ' হিসেবে অ্যাপে ঢুকবেন। এই ইউজারের পাসওয়ার্ড বা অন্য কোনো তথ্য পড়া/পরিবর্তন করা হবে না, আর পাসওয়ার্ড/ইউজার-সেটিংস বদলানোর কাজ বন্ধ থাকবে।'
                : ' — this reads/writes no password or credential of that user, and credential/account changes stay blocked.'}
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            {bn
              ? 'প্রবেশ করলে শুধুমাত্র এই ইউজারের নিজস্ব ডেটা (কাস্টমার, বিল, পেমেন্ট, রিপোর্ট, সেটিংস) দেখাবে — সুপার অ্যাডমিনের কোনো ডেটা নয়। ফিরে আসতে উপরের হলুদ বার থেকে "Return to Super Admin" চাপুন। প্রতিটি ইম্পারসোনেশন অডিট লগে থাকবে।'
              : 'You will see ONLY this user’s own data (customers, bills, payments, reports, settings) — never the super admin’s. Use "Return to Super Admin" in the yellow banner to come back. Every impersonation is audited.'}
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setConfirmUser(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
            <button className="btn-primary" disabled={busy} onClick={() => confirmUser && startImpersonation(confirmUser)}>
              <UserCheck size={15} /> {busy ? (bn ? 'প্রবেশ হচ্ছে…' : 'Entering…') : (bn ? 'প্রবেশ করুন' : 'Enter account')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ============================================================================
// Super Admin → User Management + secure "Login As User" (impersonation)
//
// Security rules enforced here (all server-side, in the main process):
//  - only a real SUPER_ADMIN session (permissions contains 'all') may list the
//    user directory or impersonate; an Administrator/Manager/Collector cannot,
//    even with the 'users' module (requirement 11/12).
//  - a SUPER_ADMIN can never impersonate itself or another SUPER_ADMIN account.
//  - the target must be an ACTIVE local account with a valid (non-expired) trial.
//  - impersonation never reads or writes the target's password/credentials and
//    never creates a token: it re-uses the target's effective permissions in the
//    current window and every credential/account-admin write is refused while
//    the impersonated session is active (see assertNotImpersonating in auth.ts).
//  - every impersonation is written to impersonation_logs (start/end/duration)
//    plus the normal activity log.
//  - Supabase access stays in the main process with the ANON key only; the
//    service_role key is never used or exposed to the renderer.
// ============================================================================
import { ipcMain } from 'electron'
import { getPrimaryDb, logActivity } from '../db'
import {
  Session, requireAuth, isSuper, getEffectivePermissions,
  beginImpersonation, endImpersonation, getImpersonation, discardImpersonation
} from './auth'
import { fetchRemoteUsers } from './accounts'
import { isUserBlocked } from '../subscription'

// SUPER_ADMIN only, and never from inside an impersonated session (no nesting).
function requireSuperAdmin(e: Electron.IpcMainInvokeEvent): Session {
  const s = requireAuth(e)
  if (s.impersonatedBy) throw new Error('IMPERSONATION_ALREADY_ACTIVE')
  if (!isSuper(s)) throw new Error('PERMISSION_DENIED:impersonation')
  return s
}

const LOCAL_STATUS_LABEL: Record<string, string> = {
  active: 'active',
  pending: 'pending',
  inactive: 'inactive'
}

interface ManagedUser {
  id: string // stable row key for the table (username, lowercase)
  username: string
  full_name: string | null
  mobile: string | null
  email: string | null
  role_name: string | null
  status: string | null // remote status (approved/pending/rejected) — may be null for local-only
  local_user_id: number | null
  local_status: string | null // active/pending/inactive/not_registered
  trial_ends: string | null
  last_login: string | null
  created_at: string | null
  source: 'supabase' | 'local'
  can_login_as: boolean
  block_reason: string | null
}

export function registerImpersonationIpc(): void {
  // ---- merged user directory: Supabase app_users ∪ local accounts ----
  ipcMain.handle('impersonation:users', async (e, params: any = {}) => {
    const s = requireSuperAdmin(e)
    const db = getPrimaryDb()
    const locals = db.prepare(`SELECT u.id, u.username, u.full_name, u.mobile, u.status, u.trial_ends, u.last_login, u.created_at,
        r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.id`).all() as any[]
    const localByName = new Map<string, any>()
    for (const l of locals) localByName.set(String(l.username).trim().toLowerCase(), l)

    const remote = await fetchRemoteUsers()
    const rows: ManagedUser[] = []
    const seen = new Set<string>()

    const build = (username: string, r: any | null, l: any | null): ManagedUser => {
      const roleName = (r?.role_name || l?.role_name || null) as string | null
      const remoteStatus = r?.status ? String(r.status) : null
      const localStatus = l ? LOCAL_STATUS_LABEL[String(l.status)] || String(l.status) : 'not_registered'
      let block: string | null = null
      if (!l) block = 'NO_LOCAL_ACCOUNT'
      else if (String(l.status) !== 'active') block = 'NOT_ACTIVE'
      else if (roleName === 'SUPER_ADMIN') block = 'SUPER_ADMIN'
      else if (Number(l.id) === Number(s.userId)) block = 'SELF'
      else if (isUserBlocked(Number(l.id))) block = 'TRIAL_EXPIRED'
      return {
        id: String(username).toLowerCase(),
        username,
        full_name: r?.full_name ?? l?.full_name ?? null,
        mobile: r?.mobile ?? l?.mobile ?? null,
        email: (r as any)?.email ?? null,
        role_name: roleName,
        status: remoteStatus ?? localStatus,
        local_user_id: l ? Number(l.id) : null,
        local_status: localStatus,
        trial_ends: l?.trial_ends ?? null,
        last_login: l?.last_login ?? null,
        created_at: r?.created_at ?? l?.created_at ?? null,
        source: r ? 'supabase' : 'local',
        can_login_as: !block,
        block_reason: block
      }
    }

    for (const r of remote.rows || []) {
      const username = String(r.username || '').trim()
      if (!username) continue
      const key = username.toLowerCase()
      seen.add(key)
      rows.push(build(username, r, localByName.get(key) || null))
    }
    // local accounts that never reached Supabase (offline signups, the seeded admin, …)
    for (const l of locals) {
      const key = String(l.username).trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(build(String(l.username), null, l))
    }

    // ---- server-side search / filter / pagination ----
    const search = String(params?.search || '').trim().toLowerCase()
    const status = String(params?.status || 'all')
    const role = String(params?.role || 'all')
    const page = Math.max(1, Number(params?.page) || 1)
    let pageSize = Number(params?.pageSize) || 20
    pageSize = Math.min(200, Math.max(5, pageSize))

    const filtered = rows.filter((r) => {
      if (status !== 'all' && String(r.status || '') !== status) return false
      if (role !== 'all' && String(r.role_name || '') !== role) return false
      if (!search) return true
      return [r.username, r.full_name, r.mobile, r.email, r.role_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search))
    })
    // per-status counters for the filter tabs (search/role applied, status not)
    const statusCounts: Record<string, number> = { all: 0, approved: 0, pending: 0, rejected: 0 }
    for (const r of rows) {
      if (role !== 'all' && String(r.role_name || '') !== role) continue
      if (search && ![r.username, r.full_name, r.mobile, r.email, r.role_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(search))) continue
      statusCounts.all++
      const st = String(r.status || '')
      statusCounts[st] = (statusCounts[st] || 0) + 1
    }
    filtered.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || a.username.localeCompare(b.username))

    const total = filtered.length
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize)
    // role options for the filter (from the real directory, never hard-coded)
    const roles = Array.from(new Set(rows.map((r) => r.role_name).filter(Boolean) as string[])).sort()
    return {
      configured: remote.configured,
      emailSupported: remote.emailSupported,
      error: remote.error || null,
      rows: slice,
      total,
      page,
      pageSize,
      roles,
      statusCounts,
      superAdmin: s.username
    }
  })

  // ---- start: Login As User ----
  ipcMain.handle('impersonation:start', (e, targetUserId: number) => {
    const res = beginImpersonation(e, Number(targetUserId))
    const target = getImpersonation(e.sender.id)
    return {
      user: res.user,
      target: target ? { username: target.targetUsername, roleName: target.targetRoleName, startedAt: target.startedAt } : null
    }
  })

  // ---- stop: Return to Super Admin ----
  ipcMain.handle('impersonation:stop', (e) => {
    const res = endImpersonation(e)
    return { user: res.user }
  })

  // ---- current impersonation state (drives the Return banner) ----
  ipcMain.handle('impersonation:status', (e) => {
    const s = requireAuth(e)
    const st = getImpersonation(e.sender.id)
    return {
      active: !!st,
      target: st ? { username: st.targetUsername, roleName: st.targetRoleName, startedAt: st.startedAt, userId: st.targetUserId } : null,
      impersonatedBy: s.impersonatedByName || null,
      permissions: s.permissions,
      roleName: s.roleName || ''
    }
  })

  // ---- audit trail (SUPER_ADMIN only) ----
  ipcMain.handle('impersonation:audit', (e, limit = 100) => {
    const s = requireAuth(e)
    if (!isSuper(s) && !s.impersonatedBy) throw new Error('PERMISSION_DENIED:impersonation')
    // while impersonating, only show the rows of the current impersonation
    if (s.impersonatedBy) {
      const st = getImpersonation(e.sender.id)
      if (!st) return []
      return getPrimaryDb().prepare('SELECT * FROM impersonation_logs WHERE id = ?').all(st.logId)
    }
    const n = Math.min(500, Math.max(1, Number(limit) || 100))
    return getPrimaryDb().prepare('SELECT * FROM impersonation_logs ORDER BY id DESC LIMIT ?').all(n)
  })

  // ---- live permission refresh of the impersonated session ----
  ipcMain.handle('impersonation:refresh', (e) => {
    const s = requireAuth(e)
    if (!s.impersonatedBy) return { user: s }
    const live = getEffectivePermissions(s.userId)
    s.permissions = live
    return { user: s }
  })

  // ---- safeguard: privilege escalation attempts are logged ----
  ipcMain.handle('impersonation:denyAudit', (e, reason: string) => {
    const s = requireAuth(e)
    logActivity(s.userId, s.username, 'impersonate_denied', 'security', String(reason || '').slice(0, 200))
    return true
  })

  // keep the audit row closed when the window goes away with an active session
  ipcMain.handle('impersonation:discard', (e, reason: string) => {
    discardImpersonation(e.sender.id, String(reason || 'window_closed').slice(0, 60))
    return true
  })
}

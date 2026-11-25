import { ipcMain, app } from 'electron'
import { getSetting, setSetting, logActivity, getDb, getPrimaryDb, isInstallSetting } from '../db'
import { requireAuth, requirePermission } from './auth'
import { hasPermission } from '../../shared/permissions'

// Company profile keys — saved permanently in the settings table (one row per
// key; setSetting upserts: UPDATE for existing keys, INSERT for new ones —
// no duplicate company records possible).
export const COMPANY_KEYS = [
  'company_name', 'company_name_bn', 'company_mobile', 'company_mobile_alt',
  'company_email', 'company_address', 'company_logo', 'company_sms', 'company_license'
]

// ---------- validation ----------
const MOBILE_RE = /^01[3-9]\d{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOGO_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/
const MAX_LOGO_LEN = 500_000 // ~500KB base64 keeps the SQLite row sane

function normalizeMobile(v: unknown): string {
  let d = String(v || '').replace(/[^\d]/g, '')
  if (d.length === 13 && d.startsWith('88')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('1')) d = '0' + d
  return d
}

// validate one company field; returns an error string or '' when valid
function validateCompanyField(key: string, raw: unknown): string {
  const v = String(raw ?? '')
  switch (key) {
    case 'company_name':
      if (!v.trim()) return 'REQUIRED:company_name'
      return ''
    case 'company_mobile':
    case 'company_mobile_alt':
      if (v.trim() && !MOBILE_RE.test(normalizeMobile(v))) return `INVALID_MOBILE:${key}`
      return ''
    case 'company_email':
      if (v.trim() && !EMAIL_RE.test(v.trim())) return 'INVALID_EMAIL'
      return ''
    case 'company_logo':
      if (v && (!LOGO_RE.test(v) || v.length > MAX_LOGO_LEN)) return 'INVALID_LOGO'
      return ''
    default:
      return ''
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', (e) => {
    requireAuth(e)
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as any[]
    const out: Record<string, string> = {}
    for (const r of rows) {
      if (r.key === 'workspace_owner_id') continue // internal isolation marker
      out[r.key] = r.value ?? ''
    }
    // installation-level keys (subscription, Supabase config, security policy,
    // updater) always come from the primary database, whatever workspace is open
    const installRows = getPrimaryDb().prepare(`SELECT key, value FROM settings
      WHERE key IN ('sub_expire','supabase_url','supabase_anon_key','sub_app_id','backup_dir','permission_mode','session_timeout_min','supabase_auto_provision','auto_update_check','update_url','auto_backup')
         OR key LIKE 'updater_%'`).all() as any[]
    for (const r of installRows) out[r.key] = r.value ?? ''
    return out
  })

  // company profile keys are editable by SUPER_ADMIN or anyone granted the
  // company_profile permission (Administrator by default, migration v13) —
  // module key OR the granular company_profile.edit key.
  const canEditCompany = (s: any): boolean =>
    s.permissions.includes('all') ||
    hasPermission(s.permissions, 'company_profile') ||
    hasPermission(s.permissions, 'company_profile', 'edit') ||
    s.permissions.includes('settings')

  // Sensitive keys (permission_mode, seq counters, session timeout...) remain
  // SUPER_ADMIN/settings-only — a company_profile grant can never escalate to
  // 'open' permission mode.
  // FIX: users holding the 'settings' MODULE key are full settings managers —
  // they may save system keys too. Previously only 'all' holders could, so an
  // Administrator with 'settings' (no 'all') always hit PERMISSION_DENIED on
  // the system part of the Settings page save.
  const canSaveKeys = (s: any, keys: string[]): boolean => {
    if (s.permissions.includes('all') || s.permissions.includes('settings')) return true
    if (!keys.every((k) => COMPANY_KEYS.includes(k))) return false
    return canEditCompany(s)
  }

  // Installation-level keys (subscription, Supabase config, security policy,
  // updater) may never be changed from inside an impersonated session.
  const guardInstallKeys = (s: any, keys: string[]) => {
    if (s?.impersonatedBy && keys.some((k) => isInstallSetting(k))) {
      throw new Error('IMPERSONATION_BLOCKED:install_settings')
    }
  }

  ipcMain.handle('settings:set', (e, key: string, value: string) => {
    const s = requirePermission(e, 'settings')
    if (!canSaveKeys(s, [key])) throw new Error('PERMISSION_DENIED:settings')
    guardInstallKeys(s, [key])
    setSetting(key, String(value))
    logActivity(s.userId, s.username, 'set_setting', 'settings', `${key}=${value}`)
    return true
  })

  ipcMain.handle('settings:setMany', (e, obj: Record<string, string>) => {
    const keys = Object.keys(obj || {})
    const companyOnly = keys.length > 0 && keys.every((k) => COMPANY_KEYS.includes(k))
    // FIX (root cause): saving ONLY company-profile keys required the 'settings'
    // module permission, so an Administrator with company_profile always got
    // PERMISSION_DENIED and Company Information could never be saved.
    // Company-only payloads now require just the company_profile permission.
    const s = companyOnly ? requireAuth(e) : requirePermission(e, 'settings')
    if (!canSaveKeys(s, keys)) throw new Error('PERMISSION_DENIED:settings')
    guardInstallKeys(s, keys)
    for (const k of keys) {
      const err = validateCompanyField(k, obj[k])
      if (err) throw new Error(err)
      setSetting(k, String(obj[k]))
    }
    logActivity(s.userId, s.username, 'set_settings', 'settings', keys.join(','))
    return true
  })

  // Company Profile — view: everyone (used by print templates); edit: SUPER_ADMIN
  // or company_profile permission
  ipcMain.handle('settings:companyProfile', (e) => {
    requireAuth(e)
    return {
      company_name: getSetting('company_name', 'AVA Cable Network'),
      company_name_bn: getSetting('company_name_bn', ''),
      company_mobile: getSetting('company_mobile', ''),
      company_mobile_alt: getSetting('company_mobile_alt', ''),
      company_email: getSetting('company_email', ''),
      company_address: getSetting('company_address', ''),
      company_logo: getSetting('company_logo', ''),
      company_sms: getSetting('company_sms', ''),
      company_license: getSetting('company_license', '')
    }
  })

  type CompanyProfileInput = {
    company_name?: string; company_name_bn?: string; company_mobile?: string
    company_mobile_alt?: string; company_email?: string; company_address?: string
    company_logo?: string; company_sms?: string; company_license?: string
  }

  ipcMain.handle('settings:companyProfileUpdate', (e, data: CompanyProfileInput) => {
    // FIX (root cause): this previously went through requirePermission(e,
    // 'company_profile', 'edit') which is correct — but the Settings page saved
    // via settings:setMany which required the 'settings' module key and failed
    // for every Administrator. The page now uses THIS endpoint, which accepts
    // company_profile (module or granular) or 'all'/'settings'.
    const s = requireAuth(e)
    if (!canEditCompany(s)) throw new Error('PERMISSION_DENIED:company_profile')
    const input = data || {}
    // required field: company name must not be empty
    const nameErr = validateCompanyField('company_name', input.company_name)
    if (nameErr) throw new Error(nameErr)
    // validate every provided field before touching the database
    for (const [k, v] of Object.entries(input)) {
      if (!COMPANY_KEYS.includes(k)) continue
      const err = validateCompanyField(k, v)
      if (err) throw new Error(err)
    }
    // upsert: UPDATE for existing keys, INSERT for new ones (permanent storage)
    setSetting('company_name', String(input.company_name).trim())
    for (const k of COMPANY_KEYS) {
      if (k === 'company_name') continue
      if (input[k as keyof CompanyProfileInput] === undefined) continue
      setSetting(k, String(input[k as keyof CompanyProfileInput]).trim())
    }
    logActivity(s.userId, s.username, 'update_company_profile', 'company_profile', String(input.company_name).trim())
    return true
  })

  ipcMain.handle('app:info', () => {
    return {
      version: app.getVersion(),
      dbPath: undefined as unknown as string, // filled by backup module to avoid circular import
      platform: process.platform
    }
  })

  ipcMain.handle('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
}

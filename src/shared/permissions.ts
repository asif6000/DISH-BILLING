// Centralized permission catalog — extensible.
// Two kinds of permission keys are valid:
//  1) module key              e.g. 'customers'        → full access to that module (legacy roles)
//  2) granular key            e.g. 'customers.create' → only that action
// Legacy module keys always dominate their granular keys.
import { GENERIC_ENTITY_KEYS } from './entities'

export interface PermAction { key: string; label: string; labelBn: string }
export interface PermModule { module: string; label: string; labelBn: string; actions: PermAction[] }

const CRUD: PermAction[] = [
  { key: 'view', label: 'View', labelBn: 'দেখা' },
  { key: 'create', label: 'Create', labelBn: 'তৈরি' },
  { key: 'edit', label: 'Edit', labelBn: 'সম্পাদনা' },
  { key: 'delete', label: 'Delete', labelBn: 'মুছে ফেলা' }
]

export const PERMISSION_CATALOG: PermModule[] = [
  { module: 'dashboard', label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', actions: [{ key: 'view', label: 'View', labelBn: 'দেখা' }] },
  { module: 'customers', label: 'Customer Management', labelBn: 'গ্রাহক ব্যবস্থাপনা', actions: CRUD },
  { module: 'billing', label: 'Billing', labelBn: 'বিলিং', actions: [...CRUD] },
  { module: 'payments', label: 'Payment Collection', labelBn: 'পেমেন্ট কালেকশন', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'collect', label: 'Collect', labelBn: 'কালেকশন' },
    { key: 'edit', label: 'Edit', labelBn: 'সম্পাদনা' },
    { key: 'refund', label: 'Refund', labelBn: 'রিফান্ড' }
  ] },
  { module: 'staff', label: 'Managers (Staff)', labelBn: 'ম্যানেজার (কর্মী)', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'create', label: 'Create', labelBn: 'তৈরি' },
    { key: 'edit', label: 'Edit', labelBn: 'সম্পাদনা' },
    { key: 'delete', label: 'Deactivate', labelBn: 'নিষ্ক্রিয়' }
  ] },
  { module: 'collectors', label: 'Collectors', labelBn: 'কালেক্টর', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'create', label: 'Create', labelBn: 'তৈরি' },
    { key: 'edit', label: 'Edit', labelBn: 'সম্পাদনা' },
    { key: 'delete', label: 'Deactivate', labelBn: 'নিষ্ক্রিয়' }
  ] },
  { module: 'reports', label: 'Reports', labelBn: 'রিপোর্ট', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'print', label: 'Print', labelBn: 'প্রিন্ট' },
    { key: 'export', label: 'Download / Export', labelBn: 'ডাউনলোড / এক্সপোর্ট' }
  ] },
  { module: 'areas', label: 'Area / Zone', labelBn: 'এরিয়া / জোন', actions: CRUD },
  { module: 'packages', label: 'Packages', labelBn: 'প্যাকেজ', actions: CRUD },
  { module: 'messaging', label: 'SMS / Messaging', labelBn: 'এসএমএস / মেসেজিং', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'send', label: 'Send', labelBn: 'পাঠানো' },
    { key: 'manage', label: 'Manage Templates', labelBn: 'টেমপ্লেট ম্যানেজ' }
  ] },
  { module: 'complaints', label: 'Complaints', labelBn: 'অভিযোগ', actions: CRUD },
  { module: 'resellers', label: 'Resellers', labelBn: 'রিসেলার', actions: CRUD },
  { module: 'accounts', label: 'Accounts', labelBn: 'হিসাব', actions: CRUD },
  { module: 'users', label: 'User Management', labelBn: 'ইউজার ব্যবস্থাপনা', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'create', label: 'Create Manager/Collector', labelBn: 'Manager/Collector তৈরি' },
    { key: 'edit', label: 'Manage', labelBn: 'ম্যানেজ' }
  ] },
  { module: 'security', label: 'Admin Management & Security', labelBn: 'অ্যাডমিন ম্যানেজমেন্ট ও নিরাপত্তা', actions: [
    { key: 'view', label: 'View Admins/Logs', labelBn: 'অ্যাডমিন/লগ দেখা' },
    { key: 'manage', label: 'Manage', labelBn: 'ম্যানেজ' }
  ] },
  { module: 'company_profile', label: 'Company Profile (Settings)', labelBn: 'কোম্পানি প্রোফাইল (সেটিংস)', actions: [
    { key: 'view', label: 'View', labelBn: 'দেখা' },
    { key: 'edit', label: 'Edit', labelBn: 'সম্পাদনা' }
  ] }
]

export function permKey(module: string, action: string): string {
  return `${module}.${action}`
}

// Legacy module keys that are valid in role permissions but are not part of
// PERMISSION_CATALOG (bespoke IPC modules / inventory group / automation).
export const LEGACY_MODULES = ['settings', 'automation', 'inventory', 'connections', 'purchases', 'transactions', 'customer_documents']

// Single source of truth for permission checks — used by BOTH the backend
// (requirePermission middleware) and the frontend (menu / button gating) so the
// two sides can never drift apart again.
// - 'all' → everything (SUPER_ADMIN only)
// - module key → full access to that module (legacy roles)
// - 'module.action' key → only that action
export function hasPermission(perms: string[], module: string, action?: string): boolean {
  if (!perms || !perms.length) return false
  if (perms.includes('all')) return true
  if (perms.includes(module)) return true
  if (action) return perms.includes(`${module}.${action}`)
  return false
}

// Any access to a module (menu visibility): module key or any granular key.
export function hasModuleAccess(perms: string[], module: string): boolean {
  if (!perms || !perms.length) return false
  if (perms.includes('all') || perms.includes(module)) return true
  return perms.some((p) => p.startsWith(module + '.'))
}

// Is a key valid for storing in roles.permissions? (module or granular key)
export function isValidRoleKey(key: string): boolean {
  if (!key) return false
  if (key === 'all') return false // 'all' is reserved for the SUPER_ADMIN role
  if (isValidPermKey(key)) return true // catalog module + granular keys
  if (LEGACY_MODULES.includes(key)) return true
  // generic entity module keys (zones, cash_deposits, pppoe_users, ...)
  return GENERIC_ENTITY_KEYS.includes(key)
}

// Is a permission key syntactically valid (in the catalog or a legacy module)?
export function isValidPermKey(key: string): boolean {
  if (!key) return false
  if (key === 'all') return true
  if (PERMISSION_CATALOG.some((m) => m.module === key)) return true
  const [mod, action] = key.split('.')
  const modDef = PERMISSION_CATALOG.find((m) => m.module === mod)
  return !!modDef && !!modDef.actions.some((a) => a.key === action)
}

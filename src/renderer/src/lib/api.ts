import type { Api } from '../../../preload/index'

declare global {
  interface Window { api: Api }
}

export const api = (): Api => window.api

export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('SESSION_EXPIRED')) return 'EXPIRED'
  if (m.includes('PERMISSION_DENIED')) return 'আপনার এই অংশের অনুমতি নেই — অ্যাডমিন হিসেবে লগইন করে Security → Roles থেকে এই অংশের permission দিন'
  if (m.includes('ALL_PERMISSION_RESERVED')) return "'all' (full access) is exclusive to the SUPER_ADMIN role"
  if (m.includes('SYSTEM_ROLE_READONLY')) return 'System role — permissions cannot be modified for SUPER_ADMIN'
  if (m.includes('INVALID_PERMISSION:')) return 'Unknown permission: ' + m.split(':')[1]
  if (m.includes('REQUIRED:company_name')) return 'Company name is required / কোম্পানির নাম প্রয়োজন'
  if (m.includes('INVALID_EMAIL')) return 'Invalid email address / ইমেইল ঠিকানা সঠিক নয়'
  if (m.includes('INVALID_LOGO')) return 'Invalid logo file — use an image under 300KB / লোগো ফাইল সঠিক নয়'
  if (m.includes('INVALID_MOBILE')) return 'Invalid mobile number (01XXXXXXXXX) / মোবাইল নম্বর সঠিক নয়'
  if (m.includes('UNKNOWN_ENTITY')) return 'পেজটি লোড হয়নি — আবার চেষ্টা করুন (Unknown page)'
  return m.replace(/^.*Error invoking remote method '[^']+': Error: /, '')
}

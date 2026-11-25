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
  if (m.includes('NO_COLLECTOR_PROFILE')) return 'এই অ্যাকাউন্টের সাথে কোনো কালেক্টর প্রোফাইল যুক্ত নেই — অ্যাডমিনের সাথে যোগাযোগ করুন / No collector profile is linked to this account'
  if (m.includes('COLLECTOR_INACTIVE')) return 'কালেক্টর প্রোফাইল নিষ্ক্রিয় — পেমেন্ট নেওয়া যাচ্ছে না / Collector profile is inactive'
  if (m.includes('COLLECTOR_NOT_FOUND')) return 'নির্বাচিত কালেক্টর পাওয়া যায়নি / Selected collector not found'
  if (m.includes('AMBIGUOUS_COLLECTOR')) return 'একই নামে একাধিক কালেক্টর পাওয়া গেছে — অ্যাডমিনের সাথে যোগাযোগ করুন / Multiple collectors match this account — contact an administrator'
  if (m.includes('WORKSPACE_OPEN_FAILED')) return 'অ্যাকাউন্টের ডেটাবেস খোলা যায়নি — আবার চেষ্টা করুন / Could not open this account workspace — please retry'
  if (m.includes('SMS_BALANCE_INSUFFICIENT')) return 'পর্যাপ্ত এসএমএস ব্যালেন্স নেই — প্যাকেজ কিনুন / Insufficient SMS balance — buy a package'
  if (m.includes('SMS_BALANCE_CANNOT_BE_NEGATIVE')) return 'এসএমএস ব্যালেন্স ঋণাত্মক করা যাবে না / SMS balance cannot become negative'
  if (m.includes('SMS_GATEWAY_DISABLED') || m.includes('SMS_GATEWAY_URL_MISSING') || m.includes('SMS_SENDER_ID_MISSING') || m.includes('SMS_API_KEY_MISSING') || m.includes('SMS_PROVIDER_INVALID') || m.includes('SMS_GATEWAY_NOT_CONFIGURED'))
    return 'SMS গেটওয়ে কনফিগার করা হয়নি — সুপার অ্যাডমিনের সাথে যোগাযোগ করুন / SMS gateway is not configured — contact the Super Admin'
  if (m.includes('SMS_GATEWAY_TIMEOUT')) return 'SMS গেটওয়ে সময়মতো সাড়া দেয়নি / SMS gateway timed out'
  if (m.includes('SMS_GATEWAY_NETWORK_ERROR')) return 'SMS গেটওয়েতে সংযোগ করা যায়নি — ইন্টারনেট দেখুন / Could not reach the SMS gateway'
  if (m.includes('SMS_BALANCE_URL_MISSING') || m.includes('SMS_BALANCE_URL_INVALID')) return 'গেটওয়ে ব্যালেন্স API URL সেট করা হয়নি / Gateway balance API URL is not configured'
  if (m.includes('SMS_DLR_URL_MISSING') || m.includes('SMS_DLR_URL_INVALID')) return 'ডেলিভারি রিপোর্ট API URL সেট করা হয়নি / Delivery report API URL is not configured'
  if (m.includes('SMS_PROVIDER_ID_MISSING')) return 'গেটওয়ে message ID নেই — DLR চেক করা যাবে না / No gateway message ID to check'
  if (m.includes('SMS_BALANCE_RESPONSE_INVALID')) return 'গেটওয়ের ব্যালেন্স রেসপন্স পড়া যায়নি / Could not read gateway balance response'
  if (m.includes('INVALID_LOW_BALANCE_THRESHOLD')) return 'সতর্কতা সীমা সঠিক সংখ্যা নয় / Invalid low-balance threshold'
  if (m.includes('INVALID_BALANCE_URL')) return 'ব্যালেন্স API URL সঠিক HTTPS URL নয় / Invalid balance API URL'
  if (m.includes('INVALID_DLR_URL')) return 'ডেলিভারি রিপোর্ট URL সঠিক HTTPS URL নয় / Invalid delivery report URL'
  if (m.includes('TRX_ALREADY_USED')) return 'এই ট্রানজেকশন আইডি আগেই ব্যবহৃত হয়েছে / This transaction ID was already used'
  if (m.includes('INVALID_TRX_ID')) return 'সঠিক ট্রানজেকশন আইডি দিন / Enter a valid transaction ID'
  if (m.includes('PACKAGE_NOT_FOUND')) return 'প্যাকেজ পাওয়া যায়নি / Package not found'
  if (m.includes('INVALID_RECIPIENT')) return 'মোবাইল নম্বর সঠিক নয় (01XXXXXXXXX) / Invalid mobile number'
  if (m.includes('SMS_MESSAGE_EMPTY') || m.includes('SMS_MESSAGE_TOO_LONG')) return 'এসএমএস বার্তা দিন (সর্বোচ্চ ২০০০ অক্ষর) / Enter an SMS message (max 2000 chars)'
  return m.replace(/^.*Error invoking remote method '[^']+': Error: /, '')
}

// Account switching must never carry the previous account's transient UI state
// into the next one. The renderer has no external query cache (React state is
// destroyed by the hard reload that follows a switch), so clearing sessionStorage
// and any per-user cache keys is sufficient. Theme/language preferences stay.
export function clearClientAccountState(): void {
  try { sessionStorage.clear() } catch { /* not available */ }
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^ava[-_](cache|query|data|user|account)/i.test(key)) localStorage.removeItem(key)
    }
  } catch { /* not available */ }
}

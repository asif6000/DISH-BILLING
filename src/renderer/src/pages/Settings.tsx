import React, { useEffect, useRef, useState } from 'react'
import { Building2, Save, ImageUp, X } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, useReflist } from '../components/ui'
import { errMsg } from '../lib/api'

// Company profile keys saved via settings:companyProfileUpdate (Administrator
// with company_profile permission) — everything else stays SUPER_ADMIN-only.
const COMPANY_KEYS = ['company_name', 'company_name_bn', 'company_mobile', 'company_mobile_alt', 'company_email', 'company_address', 'company_logo']
const MAX_LOGO_BYTES = 300 * 1024 // ~300KB before base64 encoding

// Auto-update runs fully automatically (GitHub feed baked into the main process,
// checked at startup + every hour) — no customer-facing controls.
export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const [s, setS] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [isSuper, setIsSuper] = useState(false)
  const [canEditCompany, setCanEditCompany] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // previously saved company information loads automatically on open
    window.api.settings.getAll().then(setS).catch(() => {})
    window.api.auth.check().then((r: any) => {
      const perms: string[] = r?.user?.permissions || []
      setIsSuper(perms.includes('all') || perms.includes('settings'))
      setCanEditCompany(perms.includes('all') || perms.includes('settings') ||
        perms.includes('company_profile') || perms.includes('company_profile.edit'))
    }).catch(() => {})
  }, [])

  const set = (k: string, v: string) => setS((x) => ({ ...x, [k]: v }))

  // ---- logo picker (stored as data URL in the settings table) ----
  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.push('error', lang === 'bn' ? 'শুধু ছবি ফাইল দেওয়া যাবে' : 'Only image files are allowed')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.push('error', lang === 'bn' ? 'লোগো ৩০০KB এর ছোট হতে হবে' : 'Logo must be smaller than 300KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('company_logo', String(reader.result || ''))
    reader.onerror = () => toast.push('error', lang === 'bn' ? 'ফাইল পড়া যায়নি' : 'Could not read the file')
    reader.readAsDataURL(file)
  }

  const saveAll = async () => {
    // prevent empty required field — no fake success
    if (!String(s.company_name || '').trim()) {
      toast.push('error', lang === 'bn' ? 'কোম্পানির নাম প্রয়োজন' : 'Company name is required')
      return
    }
    setBusy(true)
    try {
      // company profile goes through the dedicated endpoint — the Administrator
      // (company_profile permission) can save it without the 'settings' grant
      const company: Record<string, string> = {}
      for (const k of COMPANY_KEYS) if (k in s) company[k] = s[k]
      await window.api.companyProfile.update(company)
      // SUPER_ADMIN additionally saves the system settings (invoice, billing...)
      if (isSuper) {
        const system = Object.fromEntries(Object.entries(s).filter(([k]) => !COMPANY_KEYS.includes(k)))
        if (Object.keys(system).length) await window.api.settings.setMany(system)
      }
      toast.push('success', t('saved') + (lang === 'bn' ? ' — সব রিপোর্ট/প্রিন্টে নতুন তথ্য দেখাবে' : ' — all reports/prints now use it'))
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBusy(false) }
  }

  const input = (k: string, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={s[k] || ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  )

  const canEdit = isSuper || canEditCompany

  return (
    <div>
      <PageHeader
        title={t('nav_settings')}
        actions={canEdit ? <button className="btn-primary" onClick={saveAll} disabled={busy}><Save size={16} /> {busy ? (lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : t('save')}</button> : undefined}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 size={16} className="text-brand-600" /> {t('companyProfile')}</h3>
          <div className="space-y-3">
            {canEdit ? (
              <>
                {/* editable company profile: name/mobile required, plus alt mobile, address, logo */}
                {input('company_name', t('companyName') + (lang === 'bn' ? ' (EN) *' : ' *'))}
                {input('company_name_bn', t('companyName') + ' (বাংলা)')}
                <div className="grid grid-cols-2 gap-3">
                  {input('company_mobile', t('companyMobile'))}
                  {input('company_mobile_alt', t('companyMobileAlt'))}
                </div>
                {input('company_address', t('companyAddress'))}
                <div>
                  <label className="label">{t('companyLogo')}</label>
                  <div className="flex items-center gap-3">
                    {s.company_logo ? (
                      <div className="relative">
                        <img src={s.company_logo} alt="logo" className="h-14 w-14 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white" />
                        <button className="absolute -top-2 -right-2 p-0.5 rounded-full bg-red-500 text-white" title={t('delete')}
                          onClick={() => set('company_logo', '')}><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600"><Building2 size={20} /></div>
                    )}
                    <input ref={logoInput} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = '' }} />
                    <button type="button" className="btn-secondary btn-sm" onClick={() => logoInput.current?.click()}>
                      <ImageUp size={14} /> {lang === 'bn' ? 'লোগো আপলোড' : 'Upload logo'}
                    </button>
                    <span className="text-[10px] text-slate-400">{lang === 'bn' ? 'সর্বোচ্চ ৩০০KB' : 'max 300KB'}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1 text-sm">
                <p><b>{s.company_name || '—'}</b></p>
                {s.company_name_bn && <p className="text-slate-500">{s.company_name_bn}</p>}
                <p className="text-slate-500">📞 {s.company_mobile || '—'}</p>
                <p className="text-xs text-amber-600 mt-2">{lang === 'bn' ? 'শুধু দেখা যাচ্ছে — সম্পাদনার অনুমতি নেই' : 'View only — you cannot edit company settings'}</p>
              </div>
            )}
          </div>
        </div>
        {isSuper && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">{t('settings_invoice')}</h3>
            <div className="space-y-3">
              {input('invoice_prefix', t('invoiceNo') + ' Prefix')}
              {input('bill_footer', t('thanksFooter'))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">{t('settings_billing')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {input('late_fee', t('lateFeeSetting'), 'number')}
              {input('session_timeout_min', t('sessionTimeout'), 'number')}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">{t('settings_language')} & {t('theme')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('language')}</label>
                <select className="input" value={lang} onChange={(e) => { setLang(e.target.value as any); set('language', e.target.value) }}>
                  <option value="bn">বাংলা (Bengali)</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="label">{t('currency')}</label>
                <input className="input bg-slate-100 dark:bg-slate-800" value="BDT (৳)" disabled />
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

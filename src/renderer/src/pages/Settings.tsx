import React, { useEffect, useState } from 'react'
import { Building2, Save, Database, HardDriveDownload } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, useReflist } from '../components/ui'
import { errMsg } from '../lib/api'

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const [s, setS] = useState<Record<string, string>>({})
  const [dbPath, setDbPath] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.settings.getAll().then(setS).catch(() => {})
    window.api.backup.dir().then(setDbPath).catch(() => {})
  }, [])

  const set = (k: string, v: string) => setS((x) => ({ ...x, [k]: v }))

  const saveAll = async () => {
    setBusy(true)
    try {
      await window.api.settings.setMany(s)
      toast.push('success', t('saved'))
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBusy(false) }
  }

  const checkIntegrity = async () => {
    try {
      const ok = await window.api.backup.integrity()
      ok ? toast.push('success', '✓ ' + (lang === 'bn' ? 'ডাটাবেস ঠিক আছে' : 'Database OK'))
        : toast.push('error', lang === 'bn' ? 'ডাটাবেসে সমস্যা!' : 'Database corrupted!')
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const input = (k: string, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={s[k] || ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  )

  return (
    <div>
      <PageHeader
        title={t('nav_settings')}
        actions={<button className="btn-primary" onClick={saveAll} disabled={busy}><Save size={16} /> {t('save')}</button>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 size={16} className="text-brand-600" /> {t('companyProfile')}</h3>
          <div className="space-y-3">
            {input('company_name', t('companyName') + ' (EN)')}
            {input('company_name_bn', t('companyName') + ' (বাংলা)')}
            {input('company_address', t('companyAddress'))}
            {input('company_mobile', t('companyMobile'))}
          </div>
        </div>
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
      </div>
      <div className="card p-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Database size={16} className="text-brand-600" /> {t('settings_system')}</h3>
        <div className="text-xs text-slate-500 space-y-1">
          <p><b>{t('databasePath')}:</b> <span className="font-mono">{dbPath}/../ava-cable.db</span></p>
          <p>{lang === 'bn' ? 'ডেটা ইনস্টলেশন ফোল্ডারের বাইরে (AppData) সংরক্ষিত — সফটওয়্যার আপডেট বা রিইনস্টলে ডেটা নিরাপদ থাকে।' : 'Data is stored in AppData (outside installation folder) — safe across updates and reinstalls.'}</p>
        </div>
        <button className="btn-secondary btn-sm mt-3" onClick={checkIntegrity}><HardDriveDownload size={14} /> {t('integrityCheck')}</button>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { Zap, Download, Database, AlertTriangle, ShieldCheck, ShieldOff, Play } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, ConfirmDialog } from '../components/ui'
import { money, thisMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { ENTITIES } from '@shared/entities'
import { DataTable } from '../components/DataTable'

export default function AutomationPage() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [backups, setBackups] = useState<any[]>([])
  const [dbPath, setDbPath] = useState('')

  useEffect(() => {
    window.api.settings.getAll().then(setSettings).catch(() => {})
    window.api.backup.dir().then(setDbPath).catch(() => {})
  }, [])

  useEffect(() => {
    window.api.backup.list().then(setBackups).catch(() => {})
  }, [result, backupOpen])

  const save = async (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }))
    try {
      await window.api.settings.set(key, value)
      toast.push('success', t('saved'))
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const runBilling = async () => {
    try {
      const r = await window.api.automation.runBilling()
      setResult(r)
      toast.push('success', `${r.created} ${lang === 'bn' ? 'বিল তৈরি' : 'bills created'}, ${r.skipped} ${lang === 'bn' ? 'বাদ' : 'skipped'}`)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const runBackup = async () => {
    try {
      const p = await window.api.backup.create()
      if (p) toast.push('success', `${t('backup')}: ${p}`)
      setBackupOpen(false)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const checkIntegrity = async () => {
    try {
      const ok = await window.api.backup.integrity()
      ok ? toast.push('success', lang === 'bn' ? 'ডাটাবেস ঠিক আছে ✓' : 'Database is OK ✓')
        : toast.push('error', lang === 'bn' ? 'ডাটাবেসে সমস্যা!' : 'Database issue!')
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button onClick={() => save(k, settings[k] === '1' ? '0' : '1')}
        className={`relative w-10 h-5.5 h-6 rounded-full transition ${settings[k] === '1' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings[k] === '1' ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  )

  return (
    <div>
      <PageHeader title={t('nav_automation')} subtitle={t('automation_billing')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Zap size={16} className="text-brand-600" /> {t('automation_billing')}</h3>
          <p className="text-xs text-slate-500 mb-2">{lang === 'bn'
            ? 'অ্যাপ চালু হলে চলতি মাসের বিল স্বয়ংক্রিয়ভাবে তৈরি হয় (ডুপ্লিকেট হয় না)।'
            : 'Current month bills are generated automatically on app start (no duplicates).'}</p>
          <Toggle k="auto_billing" label={t('autoBilling')} />
          <Toggle k="auto_backup" label={t('autoBackup')} />
          <div className="py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('lateFeeSetting')}</span>
              <input type="number" min="0" className="input w-28" value={settings.late_fee || '0'}
                onChange={(e) => save('late_fee', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={runBilling}><Play size={15} /> {t('runBillingNow')}</button>
            <button className="btn-secondary" onClick={checkIntegrity}><ShieldCheck size={15} /> {t('integrityCheck')}</button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Database size={16} className="text-brand-600" /> {t('automation_backup')}</h3>
          <p className="text-xs text-slate-500 mb-3 break-all">
            <b>{t('databasePath')}:</b> {dbPath}
          </p>
          <p className="text-xs text-slate-500 mb-3">{lang === 'bn'
            ? 'প্রতি ১২ ঘণ্টায় স্বয়ংক্রিয় ব্যাকআপ হয় (সর্বশেষ ৩০টি সংরক্ষিত)। ডেটা ইনস্টলেশন ফোল্ডারের বাইরে সংরক্ষিত — আপডেট/রিইনস্টলেও ডেটা নিরাপদ থাকে।'
            : 'Automatic backup every 12 hours (last 30 kept). Data lives outside the installation folder — safe across updates/reinstalls.'}</p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setBackupOpen(true)}><Download size={15} /> {t('backupCreate')}</button>
          </div>
          <div className="mt-4 max-h-48 overflow-y-auto">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-mono truncate">{b.name}</span>
                <span className="text-slate-400 whitespace-nowrap ml-2">{(b.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
            {!backups.length && <p className="text-xs text-slate-400 text-center py-3">{t('noData')}</p>}
          </div>
        </div>
      </div>

      {result && (
        <div className="card p-4 mt-4">
          <h3 className="text-sm font-semibold mb-2">{t('runBillingNow')} — {thisMonth()}</h3>
          <div className="text-sm">{t('billing_generate')}: {result.created} · {t('billing_current')}: {result.skipped}</div>
        </div>
      )}

      <ConfirmDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onConfirm={runBackup}
        title={t('backupCreate')}
        message={lang === 'bn' ? 'ব্যাকআপ ফাইলের লোকেশন নির্বাচন করুন (সেভ ডায়ালগ খুলবে)।' : 'Choose backup location (save dialog will open).'}
        danger={false}
      />
    </div>
  )
}

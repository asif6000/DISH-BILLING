import React, { useEffect, useState } from 'react'
import { Building2, Save, Database, HardDriveDownload, RefreshCw, Download, Rocket, ShieldCheck, Cloud } from 'lucide-react'
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
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-brand-600" /> {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}</h3>
        <SubscriptionCard />
      </div>
      <div className="card p-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Cloud size={16} className="text-brand-600" /> {t('supabaseTitle')}</h3>
        <SupabaseCard lang={lang} />
      </div>
      <div className="card p-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Rocket size={16} className="text-brand-600" /> {lang === 'bn' ? 'অটো-আপডেট সিস্টেম' : 'Auto Update System'}</h3>
        <UpdateSettings />
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

// ---------- Subscription panel ----------
function SubscriptionCard() {
  const { t } = useI18n()
  const toast = useToast()
  const [s, setS] = useState<any>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => window.api.subscription.status().then(setS).catch(() => {})
  useEffect(() => { load() }, [])

  const activate = async () => {
    if (!code.trim()) return
    setBusy(true)
    try {
      const r: any = await window.api.subscription.activate(code)
      toast.push('success', t('subActivated') + ' — ' + r.expire)
      setCode('')
      load()
    } catch (e) {
      const m = errMsg(e)
      toast.push('error', m.includes('INVALID_CODE') ? t('subInvalidCode') : m)
    } finally { setBusy(false) }
  }

  if (!s) return <div className="text-xs text-slate-400">…</div>
  const color = s.state === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : s.state === 'expiring' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`badge ${color}`}>
          {s.state === 'expired' ? t('expired') : s.state === 'expiring' ? t('subExpiring') : t('active')}
        </span>
        <span className="text-slate-500">{t('subActiveUntil')} <b className="font-mono">{s.expire}</b></span>
        <span className="text-slate-500">· {t('subDaysLeft')}: <b>{s.daysLeft}</b></span>
      </div>
      <p className="text-[11px] text-slate-400">
        {t('subFee')}: <b>৳10,000</b> — bKash <b className="font-mono">01331707900</b> · Nagad <b className="font-mono">01616595386</b>
      </p>
      <div className="flex gap-2 max-w-md">
        <input className="input flex-1 font-mono uppercase tracking-widest" placeholder={t('subCode')}
          value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && activate()} />
        <button className="btn-primary whitespace-nowrap" onClick={activate} disabled={busy || !code.trim()}>{t('subActivateBtn')}</button>
      </div>
    </div>
  )
}

// ---------- Supabase panel ----------
function SupabaseCard({ lang }: { lang: string }) {
  const { t } = useI18n()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [appId, setAppId] = useState('')

  useEffect(() => {
    window.api.settings.getAll().then((s: any) => {
      setUrl(s.supabase_url || '')
      setKey(s.supabase_anon_key || '')
    }).catch(() => {})
    window.api.subscription.appId().then(setAppId).catch(() => {})
  }, [])

  const save = async () => {
    try {
      await window.api.settings.setMany({ supabase_url: url.trim(), supabase_anon_key: key.trim() })
      toast.push('success', t('saved'))
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">{t('supabaseUrl')}</label>
          <input className="input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('supabaseKey')}</label>
          <input className="input" type="password" placeholder="eyJhbGciOi..." value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">{lang === 'bn'
        ? 'Supabase Dashboard → Project Settings → API থেকে URL ও anon key নিন। সেটআপ করলে পেমেন্ট গেট থেকে TrxID রিকোয়েস্ট পাঠানো ও অটো-অ্যাক্টিভেশন চালু হবে।'
        : 'Get the URL and anon key from Supabase Dashboard → Project Settings → API. Enables payment requests from the gate and auto-activation after approval.'}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn-secondary" onClick={save}><Save size={14} /> {t('save')}</button>
        <span className="text-[11px] text-slate-400 font-mono">{t('supabaseAppId')}: {appId.slice(0, 8)}…</span>
      </div>
    </div>
  )
}

// ---------- Auto Update panel ----------
function UpdateSettings() {
  const { lang } = useI18n()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [autoCheck, setAutoCheck] = useState(true)
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<any>({ state: 'idle' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.settings.getAll().then((s: any) => {
      setUrl(s.update_url || '')
      setAutoCheck(s.auto_update_check !== '0')
    }).catch(() => {})
    window.api.updater.appVersion().then(setVersion).catch(() => {})
    window.api.updater.status().then(setStatus).catch(() => {})
    const off = window.api.updater.onStatus((s: any) => setStatus(s))
    return () => { off() }
  }, [])

  const save = async () => {
    try {
      await window.api.updater.configure(url, autoCheck)
      toast.push('success', lang === 'bn' ? 'সংরক্ষিত হয়েছে' : 'Saved')
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const check = async () => {
    setBusy(true)
    try {
      await window.api.updater.check()
    } catch (e) {
      const m = errMsg(e)
      if (m.includes('UPDATE_URL_NOT_SET')) toast.push('error', lang === 'bn' ? 'আগে আপডেট সার্ভার URL দিন' : 'Set the update server URL first')
      else if (m.includes('net::ERR_INTERNET')) toast.push('error', lang === 'bn' ? 'ইন্টারনেট নেই — অফলাইন মোডে আপডেট চেক হয় না' : 'No internet — offline, update check skipped')
      else toast.push('error', m)
    } finally { setBusy(false) }
  }

  const stateText: Record<string, string> = {
    idle: '—', checking: lang === 'bn' ? 'চেক করা হচ্ছে…' : 'Checking…',
    available: lang === 'bn' ? 'নতুন ভার্সন পাওয়া গেছে!' : 'New version available!',
    'not-available': lang === 'bn' ? 'আপ-টু-ডেট ✓' : 'Up to date ✓',
    downloading: (lang === 'bn' ? 'ডাউনলোড হচ্ছে… ' : 'Downloading… ') + status.percent + '%',
    downloaded: lang === 'bn' ? 'ডাউনলোড সম্পন্ন — ইনস্টল করুন' : 'Downloaded — ready to install',
    error: lang === 'bn' ? 'ত্রুটি: ' + (status.info?.message || '') : 'Error: ' + (status.info?.message || ''),
    'not-configured': lang === 'bn' ? 'সার্ভার URL কনফিগার করা হয়নি' : 'Server URL not configured'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{lang === 'bn' ? 'বর্তমান ভার্সন:' : 'Current version:'}</span>
        <b className="font-mono">{version}</b>
        {status.state !== 'idle' && status.state !== 'error' && (
          <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 ml-2">{stateText[status.state] || status.state}</span>
        )}
        {status.state === 'error' && <span className="badge bg-red-100 text-red-600 ml-2 truncate max-w-[300px]">{stateText.error}</span>}
      </div>
      <div>
        <label className="label">{lang === 'bn' ? 'আপডেট সার্ভার URL' : 'Update Server URL'}</label>
        <input className="input" placeholder="https://updates.yourdomain.com/ava-cable/" value={url} onChange={(e) => setUrl(e.target.value)} />
        <p className="text-[11px] text-slate-400 mt-1">{lang === 'bn'
          ? 'যেখানে latest.yml ও নতুন Setup EXE হোস্ট করা থাকবে (নিজের সার্ভার/হোস্টিং)। খালি রাখলে অটো-আপডেট বন্ধ থাকবে — অফলাইনে সমস্যা নেই।'
          : 'Where latest.yml and the new Setup EXE are hosted (your own server). Leave empty to disable — offline use is unaffected.'}</p>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={autoCheck} onChange={(e) => setAutoCheck(e.target.checked)} className="w-4 h-4" />
        {lang === 'bn' ? 'অ্যাপ চালু হলে স্বয়ংক্রিয়ভাবে আপডেট চেক করুন (ইন্টারনেট থাকলে)' : 'Check for updates automatically on app start (when internet available)'}
      </label>
      <div className="flex gap-2 flex-wrap">
        <button className="btn-secondary" onClick={save}>{lang === 'bn' ? 'সংরক্ষণ' : 'Save'}</button>
        <button className="btn-secondary" onClick={check} disabled={busy}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {lang === 'bn' ? 'এখনই চেক করুন' : 'Check Now'}</button>
        {status.state === 'available' && (
          <button className="btn-primary" onClick={() => window.api.updater.download().catch((e) => toast.push('error', errMsg(e)))}>
            <Download size={14} /> {lang === 'bn' ? 'ডাউনলোড করুন' : 'Download'}
          </button>
        )}
        {status.state === 'downloaded' && (
          <button className="btn-success" onClick={() => window.api.updater.install().catch((e) => toast.push('error', errMsg(e)))}>
            <Rocket size={14} /> {lang === 'bn' ? 'ইনস্টল ও রিস্টার্ট' : 'Install & Restart'}
          </button>
        )}
      </div>
    </div>
  )
}

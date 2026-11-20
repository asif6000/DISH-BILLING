import React, { useEffect, useState } from 'react'
import { Tv, RefreshCw, DownloadCloud, ShieldCheck } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { errMsg } from '../lib/api'

// Forced update gate: shown before login while an update is available.
// Login is blocked (also enforced in the main process) until the update is
// installed and the app restarts. Downloads automatically, then installs.
export default function UpdateGate() {
  const { t, lang } = useI18n()
  const [s, setS] = useState<any>({ state: 'checking', percent: 0 })
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.updater.status().then((st: any) => setS(st)).catch(() => {})
    window.api.updater.appVersion().then(setVersion).catch(() => {})
    const off = window.api.updater.onStatus((st: any) => setS(st))
    return () => { off() }
  }, [])

  // auto-install when downloaded (download starts automatically via autoDownload)
  useEffect(() => {
    if (s.state === 'downloaded') {
      const timer = window.setTimeout(() => window.api.updater.install().catch(() => {}), 2500)
      return () => window.clearTimeout(timer)
    }
  }, [s.state])

  const retry = async () => {
    try { await window.api.updater.check() } catch (e) { /* status event shows the error */ }
  }

  const isBn = lang === 'bn'
  const texts: Record<string, string> = {
    checking: t('updChecking'),
    'not-available': t('updUpToDate'),
    available: t('updTitle') + ' ' + t('updDownloading'),
    downloading: t('updDownloading') + ' ' + (s.percent || 0) + '%',
    downloaded: t('updInstalling'),
    error: t('updError')
  }
  const nextVer = s.info?.version ? `v${s.info.version}` : ''

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-8 shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-lg mb-4">
            <Tv size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <DownloadCloud size={20} className="text-brand-400" /> {t('updTitle')}
          </h1>
          {nextVer && <p className="text-slate-400 text-sm mt-1">{t('updNewVersion')}: <b className="font-mono text-brand-300">{nextVer}</b></p>}
          <p className="text-amber-300 text-sm mt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="shrink-0" /> {t('updMust')}
          </p>

          <div className="mt-6">
            {s.state === 'downloading' && (
              <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${s.percent || 0}%` }} />
              </div>
            )}
            <p className="text-slate-300 text-sm mt-3">
              {texts[s.state] || s.state}
              {(s.state === 'checking' || s.state === 'downloading') && (
                <RefreshCw size={13} className="inline ml-2 animate-spin text-slate-400" />
              )}
            </p>
            {s.state === 'error' && (
              <div className="mt-4">
                <p className="text-red-400 text-xs font-mono break-all">{s.info?.message || ''}</p>
                <button className="btn-primary mt-3" onClick={retry}><RefreshCw size={14} /> {t('updRetry')}</button>
              </div>
            )}
            {s.state === 'not-available' && (
              <p className="text-slate-500 text-xs mt-3">{isBn ? 'লগইন পেজে ফিরে যাচ্ছে…' : 'Returning to login…'}</p>
            )}
          </div>

          <p className="text-slate-500 text-[11px] mt-6">{t('version')}: {version} · AVA Cable Management System</p>
        </div>
      </div>
    </div>
  )
}

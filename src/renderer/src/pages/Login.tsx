import React, { useState } from 'react'
import { Tv, Lock, User } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { UserInfo } from '@shared/types'
import { errMsg } from '../lib/api'

export default function Login({ onLogin }: { onLogin: (u: UserInfo) => void }) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await window.api.auth.login(username.trim(), password)
      onLogin(r.user)
    } catch (err) {
      const m = errMsg(err)
      setError(m.includes('INVALID_CREDENTIALS') ? t('loginError')
        : m.includes('UPDATE_REQUIRED') ? t('updMust') : m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-lg mb-3">
            <Tv size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{t('appName')}</h1>
          <p className="text-slate-400 text-sm mt-1">100% Offline — Secure Access</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4 shadow-xl">
          <div>
            <label className="label">{t('username')}</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input className="input pl-9" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
            </div>
          </div>
          <div>
            <label className="label">{t('password')}</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input className="input pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>{busy ? t('loading') : t('signIn')}</button>
          <p className="text-[11px] text-slate-400 text-center">{t('defaultAdminNotice')}</p>
        </form>
      </div>
    </div>
  )
}

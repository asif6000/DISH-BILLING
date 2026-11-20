import React, { useEffect, useState } from 'react'
import { Tv, Lock, User, UserPlus, KeyRound } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { UserInfo } from '@shared/types'
import { errMsg } from '../lib/api'
import { useToast } from '../components/ui'

// Signup / forgot-password dialogs live here; the login screen also polls
// Supabase every 30s so remote account approvals and password resets reach
// the local database automatically.
export default function Login({ onLogin }: { onLogin: (u: UserInfo) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // signup dialog
  const [showSignup, setShowSignup] = useState(false)
  const [suName, setSuName] = useState('')
  const [suMobile, setSuMobile] = useState('')
  const [suUser, setSuUser] = useState('')
  const [suPass, setSuPass] = useState('')
  const [signupSent, setSignupSent] = useState(false)

  // forgot password dialog
  const [showForgot, setShowForgot] = useState(false)
  const [fpUser, setFpUser] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // poll Supabase for approvals / resets while the login screen is visible
  useEffect(() => {
    const check = async () => {
      const r: any = await window.api.userAccounts.checkRemote().catch(() => null)
      if (r?.activated?.length) toast.push('success', `${t('accountApproved')} (${r.activated.join(', ')})`)
      if (r?.reset?.length) toast.push('success', `${t('passwordResetApplied')} (${r.reset.join(', ')})`)
    }
    check()
    const id = window.setInterval(check, 30_000)
    return () => window.clearInterval(id)
  }, [])

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
    } finally { setBusy(false) }
  }

  const doSignup = async () => {
    if (!suUser.trim() || !suName.trim() || suPass.length < 6) return
    setBusy(true)
    try {
      await window.api.userAccounts.signup({ username: suUser.trim(), fullName: suName.trim(), mobile: suMobile.trim(), password: suPass })
      setSignupSent(true)
    } catch (e) {
      const m = errMsg(e)
      toast.push('error', m.includes('USERNAME_EXISTS') ? t('usernameExists')
        : m.includes('PASSWORD_TOO_SHORT') ? t('required') + ' (6+)' : m)
    } finally { setBusy(false) }
  }

  const doForgot = async () => {
    if (!fpUser.trim()) return
    setBusy(true)
    try {
      await window.api.userAccounts.forgot(fpUser.trim())
      setResetSent(true)
    } catch (e) {
      const m = errMsg(e)
      toast.push('error', m.includes('USER_NOT_FOUND') ? t('userNotFound') : m)
    } finally { setBusy(false) }
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-4 overflow-y-auto">
      <div className="w-full max-w-sm my-auto">
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

          <div className="flex items-center justify-between text-xs">
            <button type="button" className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              onClick={() => { setShowSignup(true); setSignupSent(false) }}>
              <UserPlus size={13} /> {t('createAccount')}
            </button>
            <button type="button" className="text-slate-500 hover:underline flex items-center gap-1"
              onClick={() => { setShowForgot(true); setResetSent(false) }}>
              <KeyRound size={13} /> {t('forgotPassword')}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center">{t('defaultAdminNotice')}</p>
        </form>
      </div>

      {/* ---- signup dialog ---- */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowSignup(false)}>
          <div className="card p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {!signupSent ? (
              <>
                <h2 className="font-bold text-lg mb-1">{t('createAccount')}</h2>
                <p className="text-xs text-slate-400 mb-4">{t('signupSent').split('—')[0]}</p>
                <div className="space-y-3">
                  <div><label className="label">{t('name')} *</label>
                    <input className="input" value={suName} onChange={(e) => setSuName(e.target.value)} /></div>
                  <div><label className="label">{t('mobile')}</label>
                    <input className="input" value={suMobile} onChange={(e) => setSuMobile(e.target.value)} /></div>
                  <div><label className="label">{t('username')} *</label>
                    <input className="input" value={suUser} onChange={(e) => setSuUser(e.target.value)} /></div>
                  <div><label className="label">{t('password')} * (6+)</label>
                    <input className="input" type="password" value={suPass} onChange={(e) => setSuPass(e.target.value)} /></div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button className="btn-secondary" onClick={() => setShowSignup(false)}>{t('cancel')}</button>
                  <button className="btn-primary" onClick={doSignup} disabled={busy || !suUser.trim() || !suName.trim() || suPass.length < 6}>
                    <UserPlus size={14} /> {t('confirm')}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <UserPlus size={36} className="mx-auto text-brand-500 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t('signupSent')}</p>
                <button className="btn-primary mt-4" onClick={() => setShowSignup(false)}>{t('close')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- forgot password dialog ---- */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowForgot(false)}>
          <div className="card p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {!resetSent ? (
              <>
                <h2 className="font-bold text-lg mb-1">{t('forgotPassword')}</h2>
                <p className="text-xs text-slate-400 mb-4">{t('username')}</p>
                <input className="input" placeholder={t('username')} value={fpUser} onChange={(e) => setFpUser(e.target.value)} />
                <div className="flex justify-end gap-2 mt-4">
                  <button className="btn-secondary" onClick={() => setShowForgot(false)}>{t('cancel')}</button>
                  <button className="btn-primary" onClick={doForgot} disabled={busy || !fpUser.trim()}>{t('confirm')}</button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <KeyRound size={36} className="mx-auto text-brand-500 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t('resetSent')}</p>
                <button className="btn-primary mt-4" onClick={() => setShowForgot(false)}>{t('close')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

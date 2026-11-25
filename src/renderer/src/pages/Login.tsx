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
  const { t, lang } = useI18n()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [help, setHelp] = useState<any>(null)
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
      if (r?.roleChanged?.length) toast.push('success', lang === 'bn' ? `রোল আপডেট হয়েছে: ${r.roleChanged.join(', ')}` : `Role updated: ${r.roleChanged.join(', ')}`)
    }
    check()
    const id = window.setInterval(check, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setHelp(null)
    try {
      const r = await window.api.auth.login(username.trim(), password)
      onLogin(r.user)
    } catch (err) {
      const m = errMsg(err)
      if (m.includes('ACCOUNT_PENDING') || m.includes('ACCOUNT_INACTIVE') || m.includes('INVALID_CREDENTIALS')) {
        // ask the main process WHY (status only — never a password/hash)
        const h: any = await (window.api.auth as any).loginHelp?.(username.trim()).catch(() => null)
        setHelp(h)
        // a pending account that is already approved remotely activates within
        // the 30s poll — tell the user instead of leaving them stuck
        if (m.includes('ACCOUNT_PENDING')) window.api.userAccounts.checkRemote().catch(() => null)
        // the account exists in Supabase but not on this installation yet:
        // sync once (auto-provision creates the local account) and retry the
        // same password immediately — no restart, no waiting for the poll
        if (h && !h.local && h.remote?.status === 'approved') {
          const sync: any = await window.api.userAccounts.checkRemote().catch(() => null)
          if (sync?.provisioned?.length || sync?.activated?.length) {
            try {
              const r2 = await window.api.auth.login(username.trim(), password)
              onLogin(r2.user)
              return
            } catch { /* still no matching password → show the guidance below */ }
          }
        }
      }
      setError(m.includes('INVALID_CREDENTIALS') ? t('loginError')
        : m.includes('ACCOUNT_PENDING') ? (lang === 'bn' ? 'এই অ্যাকাউন্ট এখনো approved নয়' : 'This account is not approved yet')
          : m.includes('ACCOUNT_INACTIVE') ? (lang === 'bn' ? 'এই অ্যাকাউন্ট নিষ্ক্রিয় করা আছে' : 'This account has been deactivated')
            : m.includes('UPDATE_REQUIRED') ? t('updMust') : m)
    } finally { setBusy(false) }
  }

  // actionable guidance under the error box (username vs company name, local
  // account missing, pending approval, wrong password …)
  const helpLines: string[] = []
  if (help) {
    if (help.suggestion) {
      helpLines.push(lang === 'bn'
        ? `ইউজারনেম হলো “${help.suggestion}” — নাম/কোম্পানির নাম নয়। এটাই দিয়ে আবার চেষ্টা করুন।`
        : `The username is “${help.suggestion}” — not the name/company name. Try that.`)
    }
    if (!help.local && help.remote) {
      helpLines.push(lang === 'bn'
        ? `Supabase-এ অ্যাকাউন্ট আছে (${help.remote.status}) কিন্তু এই ইনস্টলে লোকাল অ্যাকাউন্ট নেই — সুপার অ্যাডমিন Security → Supabase User Management থেকে “Create local account” করুন।`
        : `The account exists in Supabase (${help.remote.status}) but not on this installation — a super admin can create it from Security → Supabase User Management ("Create local account").`)
    }
    if (help.local?.status === 'pending') {
      helpLines.push(lang === 'bn'
        ? 'লোকাল অ্যাকাউন্ট এখনো approve হয়নি — Supabase-এ approve করার ৩০ সেকেন্ডের মধ্যে অটো সক্রিয় হবে।'
        : 'The local account is still pending — it activates automatically within 30 seconds after the Supabase approval.')
    }
    if (help.local?.status === 'inactive') {
      helpLines.push(lang === 'bn'
        ? 'অ্যাকাউন্টটি নিষ্ক্রিয় — সুপার অ্যাডমিন Security → Users থেকে সক্রিয় করবেন।'
        : 'The account is deactivated — a super admin can re-activate it in Security → Users.')
    }
    if (help.local?.status === 'active') {
      helpLines.push(lang === 'bn'
        ? 'ইউজারনেম ঠিক আছে, কিন্তু পাসওয়ার্ড মিলছে না — “Forgot password?” চাপুন (সুপার অ্যাডমিন নতুন পাসওয়ার্ড সেট করবেন)।'
        : 'The username is correct but the password does not match — use "Forgot password?" (a super admin sets a new one).')
    }
    if (!help.local && !help.remote && !help.suggestion) {
      helpLines.push(lang === 'bn'
        ? 'এই ইউজারনেম কোনো অ্যাকাউন্টে নেই — বানান দেখুন, অথবা “Create Account” দিয়ে সাইনআপ করুন।'
        : 'No account has this username — check the spelling, or use "Create Account".')
    }
  }

  const doSignup = async () => {
    if (!suUser.trim() || !suName.trim() || suPass.length < 6) return
    setBusy(true)
    try {
      const r: any = await window.api.userAccounts.signup({ username: suUser.trim(), fullName: suName.trim(), mobile: suMobile.trim(), password: suPass })
      setSignupSent(true)
      if (r?.synced === false) toast.push('error', t('signupNotSynced'))
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
          {helpLines.length > 0 && (
            <ul className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2 space-y-1 list-disc pl-6">
              {helpLines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
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

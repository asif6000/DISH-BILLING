import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { MENU } from './menu'
import { useI18n } from '../lib/i18n'
import { UserInfo } from '@shared/types'

function icon(name: string): any {
  const I = (Icons as any)[name]
  return I || Icons.Circle
}

export default function Layout({ user, onLogout }: { user: UserInfo | null; onLogout: () => void }) {
  const { t, lang, setLang } = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [dark, setDark] = useState(() => localStorage.getItem('ava_theme') === 'dark')
  const [pending, setPending] = useState(0)
  const [sub, setSub] = useState<any>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    window.api.subscription.status().then((s: any) => setSub(s)).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ava_theme', dark ? 'dark' : 'light')
  }, [dark])

  // auto-open the group containing current path
  useEffect(() => {
    for (const g of MENU) {
      if (g.children?.some((c) => location.pathname + location.search === c.path)) {
        setOpen((o) => ({ ...o, [g.labelKey]: true }))
      }
    }
  }, [location])

  useEffect(() => {
    window.api.dashboard.recent().then((r: any) => setPending(r.pendingComplaints || 0)).catch(() => {})
  }, [location])

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.altKey) return
      const map: Record<string, string> = { d: '/dashboard', c: '/customers', b: '/billing', p: '/payments/collect', r: '/reports' }
      const k = e.key.toLowerCase()
      if (map[k]) { e.preventDefault(); navigate(map[k]) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navigate])

  const isActive = (path: string) => location.pathname + location.search === path

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-60'} shrink-0 bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col transition-all duration-200 overflow-y-auto`}>
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-slate-800 sticky top-0 bg-slate-900 dark:bg-slate-950 z-10">
          <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white p-1">
            <Icons.PanelLeft size={18} />
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Tv size={20} className="text-brand-400 shrink-0" />
              <span className="font-bold text-white text-sm truncate">{t('appName')}</span>
            </div>
          )}
        </div>
        <nav className="p-2 space-y-0.5 flex-1">
          {MENU.map((g) => {
            if (g.path) {
              const I = icon(g.icon)
              return (
                <Link key={g.labelKey} to={g.path}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] hover:bg-slate-800 hover:text-white transition ${isActive(g.path) ? 'bg-brand-600 text-white' : ''}`}>
                  <I size={17} className="shrink-0" />
                  {!collapsed && <span className="truncate">{t(g.labelKey)}</span>}
                  {!collapsed && g.labelKey === 'nav_complaints' && pending > 0 && <span className="ml-auto badge bg-red-500 text-white">{pending}</span>}
                </Link>
              )
            }
            const isOpen = open[g.labelKey]
            const I = icon(g.icon)
            return (
              <div key={g.labelKey}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [g.labelKey]: !o[g.labelKey] }))}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] hover:bg-slate-800 hover:text-white transition">
                  <I size={17} className="shrink-0" />
                  {!collapsed && <span className="truncate text-left flex-1">{t(g.labelKey)}</span>}
                  {!collapsed && <Icons.ChevronRight size={13} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />}
                </button>
                {!collapsed && isOpen && (
                  <div className="ml-4 pl-3 border-l border-slate-800 space-y-0.5 my-1">
                    {g.children!.map((c) => (
                      <Link key={c.path} to={c.path}
                        className={`block px-2.5 py-1.5 rounded-md text-xs hover:bg-slate-800 hover:text-white transition ${isActive(c.path) ? 'bg-slate-800 text-brand-300 font-medium' : ''}`}>
                        {t(c.labelKey)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3 sticky top-0 z-20">
          <div className="flex-1" />
          <button onClick={() => setDark(!dark)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title={t('theme')}>
            {dark ? <Icons.Sun size={17} /> : <Icons.Moon size={17} />}
          </button>
          <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="btn-secondary btn-sm h-8" title={t('language')}>
            {lang === 'bn' ? 'EN' : 'বাং'}
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-semibold">{user?.fullName}</div>
              <div className="text-[10px] text-slate-400">{user?.roleName}</div>
            </div>
            <button onClick={onLogout} className="btn-secondary btn-sm" title={t('logout')}><Icons.LogOut size={14} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          {sub && sub.state !== 'active' && (
            <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-amber-800 dark:text-amber-300">
              <Icons.AlertTriangle size={16} className="shrink-0" />
              <span className="font-semibold">{t('subExpiring')}</span>
              <span>
                {t('subDaysLeft')}: <b>{sub.daysLeft}</b> · {t('subFee')}: <b>৳10,000</b>
              </span>
              <span className="text-xs">bKash 01331707900 · Nagad 01616595386</span>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="h-8 shrink-0 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-[11px] text-slate-400">
          <span>AVA Cable Management System v1.0 — 100% Offline</span>
          <span>{t('keyboardShortcuts')}</span>
        </footer>
      </div>
    </div>
  )
}

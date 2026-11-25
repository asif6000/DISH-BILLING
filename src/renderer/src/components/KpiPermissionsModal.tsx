// Dashboard KPI Permissions — per-collector individual overrides over role defaults.
// Priority enforced by the backend: individual override → role default → deny.
import React, { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Modal, useToast } from './ui'
import { errMsg } from '../lib/api'
import { useI18n } from '../lib/i18n'

// labels mirror the permission catalog (Collector KPI cards)
export const KPI_CARDS: { key: string; en: string; bn: string }[] = [
  { key: 'kpi_today', en: "Today's Collection", bn: 'আজকের কালেকশন' },
  { key: 'kpi_month', en: "This Month's Collection", bn: 'এই মাসের কালেকশন' },
  { key: 'kpi_total', en: 'Total Collection', bn: 'সর্বমোট কালেকশন' },
  { key: 'kpi_cash', en: 'Cash Collection', bn: 'নগদ কালেকশন' },
  { key: 'kpi_bkash', en: 'bKash Collection', bn: 'বিকাশ কালেকশন' },
  { key: 'kpi_nagad', en: 'Nagad Collection', bn: 'নগদ (ন্যাগাদ) কালেকশন' },
  { key: 'kpi_rocket', en: 'Rocket Collection', bn: 'রকেট কালেকশন' },
  { key: 'kpi_bank', en: 'Bank Collection', bn: 'ব্যাংক কালেকশন' },
  { key: 'kpi_customers', en: 'Assigned Customers', bn: 'অ্যাসাইন করা গ্রাহক' },
  { key: 'kpi_due', en: 'Due in My Areas', bn: 'আমার এরিয়ার বকেয়া' },
  { key: 'kpi_target', en: 'Collection Target', bn: 'কালেকশন টার্গেট' },
  { key: 'kpi_performance', en: 'Performance', bn: 'পারফরম্যান্স' },
  { key: 'kpi_history', en: 'My Collection History', bn: 'আমার কালেকশন ইতিহাস' }
]

export function KpiPermissionsModal({ user, onClose }: { user: any; onClose: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [info, setInfo] = useState<any>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    window.api.dashboard.kpiPermissions(user.id)
      .then((r: any) => { setInfo(r); setOverrides({ ...(r.overrides || {}) }) })
      .catch((e) => { toast.push('error', errMsg(e)); onClose() })
  }, [user?.id])

  if (!info) return null
  const roleAllows = info.roleAllows || {}
  // effective = individual override if present, else role default
  const effective = (key: string) => overrides[key] !== undefined ? overrides[key] : !!roleAllows[key]
  const overriddenCount = Object.keys(overrides).length

  const save = async (reset = false) => {
    setBusy(true)
    try {
      await window.api.dashboard.kpiPermissionsSet(user.id, reset ? {} : overrides)
      toast.push('success', reset
        ? (lang === 'bn' ? 'Role default-এ রিসেট হয়েছে' : 'Reset to role defaults')
        : t('saved'))
      if (reset) {
        const r = await window.api.dashboard.kpiPermissions(user.id)
        setInfo(r); setOverrides({})
      } else onClose()
    } catch (e) { toast.push('error', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`${t('dashboard')} KPI — ${info.user.fullName} (${info.user.roleName})`} width="max-w-lg">
      <div className="mb-3 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
        <span><b className="font-mono">{info.user.username}</b></span>
        <span>{lang === 'bn' ? 'Role' : 'Role'}: <b>{info.user.roleName}</b></span>
        <span>{lang === 'bn'
          ? 'টিক ছাড়া কার্ড = Role default অনুযায়ী। নিজের সেটিং দিলে "override" ব্যাজ দেখাবে।'
          : 'Unchecked cards follow the role default. Your own setting shows an "override" badge.'}</span>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {KPI_CARDS.map((c) => {
          const isOverride = overrides[c.key] !== undefined
          return (
            <label key={c.key}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${effective(c.key) ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
              <span className="flex items-center gap-2 min-w-0">
                <input type="checkbox" className="w-4 h-4" checked={effective(c.key)}
                  onChange={() => setOverrides((o) => ({ ...o, [c.key]: !effective(c.key) }))} />
                <span className="truncate">{lang === 'bn' ? c.bn : c.en}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {isOverride && (
                  <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    {lang === 'bn' ? 'নিজের সেটিং' : 'override'}
                  </span>
                )}
                {isOverride && (
                  <button className="text-slate-300 hover:text-red-500" title={lang === 'bn' ? 'Role default-এ ফিরিয়ে দিন' : 'Back to role default'}
                    onClick={(e) => { e.preventDefault(); setOverrides((o) => { const n = { ...o }; delete n[c.key]; return n }) }}>✕</button>
                )}
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-4">
        <button className="btn-secondary btn-sm" disabled={busy || !overriddenCount}
          onClick={() => save(true)}>
          <RotateCcw size={13} /> {lang === 'bn' ? `Role default-এ রিসেট${overriddenCount ? ` (${overriddenCount})` : ''}` : `Reset to Role Defaults${overriddenCount ? ` (${overriddenCount})` : ''}`}
        </button>
        <div className="flex gap-2 ml-auto">
          <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? '...' : t('save')}</button>
        </div>
      </div>
    </Modal>
  )
}

import React, { useEffect, useState } from 'react'
import { MapPin, Check } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast } from '../components/ui'
import { errMsg } from '../lib/api'

// Assign areas to collectors
export function CollectorAssign() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [collectors, setCollectors] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [assigned, setAssigned] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)

  const load = () => {
    window.api.db.reflist('collectors').then((r: any) => { setCollectors(r); if (r[0]) select(r[0]) }).catch(() => {})
    window.api.db.reflist('areas').then(setAreas).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const select = async (c: any) => {
    setSel(c)
    const rows = await window.api.collector.getAreas(c.id)
    setAssigned(new Set(rows.map((r: any) => r.area_id)))
    setDirty(false)
  }

  const toggle = (id: number) => {
    setAssigned((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setDirty(true)
  }

  const save = async () => {
    try {
      await window.api.collector.assignAreas(sel.id, [...assigned])
      toast.push('success', t('saved'))
      setDirty(false)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('collectors_assign')}
        actions={<button className="btn-primary" onClick={save} disabled={!sel || !dirty}><Check size={16} /> {t('save')}</button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          {collectors.map((c) => (
            <button key={c.id} onClick={() => select(c)}
              className={`w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 transition ${sel?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
              <span className="font-medium text-sm">{c.label}</span>
            </button>
          ))}
          {!collectors.length && <p className="text-sm text-slate-400 text-center py-8">{t('noData')}</p>}
        </div>
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{t('newArea')}</h4>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {areas.map((a) => (
              <label key={a.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${assigned.has(a.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <input type="checkbox" checked={assigned.has(a.id)} onChange={() => toggle(a.id)} className="w-4 h-4" />
                <MapPin size={13} className="text-slate-400" />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

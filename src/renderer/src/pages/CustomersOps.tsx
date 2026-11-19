import React, { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, useReflist } from '../components/ui'
import { ShiftPage, TransferModal } from './Connections'
import { money, thisMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { EntityPage } from '../components/EntityPage'

// Transfer page (full UI with customer picker)
export function CustomersOps({ mode }: { mode: 'transfer' | 'shift' }) {
  if (mode === 'shift') return <ShiftPage />
  return <TransferPage />
}

function TransferPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [modal, setModal] = useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.api.customers.list({ page: 1, pageSize: 10, search }).then((r: any) => setCustomers(r.rows)).catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div>
      <PageHeader title={t('transferCustomer')} subtitle={t('newArea')} />
      <div className="card p-4">
        <input className="input mb-2" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-96 overflow-y-auto space-y-1">
          {customers.map((c) => (
            <button key={c.id} onClick={() => { setSel(c); setModal(true) }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between">
              <span><b>{c.name}</b> <span className="opacity-60 font-mono text-xs">{c.code}</span></span>
              <span className="text-xs text-slate-400">{c._area || '-'}</span>
            </button>
          ))}
          {!customers.length && <p className="text-sm text-slate-400 text-center py-6">{t('noData')}</p>}
        </div>
      </div>
      {sel && modal && <TransferModal customer={sel} onClose={() => setModal(false)} onSaved={() => setModal(false)} />}
    </div>
  )
}

export function ImportExport() { return null }

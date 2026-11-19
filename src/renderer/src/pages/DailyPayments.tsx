import React, { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { DataTable } from '../components/DataTable'
import { PageHeader } from '../components/ui'
import { money, monthStartEnd, thisMonth } from '../lib/format'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export function DailyPaymentsPage() {
  const { t, lang } = useI18n()
  const { from, to } = monthStartEnd(thisMonth())
  const [f, setF] = useState({ from, to })
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    window.api.payments.daily(f.from, f.to).then(setRows).catch(() => {})
  }, [f.from, f.to])
  const total = rows.reduce((s, r) => s + Number(r.collected), 0)
  return (
    <div>
      <PageHeader title={t('payments_daily')} subtitle={`${t('totalCollection')}: ৳${money(total)}`}
        actions={
          <div className="flex gap-2">
            <input type="date" className="input w-36" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <input type="date" className="input w-36" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
        } />
      <div className="card p-4 mb-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows.map((r) => ({ ...r, d: r.date.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
            <XAxis dataKey="d" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: any) => '৳ ' + money(v)} />
            <Bar dataKey="collected" name={t('collection')} fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable columns={[
        { key: 'date', label: t('date') },
        { key: 'collected', label: t('collection'), align: 'right', render: (r) => money(r.collected) },
        { key: 'refunded', label: t('payments_refund'), align: 'right', render: (r) => r.refunded ? money(r.refunded) : '-' }
      ]} rows={rows} exportName="daily-collection" />
    </div>
  )
}

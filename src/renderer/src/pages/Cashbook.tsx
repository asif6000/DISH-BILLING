import React, { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast } from '../components/ui'
import { money, monthStartEnd, thisMonth, exportExcel } from '../lib/format'
import { errMsg } from '../lib/api'

export default function CashbookPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { from, to } = monthStartEnd(thisMonth())
  const [f, setF] = useState({ from, to })
  const [data, setData] = useState<{ opening: number; rows: any[] }>({ opening: 0, rows: [] })

  useEffect(() => {
    window.api.accounts.cashbook(f.from, f.to).then(setData).catch((e) => toast.push('error', errMsg(e)))
  }, [f.from, f.to])

  const closing = data.rows.length ? data.rows[data.rows.length - 1].balance : data.opening

  return (
    <div>
      <PageHeader
        title={t('cashbook')}
        subtitle={`${t('openingBalance')}: ৳${money(data.opening)} · ${t('closingBalance')}: ৳${money(closing)}`}
        actions={
          <div className="flex gap-2">
            <input type="date" className="input w-36" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <input type="date" className="input w-36" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <button className="btn-secondary btn-sm" onClick={() => exportExcel('cashbook.xlsx', data.rows.map((r) => ({
              date: r.date, type: r.type, account: r.account, category: r.category, description: r.description, amount: r.amount, balance: r.balance
            })), 'Cashbook')}>Excel</button>
          </div>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="table-th">{t('date')}</th>
              <th className="table-th">{t('description')}</th>
              <th className="table-th">{t('accounts_bank')}</th>
              <th className="table-th">{t('expenses_categories')}</th>
              <th className="table-th text-right">{t('income')}</th>
              <th className="table-th text-right">{t('expense')}</th>
              <th className="table-th text-right">{t('balance')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-100/50 dark:bg-slate-800/30 font-medium">
              <td className="table-td" colSpan={6}>{t('openingBalance')}</td>
              <td className="table-td text-right">{money(data.opening)}</td>
            </tr>
            {data.rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="table-td">{r.date}</td>
                <td className="table-td">{r.description}</td>
                <td className="table-td">{r.account}</td>
                <td className="table-td">{r.category || '-'}</td>
                <td className="table-td text-right text-emerald-600">{r.type === 'income' ? money(r.amount) : '-'}</td>
                <td className="table-td text-right text-red-600">{r.type === 'expense' ? money(r.amount) : '-'}</td>
                <td className="table-td text-right font-medium">{money(r.balance)}</td>
              </tr>
            ))}
            {!data.rows.length && <tr><td colSpan={7} className="table-td text-center py-8 text-slate-400">{t('noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

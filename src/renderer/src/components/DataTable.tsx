import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, X, Download, FileText } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { money, dateFmt, downloadCSV, exportExcel, pdfExport } from '../lib/format'
import { useToast } from './ui'

export interface Column {
  key: string
  label: string
  render?: (row: any) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps {
  columns: Column[]
  rows: any[]
  total?: number
  page?: number
  pageSize?: number
  onPage?: (p: number) => void
  search?: string
  onSearch?: (s: string) => void
  loading?: boolean
  actions?: (row: any) => React.ReactNode
  exportName?: string
  extraToolbar?: React.ReactNode
  emptyText?: string
  // row selection (checkboxes) — used for select-all / bulk delete etc.
  selectable?: boolean
  selectedIds?: number[]
  onToggleRow?: (id: number, checked: boolean) => void
  onToggleAllPage?: (checked: boolean) => void
}

export function DataTable({ columns, rows, total, page, pageSize, onPage, search, onSearch, loading, actions, exportName, extraToolbar, emptyText, selectable, selectedIds, onToggleRow, onToggleAllPage }: DataTableProps) {
  const { t } = useI18n()
  const [localSearch, setLocalSearch] = useState('')
  const toast = useToast()
  const debounced = useRef<ReturnType<typeof setTimeout>>()
  const sel = useMemo(() => new Set(selectedIds || []), [selectedIds])
  const pageIds = rows.map((r) => r.id).filter((id) => id != null)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => sel.has(id))

  const onSearchInput = (v: string) => {
    setLocalSearch(v)
    clearTimeout(debounced.current)
    debounced.current = setTimeout(() => onSearch?.(v), 350)
  }

  const showSearch = onSearch !== undefined
  const showPager = onPage !== undefined && total !== undefined

  const doExport = async (kind: 'csv' | 'xlsx' | 'pdf') => {
    if (!rows.length) return toast.push('error', t('noData'))
    const name = exportName || 'export'
    const headers = Object.fromEntries(columns.map((c) => [c.key, c.label]))
    try {
      if (kind === 'csv') downloadCSV(name + '.csv', rows, headers)
      else if (kind === 'xlsx') await exportExcel(name + '.xlsx', rows, name)
      else pdfExport(name, rows, headers)
    } catch (e) {
      toast.push('error', String(e))
    }
  }

  return (
    <div className="card">
      {(showSearch || extraToolbar || exportName) && (
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 flex-wrap">
          {showSearch && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input className="input pl-9 pr-8" placeholder={t('search')} value={localSearch} onChange={(e) => onSearchInput(e.target.value)} />
              {localSearch && <button className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => { setLocalSearch(''); onSearch?.('') }}><X size={14} /></button>}
            </div>
          )}
          {extraToolbar}
          {exportName && (
            <div className="flex gap-1 ml-auto">
              <button className="btn-secondary btn-sm" title={t('exportExcel')} onClick={() => doExport('xlsx')}><Download size={13} /> Excel</button>
              <button className="btn-secondary btn-sm" title={t('exportPdf')} onClick={() => doExport('pdf')}><FileText size={13} /> PDF</button>
              <button className="btn-secondary btn-sm" onClick={() => doExport('csv')}><Download size={13} /> CSV</button>
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              {selectable && (
                <th className="table-th w-8 text-center">
                  <input type="checkbox" className="cursor-pointer" title={t('selectAll')}
                    checked={allPageSelected}
                    onChange={(e) => onToggleAllPage?.(e.target.checked)} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`table-th ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} ${c.className || ''}`}>{c.label}</th>
              ))}
              {actions && <th className="table-th text-right">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)} className="table-td text-center py-10 text-slate-400">{t('loading')}</td></tr>
            )}
            {!loading && !rows.length && (
              <tr><td colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)} className="table-td text-center py-10 text-slate-400">{emptyText || t('noData')}</td></tr>
            )}
            {!loading && rows.map((row, i) => (
              <tr key={row.id ?? i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${row.id != null && sel.has(row.id) ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                {selectable && (
                  <td className="table-td text-center w-8">
                    <input type="checkbox" className="cursor-pointer" checked={row.id != null && sel.has(row.id)}
                      onChange={(e) => onToggleRow?.(row.id, e.target.checked)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={`table-td ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} ${c.className || ''}`}>
                    {c.render ? c.render(row) : formatCell(row[c.key])}
                  </td>
                ))}
                {actions && <td className="table-td text-right whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPager && (
        <Pager page={page!} pageSize={pageSize || 20} total={total!} onPage={onPage!} />
      )}
    </div>
  )
}

function formatCell(v: any): React.ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300 dark:text-slate-600">-</span>
  if (typeof v === 'number' && !Number.isInteger(v)) return money(v)
  if (typeof v === 'number') return v
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return dateFmt(v)
  return String(v)
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useI18n()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 text-sm">
      <span className="text-slate-500 text-xs">{t('showing')} {total ? start : 0}–{end} {t('of')} {total}</span>
      <div className="flex items-center gap-1">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /></button>
        <span className="px-2 text-xs text-slate-500">{t('page')} {page} / {pages}</span>
        <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

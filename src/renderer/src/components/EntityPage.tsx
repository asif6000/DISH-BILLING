import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ENTITIES, FieldDef } from '@shared/entities'
import { useI18n } from '../lib/i18n'
import { DataTable, Column } from './DataTable'
import { Modal, ConfirmDialog, StatusBadge, useToast, useReflist, PageHeader } from './ui'
import { money, dateFmt } from '../lib/format'
import { errMsg } from '../lib/api'

export interface EntityPageProps {
  entity: string
  title: string
  subtitle?: string
  fixedFilters?: Record<string, string | number>
  extraColumns?: Column[]
  rowActions?: (row: any, refresh: () => void) => React.ReactNode
  hideFields?: string[]
  toolbar?: React.ReactNode
}

export function EntityPage({ entity, title, subtitle, fixedFilters, extraColumns, rowActions, hideFields = [], toolbar }: EntityPageProps) {
  const def = ENTITIES[entity]
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((x) => x + 1), [])

  useEffect(() => { setPage(1) }, [search, entity, JSON.stringify(fixedFilters)])

  useEffect(() => {
    setLoading(true)
    const params: any = { page, pageSize, search, filters: fixedFilters || {} }
    window.api.db.list(entity, params)
      .then((r: any) => { setRows(r.rows); setTotal(r.total) })
      .catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [page, search, entity, tick, JSON.stringify(fixedFilters)])

  const refEntities = useMemo(() => {
    const m: Record<string, { id: number; label: string }[]> = {}
    for (const f of def.fields) if (f.type === 'ref' && f.refEntity) m[f.name] = []
    return m
  }, [entity])

  const formFields = def.fields.filter((f) => !f.hideInForm && !hideFields.includes(f.name))
  const forRefs = [...new Set(formFields.filter((f) => f.type === 'ref' && f.refEntity).map((f) => f.refEntity!))]

  const columns: Column[] = [
    ...def.fields.filter((f) => !f.hideInTable && !hideFields.includes(f.name)).map((f): Column => ({
      key: f.name,
      label: lang === 'bn' ? f.labelBn : f.label,
      render: f.type === 'ref'
        ? (row) => row[`_${f.name}_label`] || '-'
        : f.name === 'status'
          ? (row) => <StatusBadge value={row.status} label={optLabel(f, row.status, lang)} />
          : (row) => formatValue(f, row[f.name])
    })),
    ...(extraColumns || [])
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {toolbar}
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={16} /> {t('add')}</button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        search={search}
        onSearch={setSearch}
        loading={loading}
        exportName={def.table}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            {rowActions?.(row, refresh)}
            <button className="btn-secondary btn-sm" title={t('edit')} onClick={() => { setEditing(row); setFormOpen(true) }}><Pencil size={13} /></button>
            <button className="btn-secondary btn-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title={t('delete')} onClick={() => setDeleting(row)}><Trash2 size={13} /></button>
          </div>
        )}
      />

      <EntityForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        entity={entity}
        editing={editing}
        onSaved={() => { setFormOpen(false); refresh() }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          window.api.db.delete(entity, deleting.id)
            .then(() => { toast.push('success', t('deleted')); refresh() })
            .catch((e) => toast.push('error', errMsg(e)))
        }}
        title={t('delete')}
        message={t('confirmDelete')}
      />
    </div>
  )
}

function optLabel(f: FieldDef, value: any, lang: string): string {
  const o = f.options?.find((x) => x.value === value)
  return o ? (lang === 'bn' ? o.labelBn : o.label) : value
}

function formatValue(f: FieldDef, v: any): React.ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300 dark:text-slate-600">-</span>
  if (f.type === 'money') return money(v)
  if (f.type === 'date') return dateFmt(v)
  if (f.type === 'checkbox') return v ? '✓' : '✗'
  return String(v)
}

// ---------- Form ----------
function EntityForm({ open, onClose, entity, editing, onSaved }: {
  open: boolean; onClose: () => void; entity: string; editing: any; onSaved: () => void
}) {
  const def = ENTITIES[entity]
  const { t, lang } = useI18n()
  const toast = useToast()
  const [form, setForm] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const formFields = def.fields.filter((f) => !f.hideInForm)

  useEffect(() => {
    if (!open) return
    const init: Record<string, any> = {}
    for (const f of formFields) {
      init[f.name] = editing ? editing[f.name] ?? '' : (f.defaultValue ?? (f.type === 'date' ? '' : ''))
    }
    setForm(init)
    setErrors({})
  }, [open, editing, entity])

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    const errs: Record<string, string> = {}
    for (const f of formFields) {
      const v = form[f.name]
      if (f.required && (v === '' || v === null || v === undefined)) errs[f.name] = t('required')
      if ((f.type === 'number' || f.type === 'money') && v !== '' && v !== null) {
        const n = Number(v)
        if (isNaN(n)) errs[f.name] = 'Invalid number'
        else if (f.min !== undefined && n < f.min) errs[f.name] = `Min: ${f.min}`
        else if (f.max !== undefined && n > f.max) errs[f.name] = `Max: ${f.max}`
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const data = { ...form }
      // empty ref → null
      for (const f of formFields) {
        if (f.type === 'ref' && (data[f.name] === '' || data[f.name] === undefined)) data[f.name] = null
        if ((f.type === 'number' || f.type === 'money') && data[f.name] === '') data[f.name] = 0
      }
      if (editing) await window.api.db.update(entity, editing.id, data)
      else await window.api.db.create(entity, data)
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) {
      toast.push('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={(editing ? t('edit') : t('add')) + ' — ' + (lang === 'bn' ? def.labelBn : def.label)} width="max-w-xl">
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formFields.map((f) => (
            <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="label">
                {lang === 'bn' ? f.labelBn : f.label}{f.required && <span className="text-red-500"> *</span>}
              </label>
              <FieldInput f={f} value={form[f.name]} onChange={(v) => set(f.name, v)} error={errors[f.name]} />
              {errors[f.name] && <p className="text-xs text-red-500 mt-0.5">{errors[f.name]}</p>}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('loading') : t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function FieldInput({ f, value, onChange, error }: { f: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  const { lang } = useI18n()
  const refs = useReflist(f.type === 'ref' ? f.refEntity || null : null)
  const base = `input ${error ? 'border-red-500 focus:ring-red-400' : ''}`
  if (f.type === 'textarea') return <textarea className={base + ' min-h-[70px]'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  if (f.type === 'select') {
    return (
      <select className={base} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {f.options?.map((o) => <option key={o.value} value={o.value}>{lang === 'bn' ? o.labelBn : o.label}</option>)}
      </select>
    )
  }
  if (f.type === 'ref') {
    return (
      <select className={base} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {refs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
    )
  }
  if (f.type === 'date') return <input type="date" className={base} value={(value || '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />
  if (f.type === 'month') return <input type="month" className={base} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  if (f.type === 'checkbox') return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
  return (
    <input
      type={f.type === 'number' || f.type === 'money' ? 'number' : 'text'}
      className={base}
      value={value ?? ''}
      min={f.min} max={f.max}
      step={f.type === 'money' ? '0.01' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

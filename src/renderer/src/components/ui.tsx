import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useI18n } from '../lib/i18n'

// ---------- Toasts ----------
interface Toast { id: number; type: 'success' | 'error' | 'info'; text: string }
const ToastCtx = createContext<{ push: (type: Toast['type'], text: string) => void }>({ push: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((type: Toast['type'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, type, text }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div key={t.id} className={`card flex items-start gap-2 p-3 shadow-lg border-l-4 ${t.type === 'success' ? 'border-l-emerald-500' : t.type === 'error' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
            {t.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : t.type === 'error' ? <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              : <AlertTriangle size={18} className="text-blue-500 shrink-0 mt-0.5" />}
            <div className="text-sm flex-1 break-words">{t.text}</div>
            <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: string
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`card w-full ${width} max-h-[88vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ---------- Confirm ----------
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; danger?: boolean
}) {
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className={`shrink-0 ${danger ? 'text-red-500' : 'text-amber-500'}`} size={24} />
        <p className="text-sm whitespace-pre-line">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose() }}>{t('confirm')}</button>
      </div>
    </Modal>
  )
}

// ---------- Status badge ----------
const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  sent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  fixed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  due: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  unpaid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  inactive: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  draft: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  disconnected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const color = statusColors[value] || 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  return <span className={`badge ${color}`}>{label || value}</span>
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} size={22} />
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// simple select of refs
export function useReflist(entity: string | null): { id: number; label: string }[] {
  const [rows, setRows] = useState<{ id: number; label: string }[]>([])
  useEffect(() => {
    if (!entity) return
    window.api.db.reflist(entity).then((r: any) => setRows(r)).catch(() => setRows([]))
  }, [entity])
  return rows
}

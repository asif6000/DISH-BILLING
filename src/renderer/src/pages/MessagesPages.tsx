import React, { useEffect, useState } from 'react'
import { Send, Users, FileText, CheckCircle2, Plus } from 'lucide-react'
import { useI18n, monthLabel } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { money, thisMonth } from '../lib/format'
import { errMsg } from '../lib/api'
import { EntityPage } from '../components/EntityPage'
import { ENTITIES } from '@shared/entities'

export function MessagesPages({ mode }: { mode: 'compose' | 'reminders' | 'history' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    window.api.db.list('messages', { page: 1, pageSize: 100 }).then((r: any) => setRows(r.rows)).catch(() => {})
  }, [tick])

  if (mode === 'history') {
    return (
      <div>
        <PageHeader title={t('messages_history')} />
        <DataTable columns={[
          { key: 'mobile', label: t('mobile') },
          { key: '_customer_id_label', label: t('customer'), render: (r) => r._customer_id_label || '-' },
          { key: 'channel', label: 'Channel' },
          { key: 'type', label: t('type') },
          { key: 'text', label: t('msgCompose'), render: (r) => <span className="text-xs">{r.text?.slice(0, 60)}</span> },
          { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> },
          { key: 'sent_at', label: t('msgSend'), render: (r) => r.sent_at || '-' }
        ]} rows={rows} exportName="messages" />
      </div>
    )
  }

  if (mode === 'reminders') {
    return <DueReminders onDone={() => setTick((x) => x + 1)} />
  }

  return <ComposePage onDone={() => setTick((x) => x + 1)} />
}

function ComposePage({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<any>(null)
  const [f, setF] = useState({ channel: 'sms', type: 'individual', text: '' })

  useEffect(() => {
    const timer = setTimeout(() => {
      window.api.customers.list({ page: 1, pageSize: 10, search }).then((r: any) => setCustomers(r.rows)).catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const send = async () => {
    if (!sel || !f.text.trim()) return
    try {
      const id = await window.api.db.create('messages', { customer_id: sel.id, mobile: sel.mobile, channel: f.channel, type: f.type, text: f.text, status: 'draft' })
      await window.api.messages.send(Number(id))
      toast.push('success', t('msgSend') + ' ✓')
      setF({ ...f, text: '' })
      onDone()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('messages_individual')} subtitle={lang === 'bn' ? 'এসএমএস রেকর্ড করুন; হোয়াটসঅ্যাপ ইন্টারনেট থাকলে খুলবে' : 'Record SMS; WhatsApp opens when internet available'} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <input className="input mb-2" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {customers.map((c) => (
              <button key={c.id} onClick={() => setSel(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sel?.id === c.id ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <b>{c.name}</b> <span className="opacity-60 text-xs">{c.mobile}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Channel</label>
              <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
                <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
              </select></div>
            <div><label className="label">{t('type')}</label>
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {ENTITIES.messages.fields.find((x) => x.name === 'type')!.options!.map((o) => (
                  <option key={o.value} value={o.value}>{lang === 'bn' ? o.labelBn : o.label}</option>
                ))}
              </select></div>
          </div>
          <div>
            <label className="label">{t('msgCompose')} <span className="text-red-500">*</span></label>
            <textarea className="input min-h-[100px]" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
            <div className="text-[11px] text-slate-400 mt-1">{lang === 'bn' ? 'প্রাপক' : 'Recipient'}: {sel ? `${sel.name} (${sel.mobile})` : '—'}</div>
          </div>
          <button className="btn-primary w-full" onClick={send} disabled={!sel || !f.text.trim()}><Send size={15} /> {t('msgSend')}</button>
        </div>
      </div>
    </div>
  )
}

function DueReminders({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [templates, setTemplates] = useState<any[]>([])
  const [templateId, setTemplateId] = useState('')
  const [month, setMonth] = useState(thisMonth())
  const [rows, setRows] = useState<any[]>([])
  const [tick, setTick2] = useState(0)

  useEffect(() => { window.api.db.reflist('sms_templates').then((r: any) => { setTemplates(r); if (r[0]) setTemplateId(String(r[0].id)) }).catch(() => {}) }, [])
  useEffect(() => {
    window.api.db.list('messages', { page: 1, pageSize: 100, filters: { type: 'due_reminder' } })
      .then((r: any) => setRows(r.rows)).catch(() => {})
  }, [tick])

  const generate = async () => {
    try {
      const count = await window.api.messages.composeDue(Number(templateId), month)
      toast.push('success', `${count} ${lang === 'bn' ? 'মেসেজ তৈরি হয়েছে' : 'messages composed'}`)
      onDone()
      setTick2((x) => x + 1)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <PageHeader title={t('msgDueReminder')} subtitle={monthLabel(month, lang)} />
      <div className="card p-4 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">{t('messages_templates')}</label>
          <select className="input w-64" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((tp) => <option key={tp.id} value={tp.id}>{tp.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('month')}</label>
          <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={generate}><Users size={15} /> {lang === 'bn' ? 'বকেয়া গ্রাহকদের জন্য তৈরি করুন' : 'Generate for due customers'}</button>
      </div>
      <DataTable columns={[
        { key: 'mobile', label: t('mobile') },
        { key: '_customer_id_label', label: t('customer'), render: (r) => r._customer_id_label || '-' },
        { key: 'text', label: t('msgCompose'), render: (r) => <span className="text-xs">{r.text?.slice(0, 70)}</span> },
        { key: 'status', label: t('statusCol'), render: (r) => <StatusBadge value={r.status} label={t(r.status)} /> },
        { key: 'act', label: t('actions'), render: (r) => (
          <div className="flex gap-1 justify-end">
            {r.status !== 'sent' && <button className="btn-secondary btn-sm text-emerald-600" onClick={() => window.api.messages.send(r.id).then(() => { toast.push('success', t('msgSend')); setTick2((x) => x + 1) }).catch((e) => toast.push('error', errMsg(e)))}><Send size={12} /></button>}
            {r.status !== 'sent' && <button className="btn-secondary btn-sm" title={t('msgMarkSent')} onClick={() => window.api.messages.markSent(r.id).then(() => setTick2((x) => x + 1))}><CheckCircle2 size={12} /></button>}
          </div>
        ) }
      ]} rows={rows} exportName="due-reminders" />
    </div>
  )
}

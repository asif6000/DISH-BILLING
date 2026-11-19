import React, { useEffect, useState } from 'react'
import { Plus, X, Printer } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { money, todayStr } from '../lib/format'
import { errMsg } from '../lib/api'
import { useReflist } from '../components/ui'

export function PurchasesPage() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    window.api.db.list('purchases', { page: 1, pageSize: 100 }).then((r: any) => setRows(r.rows)).catch(() => {})
  }, [tick])

  const view = async (id: number) => {
    const d = await window.api.inventory.getPurchase(id)
    setDetail(d)
  }

  return (
    <div>
      <PageHeader title={t('inventory_purchases')}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {t('purchase')}</button>} />
      <DataTable
        columns={[
          { key: 'invoice_no', label: '#', className: 'font-mono text-xs' },
          { key: 'date', label: t('date') },
          { key: '_supplier_id_label', label: t('supplier'), render: (r) => r._supplier_id_label || '-' },
          { key: 'total', label: t('total'), align: 'right', render: (r) => <b>{money(r.total)}</b> },
          { key: 'paid', label: t('paid'), align: 'right', render: (r) => money(r.paid) },
          { key: 'dueAmt', label: t('due'), align: 'right', render: (r) => money(r.total - r.paid) }
        ]}
        rows={rows} exportName="purchases"
        actions={(r) => <button className="btn-secondary btn-sm" onClick={() => view(r.id)}>{t('view')}</button>}
      />

      <PurchaseModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setTick((x) => x + 1) }} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.purchase?.invoice_no || ''} width="max-w-xl">
        {detail && (
          <>
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="table-th">{t('product')}</th><th className="table-th text-right">{t('quantity')}</th>
                <th className="table-th text-right">{t('price')}</th><th className="table-th text-right">{t('total')}</th>
              </tr></thead>
              <tbody>
                {detail.items.map((it: any) => (
                  <tr key={it.id}>
                    <td className="table-td">{it.product_name}</td>
                    <td className="table-td text-right">{it.qty} {it.unit}</td>
                    <td className="table-td text-right">{money(it.price)}</td>
                    <td className="table-td text-right">{money(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-bold border-t-2 border-slate-200">
                <td className="table-td" colSpan={3}>{t('total')}</td>
                <td className="table-td text-right">৳ {money(detail.purchase.total)}</td>
              </tr></tfoot>
            </table>
            <div className="text-xs text-slate-400 mt-2">
              {t('supplier')}: {detail.purchase.supplier_name || '-'} · {t('paid')}: ৳{money(detail.purchase.paid)} · {t('due')}: ৳{money(detail.purchase.total - detail.purchase.paid)}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function PurchaseModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [f, setF] = useState({ supplier_id: '', date: todayStr(), paid: '', note: '' })
  const [items, setItems] = useState<{ product_id: string; qty: string; price: string }[]>([])
  const products = useReflist('products')
  const suppliers = useReflist('suppliers')

  useEffect(() => {
    if (open) {
      setF({ supplier_id: '', date: todayStr(), paid: '', note: '' })
      setItems([{ product_id: '', qty: '', price: '' }])
    }
  }, [open])

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)

  const submit = async () => {
    const valid = items.filter((it) => it.product_id && Number(it.qty) > 0)
    if (!valid.length) { toast.push('error', lang === 'bn' ? 'অন্তত একটি পণ্য যোগ করুন' : 'Add at least one product'); return }
    try {
      await window.api.inventory.createPurchase({
        supplier_id: f.supplier_id ? Number(f.supplier_id) : null, date: f.date,
        paid: Number(f.paid) || 0, note: f.note,
        items: valid.map((it) => ({ product_id: Number(it.product_id), qty: Number(it.qty), price: Number(it.price) || 0 }))
      })
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('purchase')} width="max-w-2xl">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">{t('supplier')}</label>
          <select className="input" value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div><label className="label">{t('date')}</label>
          <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="label">{t('paid')}</label>
          <input type="number" min="0" className="input" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></div>
      </div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">{t('product')} ({t('quantity')}, {t('price')})</h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select className="input flex-1" value={it.product_id}
              onChange={(e) => {
                const productId = e.target.value
                const p = products.find((x) => String(x.id) === productId)
                // autofill price from last purchase price of product (approx: use purchase_price via db:get)
                const next = [...items]
                next[i] = { ...next[i], product_id: productId }
                setItems(next)
                if (productId) {
                  window.api.db.get('products', Number(productId)).then((p2: any) => {
                    if (p2?.purchase_price) {
                      const n = [...items]
                      n[i] = { ...n[i], product_id: productId, price: String(p2.purchase_price) }
                      setItems(n)
                    }
                  }).catch(() => {})
                }
              }}>
              <option value="">{t('product')}…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input type="number" min="0.01" placeholder={t('quantity')} className="input w-24" value={it.qty}
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], qty: e.target.value }; setItems(n) }} />
            <input type="number" min="0" placeholder={t('price')} className="input w-28" value={it.price}
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], price: e.target.value }; setItems(n) }} />
            <button className="text-slate-400 hover:text-red-500" onClick={() => setItems(items.filter((_, x) => x !== i))}><X size={15} /></button>
          </div>
        ))}
      </div>
      <button className="btn-secondary btn-sm mt-2" onClick={() => setItems([...items, { product_id: '', qty: '', price: '' }])}><Plus size={13} /> {t('product')}</button>
      <div className="text-right font-bold mt-3">{t('total')}: <span className="text-brand-600">৳ {money(total)}</span></div>
      <div className="flex justify-end gap-2 mt-3">
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={submit}>{t('save')}</button>
      </div>
    </Modal>
  )
}

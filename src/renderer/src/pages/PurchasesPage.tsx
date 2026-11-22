// Purchase module — manual product name (no dropdown), product image upload,
// automatic date/time (Asia/Dhaka, trusted backend timestamp), auto total.
import React, { useEffect, useRef, useState } from 'react'
import { Plus, X, Upload } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast } from '../components/ui'
import { money } from '../lib/format'
import { errMsg } from '../lib/api'

export function PurchasesPage() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [tick, setTick] = useState(0)

  const load = () => {
    window.api.inventory.listFull().then(setRows).catch((e) => toast.push('error', errMsg(e)))
  }
  useEffect(() => { load() }, [tick])

  const view = async (id: number) => {
    const d = await window.api.inventory.getPurchase(id)
    setDetail(d)
  }

  const dhakaDate = (ts: string) => String(ts || '').slice(0, 10)
  const dhakaTime = (ts: string) => String(ts || '').slice(11, 19)

  return (
    <div>
      <PageHeader title={t('inventory_purchases')}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {t('purchase')}</button>} />
      {/* history table — Bill Report table style */}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="p-2 text-left">{t('inventory_purchases').includes('urchase') ? 'ID' : 'আইডি'}</th>
                <th className="p-2 text-left">{t('product')}</th>
                <th className="p-2 text-left">{lang === 'bn' ? 'ছবি' : 'Image'}</th>
                <th className="p-2 text-right">{lang === 'bn' ? 'কেনা দাম' : 'Buy Price'}</th>
                <th className="p-2 text-right">{lang === 'bn' ? 'বিক্রয় দাম' : 'Sell Price'}</th>
                <th className="p-2 text-right">{t('quantity')}</th>
                <th className="p-2 text-right">{lang === 'bn' ? 'মোট কেনা' : 'Total Purchase'}</th>
                <th className="p-2 text-left">{t('date')}</th>
                <th className="p-2 text-left">{lang === 'bn' ? 'সময়' : 'Time'}</th>
                <th className="p-2 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-2 font-mono text-xs">{r.invoice_no}</td>
                  <td className="p-2 font-medium">{r.product_name || '-'}</td>
                  <td className="p-2">{r.product_image ? <img src={r.product_image} className="w-9 h-9 rounded object-cover border border-slate-200 dark:border-slate-700" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="p-2 text-right">{money(r.price ?? r.purchase_price)}</td>
                  <td className="p-2 text-right">{money(r.sale_price)}</td>
                  <td className="p-2 text-right">{r.qty ?? '-'}</td>
                  <td className="p-2 text-right font-semibold">{money(r.total)}</td>
                  <td className="p-2">{dhakaDate(r.created_local_time || r.date)}</td>
                  <td className="p-2">{dhakaTime(r.created_local_time || '') || '—'}</td>
                  <td className="p-2"><button className="btn-secondary btn-sm" onClick={() => view(r.id)}>{t('view')}</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10} className="p-6 text-center text-slate-400">{t('noData')}</td></tr>}
            </tbody>
          </table>
        </div>

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
              {lang === 'bn' ? 'সময়' : 'Saved'}: {detail.purchase.created_local_time || detail.purchase.date}
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
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState<string>('')
  const [buy, setBuy] = useState('')
  const [sell, setSell] = useState('')
  const [qty, setQty] = useState('')
  const [match, setMatch] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) { setName(''); setImage(''); setBuy(''); setSell(''); setQty(''); setMatch(null); setSuggestions([]); setErr('') }
  }, [open])

  // existing-product detection (debounced) — reuse the product, never duplicate it
  useEffect(() => {
    const q = name.trim()
    if (!q) { setMatch(null); setSuggestions([]); return }
    const id = setTimeout(async () => {
      try {
        const list = await window.api.db.list('products', { page: 1, pageSize: 100, search: q })
        const hit = (list.rows as any[]).find((p) => p.name.toLowerCase() === q.toLowerCase())
        setMatch(hit || null)
        setSuggestions((list.rows as any[]).slice(0, 6))
      } catch { setMatch(null); setSuggestions([]) }
    }, 300)
    return () => clearTimeout(id)
  }, [name])

  const total = (Number(buy) || 0) * (Number(qty) || 0)

  const pickImage = (file: File | null) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErr(lang === 'bn' ? 'ছবি ২ MB এর কম হতে হবে' : 'Image must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    setErr('')
    if (!name.trim()) { setErr(lang === 'bn' ? 'পণ্যের নাম দিন' : 'Product name is required'); return }
    if (Number(buy) < 0) { setErr(lang === 'bn' ? 'কেনা দাম ঋণাত্মক হতে পারে না' : 'Buy price cannot be negative'); return }
    if (Number(sell) < 0) { setErr(lang === 'bn' ? 'বিক্রয় দাম ঋণাত্মক হতে পারে না' : 'Sell price cannot be negative'); return }
    if (!(Number(qty) > 0)) { setErr(lang === 'bn' ? 'পরিমাণ ০ এর বেশি দিন' : 'Quantity must be greater than zero'); return }
    setBusy(true)
    try {
      // 1) find or create the product (image reused if the product already exists)
      const prod = await window.api.inventory.findOrCreateProduct({ name: name.trim(), image: image || undefined, salePrice: Number(sell) || 0 })
      if (match && prod.id !== match.id) throw new Error('PRODUCT_CHANGED')
      // 2) save the purchase (transaction-safe, stock updated once, auto timestamp)
      await window.api.inventory.createPurchase({
        items: [{ product_id: prod.id, qty: Number(qty), price: Number(buy) || 0, sale_price: Number(sell) || 0 }]
      })
      toast.push('success', t('saved'))
      onSaved()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('purchase')} width="max-w-lg">
      <div className="space-y-3">
        {/* Product name — manual text input */}
        <div>
          <label className="label">{lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'} <span className="text-red-500">*</span></label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === 'bn' ? 'যেকোনো পণ্যের নাম লিখুন' : 'Type any product name'} autoFocus />
          {match && (
            <p className="text-[11px] text-emerald-600 mt-1">
              ✓ {lang === 'bn' ? 'বিদ্যমান পণ্য পাওয়া গেছে — এটিই ব্যবহার হবে (নতুন ডুপ্লিকেট তৈরি হবে না)' : 'Existing product found — it will be reused (no duplicate created)'}
            </p>
          )}
          {!match && suggestions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="text-[11px] text-slate-400">{lang === 'bn' ? 'মিল পাওয়া পণ্য:' : 'Matches:'}</span>
              {suggestions.map((p: any) => (
                <button key={p.id} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700"
                  onClick={() => setName(p.name)}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
        {/* Product image — upload + preview */}
        <div>
          <label className="label">{lang === 'bn' ? 'পণ্যের ছবি' : 'Product Image'} {!match?.image && <span className="text-red-500">*</span>}</label>
          <div className="flex items-center gap-3">
            {image ? (
              <img src={image} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
            ) : match?.image ? (
              <img src={match.image} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" title={lang === 'bn' ? 'বিদ্যমান ছবি ব্যবহৃত হবে' : 'Existing image will be reused'} />
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400"><Upload size={18} /></div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
              <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={!!match?.image}>
                {lang === 'bn' ? 'ছবি বাছাই করুন' : 'Choose image'}
              </button>
              {image && <button className="text-xs text-red-500 ml-2" onClick={() => setImage('')}>{lang === 'bn' ? 'সরান' : 'Remove'}</button>}
              {match?.image && <p className="text-[10px] text-slate-400 mt-1">{lang === 'bn' ? 'বিদ্যমান পণ্যের ছবি ব্যবহৃত হবে' : "Existing product's image will be reused"}</p>}
            </div>
          </div>
        </div>
        {/* prices + quantity + auto total */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{lang === 'bn' ? 'কেনা দাম' : 'Buy Price'} <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" className="input" value={buy} onChange={(e) => setBuy(e.target.value)} />
          </div>
          <div>
            <label className="label">{lang === 'bn' ? 'বিক্রয় দাম' : 'Sell Price'} <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" className="input" value={sell} onChange={(e) => setSell(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('quantity')} <span className="text-red-500">*</span></label>
            <input type="number" min="0.01" step="0.01" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-400">{lang === 'bn' ? 'মোট কেনা (অটো)' : 'Total Purchase (auto)'}</span>
          <span className="font-bold text-brand-600">৳ {money(total)}</span>
        </div>
        <p className="text-[10px] text-slate-400">{lang === 'bn' ? 'তারিখ ও সময় (বাংলাদেশ সময়) সেভের সময় স্বয়ংক্রিয়ভাবে যুক্ত হবে' : 'Date & time (Asia/Dhaka) are added automatically on save'}</p>
        {err && <p className="text-xs text-red-500">⚠ {err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? (lang === 'bn' ? 'প্রসেসিং...' : 'Processing...') : t('save')}</button>
        </div>
      </div>
    </Modal>
  )
}

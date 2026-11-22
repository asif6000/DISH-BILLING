// Two-copy A4 billing report & print system (Office Copy + Customer Copy)
// READ-ONLY: printing never creates bills/payments — all figures come from existing records.
import React, { useCallback, useEffect, useState } from 'react'
import { Eye, Printer, FileDown, FileText } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { Modal, useToast, useReflist } from '../components/ui'
import { money, thisMonth, monthLabel } from '../lib/format'
import { errMsg } from '../lib/api'

type Copy = 'office' | 'customer' | 'both'
const BN_METHODS: Record<string, string> = { cash: 'নগদ (ক্যাশ)', bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', bank: 'ব্যাংক' }

export default function BillReport() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const areas = useReflist('areas')
  const [month, setMonth] = useState(thisMonth())
  const [q, setQ] = useState('')
  const [areaId, setAreaId] = useState('')
  const [status, setStatus] = useState('all')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    window.api.reports.billList(month, { q, areaId, status })
      .then(setRows).catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [month, q, areaId, status])
  useEffect(() => { load() }, [month])
  useEffect(() => { const id = setTimeout(load, 300); return () => clearTimeout(id) }, [q, areaId, status])

  const reset = () => { setQ(''); setAreaId(''); setStatus('all'); setMonth(thisMonth()) }

  const openPrint = async (r: any, copy: Copy) => {
    try {
      const info = await window.api.reports.customerBill(r.id, month)
      await window.api.print.preview(buildBillHtml(info, copy), `${info.customer.name} — ${monthLabel(month)}`)
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  const savePdf = async (r: any, copy: Copy) => {
    try {
      const info = await window.api.reports.customerBill(r.id, month)
      const path = await window.api.print.savePdf(buildBillHtml(info, copy), `${info.customer.code}-${month}-${copy}.pdf`)
      if (path) toast.push('success', (lang === 'bn' ? 'PDF সেভ হয়েছে: ' : 'PDF saved: ') + path)
    } catch (e) { toast.push('error', errMsg(e)) }
  }
  const openView = async (r: any) => {
    try { setView(await window.api.reports.customerBill(r.id, month)) } catch (e) { toast.push('error', errMsg(e)) }
  }

  const statusBadge = (s: string) => s === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : s === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">{t('billReportTitle')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{t('billReportSub')}</p>
      </div>
      {/* Filters */}
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <div>
          <label className="label">{t('billingMonth')}</label>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('search')}</label>
          <input className="input" placeholder={t('searchCustomerPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('area')}</label>
          <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">—</option>
            {areas.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('paymentStatus')}</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('all')}</option>
            <option value="paid">{t('paid')}</option>
            <option value="partial">{t('partial')}</option>
            <option value="due">{t('due')}</option>
          </select>
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>{t('search')}</button>
        <button className="btn-secondary" onClick={reset}>{t('reset')}</button>
      </div>
      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={t('customers')} value={rows.length} />
        <Stat label={t('totalPayable')} value={money(rows.reduce((s, r) => s + r.totalPayable, 0))} />
        <Stat label={t('paidAmount')} value={money(rows.reduce((s, r) => s + r.paid, 0))} />
        <Stat label={t('currentDue')} value={money(rows.reduce((s, r) => s + Math.max(0, r.currentDue), 0))} tone="text-red-600" />
      </div>
      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="p-2 text-left">SL</th>
              <th className="p-2 text-left">{t('customerCode')}</th>
              <th className="p-2 text-left">{t('name')}</th>
              <th className="p-2 text-left">{t('address')}</th>
              <th className="p-2 text-left">{t('mobile')}</th>
              <th className="p-2 text-right">{t('monthlyBill')}</th>
              <th className="p-2 text-right">{t('previousDue')}</th>
              <th className="p-2 text-right">{t('totalPayable')}</th>
              <th className="p-2 text-right">{t('paidAmount')}</th>
              <th className="p-2 text-right">{t('currentDue')}</th>
              <th className="p-2 text-left">{t('paymentStatus')}</th>
              <th className="p-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="p-2 text-slate-400">{i + 1}</td>
                <td className="p-2 font-mono text-xs">{r.code}</td>
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-xs text-slate-500 max-w-[140px] truncate">{r.address || '-'}</td>
                <td className="p-2">{r.mobile}</td>
                <td className="p-2 text-right">{money(r.month_bill)}</td>
                <td className="p-2 text-right">{money(r.prev_due)}</td>
                <td className="p-2 text-right font-semibold">{money(r.totalPayable)}</td>
                <td className="p-2 text-right text-emerald-600">{money(r.paid)}</td>
                <td className={`p-2 text-right font-semibold ${r.currentDue > 0 ? 'text-red-600' : ''}`}>{money(r.currentDue)}</td>
                <td className="p-2"><span className={`badge ${statusBadge(r.status)}`}>{t(r.status)}</span></td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <IconBtn title={t('view')} onClick={() => openView(r)}><Eye size={14} /></IconBtn>
                    <IconBtn title={t('printOfficeCopy')} onClick={() => openPrint(r, 'office')}><Printer size={14} /></IconBtn>
                    <IconBtn title={t('printCustomerCopy')} onClick={() => openPrint(r, 'customer')}><FileText size={14} /></IconBtn>
                    <IconBtn title={t('printBothCopies')} onClick={() => openPrint(r, 'both')}><Printer size={14} className="text-brand-600" /></IconBtn>
                    <IconBtn title={t('downloadPdf')} onClick={() => savePdf(r, 'both')}><FileDown size={14} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={12} className="p-6 text-center text-slate-400">{t('noData')}</td></tr>}
          </tbody>
        </table>
      </div>
      {view && <ViewModal info={view} onClose={() => setView(null)} onPrint={openPrint} onSavePdf={savePdf} />}
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: any; tone?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
    </div>
  )
}

function IconBtn({ title, onClick, children }: any) {
  return <button title={title} onClick={onClick} className="btn-secondary btn-sm" style={{ padding: '5px 7px' }}>{children}</button>
}

function ViewModal({ info, onClose, onPrint, onSavePdf }: any) {
  const { t } = useI18n()
  const f = info.figures
  return (
    <Modal open onClose={onClose} title={`${info.customer.name} — ${monthLabel(info.month)}`} width="max-w-2xl">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-slate-400">{t('customerCode')}:</span> <b className="font-mono">{info.customer.code}</b></div>
          <div><span className="text-slate-400">{t('mobile')}:</span> {info.customer.mobile}</div>
          <div><span className="text-slate-400">{t('address')}:</span> {info.customer.address || '-'}</div>
          <div><span className="text-slate-400">{t('area')}:</span> {info.customer.area_name || '-'}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KV label={t('monthlyBill')} value={money(f.monthBill)} />
          <KV label={t('previousDue')} value={money(f.prevDue)} />
          <KV label={t('totalPayable')} value={money(f.totalPayable)} />
          <KV label={t('paidAmount')} value={money(f.paid)} />
          <KV label={t('currentDue')} value={money(f.currentDue)} />
          <KV label={t('paymentStatus')} value={t(f.status)} />
          <KV label={t('additionalCharge')} value={money(f.additional)} />
          <KV label={t('discount')} value={money(f.discount)} />
        </div>
        <div>
          <h4 className="font-semibold mb-1">{t('payments')}</h4>
          {info.payments.length ? (
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left p-1.5">{t('receiptNo')}</th><th className="text-left p-1.5">{t('date')}</th>
                <th className="text-right p-1.5">{t('amount')}</th><th className="text-left p-1.5">{t('paymentMethod')}</th>
                <th className="text-left p-1.5">{t('trxId')}</th><th className="text-left p-1.5">{t('collectedBy')}</th>
              </tr></thead>
              <tbody>
                {info.payments.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="p-1.5 font-mono">{p.receipt_no}</td>
                    <td className="p-1.5">{p.payment_date}</td>
                    <td className="p-1.5 text-right">{money(p.amount)}</td>
                    <td className="p-1.5">{p.method}</td>
                    <td className="p-1.5">{p.reference || '-'}</td>
                    <td className="p-1.5">{p.collected_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-slate-400 text-xs">{t('noData')}</p>}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button className="btn-secondary" onClick={() => onPrint({ id: info.customer.id }, 'office')}><Printer size={15} /> {t('printOfficeCopy')}</button>
          <button className="btn-secondary" onClick={() => onPrint({ id: info.customer.id }, 'customer')}><FileText size={15} /> {t('printCustomerCopy')}</button>
          <button className="btn-primary" onClick={() => onPrint({ id: info.customer.id }, 'both')}><Printer size={15} /> {t('printBothCopies')}</button>
          <button className="btn-secondary" onClick={() => onSavePdf({ id: info.customer.id }, 'both')}><FileDown size={15} /> {t('downloadPdf')}</button>
        </div>
      </div>
    </Modal>
  )
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-2"><div className="text-[10px] text-slate-400">{label}</div><div className="font-semibold">{value}</div></div>
  )
}

// ================= A4 print templates (pure HTML string) =================
// Exported so the Collection page prints with the EXACT same templates.

export function buildBillHtml(info: any, copy: Copy): string {
  const c = info.customer
  const f = info.figures
  const co = info.company
  const ml = monthLabel(info.month)
  const genDate = new Date()
  const dateStr = genDate.toISOString().slice(0, 10)
  const timeStr = genDate.toTimeString().slice(0, 8)
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const payRows = info.payments.map((p: any, i: number) =>
    `<tr><td>${i + 1}</td><td>${esc(p.receipt_no)}</td><td>${esc(p.payment_date)}</td><td>${esc(String(p.created_at || '').slice(11, 19))}</td><td class="r">${esc(p.amount)}</td><td>${esc(BN_METHODS[p.method] || p.method)}</td><td>${esc(p.reference || '—')}</td><td>${esc(p.collected_by || '—')}</td></tr>`).join('')

  const office = `
  <div class="print-page office-copy">
    <table class="top"><tr>
      <td class="ltd"><div style="display:flex;gap:8px;align-items:center">${co.logo ? `<img src="${esc(co.logo)}" alt="logo" style="height:38px;width:38px;object-fit:contain" />` : ''}<div><div class="co">${esc(co.name)}</div>${co.email ? `<div class="addr">✉ ${esc(co.email)}</div>` : ''}</div></div><div class="addr">${esc(co.address)}</div><div class="addr">📞 ${esc(co.mobile)}${co.mobile_alt ? ` | 📞 ${esc(co.mobile_alt)}` : ''} | SMS: ${esc(co.sms)}</div></td>
      <td class="rtd"><div class="copytag">OFFICE COPY</div><div class="inv">${esc(ml)}</div></td>
    </tr></table>
    <hr/>
    <table class="info"><tr>
      <td>
        <div class="sect">CUSTOMER INFORMATION</div>
        <table class="kv">
          <tr><td>Customer ID</td><td><b>${esc(c.code)}</b></td></tr>
          <tr><td>Customer Name</td><td><b>${esc(c.name)}</b></td></tr>
          <tr><td>Address</td><td>${esc(c.address || '—')}</td></tr>
          <tr><td>Mobile Number</td><td>${esc(c.mobile)}</td></tr>
          <tr><td>Connection No</td><td>${esc(c.code)}</td></tr>
          <tr><td>Area / Zone</td><td>${esc(c.area_name || '—')}</td></tr>
        </table>
      </td>
      <td>
        <div class="sect">BILL INFORMATION</div>
        <table class="kv">
          <tr><td>Billing Month</td><td><b>${esc(ml)}</b></td></tr>
          <tr><td>Monthly Bill</td><td>${esc(f.monthBill)}</td></tr>
          <tr><td>Previous Due</td><td>${esc(f.prevDue)}</td></tr>
          <tr><td>Additional Charges</td><td>${esc(f.additional)}</td></tr>
          <tr><td>Discount</td><td>${esc(f.discount)}</td></tr>
          <tr><td><b>Total Payable</b></td><td class="big"><b>${esc(f.totalPayable)} ৳</b></td></tr>
        </table>
      </td>
    </tr></table>
    <div class="sect">PAYMENT INFORMATION</div>
    <table class="pay">
      <thead><tr><th>SL</th><th>Receipt No</th><th>Payment Date</th><th>Payment Time</th><th>Paid Amount</th><th>Method</th><th>Transaction ID</th><th>Collected By</th></tr></thead>
      <tbody>${payRows || '<tr><td colspan="8" class="r">No payment this month</td></tr>'}</tbody>
    </table>
    <table class="sum">
      <tr><td>Total Payable</td><td class="r">${esc(f.totalPayable)} ৳</td></tr>
      <tr><td>Total Paid</td><td class="r">${esc(f.paid)} ৳</td></tr>
      <tr><td><b>Remaining Due</b></td><td class="r big"><b>${esc(f.currentDue)} ৳</b></td></tr>
      <tr><td>Payment Status</td><td class="r"><b>${esc(String(f.status).toUpperCase())}</b></td></tr>
    </table>
    <div class="foot">
      <table class="sig"><tr>
        <td class="ltd">Generated: ${esc(dateStr)} ${esc(timeStr)}</td>
        <td class="rtd">..............................<br/>Authorized Signature</td>
      </tr></table>
      <div class="copyline">OFFICE COPY</div>
    </div>
  </div>`

  const customer = `
  <div class="print-page customer-copy">
    <div class="bbox">
      ${co.logo ? `<div class="cc-center"><img src="${esc(co.logo)}" alt="logo" style="height:42px;object-fit:contain" /></div>` : ''}
      <div class="cc-center"><div class="bn-name">${esc(co.name_bn || co.name)}</div>${co.name_bn ? `<div class="en-name">${esc(co.name)}</div>` : ''}</div>
      <hr/>
      <div class="cc-center addr">ঠিকানা: ${esc(co.address || '—')}</div>
      <div class="cc-center addr">ফোন: ${esc(co.mobile)}${co.mobile_alt ? `, ${esc(co.mobile_alt)}` : ''}${co.email ? ` | ইমেইল: ${esc(co.email)}` : ''} &nbsp;|&nbsp; এসএমএস: ${esc(co.sms)}</div>
      <hr/>
      <div class="cc-title">মাসিক বিল রশিদ — ${esc(ml)}</div>
      <table class="bkv">
        <tr><td class="k">গ্রাহকের নাম</td><td>: <b>${esc(c.name)}</b></td></tr>
        <tr><td class="k">ঠিকানা</td><td>: ${esc(c.address || '—')}</td></tr>
        <tr><td class="k">মোবাইল নম্বর</td><td>: ${esc(c.mobile)}</td></tr>
        <tr><td class="k">গ্রাহক / সংযোগ নং</td><td>: ${esc(c.code)}</td></tr>
      </table>
      <hr/>
      <table class="bkv">
        <tr><td class="k">মাসিক বিল</td><td>: ${esc(f.monthBill)} টাকা</td></tr>
        <tr><td class="k">পূর্বের বকেয়া</td><td>: ${esc(f.prevDue)} টাকা</td></tr>
        <tr><td class="k">অতিরিক্ত চার্জ</td><td>: ${esc(f.additional)} টাকা</td></tr>
        <tr><td class="k">ছাড় (ডিসকাউন্ট)</td><td>: ${esc(f.discount)} টাকা</td></tr>
        <tr><td class="k">সর্বমোট</td><td>: <b>${esc(f.totalPayable)} টাকা</b></td></tr>
      </table>
      <hr/>
      <table class="bkv">
        <tr><td class="k">পরিশোধিত</td><td>: <b>${esc(f.paid)} টাকা</b></td></tr>
        <tr><td class="k">বর্তমান বকেয়া</td><td>: <b>${esc(f.currentDue)} টাকা</b></td></tr>
        <tr><td class="k">রশিদ নং</td><td>: ${esc(info.payments.map((p: any) => p.receipt_no).filter(Boolean).join(', ') || '—')}</td></tr>
        <tr><td class="k">পেমেন্ট তারিখ</td><td>: ${esc(info.payments[0]?.payment_date || '—')}</td></tr>
        <tr><td class="k">পেমেন্ট পদ্ধতি</td><td>: ${esc(info.payments.map((p: any) => BN_METHODS[p.method] || p.method).join(', ') || '—')}</td></tr>
      </table>
      <hr/>
      <table class="bkv">
        <tr><td>তারিখ: ${esc(dateStr)}</td><td class="r">সময়: ${esc(timeStr)}</td></tr>
        <tr><td>লাইসেন্স: ${esc(co.license || '—')}</td><td class="r">কাস্টমার কপি</td></tr>
      </table>
      <div class="cc-center foot2">${esc(co.footer || '')}</div>
    </div>
  </div>`

  const pages = copy === 'both' ? office + customer : copy === 'office' ? office : customer

  return `<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>
  @page { size: A4 portrait; margin: 10mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { font-family: 'Nirmala UI','Noto Sans Bengali','SolaimanLipi','Segoe UI',sans-serif; color:#000; background:#fff; margin:0; font-size:12px; }
  .print-page { width:190mm; min-height:277mm; margin:0 auto; background:#fff; color:#000; padding:4mm; }
  .office-copy { page-break-after: always; break-after: page; }
  .customer-copy { page-break-after: auto; break-after: auto; }
  hr { border:none; border-top:1.5px solid #000; margin:6px 0; }
  table { width:100%; border-collapse:collapse; }
  .top .co { font-size:20px; font-weight:800; letter-spacing:.5px; }
  .addr { font-size:11px; color:#111; }
  .copytag { display:inline-block; border:2px solid #000; padding:4px 12px; font-weight:800; letter-spacing:1px; }
  .inv { text-align:right; font-size:13px; font-weight:700; margin-top:4px; }
  .ltd { text-align:left; } .rtd { text-align:right; vertical-align:top; }
  .info > tr > td, .info td[colspan] { vertical-align:top; }
  .sect { font-weight:800; font-size:11px; letter-spacing:.5px; border-bottom:1px solid #000; margin:10px 0 4px; padding-bottom:2px; }
  .kv td { padding:2.5px 4px; font-size:11.5px; } .kv td:first-child { width:38%; color:#333; }
  .kv .big { font-size:14px; }
  .pay th, .pay td { border:1px solid #999; padding:3px 5px; font-size:10.5px; text-align:left; }
  .pay th { background:#f0f0f0; font-size:10px; }
  .r { text-align:right; }
  .sum { margin-top:8px; width:60%; margin-left:auto; }
  .sum td { padding:3px 6px; border-bottom:1px dashed #999; font-size:12px; }
  .sum .big { font-size:14px; }
  .foot { margin-top:22px; }
  .sig td { font-size:11px; }
  .copyline { text-align:center; font-weight:800; letter-spacing:2px; margin-top:10px; border-top:2px solid #000; padding-top:4px; }
  /* customer copy (Bengali receipt) */
  .bbox { border:2.5px solid #000; padding:8mm 7mm; min-height:250mm; }
  .cc-center { text-align:center; }
  .bn-name { font-size:26px; font-weight:800; }
  .en-name { font-size:13px; font-weight:600; }
  .cc-title { text-align:center; font-size:15px; font-weight:800; margin:6px 0; border:1.5px solid #000; padding:5px; }
  .bkv { font-size:13.5px; }
  .bkv td { padding:4.5px 2px; }
  .bkv .k { width:42%; }
  .foot2 { margin-top:8px; font-size:11px; }
  </style></head><body>${pages}</body></html>`
}

import { money } from './format'

export interface Company { name: string; name_bn?: string; address: string; mobile: string; footer?: string; mobile_alt?: string; email?: string; logo?: string }

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;')
}

// company header block shared by invoice & receipt: logo + name + contacts
function companyHeaderHTML(company: Company, color: string, showEmail = true): string {
  return `
      <div style="display:flex;gap:10px;align-items:center">
        ${company.logo ? `<img src="${esc(company.logo)}" alt="logo" style="height:44px;width:44px;object-fit:contain" />` : ''}
        <div>
          <h2 style="margin:0;font-size:22px;color:${color}">${esc(company.name)}</h2>
          ${company.name_bn ? `<div style="font-size:14px;color:#555">${esc(company.name_bn)}</div>` : ''}
        </div>
      </div>
      <div style="font-size:12px;color:#555">${esc(company.address)}</div>
      <div style="font-size:12px;color:#555">📞 ${esc(company.mobile)}${company.mobile_alt ? ` &nbsp;|&nbsp; 📞 ${esc(company.mobile_alt)}` : ''}${showEmail && company.email ? ` &nbsp;|&nbsp; ✉ ${esc(company.email)}` : ''}</div>`
}

export function invoiceHTML(bill: any, customer: any, company: Company): string {
  const rows = [
    ['Monthly Bill (' + esc(bill.month) + ')', money(bill.amount)],
    ...(bill.discount ? [['Discount', '-' + money(bill.discount)]] : []),
    ...(bill.previous_due ? [['Previous Due', money(bill.previous_due)]] : []),
    ...(bill.late_fee ? [['Late Fee', money(bill.late_fee)]] : [])
  ]
  return `
  <div style="max-width:680px;margin:24px auto;font-family:'Segoe UI',sans-serif;color:#111">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:12px">
      <div>
        ${companyHeaderHTML(company, '#4f46e5')}
      </div>
      <div style="text-align:right">
        <div style="background:#4f46e5;color:#fff;padding:4px 14px;border-radius:6px;font-size:13px">INVOICE</div>
        <div style="font-size:12px;margin-top:6px"><b>${esc(bill.invoice_no)}</b></div>
        <div style="font-size:12px;color:#555">${esc(bill.month)}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin:14px 0;font-size:13px">
      <div>
        <div style="color:#666;font-size:11px">CUSTOMER</div>
        <div><b>${esc(customer.name)}</b> (${esc(customer.code)})</div>
        <div style="color:#555">${esc(customer.address || '')}</div>
        <div style="color:#555">${esc(customer.area_name || '')} · ${esc(customer.mobile)}</div>
      </div>
      <div style="text-align:right">
        <div style="color:#666;font-size:11px">STATUS</div>
        <div><b>${esc(String(bill.status).toUpperCase())}</b></div>
        <div style="color:#555">Paid: ${money(bill.paid)} / Total: ${money(bill.total)}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#f1f5f9">
        <th style="text-align:left;padding:8px;border:1px solid #e2e8f0">Description</th>
        <th style="text-align:right;padding:8px;border:1px solid #e2e8f0">Amount (BDT)</th>
      </tr>
      ${rows.map((r) => `<tr><td style="padding:8px;border:1px solid #e2e8f0">${r[0]}</td><td style="text-align:right;padding:8px;border:1px solid #e2e8f0">${r[1]}</td></tr>`).join('')}
      <tr style="background:#eef2ff;font-weight:700">
        <td style="padding:8px;border:1px solid #e2e8f0">NET TOTAL</td>
        <td style="text-align:right;padding:8px;border:1px solid #e2e8f0">৳ ${money(bill.total)}</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0">PAID</td>
        <td style="text-align:right;padding:8px;border:1px solid #e2e8f0">${money(bill.paid)}</td>
      </tr>
      <tr style="font-weight:700;color:#dc2626">
        <td style="padding:8px;border:1px solid #e2e8f0">DUE</td>
        <td style="text-align:right;padding:8px;border:1px solid #e2e8f0">${money(bill.total - bill.paid)}</td>
      </tr>
    </table>
    <div style="margin-top:20px;font-size:12px;color:#555;text-align:center;border-top:1px dashed #ccc;padding-top:10px">
      ${esc(company.footer || 'Thank you for your business')}
    </div>
  </div>`
}

const BN_METHODS: Record<string, string> = { cash: 'নগদ (ক্যাশ)', bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', bank: 'ব্যাংক' }
const BN_TYPES: Record<string, string> = { bill: 'বিল', advance: 'অগ্রিম', connection_fee: 'সংযোগ ফি', refund: 'রিফান্ড' }

export function receiptHTML(payment: any, customer: any, company: Company): string {
  // SINGLE payment receipt (A4, one page, one print window — no office/customer copies)
  return `
  <div style="max-width:680px;margin:24px auto;font-family:'Nirmala UI','Noto Sans Bengali','Segoe UI',sans-serif;color:#111">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #059669;padding-bottom:12px">
      <div>
        ${companyHeaderHTML(company, '#059669', false)}
      </div>
      <div style="text-align:right">
        <div style="background:#059669;color:#fff;padding:4px 14px;border-radius:6px;font-size:13px">PAYMENT RECEIPT</div>
        <div style="font-size:12px;margin-top:6px"><b>${esc(payment.receipt_no)}</b></div>
        <div style="font-size:12px;color:#555">${esc(payment.payment_date)}</div>
      </div>
    </div>
    <table style="width:100%;margin-top:14px;font-size:13px;border-collapse:collapse">
      <tr><td style="padding:6px;color:#666;width:30%">Customer</td><td style="padding:6px"><b>${esc(customer.name)}</b> (${esc(customer.code)})</td></tr>
      <tr><td style="padding:6px;color:#666">Address</td><td style="padding:6px">${esc(customer.address || '-')}</td></tr>
      <tr><td style="padding:6px;color:#666">Method</td><td style="padding:6px">${esc(BN_METHODS[payment.method] || payment.method)}</td></tr>
      <tr><td style="padding:6px;color:#666">Type</td><td style="padding:6px">${esc(BN_TYPES[payment.type] || payment.type)}</td></tr>
      <tr><td style="padding:6px;color:#666">Reference / TrxID</td><td style="padding:6px">${esc(payment.reference || '-')}</td></tr>
      <tr><td style="padding:6px;color:#666">Note</td><td style="padding:6px">${esc(payment.note || '-')}</td></tr>
      <tr style="background:#ecfdf5;font-weight:700;font-size:15px"><td style="padding:8px">AMOUNT RECEIVED</td><td style="padding:8px;text-align:right">৳ ${money(payment.amount)}</td></tr>
    </table>
    <div style="margin-top:20px;font-size:13px;color:#555;text-align:center;border-top:1px dashed #ccc;padding-top:10px">
      ${esc(company.footer || 'পরিষেবার জন্য ধন্যবাদ — আবার আসবেন')}<br/>
      <span style="font-size:11px;color:#999">${esc(payment.receipt_no)} · ${esc(payment.payment_date)}</span>
    </div>
  </div>`
}

export function thermalReceiptHTML(payment: any, customer: any, company: Company): string {
  return `
  <div style="width:64mm;font-family:'Segoe UI',monospace;font-size:11px;color:#000">
    <div style="text-align:center">
      ${company.logo ? `<img src="${esc(company.logo)}" alt="logo" style="height:32px;object-fit:contain" /><br/>` : ''}
      <div style="font-weight:700">${esc(company.name)}</div>
      <div>${esc(company.address)}</div>
      <div>Tel: ${esc(company.mobile)}${company.mobile_alt ? `, ${esc(company.mobile_alt)}` : ''}</div>
    </div>
    <hr>
    <div>Receipt: ${esc(payment.receipt_no)}</div>
    <div>Date: ${esc(payment.payment_date)}</div>
    <div>Customer: ${esc(customer.code)} ${esc(customer.name)}</div>
    <div>Method: ${esc(payment.method)}</div>
    <hr>
    <div style="font-size:14px;font-weight:700">TOTAL: ৳ ${money(payment.amount)}</div>
    <hr>
    <div style="text-align:center">${esc(company.footer || '')}</div>
  </div>`
}

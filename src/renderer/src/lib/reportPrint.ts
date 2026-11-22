// Shared A4 report print builder — uses the EXACT same print CSS/typography
// as the Billing Report (BillReport.tsx) so both reports print identically.
// Only title, data and summary differ per report.
import { monthLabel } from './format'

export interface ReportPrintOptions {
  titleBn: string
  titleEn: string
  rangeLabel: string
  company: any
  columns: { label: string; align?: 'left' | 'right' | 'center' }[]
  rows: (string | number)[][]
  summary: { label: string; value: string }[]
  generatedBy?: string
}

export function reportPrintHtml(o: ReportPrintOptions): string {
  const co = o.company
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 8)
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const head = o.columns.map((c) => `<th${c.align ? ` class="${c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : ''}"` : ''}>${esc(c.label)}</th>`).join('')
  const body = o.rows.length
    ? o.rows.map((r, i) => `<tr>${r.map((cell, j) => `<td${o.columns[j]?.align === 'right' ? ' class="r"' : ''}>${esc(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${o.columns.length}" class="c">No data</td></tr>`
  const summary = o.summary.map((s) => `<tr><td>${esc(s.label)}</td><td class="r big"><b>${esc(s.value)}</b></td></tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.titleEn)}</title><style>
  @page { size: A4 portrait; margin: 10mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { font-family: 'Nirmala UI','Noto Sans Bengali','SolaimanLipi','Segoe UI',sans-serif; color:#000; background:#fff; margin:0; font-size:12px; }
  .print-page { width:190mm; min-height:277mm; margin:0 auto; background:#fff; color:#000; padding:4mm; }
  hr { border:none; border-top:1.5px solid #000; margin:6px 0; }
  table { width:100%; border-collapse:collapse; }
  .top .co { font-size:20px; font-weight:800; letter-spacing:.5px; }
  .addr { font-size:11px; color:#111; }
  .ltd { text-align:left; } .rtd { text-align:right; vertical-align:top; }
  .rep-title { text-align:center; font-size:14px; font-weight:800; border:1.5px solid #000; padding:5px; margin:8px 0; }
  .range { text-align:center; font-size:11px; margin-bottom:6px; }
  .pay th, .pay td { border:1px solid #999; padding:3px 5px; font-size:10.5px; text-align:left; }
  .pay th { background:#f0f0f0; font-size:10px; }
  .r { text-align:right; } .c { text-align:center; }
  .sum { margin-top:8px; width:60%; margin-left:auto; }
  .sum td { padding:3px 6px; border-bottom:1px dashed #999; font-size:12px; }
  .sum .big { font-size:13.5px; }
  .foot { margin-top:22px; }
  .sig td { font-size:11px; }
  .copyline { text-align:center; font-weight:800; letter-spacing:2px; margin-top:10px; border-top:2px solid #000; padding-top:4px; }
  </style></head><body>
  <div class="print-page">
    <table class="top"><tr>
      <td class="ltd">
        <div style="display:flex;gap:8px;align-items:center">
          ${co.logo ? `<img src="${esc(co.logo)}" alt="logo" style="height:40px;width:40px;object-fit:contain" />` : ''}
          <div><div class="co">${esc(co.name)}</div>${co.email ? `<div class="addr">✉ ${esc(co.email)}</div>` : ''}</div>
        </div>
        <div class="addr">${esc(co.address)}</div>
        <div class="addr">📞 ${esc(co.mobile)}${co.mobile_alt ? ` | 📞 ${esc(co.mobile_alt)}` : ''}</div>
      </td>
      <td class="rtd"><div class="addr">${esc(dateStr)} ${esc(timeStr)}</div></td>
    </tr></table>
    <hr/>
    <div class="rep-title">${esc(o.titleBn)}${o.titleEn ? ` (${esc(o.titleEn)})` : ''}</div>
    <div class="range">${esc(o.rangeLabel)}</div>
    <table class="pay">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <table class="sum">${summary}</table>
    <div class="foot">
      <table class="sig"><tr>
        <td class="ltd">Generated: ${esc(dateStr)} ${esc(timeStr)}</td>
        <td class="rtd">..............................<br/>Authorized Signature</td>
      </tr></table>
      <div class="copyline">OFFICE COPY</div>
    </div>
  </div></body></html>`
}

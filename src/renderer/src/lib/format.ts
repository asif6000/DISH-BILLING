export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0'
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function dateFmt(d: string | null | undefined): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return d.toISOString().slice(0, 7)
}

export function monthStartEnd(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  const from = new Date(y, m - 1, 1).toISOString().slice(0, 10)
  const to = new Date(y, m, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function toCSV(rows: Record<string, any>[], headers?: Record<string, string>): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0]).filter((k) => !k.startsWith('_'))
  const head = headers || Object.fromEntries(keys.map((k) => [k, k]))
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [keys.map((k) => esc(head[k])).join(',')]
  for (const r of rows) lines.push(keys.map((k) => esc(r[k])).join(','))
  return '\ufeff' + lines.join('\n')
}

export function downloadCSV(filename: string, rows: Record<string, any>[], headers?: Record<string, string>): void {
  const blob = new Blob([toCSV(rows, headers)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Excel export via SheetJS (bundled, works offline)
export async function exportExcel(filename: string, rows: Record<string, any>[], sheet = 'Report'): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows.map((r) => {
    const o: Record<string, any> = {}
    for (const [k, v] of Object.entries(r)) if (!k.startsWith('_')) o[k] = v
    return o
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  XLSX.writeFile(wb, filename)
}

// PDF export via jsPDF + autotable (bundled, works offline)
export async function exportPDF(title: string, rows: Record<string, any>[], headers?: Record<string, string>): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: rows.length && Object.keys(rows[0]).length > 7 ? 'landscape' : 'portrait' })
  const keys = rows.length ? Object.keys(rows[0]).filter((k) => !k.startsWith('_')) : []
  const head = [keys.map((k) => (headers || {})[k] || k)]
  const body = rows.map((r) => keys.map((k) => (r[k] === null || r[k] === undefined ? '' : String(r[k]))))
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  autoTable(doc, { head, body, startY: 22, styles: { fontSize: 8 } })
  doc.save(title.replace(/[^\w\u0980-\u09FF -]/g, '') + '.pdf')
}

export function pdfExport(title: string, rows: any[], headers?: Record<string, string>): void {
  exportPDF(title, rows, headers).catch((e) => alert(String(e)))
}

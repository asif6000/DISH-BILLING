import React, { useRef, useState } from 'react'
import { Upload, Download } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast, useReflist } from '../components/ui'
import { downloadCSV, exportExcel, pdfExport } from '../lib/format'
import { errMsg } from '../lib/api'

export function ImportExportPage({ mode }: { mode: 'import' | 'export' }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const areas = useReflist('areas')
  const packages = useReflist('packages')

  const doExport = async (kind: 'csv' | 'xlsx') => {
    try {
      const r = await window.api.customers.list({ all: true })
      const data = r.rows.map((x: any) => ({
        code: x.code, name: x.name, father_name: x.father_name, mobile: x.mobile, address: x.address,
        area: x._area, package: x._package, monthly_bill: x.monthly_bill, connection_fee: x.connection_fee,
        connection_date: x.connection_date, status: x.status, total_due: x.total_due
      }))
      if (kind === 'csv') downloadCSV('customers-export.csv', data)
      else await exportExcel('customers-export.xlsx', data, 'Customers')
      toast.push('success', `${data.length} ${lang === 'bn' ? 'গ্রাহক এক্সপোর্ট হয়েছে' : 'customers exported'}`)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim())
    if (!lines.length) return []
    const parseLine = (line: string) => {
      const out: string[] = []
      let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
          else if (ch === '"') inQ = false
          else cur += ch
        } else if (ch === '"') inQ = true
        else if (ch === ',') { out.push(cur); cur = '' }
        else cur += ch
      }
      out.push(cur)
      return out
    }
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
    return lines.slice(1).map((line) => {
      const cells = parseLine(line)
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = cells[i]?.trim() })
      return obj
    })
  }

  const onFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed.length) { toast.push('error', 'No rows found'); return }
    // map area name → id
    for (const r of parsed) {
      if (r.area) {
        const a = areas.find((x) => x.label.toLowerCase() === String(r.area).toLowerCase())
        r.area_id = a ? a.id : null
      }
      if (r.package) {
        const p = packages.find((x) => x.label.toLowerCase() === String(r.package).toLowerCase())
        r.package_id = p ? p.id : null
      }
    }
    setRows(parsed)
    setResult(null)
  }

  const doImport = async () => {
    try {
      const res = await window.api.customers.bulkImport(rows)
      setResult(res)
      toast.push('success', `${res.imported} ${t('imported')}`)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const sampleCSV = () => {
    downloadCSV('customers-sample.csv', [
      { name: 'রহিম উদ্দিন', mobile: '01712345678', address: 'বাড়ি ১২, রোড ৩', area: areas[0]?.label || 'Area1', monthly_bill: 300, connection_fee: 500, connection_date: '2024-01-15' }
    ])
  }

  return (
    <div>
      <PageHeader
        title={mode === 'import' ? t('bulkImport') : t('customers_export')}
        subtitle={t('bulkImportDesc')}
        actions={
          mode === 'export' ? (
            <>
              <button className="btn-secondary" onClick={() => doExport('xlsx')}><Download size={15} /> Excel</button>
              <button className="btn-secondary" onClick={() => doExport('csv')}><Download size={15} /> CSV</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={sampleCSV}><Download size={15} /> {lang === 'bn' ? 'নমুনা CSV' : 'Sample CSV'}</button>
              <button className="btn-primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> {lang === 'bn' ? 'ফাইল নির্বাচন' : 'Choose File'}</button>
            </>
          )
        }
      />
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {mode === 'import' && rows.length > 0 && (
        <div className="card mt-4">
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-sm font-medium">{rows.length} {lang === 'bn' ? 'সারি পার্স হয়েছে' : 'rows parsed'}</span>
            <button className="btn-primary btn-sm" onClick={doImport}><Upload size={13} /> {t('import')}</button>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/50">
                {['name', 'mobile', 'address', 'area', 'monthly_bill'].map((h) => <th key={h} className="table-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="table-td">{r.name}</td><td className="table-td">{r.mobile}</td>
                    <td className="table-td text-xs">{r.address}</td><td className="table-td">{r.area}</td>
                    <td className="table-td">{r.monthly_bill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-sm">
              <b>{t('importResult')}:</b> {t('imported')}: <span className="text-emerald-600 font-semibold">{result.imported}</span>
              {result.errors.length > 0 && (
                <div className="mt-2 text-red-600 text-xs max-h-32 overflow-y-auto">
                  {result.errors.map((er: string, i: number) => <div key={i}>{er}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

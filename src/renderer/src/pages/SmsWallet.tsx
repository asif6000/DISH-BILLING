import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send, ShoppingCart, Wallet, History, Package, RefreshCw, CheckCircle2, AlertTriangle, Users, Copy } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { money } from '../lib/format'
import { errMsg } from '../lib/api'
import { useCan } from '../lib/perms'

type Tab = 'send' | 'bulk' | 'buy' | 'messages' | 'transactions' | 'purchases'

// Display-only estimate. The server recalculates the billable segment count and
// is the only authority that debits the wallet. GSM extension characters cost
// two septets; Unicode (e.g. Bangla) is billed per UCS-2 code unit.
const GSM_BASE = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXT = '^{}\\[~]|€'
const GSM_CHARS = new Set<string>([...GSM_BASE, ...GSM_EXT])
const GSM_EXT_CHARS = new Set<string>([...GSM_EXT])
function estimateSegments(text: string): number {
  const value = String(text || '')
  if (!value) return 0
  const chars = Array.from(value)
  if (chars.every((c) => GSM_CHARS.has(c))) {
    const septets = chars.reduce((n, c) => n + (GSM_EXT_CHARS.has(c) ? 2 : 1), 0)
    return septets <= 160 ? 1 : Math.ceil(septets / 153)
  }
  return value.length <= 70 ? 1 : Math.ceil(value.length / 67)
}

const METHOD_LABEL: Record<string, string> = {
  bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank', cash: 'Cash'
}

// Official SMS package payment number (bKash Send Money).
const SMS_PAYMENT_BKASH = '01331707900'

function newRequestId(): string {
  try { return crypto.randomUUID() } catch { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

export default function SmsWalletPage() {
  const { lang } = useI18n()
  const toast = useToast()
  const bn = lang === 'bn'
  const can = useCan()
  const canSend = can('sms', 'send') || can('messaging', 'send')
  const [tab, setTab] = useState<Tab>('send')
  const [wallet, setWallet] = useState<any>(null)
  const [packages, setPackages] = useState<any[]>([])
  const [messages, setMessages] = useState<any>({ rows: [], total: 0 })
  const [txns, setTxns] = useState<any>({ rows: [], total: 0 })
  const [purchases, setPurchases] = useState<any>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(false)

  // send form
  const [recipient, setRecipient] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [lastSend, setLastSend] = useState<any>(null)
  const [requestId, setRequestId] = useState(() => newRequestId())

  // bulk send form (same message to many recipients, one provider batch)
  const [bulkRecipients, setBulkRecipients] = useState('')
  const [bulkBody, setBulkBody] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkLast, setBulkLast] = useState<any>(null)
  const [bulkRequestId, setBulkRequestId] = useState(() => newRequestId())

  // buy form
  const [packageId, setPackageId] = useState('')
  const [method, setMethod] = useState('bkash')
  const [trxId, setTrxId] = useState('')
  const [note, setNote] = useState('')
  const [buying, setBuying] = useState(false)

  const segments = estimateSegments(body)
  const bulkNumbers = Array.from(new Set(bulkRecipients.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean)))
  const bulkSegments = estimateSegments(bulkBody)
  const bulkTotal = bulkSegments * bulkNumbers.length
  const selectedPackage = packages.find((p) => String(p.id) === packageId)
  const copyPaymentNumber = async () => {
    try {
      await navigator.clipboard.writeText(SMS_PAYMENT_BKASH)
      toast.push('success', bn ? 'বিকাশ নম্বর কপি হয়েছে' : 'bKash number copied')
    } catch {
      toast.push('error', bn ? 'নম্বর কপি করা যায়নি' : 'Could not copy the number')
    }
  }
  const tabLabels: Record<Tab, string> = {
    send: bn ? 'এসএমএস পাঠান' : 'Send SMS',
    bulk: bn ? 'বাল্ক এসএমএস' : 'Bulk SMS',
    buy: bn ? 'এসএমএস কিনুন' : 'Buy SMS',
    messages: bn ? 'হিস্ট্রি' : 'History',
    transactions: bn ? 'লেনদেন' : 'Transactions',
    purchases: bn ? 'কেনাকাটা' : 'Purchases'
  }
  const allTabs: { key: Tab; icon: any }[] = [
    { key: 'send', icon: Send }, { key: 'bulk', icon: Users }, { key: 'buy', icon: ShoppingCart }, { key: 'messages', icon: History },
    { key: 'transactions', icon: Wallet }, { key: 'purchases', icon: Package }
  ]
  const tabs = allTabs.filter((t) => (t.key !== 'send' && t.key !== 'bulk') || canSend)

  useEffect(() => {
    if (!canSend && (tab === 'send' || tab === 'bulk')) setTab('buy')
  }, [canSend, tab])

  const loadWallet = useCallback(() => window.api.sms.wallet().then(setWallet).catch((e) => toast.push('error', errMsg(e))), [toast])
  const loadPackages = useCallback(() => window.api.sms.packages().then((r: any) => {
    setPackages(r || [])
    if (r?.[0] && !packageId) setPackageId(String(r[0].id))
  }).catch(() => {}), [packageId])
  const loadMessages = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.messages({ page, pageSize: 20 })
      .then((r: any) => setMessages(r)).catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [toast])
  const loadTxns = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.transactions({ page, pageSize: 20 })
      .then((r: any) => setTxns(r)).catch((e) => toast.push('error', errMsg(e)))
      .finally(() => setLoading(false))
  }, [toast])
  const loadPurchases = useCallback((page = 1) => {
    window.api.sms.purchases({ page, pageSize: 20 })
      .then((r: any) => setPurchases(r)).catch(() => {})
  }, [])

  useEffect(() => { loadWallet(); loadPackages(); loadPurchases() }, [loadWallet, loadPackages, loadPurchases])
  useEffect(() => {
    if (tab === 'messages') loadMessages(1)
    if (tab === 'transactions') loadTxns(1)
    if (tab === 'purchases') loadPurchases()
  }, [tab, loadMessages, loadTxns, loadPurchases])

  const send = async () => {
    if (!recipient.trim() || !body.trim()) {
      toast.push('error', bn ? 'নম্বর ও বার্তা লিখুন' : 'Recipient and message are required')
      return
    }
    setSending(true)
    setLastSend(null)
    try {
      const r: any = await window.api.sms.send({ recipient, message: body, clientRequestId: requestId })
      setLastSend(r)
      if (r.status === 'sent') toast.push('success', bn ? `${r.smsCount} এসএমএস পাঠানো হয়েছে` : `${r.smsCount} SMS sent`)
      else if (r.status === 'failed') toast.push('error', (bn ? 'পাঠানো যায়নি: ' : 'Send failed: ') + (r.error || '') + (r.refunded ? (bn ? ' — রিফান্ড হয়েছে' : ' — refunded') : ''))
      else if (r.duplicate) toast.push('info', bn ? 'এই রিকোয়েস্ট আগেই প্রসেস হয়েছে (ডুপ্লিকেট, দ্বিতীয়বার কাটা হয়নি)' : 'Duplicate request — already processed, not charged twice')
      if (r.lowBalance) toast.push('info', bn
        ? `কম এসএমএস ব্যালেন্স: ${r.balanceAfter ?? r.wallet?.balance ?? ''} (সতর্কতা: ${r.lowThreshold ?? ''}) — প্যাকেজ কিনুন`
        : `Low SMS balance: ${r.balanceAfter ?? r.wallet?.balance ?? ''} (warning at ${r.lowThreshold ?? ''}) — buy a package`)
      setBody('')
      setRequestId(newRequestId())
      loadWallet()
      if (tab === 'messages') loadMessages(1)
    } catch (e: any) {
      const m = String(e?.message || e)
      toast.push('error', m.includes('SMS_BALANCE_INSUFFICIENT')
        ? (bn ? 'পর্যাপ্ত এসএমএস ব্যালেন্স নেই — প্যাকেজ কিনুন' : 'Insufficient SMS balance — buy a package')
        : m.includes('SMS_PROVIDER_BALANCE_INSUFFICIENT')
          ? (bn ? 'প্রোভাইডারের গেটওয়ে ব্যালেন্স পর্যাপ্ত নয় — সুপার অ্যাডমিনকে জানান' : 'Provider gateway balance is insufficient — contact the Super Admin')
          : m.includes('SMS_GATEWAY') || m.includes('SMS_API') || m.includes('SMS_SENDER') || m.includes('SMS_PROVIDER') || m.includes('SMS_EDGE')
            ? (bn ? 'SMS গেটওয়ে কনফিগার করা নেই — সুপার অ্যাডমিনের সাথে যোগাযোগ করুন' : 'SMS gateway is not configured — contact the Super Admin')
            : errMsg(e))
    } finally { setSending(false) }
  }

  const sendBulk = async () => {
    if (!bulkNumbers.length || !bulkBody.trim()) {
      toast.push('error', bn ? 'নম্বর ও বার্তা লিখুন' : 'Recipients and message are required')
      return
    }
    if (bulkNumbers.length > 100) {
      toast.push('error', bn ? 'একবারে সর্বোচ্চ ১০০ জনকে পাঠানো যাবে' : 'Maximum 100 recipients per batch')
      return
    }
    setBulkBusy(true); setBulkLast(null)
    try {
      const r: any = await window.api.sms.sendBulk({
        messages: bulkNumbers.map((n) => ({ recipient: n, message: bulkBody })),
        clientRequestId: bulkRequestId
      })
      setBulkLast(r)
      if (r.duplicate) toast.push('info', bn ? 'এই ব্যাচ আগেই প্রসেস হয়েছে (দ্বিতীয়বার কাটা হয়নি)' : 'Duplicate batch — already processed, not charged twice')
      else if (r.status === 'sent') toast.push('success', bn ? `${r.count} জনকে ${r.totalSms} SMS সাবমিট হয়েছে` : `${r.totalSms} SMS submitted to ${r.count} recipients`)
      else if (r.status === 'failed') toast.push('error', (bn ? 'ব্যাচ ব্যর্থ: ' : 'Batch failed: ') + (r.error || '') + (r.refunded ? (bn ? ' — রিফান্ড হয়েছে' : ' — refunded') : ''))
      if (r.lowBalance) toast.push('info', bn ? 'এসএমএস ব্যালেন্স কম — প্যাকেজ কিনুন' : 'Low SMS balance — buy a package')
      setBulkRequestId(newRequestId())
      loadWallet()
      if (tab === 'messages') loadMessages(1)
    } catch (e: any) {
      const m = String(e?.message || e)
      toast.push('error', m.includes('SMS_BALANCE_INSUFFICIENT')
        ? (bn ? 'পর্যাপ্ত এসএমএস ব্যালেন্স নেই — প্যাকেজ কিনুন' : 'Insufficient SMS balance — buy a package')
        : m.includes('SMS_PROVIDER_BALANCE_INSUFFICIENT')
          ? (bn ? 'প্রোভাইডারের গেটওয়ে ব্যালেন্স পর্যাপ্ত নয়' : 'Provider gateway balance is insufficient')
          : m.includes('BULK_SMS_NOT_SUPPORTED')
            ? (bn ? 'এই গেটওয়েতে বাল্ক পাঠানো সমর্থিত নয়' : 'Bulk send is not supported by this gateway')
            : errMsg(e))
    } finally { setBulkBusy(false) }
  }

  const buy = async () => {
    if (!packageId || !trxId.trim()) {
      toast.push('error', bn ? 'প্যাকেজ ও ট্রানজেকশন আইডি দিন' : 'Package and transaction ID are required')
      return
    }
    setBuying(true)
    try {
      const r: any = await window.api.sms.createPurchase({ packageId: Number(packageId), method, trxId: trxId.trim(), note })
      if (r.duplicate) toast.push('info', bn ? 'এই ট্রানজেকশন আইডি আগেই জমা হয়েছে' : 'This transaction ID was already submitted')
      else toast.push('success', bn ? 'প্যাকেজ রিকোয়েস্ট জমা হয়েছে — সুপার অ্যাডমিন যাচাই করে ব্যালেন্স যোগ করবেন' : 'Package request submitted — the Super Admin will verify and credit it')
      setTrxId(''); setNote('')
      loadPurchases(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setBuying(false) }
  }

  const msgColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'recipient', label: bn ? 'প্রাপক' : 'Recipient' },
    { key: 'message', label: bn ? 'বার্তা' : 'Message', render: (r: any) => <span className="text-xs">{String(r.message || '').slice(0, 55)}</span> },
    { key: 'smsCount', label: bn ? 'এসএমএস' : 'SMS', align: 'right' as const },
    { key: 'status', label: bn ? 'স্ট্যাটাস' : 'Status', render: (r: any) => <StatusBadge value={r.status} label={r.status === 'sent' ? (bn ? 'সাবমিট' : 'submitted') : r.status} /> },
    { key: 'refunded', label: bn ? 'রিফান্ড' : 'Refund', render: (r: any) => r.refunded ? <span className="text-emerald-600 text-xs">✓</span> : '-' },
    { key: 'error', label: 'Error', render: (r: any) => r.error ? <span className="text-[10px] text-red-500">{String(r.error).slice(0, 50)}</span> : '-' }
  ]
  const txColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'type', label: bn ? 'ধরন' : 'Type', render: (r: any) => <StatusBadge value={r.type === 'purchase' ? 'paid' : r.type === 'refund' ? 'approved' : r.type === 'usage' ? 'queued' : 'pending'} label={r.type} /> },
    { key: 'smsCount', label: bn ? 'এসএমএস' : 'SMS', align: 'right' as const, render: (r: any) => <span className={r.smsCount > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>{r.smsCount > 0 ? `+${r.smsCount}` : r.smsCount}</span> },
    { key: 'balanceAfter', label: bn ? 'ব্যালেন্স' : 'Balance', align: 'right' as const },
    { key: 'amount', label: bn ? 'টাকা' : 'Amount', align: 'right' as const, render: (r: any) => r.amount ? money(r.amount) : '-' },
    { key: 'note', label: bn ? 'নোট' : 'Note', render: (r: any) => r.note || '-' }
  ]
  const purchaseColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'packageName', label: bn ? 'প্যাকেজ' : 'Package' },
    { key: 'smsCount', label: 'SMS', align: 'right' as const },
    { key: 'amount', label: bn ? 'টাকা' : 'Amount', align: 'right' as const, render: (r: any) => money(r.amount) },
    { key: 'method', label: 'Method', render: (r: any) => METHOD_LABEL[r.method] || r.method },
    { key: 'trxId', label: 'Trx ID', className: 'font-mono text-xs' },
    { key: 'status', label: bn ? 'স্ট্যাটাস' : 'Status', render: (r: any) => <StatusBadge value={r.status === 'verified' ? 'approved' : r.status === 'rejected' ? 'failed' : 'pending'} label={r.status} /> }
  ]

  return (
    <div>
      <PageHeader
        title={bn ? 'আমার এসএমএস ওয়ালেট' : 'My SMS Wallet'}
        subtitle={bn ? 'আপনার নিজের এসএমএস ব্যালেন্স — কোম্পানির টাকা/মেইন ব্যালেন্স থেকে সম্পূর্ণ আলাদা' : 'Your own SMS balance — completely separate from the company money ledger'}
        actions={<button className="btn-secondary" onClick={() => { loadWallet(); loadPackages(); loadPurchases() }}><RefreshCw size={15} /> {bn ? 'রিফ্রেশ' : 'Refresh'}</button>}
      />

      {wallet?.lowBalance && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={18} />
          <span className="flex-1">{bn
            ? `আপনার এসএমএস ব্যালেন্স কম: ${wallet.balance} SMS (সতর্কতা সীমা ${wallet.lowThreshold})। নতুন প্যাকেজ কিনুন।`
            : `Your SMS balance is low: ${wallet.balance} SMS (warning threshold ${wallet.lowThreshold}). Buy a new package.`}</span>
          <button className="btn-secondary btn-sm" onClick={() => setTab('buy')}>{bn ? 'কিনুন' : 'Buy'}</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"><MessageSquare size={20} /></div>
          <div><div className="text-[11px] text-slate-500">{bn ? 'বর্তমান ব্যালেন্স' : 'Current balance'}</div><div className="text-2xl font-bold">{wallet?.balance ?? '—'} <span className="text-xs font-normal text-slate-400">SMS</span></div></div>
        </div>
        <div className="card p-4"><div className="text-[11px] text-slate-500">{bn ? 'মোট কেনা' : 'Total purchased'}</div><div className="text-xl font-bold">{wallet?.totalPurchased ?? 0}</div></div>
        <div className="card p-4"><div className="text-[11px] text-slate-500">{bn ? 'মোট ব্যবহার' : 'Total used'}</div><div className="text-xl font-bold">{wallet?.totalUsed ?? 0}</div></div>
        <div className="card p-4"><div className="text-[11px] text-slate-500">{bn ? 'মোট রিফান্ড' : 'Total refunded'}</div><div className="text-xl font-bold">{wallet?.totalRefunded ?? 0}</div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-3"><div className="text-[11px] text-slate-500">{bn ? 'সাবমিট হয়েছে' : 'Submitted'}</div><div className="text-lg font-bold text-sky-600">{wallet?.statusCounts?.submitted ?? 0}</div></div>
        <div className="card p-3"><div className="text-[11px] text-slate-500">{bn ? 'ডেলিভার হয়েছে' : 'Delivered'}</div><div className="text-lg font-bold text-emerald-600">{wallet?.statusCounts?.delivered ?? 0}</div></div>
        <div className="card p-3"><div className="text-[11px] text-slate-500">{bn ? 'ব্যর্থ হয়েছে' : 'Failed'}</div><div className="text-lg font-bold text-red-500">{wallet?.statusCounts?.failed ?? 0}</div></div>
        <div className="card p-3"><div className="text-[11px] text-slate-500">{bn ? 'অপেক্ষমাণ' : 'Pending'}</div><div className="text-lg font-bold text-amber-600">{wallet?.statusCounts?.pending ?? 0}</div></div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(({ key, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${tab === key ? 'bg-brand-600 text-white' : 'card hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Icon size={13} /> {tabLabels[key]}
          </button>
        ))}
      </div>

      {tab === 'send' && canSend && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">{bn ? 'প্রাপকের নম্বর' : 'Recipient number'}</label>
              <input className="input" placeholder="01XXXXXXXXX" maxLength={20} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </div>
            <div>
              <label className="label">{bn ? 'এসএমএস বার্তা' : 'SMS message'}</label>
              <textarea className="input min-h-[130px]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                <span>{Array.from(body).length} {bn ? 'অক্ষর' : 'chars'}</span>
                <span className="font-semibold text-amber-600">{segments} SMS</span>
                <span>{bn ? 'খরচ' : 'cost'}: <b>{segments}</b> SMS</span>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={send} disabled={sending}><Send size={15} /> {sending ? (bn ? 'পাঠানো হচ্ছে…' : 'Sending…') : (bn ? 'এসএমএস পাঠান' : 'Send SMS')}</button>
          </div>
          <div className="card p-4 text-sm space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> {bn ? 'কীভাবে কাজ করে' : 'How it works'}</h3>
            <p className="text-slate-600 dark:text-slate-400">{bn
              ? 'প্রতিটি পাঠানোর আগে সার্ভারে আপনার ব্যালেন্স চেক হবে। বার্তা কত অংশ (segment) হবে সেই অনুযায়ী SMS কাটা হবে। ব্যালেন্স কম হলে পাঠানো হবে না।'
              : 'The server checks your balance before every send and deducts the exact billable segments. If the balance is too low, nothing is sent.'}</p>
            <p className="text-slate-600 dark:text-slate-400">{bn
              ? 'গেটওয়ে ব্যর্থ হলে ব্যবস্থাপনার Refund Policy অনুযায়ী স্বয়ংক্রিয়ভাবে SMS ফেরত যাবে। ডুপ্লিকেট রিকোয়েস্ট দ্বিতীয়বার কাটবে না।'
              : 'A gateway failure is refunded automatically according to the configured policy. Duplicate requests are never charged twice.'}</p>
            {lastSend && (
              <div className={`rounded-lg p-3 text-xs ${lastSend.status === 'sent' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : lastSend.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-900/20' : 'bg-amber-50 text-amber-700'}`}>
                {lastSend.duplicate ? (bn ? 'ডুপ্লিকেট — আগেই প্রসেস হয়েছে' : 'Duplicate — already processed') : null}
                {lastSend.status && <div>Status: <b>{lastSend.status}</b> · {lastSend.smsCount} SMS {lastSend.refunded ? `· ${bn ? 'রিফান্ড হয়েছে' : 'refunded'}` : ''}</div>}
                {lastSend.requestId && <div className="mt-1 font-mono text-[10px] opacity-80">Request: {lastSend.requestId}</div>}
                {lastSend.error && <div className="mt-1 break-words">{lastSend.error}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'bulk' && canSend && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">{bn ? 'প্রাপকের নম্বরসমূহ (প্রতি লাইনে একটি)' : 'Recipient numbers (one per line)'}</label>
              <textarea className="input min-h-[110px] font-mono text-xs" value={bulkRecipients} onChange={(e) => setBulkRecipients(e.target.value)} placeholder={'01712345678\n01812345678'} />
              <div className="text-[11px] text-slate-500 mt-1">{bulkNumbers.length} {bn ? 'জন প্রাপক' : 'recipients'} · {bn ? 'সর্বোচ্চ ১০০' : 'max 100'}</div>
            </div>
            <div>
              <label className="label">{bn ? 'একই বার্তা সবার জন্য' : 'Same message for every recipient'}</label>
              <textarea className="input min-h-[120px]" value={bulkBody} onChange={(e) => setBulkBody(e.target.value)} maxLength={2000} />
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                <span>{bulkSegments} SMS / {bn ? 'জন' : 'recipient'}</span>
                <span className="font-semibold text-amber-600">{bn ? 'মোট খরচ' : 'Total cost'}: {bulkTotal} SMS</span>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={sendBulk} disabled={bulkBusy}><Users size={15} /> {bulkBusy ? (bn ? 'পাঠানো হচ্ছে…' : 'Sending…') : (bn ? 'বাল্ক এসএমএস পাঠান' : 'Send bulk SMS')}</button>
          </div>
          <div className="card p-4 text-sm space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> {bn ? 'বাল্ক পাঠানোর নিয়ম' : 'Bulk send rules'}</h3>
            <p className="text-slate-600 dark:text-slate-400">{bn
              ? 'পুরো ব্যাচের মোট SMS অংশ একবারে আপনার ওয়ালেট থেকে কাটা হয়। প্রোভাইডার ব্যাচ গ্রহণ করলে ২০২ হিসেবে সাবমিট হয়; ব্যর্থ হলে Refund Policy অনুযায়ী ফেরত যায়।'
              : 'The whole batch is debited once from your wallet. A provider 202 is stored as submitted; a rejected batch is refunded under the refund policy.'}</p>
            <p className="text-slate-600 dark:text-slate-400">{bn
              ? 'একই অনুরোধ দ্বিতীয়বার পাঠালে ডুপ্লিকেট হিসেবে ফিরে আসবে — আবার কাটা হবে না।'
              : 'Sending the same request again returns the duplicate result — it is never charged twice.'}</p>
            {bulkLast && (
              <div className={`rounded-lg p-3 text-xs ${bulkLast.status === 'sent' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : bulkLast.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-900/20' : 'bg-amber-50 text-amber-700'}`}>
                {bulkLast.duplicate && <div>{bn ? 'ডুপ্লিকেট — আগেই প্রসেস হয়েছে' : 'Duplicate — already processed'}</div>}
                {bulkLast.status && <div>Status: <b>{bulkLast.status === 'sent' ? 'submitted' : bulkLast.status}</b> · {bulkLast.count} {bn ? 'জন' : 'recipients'} · {bulkLast.totalSms} SMS {bulkLast.refunded ? `· ${bn ? 'রিফান্ড হয়েছে' : 'refunded'}` : ''}</div>}
                {bulkLast.batchId && <div className="mt-1 font-mono text-[10px] opacity-80">Batch: {bulkLast.batchId}</div>}
                {bulkLast.error && <div className="mt-1 break-words">{bulkLast.error}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'buy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><ShoppingCart size={16} className="text-brand-600" /> {bn ? 'এসএমএস প্যাকেজ কিনুন' : 'Buy an SMS package'}</h3>
            {method === 'bkash' && (
              <div className="rounded-xl border border-pink-200 bg-pink-50 dark:border-pink-900/50 dark:bg-pink-950/20 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-pink-700 dark:text-pink-300">bKash — Send Money</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xl font-bold text-pink-700 dark:text-pink-300">{SMS_PAYMENT_BKASH}</span>
                  <button type="button" className="btn-secondary btn-sm" onClick={copyPaymentNumber}><Copy size={13} /> {bn ? 'কপি' : 'Copy'}</button>
                </div>
                <p className="text-xs text-pink-700/90 dark:text-pink-200/90 mt-1.5">
                  {bn
                    ? 'প্যাকেজের টাকা এই নম্বরে bKash Send Money করুন, তারপর নিচে TrxID দিন।'
                    : 'Send the package amount to this number using bKash Send Money, then enter the TrxID below.'}
                </p>
                {selectedPackage && (
                  <p className="text-xs font-semibold text-pink-700 dark:text-pink-300 mt-1">
                    {bn ? 'পাঠাতে হবে' : 'Send'}: ৳ {money(selectedPackage.price)} · {selectedPackage.sms_count} SMS
                  </p>
                )}
              </div>
            )}
            {!packages.length && <p className="text-sm text-amber-600">{bn ? 'এখনো কোনো প্যাকেজ কনফিগার করা হয়নি — সুপার অ্যাডমিনকে বলুন।' : 'No packages are configured yet — ask the Super Admin.'}</p>}
            <div>
              <label className="label">{bn ? 'প্যাকেজ' : 'Package'}</label>
              <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.sms_count} SMS — {money(p.price)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{bn ? 'পেমেন্ট মাধ্যম' : 'Payment method'}</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}</label>
                <input className="input" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="TrxID" />
              </div>
            </div>
            <div><label className="label">{bn ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'}</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <button className="btn-primary w-full" onClick={buy} disabled={buying || !packages.length}><ShoppingCart size={15} /> {buying ? '…' : (bn ? 'রিকোয়েস্ট পাঠান' : 'Submit request')}</button>
            <p className="text-[11px] text-slate-500">{bn
              ? 'পেমেন্ট আগে bKash/Nagad/ব্যাংকে করুন, তারপর সঠিক TrxID দিন। সুপার অ্যাডমিন যাচাই করার পরেই SMS ব্যালেন্স যোগ হবে — কোনো অটো ফেক ক্রেডিট নেই।'
              : 'Pay via bKash/Nagad/Bank first and enter the real TrxID. The Super Admin verifies it before any SMS is credited — there is no fake auto-credit.'}</p>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-2">{bn ? 'আমার রিকোয়েস্ট' : 'My requests'}</h3>
            <DataTable columns={purchaseColumns as any} rows={purchases.rows} total={purchases.total} page={purchases.page} pageSize={purchases.pageSize}
              onPage={(p) => loadPurchases(p)} emptyText={bn ? 'কোনো রিকোয়েস্ট নেই' : 'No requests yet'} />
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <DataTable columns={msgColumns as any} rows={messages.rows} total={messages.total} page={messages.page} pageSize={messages.pageSize}
          onPage={(p) => loadMessages(p)} loading={loading} exportName="sms-history"
          emptyText={bn ? 'কোনো এসএমএস নেই' : 'No SMS yet'} />
      )}
      {tab === 'transactions' && (
        <DataTable columns={txColumns as any} rows={txns.rows} total={txns.total} page={txns.page} pageSize={txns.pageSize}
          onPage={(p) => loadTxns(p)} loading={loading} exportName="sms-transactions"
          emptyText={bn ? 'কোনো লেনদেন নেই' : 'No transactions yet'} />
      )}
      {tab === 'purchases' && (
        <DataTable columns={purchaseColumns as any} rows={purchases.rows} total={purchases.total} page={purchases.page} pageSize={purchases.pageSize}
          onPage={(p) => loadPurchases(p)} exportName="sms-purchases"
          emptyText={bn ? 'কোনো কেনাকাটা নেই' : 'No purchases yet'} />
      )}
    </div>
  )
}

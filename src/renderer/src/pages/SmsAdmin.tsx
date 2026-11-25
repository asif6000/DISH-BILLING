import React, { useCallback, useEffect, useState } from 'react'
import { Wallet, ShoppingCart, Package, Settings, MessageSquare, ArrowLeftRight, RefreshCw, Save, Send, ShieldAlert, Banknote } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, Modal, useToast, StatusBadge } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { money } from '../lib/format'
import { errMsg } from '../lib/api'
import { useIsSuper } from '../lib/perms'

type Tab = 'wallets' | 'purchases' | 'packages' | 'provider' | 'gateway' | 'transactions' | 'messages'

const METHOD_LABEL: Record<string, string> = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank', cash: 'Cash' }
const TX_TYPE_LABEL: Record<string, string> = { purchase: 'Purchase', usage: 'Usage', refund: 'Refund', adjustment: 'Adjustment' }

function newRequestId(): string {
  try { return crypto.randomUUID() } catch { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

export default function SmsAdminPage() {
  const { lang } = useI18n()
  const toast = useToast()
  const bn = lang === 'bn'
  const isSuper = useIsSuper()
  const [tab, setTab] = useState<Tab>('wallets')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [wallets, setWallets] = useState<any>({ rows: [], total: 0 })
  const [purchases, setPurchases] = useState<any>({ rows: [], total: 0 })
  const [providerRows, setProviderRows] = useState<any>({ rows: [], total: 0 })
  const [providerForm, setProviderForm] = useState<any>({ provider: 'bulksmsbd', smsCount: '', amount: '', method: 'bank', trxId: '', note: '' })
  const [providerBusy, setProviderBusy] = useState(false)
  const [packageRows, setPackageRows] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any>({ rows: [], total: 0 })
  const [messages, setMessages] = useState<any>({ rows: [], total: 0 })
  const [purchaseStatus, setPurchaseStatus] = useState('pending')
  const [messageStatus, setMessageStatus] = useState('')

  const [adjust, setAdjust] = useState<any>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)

  const [pkgModal, setPkgModal] = useState<any>(null)
  const [pkgBusy, setPkgBusy] = useState(false)

  const [confirmPurchase, setConfirmPurchase] = useState<any>(null)
  const [purchaseBusy, setPurchaseBusy] = useState(false)

  const [cfg, setCfg] = useState<any>(null)
  const [cfgBusy, setCfgBusy] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [gatewayBal, setGatewayBal] = useState<any>(null)
  const [gwBalBusy, setGwBalBusy] = useState(false)
  const [deliveryBusy, setDeliveryBusy] = useState(false)

  const loadWallets = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.admin.wallets({ page, pageSize: 20, search })
      .then(setWallets).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [search, toast])
  const loadPurchases = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.admin.purchases({ page, pageSize: 20, status: purchaseStatus === 'all' ? '' : purchaseStatus, search })
      .then(setPurchases).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [purchaseStatus, search, toast])
  const loadProviderPurchases = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.admin.providerPurchases({ page, pageSize: 20, search })
      .then(setProviderRows).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [search, toast])
  const loadTransactions = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.admin.transactions({ page, pageSize: 20, search })
      .then(setTransactions).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [search, toast])
  const loadMessages = useCallback((page = 1) => {
    setLoading(true)
    window.api.sms.admin.messages({ page, pageSize: 20, status: messageStatus, search })
      .then(setMessages).catch((e) => toast.push('error', errMsg(e))).finally(() => setLoading(false))
  }, [messageStatus, search, toast])
  const loadPackages = useCallback(() => {
    window.api.sms.admin.packages().then(setPackageRows).catch((e) => toast.push('error', errMsg(e)))
  }, [toast])
  const loadConfig = useCallback(() => {
    window.api.sms.admin.config().then(setCfg).catch((e) => toast.push('error', errMsg(e)))
  }, [toast])

  useEffect(() => {
    if (!isSuper) return
    if (tab === 'wallets') loadWallets(1)
    if (tab === 'purchases') loadPurchases(1)
    if (tab === 'transactions') loadTransactions(1)
    if (tab === 'messages') loadMessages(1)
    if (tab === 'packages') loadPackages()
    if (tab === 'provider') loadProviderPurchases(1)
    if (tab === 'gateway') loadConfig()
  }, [tab, isSuper, loadWallets, loadPurchases, loadTransactions, loadMessages, loadPackages, loadProviderPurchases, loadConfig])

  if (!isSuper) {
    return (
      <div>
        <PageHeader title={bn ? 'এসএমএস অ্যাডমিন' : 'SMS Admin'} />
        <div className="card p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <ShieldAlert size={16} /> {bn ? 'শুধুমাত্র SUPER_ADMIN এই পেজ ব্যবহার করতে পারেন।' : 'Only the SUPER_ADMIN can use this page.'}
        </div>
      </div>
    )
  }

  const verifyPurchase = async (action: 'approve' | 'reject') => {
    if (!confirmPurchase) return
    setPurchaseBusy(true)
    try {
      const r: any = await window.api.sms.admin.verifyPurchase(confirmPurchase.id, action)
      toast.push('success', action === 'approve'
        ? (r.already ? (bn ? 'আগেই যাচাই হয়েছে — দ্বিতীয়বার ক্রেডিট হয়নি' : 'Already verified — no double credit') : (bn ? `${r.credited} SMS ক্রেডিট হয়েছে` : `${r.credited} SMS credited`))
        : (bn ? 'রিকোয়েস্ট বাতিল হয়েছে' : 'Purchase rejected'))
      setConfirmPurchase(null)
      loadPurchases(1); loadWallets(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setPurchaseBusy(false) }
  }

  const saveAdjust = async () => {
    if (!adjust) return
    const delta = Number(adjustDelta)
    if (!Number.isInteger(delta) || delta === 0) {
      toast.push('error', bn ? 'পূর্ণ সংখ্যা দিন (যেমন +100 বা -50)' : 'Enter a non-zero whole number (e.g. +100 or -50)')
      return
    }
    setAdjustBusy(true)
    try {
      await window.api.sms.admin.adjust(adjust.userId, delta, adjustNote, newRequestId())
      toast.push('success', bn ? 'ব্যালেন্স সমন্বয় হয়েছে' : 'SMS balance adjusted')
      setAdjust(null); setAdjustDelta(''); setAdjustNote('')
      loadWallets(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setAdjustBusy(false) }
  }

  const saveProviderPurchase = async () => {
    if (!providerForm.trxId.trim() || !providerForm.smsCount) {
      toast.push('error', bn ? 'SMS সংখ্যা ও ট্রানজেকশন আইডি দিন' : 'SMS count and transaction ID are required')
      return
    }
    setProviderBusy(true)
    try {
      const r: any = await window.api.sms.admin.providerPurchase({
        provider: providerForm.provider,
        smsCount: Number(providerForm.smsCount),
        amount: Number(providerForm.amount || 0),
        method: providerForm.method,
        trxId: providerForm.trxId.trim(),
        note: providerForm.note
      })
      toast.push('success', r.duplicate
        ? (bn ? 'এই ক্রয় আগেই রেকর্ড হয়েছে' : 'This provider purchase was already recorded')
        : (bn ? 'প্রোভাইডার ক্রয় রেকর্ড হয়েছে — এখন ইউজার ওয়ালেটে অ্যালোকেট করুন' : 'Provider purchase recorded — now allocate it to user wallets'))
      setProviderForm({ ...providerForm, smsCount: '', amount: '', trxId: '', note: '' })
      loadProviderPurchases(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setProviderBusy(false) }
  }

  const savePkg = async () => {
    if (!pkgModal) return
    setPkgBusy(true)
    try {
      await window.api.sms.admin.packageSave({
        id: pkgModal.id,
        name: pkgModal.name,
        smsCount: Number(pkgModal.smsCount),
        price: Number(pkgModal.price),
        status: pkgModal.status,
        description: pkgModal.description
      })
      toast.push('success', bn ? 'প্যাকেজ সংরক্ষিত হয়েছে' : 'Package saved')
      setPkgModal(null); loadPackages()
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setPkgBusy(false) }
  }

  const deactivatePkg = async (p: any) => {
    if (!confirm(bn ? `${p.name} নিষ্ক্রিয় করবেন?` : `Deactivate ${p.name}?`)) return
    try {
      await window.api.sms.admin.packageDelete(p.id)
      toast.push('success', bn ? 'প্যাকেজ নিষ্ক্রিয় হয়েছে' : 'Package deactivated')
      loadPackages()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const saveConfig = async () => {
    if (!cfg) return
    setCfgBusy(true)
    try {
      const r = await window.api.sms.admin.configSet({
        provider: cfg.provider,
        gatewayUrl: cfg.gatewayUrl,
        balanceUrl: cfg.balanceUrl,
        dlrUrl: cfg.dlrUrl,
        senderId: cfg.senderId,
        enabled: cfg.enabled,
        refundOnFailed: cfg.refundOnFailed,
        lowBalanceThreshold: Number(cfg.lowBalanceThreshold)
      })
      setCfg(r)
      toast.push('success', bn ? 'গেটওয়ে কনফিগারেশন সংরক্ষিত হয়েছে' : 'Gateway configuration saved')
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setCfgBusy(false) }
  }

  const testGateway = async () => {
    if (!testRecipient.trim()) return
    setTestBusy(true); setTestResult(null)
    try {
      const r = await window.api.sms.admin.testGateway(testRecipient.trim())
      setTestResult(r)
      toast.push('success', bn ? 'টেস্ট SMS গেটওয়েতে গৃহীত হয়েছে' : 'Test SMS accepted by the gateway')
    } catch (e) {
      const m = errMsg(e)
      setTestResult({ error: m })
      toast.push('error', m)
    } finally { setTestBusy(false) }
  }

  const loadGatewayBalance = async () => {
    setGwBalBusy(true)
    try {
      const r = await window.api.sms.admin.gatewayBalance()
      setGatewayBal(r)
      toast.push('success', bn ? `গেটওয়ে ব্যালেন্স: ${r.balance}` : `Gateway balance: ${r.balance}`)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setGwBalBusy(false) }
  }

  const checkDelivery = async (m: any) => {
    setDeliveryBusy(true)
    try {
      const r: any = await window.api.sms.admin.checkDelivery(m.id)
      toast.push('success', bn ? `ডেলিভারি স্ট্যাটাস: ${r.status}` : `Delivery status: ${r.status}`)
      loadMessages(m.page || 1); loadWallets(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setDeliveryBusy(false) }
  }

  const syncDelivery = async () => {
    setDeliveryBusy(true)
    try {
      const r: any = await window.api.sms.admin.syncDelivery({ limit: 25 })
      toast.push('success', bn
        ? `DLR সিঙ্ক: ${r.checked} চেক, ${r.delivered} delivered, ${r.failed} failed, ${r.errors} error`
        : `DLR sync: ${r.checked} checked, ${r.delivered} delivered, ${r.failed} failed, ${r.errors} errors`)
      loadMessages(1); loadWallets(1)
    } catch (e) { toast.push('error', errMsg(e)) }
    finally { setDeliveryBusy(false) }
  }

  const updateStatus = async (m: any, status: string) => {
    if (status === 'failed' && !confirm(bn ? 'Failed করলে Refund Policy অনুযায়ী SMS ফেরত যেতে পারে। নিশ্চিত?' : 'Marking failed may refund SMS according to policy. Continue?')) return
    try {
      await window.api.sms.admin.updateStatus(m.id, status)
      toast.push('success', bn ? 'স্ট্যাটাস আপডেট হয়েছে' : 'Status updated')
      loadMessages(m.page || 1); loadWallets(1)
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  const walletColumns = [
    { key: 'username', label: bn ? 'ইউজার' : 'User', className: 'font-mono text-xs' },
    { key: 'fullName', label: bn ? 'নাম' : 'Name', render: (r: any) => r.fullName || '-' },
    { key: 'roleName', label: bn ? 'রোল' : 'Role', render: (r: any) => r.roleName || '-' },
    { key: 'status', label: bn ? 'অ্যাকাউন্ট' : 'Account', render: (r: any) => <StatusBadge value={r.status} label={r.status} /> },
    { key: 'balance', label: 'SMS', align: 'right' as const, render: (r: any) => <b className={r.lowBalance ? 'text-amber-600' : ''}>{r.balance}{r.lowBalance ? ' ⚠' : ''}</b> },
    { key: 'totalPurchased', label: bn ? 'কেনা' : 'Purchased', align: 'right' as const },
    { key: 'totalUsed', label: bn ? 'ব্যবহৃত' : 'Used', align: 'right' as const },
    { key: 'totalRefunded', label: bn ? 'রিফান্ড' : 'Refunded', align: 'right' as const },
    { key: 'smsStatus', label: 'Submitted / Delivered / Failed', align: 'right' as const, render: (r: any) => (
      <span className="font-mono text-[11px]">
        {r.statusCounts?.submitted ?? 0} / {r.statusCounts?.delivered ?? 0} / <span className="text-red-500">{r.statusCounts?.failed ?? 0}</span>
      </span>
    ) }
  ]
  const purchaseColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'username', label: bn ? 'ইউজার' : 'User', className: 'font-mono text-xs' },
    { key: 'packageName', label: bn ? 'প্যাকেজ' : 'Package' },
    { key: 'smsCount', label: 'SMS', align: 'right' as const },
    { key: 'amount', label: bn ? 'টাকা' : 'Amount', align: 'right' as const, render: (r: any) => money(r.amount) },
    { key: 'method', label: 'Method', render: (r: any) => METHOD_LABEL[r.method] || r.method },
    { key: 'trxId', label: 'Trx ID', className: 'font-mono text-xs' },
    { key: 'status', label: bn ? 'স্ট্যাটাস' : 'Status', render: (r: any) => <StatusBadge value={r.status === 'verified' ? 'approved' : r.status === 'rejected' ? 'failed' : 'pending'} label={r.status} /> }
  ]
  const txColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'username', label: bn ? 'ইউজার' : 'User', className: 'font-mono text-xs' },
    { key: 'type', label: bn ? 'ধরন' : 'Type', render: (r: any) => TX_TYPE_LABEL[r.type] || r.type },
    { key: 'smsCount', label: 'SMS', align: 'right' as const, render: (r: any) => <span className={r.smsCount > 0 ? 'text-emerald-600' : 'text-red-500'}>{r.smsCount > 0 ? `+${r.smsCount}` : r.smsCount}</span> },
    { key: 'balanceAfter', label: bn ? 'ব্যালেন্স' : 'Balance', align: 'right' as const },
    { key: 'amount', label: bn ? 'টাকা' : 'Amount', align: 'right' as const, render: (r: any) => r.amount ? money(r.amount) : '-' },
    { key: 'note', label: bn ? 'নোট' : 'Note', render: (r: any) => r.note || '-' }
  ]
  const messageColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'username', label: bn ? 'ইউজার' : 'User', className: 'font-mono text-xs' },
    { key: 'recipient', label: bn ? 'প্রাপক' : 'Recipient' },
    { key: 'smsCount', label: 'SMS', align: 'right' as const },
    { key: 'requestId', label: 'Request ID', render: (r: any) => <span className="font-mono text-[10px]">{r.requestId ? String(r.requestId).slice(0, 18) : '-'}</span> },
    { key: 'status', label: bn ? 'স্ট্যাটাস' : 'Status', render: (r: any) => <StatusBadge value={r.status} label={r.status === 'sent' ? 'submitted' : r.status} /> },
    { key: 'deliveryCheckedAt', label: 'DLR', render: (r: any) => r.deliveryCheckedAt ? <span className="text-[10px] text-slate-500">{String(r.deliveryCheckedAt).slice(5, 19)}</span> : '-' },
    { key: 'refunded', label: bn ? 'রিফান্ড' : 'Refund', render: (r: any) => r.refunded ? '✓' : '-' },
    { key: 'gatewayResponse', label: 'Gateway response', render: (r: any) => r.gatewayResponse ? <span className="text-[10px] text-slate-500" title={r.gatewayResponse}>{String(r.gatewayResponse).slice(0, 32)}</span> : '-' },
    { key: 'error', label: 'Error', render: (r: any) => r.error ? <span className="text-[10px] text-red-500">{String(r.error).slice(0, 40)}</span> : '-' }
  ]
  const providerColumns = [
    { key: 'createdAt', label: bn ? 'তারিখ' : 'Date', render: (r: any) => String(r.createdAt || '').slice(0, 19) },
    { key: 'provider', label: 'Provider' },
    { key: 'smsCount', label: 'SMS', align: 'right' as const },
    { key: 'amount', label: bn ? 'টাকা' : 'Amount', align: 'right' as const, render: (r: any) => money(r.amount || 0) },
    { key: 'method', label: 'Method', render: (r: any) => METHOD_LABEL[r.method] || r.method },
    { key: 'trxId', label: 'Trx ID', className: 'font-mono text-xs' },
    { key: 'purchasedByName', label: bn ? 'রেকর্ডকারী' : 'Recorded by', render: (r: any) => r.purchasedByName || '-' },
    { key: 'note', label: bn ? 'নোট' : 'Note', render: (r: any) => r.note || '-' }
  ]
  const pkgColumns = [
    { key: 'name', label: bn ? 'প্যাকেজ' : 'Package' },
    { key: 'sms_count', label: 'SMS', align: 'right' as const },
    { key: 'price', label: bn ? 'দাম' : 'Price', align: 'right' as const, render: (r: any) => money(r.price) },
    { key: 'status', label: bn ? 'স্ট্যাটাস' : 'Status', render: (r: any) => <StatusBadge value={r.status} label={r.status} /> },
    { key: 'description', label: bn ? 'বিবরণ' : 'Description', render: (r: any) => r.description || '-' }
  ]

  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: 'wallets', icon: Wallet, label: bn ? 'ইউজার ওয়ালেট' : 'User Wallets' },
    { key: 'purchases', icon: ShoppingCart, label: bn ? 'কেনাকাটা যাচাই' : 'Purchases' },
    { key: 'packages', icon: Package, label: bn ? 'প্যাকেজ' : 'Packages' },
    { key: 'provider', icon: Banknote, label: bn ? 'প্রোভাইডার ক্রয়' : 'Provider Credits' },
    { key: 'transactions', icon: ArrowLeftRight, label: bn ? 'লেনদেন' : 'Transactions' },
    { key: 'messages', icon: MessageSquare, label: bn ? 'এসএমএস লগ' : 'SMS Log' },
    { key: 'gateway', icon: Settings, label: bn ? 'গেটওয়ে' : 'Gateway' }
  ]

  return (
    <div>
      <PageHeader
        title={bn ? 'এসএমএস অ্যাডমিন' : 'SMS Admin'}
        subtitle={bn ? 'সব ইউজারের এসএমএস ওয়ালেট, প্যাকেজ, পেমেন্ট যাচাই ও গেটওয়ে — SUPER_ADMIN only' : 'All user SMS wallets, packages, payment verification and gateway — SUPER_ADMIN only'}
        actions={<button className="btn-secondary" onClick={() => {
          if (tab === 'wallets') loadWallets(1)
          if (tab === 'purchases') loadPurchases(1)
          if (tab === 'packages') loadPackages()
          if (tab === 'provider') loadProviderPurchases(1)
          if (tab === 'transactions') loadTransactions(1)
          if (tab === 'messages') loadMessages(1)
          if (tab === 'gateway') loadConfig()
        }}><RefreshCw size={15} /> {bn ? 'রিফ্রেশ' : 'Refresh'}</button>}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => { setTab(key); setSearch('') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${tab === key ? 'bg-brand-600 text-white' : 'card hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'wallets' && (
        <DataTable columns={walletColumns as any} rows={wallets.rows} total={wallets.total}
          page={wallets.page} pageSize={wallets.pageSize} onPage={(p) => loadWallets(p)}
          search={search} onSearch={setSearch} loading={loading} exportName="sms-wallets"
          emptyText={bn ? 'কোনো ইউজার নেই' : 'No users'}
          actions={(r: any) => (
            <button className="btn-secondary btn-sm" onClick={() => { setAdjust(r); setAdjustDelta(''); setAdjustNote('') }}>
              {bn ? 'সমন্বয়' : 'Adjust'}
            </button>
          )} />
      )}

      {tab === 'purchases' && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap">
            {['pending', 'verified', 'rejected', 'all'].map((st) => (
              <button key={st} onClick={() => setPurchaseStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs ${purchaseStatus === st ? 'bg-brand-600 text-white' : 'card'}`}>{st}</button>
            ))}
          </div>
          <DataTable columns={purchaseColumns as any} rows={purchases.rows} total={purchases.total}
            page={purchases.page} pageSize={purchases.pageSize} onPage={(p) => loadPurchases(p)}
            search={search} onSearch={setSearch} loading={loading} exportName="sms-purchases"
            emptyText={bn ? 'কোনো রিকোয়েস্ট নেই' : 'No requests'}
            actions={(r: any) => r.status === 'pending' ? (
              <div className="flex gap-1 justify-end">
                <button className="btn-primary btn-sm" onClick={() => setConfirmPurchase(r)}>{bn ? 'যাচাই' : 'Verify'}</button>
                <button className="btn-secondary btn-sm" onClick={() => { setConfirmPurchase({ ...r, rejectMode: true }) }}>{bn ? 'বাতিল' : 'Reject'}</button>
              </div>
            ) : <span className="text-[10px] text-slate-400">{r.verifiedAt ? String(r.verifiedAt).slice(0, 10) : '-'}</span>} />
        </>
      )}

      {tab === 'provider' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Banknote size={16} className="text-brand-600" /> {bn ? 'প্রোভাইডার ক্রেডিট ক্রয়' : 'Provider credit purchase'}</h3>
            <p className="text-[11px] text-slate-500">{bn
              ? 'BulkSMSBD থেকে যে SMS/ক্রেডিট কিনেছেন তা এখানে রেকর্ড করুন। এটি ইউজার ওয়ালেটে সরাসরি যোগ হবে না — User Wallets ট্যাব থেকে আলাদাভাবে অ্যালোকেট করুন।'
              : 'Record SMS/credit bought from BulkSMSBD here. This does not credit a user wallet directly — allocate it from the User Wallets tab.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Provider</label>
                <select className="input" value={providerForm.provider} onChange={(e) => setProviderForm({ ...providerForm, provider: e.target.value })}>
                  <option value="bulksmsbd">bulksmsbd</option>
                </select></div>
              <div><label className="label">SMS</label><input className="input" type="number" min={1} value={providerForm.smsCount} onChange={(e) => setProviderForm({ ...providerForm, smsCount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{bn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</label><input className="input" type="number" min={0} value={providerForm.amount} onChange={(e) => setProviderForm({ ...providerForm, amount: e.target.value })} /></div>
              <div><label className="label">{bn ? 'পেমেন্ট মাধ্যম' : 'Payment method'}</label>
                <select className="input" value={providerForm.method} onChange={(e) => setProviderForm({ ...providerForm, method: e.target.value })}>
                  {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  <option value="other">Other</option>
                </select></div>
            </div>
            <div><label className="label">Trx ID</label><input className="input" value={providerForm.trxId} onChange={(e) => setProviderForm({ ...providerForm, trxId: e.target.value })} placeholder="Provider payment reference" /></div>
            <div><label className="label">{bn ? 'নোট' : 'Note'}</label><input className="input" value={providerForm.note} onChange={(e) => setProviderForm({ ...providerForm, note: e.target.value })} /></div>
            <button className="btn-primary w-full" onClick={saveProviderPurchase} disabled={providerBusy}><Save size={15} /> {providerBusy ? '…' : (bn ? 'রেকর্ড করুন' : 'Record purchase')}</button>
          </div>
          <div className="xl:col-span-2">
            <DataTable columns={providerColumns as any} rows={providerRows.rows} total={providerRows.total}
              page={providerRows.page} pageSize={providerRows.pageSize} onPage={(p) => loadProviderPurchases(p)}
              search={search} onSearch={setSearch} loading={loading} exportName="sms-provider-purchases"
              emptyText={bn ? 'কোনো প্রোভাইডার ক্রয় নেই' : 'No provider purchases'} />
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <DataTable columns={txColumns as any} rows={transactions.rows} total={transactions.total}
          page={transactions.page} pageSize={transactions.pageSize} onPage={(p) => loadTransactions(p)}
          search={search} onSearch={setSearch} loading={loading} exportName="sms-transactions"
          emptyText={bn ? 'কোনো লেনদেন নেই' : 'No transactions'} />
      )}

      {tab === 'messages' && (
        <>
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            {['', 'pending', 'sent', 'delivered', 'failed'].map((st) => (
              <button key={st || 'all'} onClick={() => setMessageStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs ${messageStatus === st ? 'bg-brand-600 text-white' : 'card'}`}>{st === 'sent' ? 'submitted' : (st || 'all')}</button>
            ))}
            <button className="btn-secondary btn-sm ml-auto" onClick={syncDelivery} disabled={deliveryBusy}>
              <RefreshCw size={13} /> {deliveryBusy ? '…' : (bn ? 'DLR সিঙ্ক' : 'Sync delivery')}
            </button>
          </div>
          <DataTable columns={messageColumns as any} rows={messages.rows} total={messages.total}
            page={messages.page} pageSize={messages.pageSize} onPage={(p) => loadMessages(p)}
            search={search} onSearch={setSearch} loading={loading} exportName="sms-messages"
            emptyText={bn ? 'কোনো এসএমএস নেই' : 'No SMS'}
            actions={(r: any) => (
              <div className="flex gap-1 justify-end">
                {r.providerMessageId && (r.status === 'sent' || r.status === 'pending') && (
                  <button className="btn-secondary btn-sm" disabled={deliveryBusy} onClick={() => checkDelivery(r)}>DLR</button>
                )}
                {r.status !== 'delivered' && r.status !== 'failed' && !r.refunded && (
                  <button className="btn-secondary btn-sm" onClick={() => updateStatus(r, 'delivered')}>Delivered</button>
                )}
                {(r.status === 'pending' || r.status === 'sent') && !r.refunded && (
                  <button className="btn-secondary btn-sm" onClick={() => updateStatus(r, 'failed')}>Failed</button>
                )}
              </div>
            )} />
        </>
      )}

      {tab === 'packages' && (
        <>
          <div className="flex justify-end mb-3">
            <button className="btn-primary btn-sm" onClick={() => setPkgModal({ name: '', smsCount: 100, price: 0, status: 'active', description: '' })}>
              + {bn ? 'নতুন প্যাকেজ' : 'New package'}
            </button>
          </div>
          <DataTable columns={pkgColumns as any} rows={packageRows} exportName="sms-packages"
            emptyText={bn ? 'কোনো প্যাকেজ নেই — ইউজার কেনার আগে তৈরি করুন' : 'No packages — create one before users can buy'}
            actions={(r: any) => (
              <div className="flex gap-1 justify-end">
                <button className="btn-secondary btn-sm" onClick={() => setPkgModal({ ...r, smsCount: r.sms_count, price: r.price })}>{bn ? 'এডিট' : 'Edit'}</button>
                {r.status === 'active' && <button className="btn-secondary btn-sm" onClick={() => deactivatePkg(r)}>{bn ? 'নিষ্ক্রিয়' : 'Disable'}</button>}
              </div>
            )} />
        </>
      )}

      {tab === 'gateway' && cfg && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">{bn ? 'গেটওয়ে কনফিগারেশন' : 'Gateway configuration'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Provider</label>
                <select className="input" disabled={cfg.env.provider} value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}>
                  {(cfg.providers || []).map((p: string) => <option key={p} value={p}>{p}</option>)}
                </select>
                {cfg.env.provider && <p className="text-[10px] text-slate-400">managed by SMS_PROVIDER env</p>}
              </div>
              <div>
                <label className="label">Sender ID</label>
                <input className="input" disabled={cfg.env.senderId || cfg.viaEdge} value={cfg.senderId || ''} onChange={(e) => setCfg({ ...cfg, senderId: e.target.value })} />
                {cfg.env.senderId && <p className="text-[10px] text-slate-400">managed by SMS_SENDER_ID env</p>}
                {cfg.viaEdge && <p className="text-[10px] text-slate-400">managed by the Supabase Edge Function secret</p>}
              </div>
            </div>
            <div>
              <label className="label">Gateway URL</label>
              <input className="input" disabled={cfg.env.gatewayUrl} value={cfg.gatewayUrl || ''} onChange={(e) => setCfg({ ...cfg, gatewayUrl: e.target.value })} placeholder="https://bulksmsbd.net/api/smsapi" />
              {cfg.env.gatewayUrl && <p className="text-[10px] text-slate-400">managed by SMS_GATEWAY_URL env</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Balance API URL</label>
                <input className="input" disabled={cfg.env.balanceUrl} value={cfg.balanceUrl || ''} onChange={(e) => setCfg({ ...cfg, balanceUrl: e.target.value })} placeholder="https://bulksmsbd.net/api/getBalanceApi" />
                {cfg.env.balanceUrl && <p className="text-[10px] text-slate-400">SMS_BALANCE_URL env</p>}
              </div>
              <div>
                <label className="label">Delivery Report URL</label>
                <input className="input" disabled={cfg.env.dlrUrl} value={cfg.dlrUrl || ''} onChange={(e) => setCfg({ ...cfg, dlrUrl: e.target.value })} placeholder="https://bulksmsbd.net/api/deliveryReportApi" />
                {cfg.env.dlrUrl && <p className="text-[10px] text-slate-400">SMS_DLR_URL env</p>}
              </div>
            </div>
            <div>
              <label className="label">{bn ? 'কম ব্যালেন্স সতর্কতা (SMS)' : 'Low-balance warning (SMS)'}</label>
              <input className="input" type="number" min={0} disabled={cfg.env.lowBalanceThreshold} value={cfg.lowBalanceThreshold ?? 20} onChange={(e) => setCfg({ ...cfg, lowBalanceThreshold: e.target.value })} />
              {cfg.env.lowBalanceThreshold && <p className="text-[10px] text-slate-400">SMS_LOW_BALANCE_THRESHOLD env</p>}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" disabled={cfg.env.enabled} checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled={cfg.env.refundOnFailed} checked={!!cfg.refundOnFailed} onChange={(e) => setCfg({ ...cfg, refundOnFailed: e.target.checked })} /> Refund failed SMS</label>
              {(cfg.env.enabled || cfg.env.refundOnFailed) && <span className="text-[10px] text-slate-400">environment override</span>}
            </div>
            <button className="btn-primary" onClick={saveConfig} disabled={cfgBusy}><Save size={15} /> {cfgBusy ? '…' : (bn ? 'সেভ করুন' : 'Save')}</button>
          </div>

          <div className="space-y-4">
            <div className="card p-4 text-sm space-y-2">
              <h3 className="font-semibold text-sm">Security status</h3>
              <div className="flex items-center justify-between"><span>{bn ? 'রাউটিং' : 'Routing'}</span><StatusBadge value={cfg.viaEdge ? 'approved' : 'pending'} label={cfg.viaEdge ? 'Supabase Edge Function' : 'Local main process'} /></div>
              {cfg.viaEdge && <div className="flex items-center justify-between"><span>Edge Function</span><StatusBadge value={cfg.edgeConfigured ? 'approved' : 'failed'} label={cfg.edgeConfigured ? 'configured' : 'missing'} /></div>}
              <div className="flex items-center justify-between"><span>{cfg.viaEdge ? 'API Key (Supabase secret)' : 'API Key (env)'}</span><StatusBadge value={(cfg.viaEdge || cfg.apiKeyConfigured) ? 'approved' : 'failed'} label={(cfg.viaEdge || cfg.apiKeyConfigured) ? 'configured' : 'missing'} /></div>
              <div className="flex items-center justify-between"><span>{cfg.viaEdge ? 'Sender ID (Supabase secret)' : 'API Secret (env)'}</span><StatusBadge value={(cfg.viaEdge ? cfg.senderIdConfigured : cfg.apiSecretConfigured) ? 'approved' : 'pending'} label={(cfg.viaEdge ? cfg.senderIdConfigured : cfg.apiSecretConfigured) ? 'configured' : 'not set'} /></div>
              <div className="flex items-center justify-between"><span>Gateway ready</span><StatusBadge value={cfg.configured ? 'approved' : 'failed'} label={cfg.configured ? 'ready' : (cfg.error || 'not configured')} /></div>
              <p className="text-[11px] text-amber-600">{cfg.viaEdge
                ? (bn ? 'API Key ও Sender ID Supabase Edge Function Secrets-এ আছে; ডেস্কটপ অ্যাপ শুধু SMS_EDGE_URL ও SMS_EDGE_TOKEN দিয়ে প্রোভাইডার কল করে।'
                  : 'The API key and Sender ID live in Supabase Edge Function Secrets; the desktop app only calls the function with SMS_EDGE_URL and SMS_EDGE_TOKEN.')
                : (bn ? 'API Key/Secret কখনো ফ্রন্টএন্ডে দেখানো বা সংরক্ষণ করা হয় না। অ্যাপ চালু করার আগে সার্ভার environment-এ SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID, SMS_GATEWAY_URL সেট করুন।'
                  : 'API Key/Secret are never shown or stored in the renderer. Set SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID and SMS_GATEWAY_URL in the server environment before starting the app.')}</p>
            </div>
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">{bn ? 'গেটওয়ে ব্যালেন্স (BulkSMSBD)' : 'Gateway balance (BulkSMSBD)'}</h3>
              <p className="text-[11px] text-slate-500">{bn
                ? 'এটি BulkSMSBD অ্যাকাউন্টের ব্যালেন্স — ইউজারের SMS ওয়ালেট থেকে সম্পূর্ণ আলাদা।'
                : 'This is the BulkSMSBD account balance — completely separate from user SMS wallets.'}</p>
              <button className="btn-secondary" onClick={loadGatewayBalance} disabled={gwBalBusy}>
                <RefreshCw size={14} /> {gwBalBusy ? '…' : (bn ? 'ব্যালেন্স চেক' : 'Check balance')}
              </button>
              {gatewayBal && (
                <div className="text-sm">
                  <span className="text-slate-500">{bn ? 'গেটওয়ে ব্যালেন্স' : 'Gateway balance'}: </span>
                  <b className={gatewayBal.balance <= 0 || (gatewayBal.unit === 'sms' && gatewayBal.balance <= (cfg.lowBalanceThreshold ?? 20)) ? 'text-amber-600' : 'text-emerald-600'}>{gatewayBal.balance} <span className="text-[10px] font-normal text-slate-400">{gatewayBal.unit === 'sms' ? 'SMS' : 'BDT'}</span></b>
                  <span className="text-[10px] text-slate-400 ml-2">{String(gatewayBal.checkedAt || '').slice(0, 19)}</span>
                </div>
              )}
            </div>
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">{bn ? 'গেটওয়ে টেস্ট (ওয়ালেট কাটবে না)' : 'Gateway test (does not debit any wallet)'}</h3>
              <div className="flex gap-2">
                <input className="input" placeholder="01XXXXXXXXX" maxLength={20} value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} />
                <button className="btn-secondary" onClick={testGateway} disabled={testBusy}><Send size={14} /> {testBusy ? '…' : 'Test'}</button>
              </div>
              {testResult && <p className={`text-xs ${testResult.error ? 'text-red-500' : 'text-emerald-600'}`}>{testResult.error || `Accepted · ${testResult.provider} · ID: ${testResult.providerMessageId || '-'}`}</p>}
            </div>
          </div>
        </div>
      )}

      {/* wallet adjustment */}
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={bn ? 'এসএমএস ব্যালেন্স সমন্বয়' : 'Adjust SMS balance'} width="max-w-md">
        <div className="space-y-3 text-sm">
          <p>{bn ? 'ইউজার' : 'User'}: <b className="font-mono">{adjust?.username}</b> · {bn ? 'বর্তমান' : 'Current'}: <b>{adjust?.balance}</b> SMS</p>
          <div><label className="label">{bn ? 'পরিবর্তন (যেমন +100, -50)' : 'Change (e.g. +100, -50)'}</label>
            <input className="input" type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} /></div>
          <div><label className="label">{bn ? 'কারণ / নোট' : 'Reason / note'}</label>
            <input className="input" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAdjust(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
            <button className="btn-primary" disabled={adjustBusy} onClick={saveAdjust}>{adjustBusy ? '…' : (bn ? 'সমন্বয় করুন' : 'Adjust')}</button>
          </div>
        </div>
      </Modal>

      {/* purchase verify */}
      <Modal open={!!confirmPurchase} onClose={() => setConfirmPurchase(null)} title={bn ? 'পেমেন্ট যাচাই' : 'Verify payment'} width="max-w-md">
        <div className="space-y-3 text-sm">
          <p><b className="font-mono">{confirmPurchase?.username}</b> · {confirmPurchase?.packageName} · <b>{confirmPurchase?.smsCount}</b> SMS · {money(confirmPurchase?.amount || 0)} · {METHOD_LABEL[confirmPurchase?.method] || confirmPurchase?.method}</p>
          <p>Trx ID: <b className="font-mono">{confirmPurchase?.trxId}</b></p>
          <p className="text-[11px] text-amber-600">{bn
            ? 'শুধুমাত্র বাস্তবে পেমেন্ট যাচাই করার পর Approve করুন। Approve করলে ঠিক একবার SMS ক্রেডিট হবে; ডুপ্লিকেট ক্লিকে দ্বিতীয়বার ক্রেডিট হবে না।'
            : 'Approve only after verifying the real payment. Approval credits exactly once; duplicate clicks will not credit twice.'}</p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setConfirmPurchase(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
            <button className="btn-primary" disabled={purchaseBusy} onClick={() => verifyPurchase(confirmPurchase?.rejectMode ? 'reject' : 'approve')}>
              {purchaseBusy ? '…' : confirmPurchase?.rejectMode ? (bn ? 'রিজেক্ট' : 'Reject') : (bn ? 'Approve ও ক্রেডিট' : 'Approve & credit')}
            </button>
          </div>
        </div>
      </Modal>

      {/* package editor */}
      <Modal open={!!pkgModal} onClose={() => setPkgModal(null)} title={bn ? 'এসএমএস প্যাকেজ' : 'SMS package'} width="max-w-md">
        <div className="space-y-3 text-sm">
          <div><label className="label">{bn ? 'নাম' : 'Name'}</label><input className="input" value={pkgModal?.name || ''} onChange={(e) => setPkgModal({ ...pkgModal, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">SMS</label><input className="input" type="number" value={pkgModal?.smsCount ?? ''} onChange={(e) => setPkgModal({ ...pkgModal, smsCount: e.target.value })} /></div>
            <div><label className="label">{bn ? 'দাম (৳)' : 'Price (৳)'}</label><input className="input" type="number" value={pkgModal?.price ?? ''} onChange={(e) => setPkgModal({ ...pkgModal, price: e.target.value })} /></div>
          </div>
          <div><label className="label">{bn ? 'বিবরণ' : 'Description'}</label><input className="input" value={pkgModal?.description || ''} onChange={(e) => setPkgModal({ ...pkgModal, description: e.target.value })} /></div>
          <div><label className="label">{bn ? 'স্ট্যাটাস' : 'Status'}</label>
            <select className="input" value={pkgModal?.status || 'active'} onChange={(e) => setPkgModal({ ...pkgModal, status: e.target.value })}>
              <option value="active">active</option><option value="inactive">inactive</option>
            </select></div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setPkgModal(null)}>{bn ? 'বাতিল' : 'Cancel'}</button>
            <button className="btn-primary" disabled={pkgBusy} onClick={savePkg}>{pkgBusy ? '…' : (bn ? 'সেভ' : 'Save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

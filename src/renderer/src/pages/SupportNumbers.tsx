import React from 'react'
import { Phone, Copy, Headphones, Tv, CreditCard } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader, useToast } from '../components/ui'

// Support numbers — the developer's contact & payment numbers.
export default function SupportNumbers() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const copy = (n: string) => { navigator.clipboard?.writeText(n); toast.push('success', t('subCopied')) }

  const items = [
    { label: 'bKash', num: '01331707900', color: '#E2136E', icon: CreditCard },
    { label: 'Nagad', num: '01616595386', color: '#F1471D', icon: CreditCard },
    { label: lang === 'bn' ? 'হোয়াটসঅ্যাপ সাপোর্ট' : 'WhatsApp Support', num: '01331707900', color: '#10b981', icon: Headphones },
    { label: lang === 'bn' ? 'কল / SMS সাপোর্ট' : 'Call / SMS Support', num: '01616595386', color: '#6366f1', icon: Phone }
  ]

  return (
    <div>
      <PageHeader title={t('m_support_numbers')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        {items.map((it) => (
          <div key={it.label + it.num}
            className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: it.color }}>
                <it.icon size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{it.label}</div>
                <div className="font-mono font-bold text-lg truncate">{it.num}</div>
              </div>
            </div>
            <button className="btn-secondary btn-sm shrink-0" onClick={() => copy(it.num)}>
              <Copy size={14} /> {t('subCopy')}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-4 max-w-2xl">
        {lang === 'bn'
          ? 'কোনো সমস্যা হলে উপরের নাম্বারে যোগাযোগ করুন। সফটওয়্যার সাপোর্ট → ওপেন সাপোর্ট টিকেট থেকে টিকেট খুললে দ্রুত সমাধান পাবেন।'
          : 'Contact the numbers above for any issue. Open a ticket from Software Support → Open Support Ticket for a faster resolution.'}
      </p>
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
        <Tv size={13} /> AVA Cable Management — 100% Offline
      </div>
    </div>
  )
}

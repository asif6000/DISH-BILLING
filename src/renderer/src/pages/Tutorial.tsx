import React from 'react'
import { PlayCircle, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PageHeader } from '../components/ui'

// Tutorial — getting started steps for the classic menu layout.
export default function Tutorial() {
  const { t, lang } = useI18n()
  const bn = lang === 'bn'

  const steps: { title: string; desc: string }[] = bn ? [
    { title: '১. লগইন করুন', desc: 'অ্যাডমিন দেওয়া ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন করুন। নতুন অ্যাকাউন্ট খুললে অ্যাডমিন অ্যাপ্রুভ করার পর লগইন হবে।' },
    { title: '২. এরিয়া ও গ্রাহক যোগ করুন', desc: 'এরিয়া পেজে এলাকা বানান, তারপর গ্রাহক → গ্রাহক থেকে নতুন গ্রাহক যোগ করুন।' },
    { title: '৩. মাসিক বিল তৈরি ও কালেকশন', desc: 'রিপোর্ট → কালেকশন থেকে মাসিক বিল দেখুন ও টাকা কালেক্ট করুন। কালেকশনের রসিদ অটো তৈরি হয়।' },
    { title: '৪. মেসেজ পাঠান', desc: 'মেসেজ → বাল্ক মেসেজ থেকে গ্রাহকদের বকেয়া রিমাইন্ডার বা নিশ্চিতকরণ SMS পাঠান।' },
    { title: '৫. রিসেলার ও স্টাফ', desc: 'রিসেলার রিচার্জ/কমিশন ম্যানেজ করুন, স্টাফ → কালেক্টর থেকে কালেক্টর ডিউটি দিন।' },
    { title: '৬. সমস্যা হলে', desc: 'সফটওয়্যার সাপোর্ট → ওপেন সাপোর্ট টিকেট থেকে টিকেট খুলুন, বা সাপোর্ট নাম্বারস পেজের নাম্বারে কল করুন।' }
  ] : [
    { title: '1. Log in', desc: 'Log in with the username and password from the admin. New signups work after admin approval.' },
    { title: '2. Add areas & customers', desc: 'Create areas in the Area page, then add customers from Customers → Customers.' },
    { title: '3. Monthly bill & collection', desc: 'View monthly bills and collect payments from Reports → Collection. Receipts are generated automatically.' },
    { title: '4. Send messages', desc: 'Send due reminders or payment confirmations from Messages → Bulk Message.' },
    { title: '5. Resellers & staff', desc: 'Manage reseller recharge/commission and assign collector duty from Staff → Collector.' },
    { title: '6. Need help?', desc: 'Open a ticket from Software Support → Open Support Ticket, or call the numbers in Support Numbers.' }
  ]

  return (
    <div>
      <PageHeader title={t('m_tutorial')} />
      <div className="max-w-2xl space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 shadow-lg shadow-brand-600/20">
          <div className="flex items-center gap-2 font-bold"><PlayCircle size={20} /> {t('appName')}</div>
          <p className="text-sm text-white/80 mt-1">{bn ? 'শুরু করার ৬টা ধাপ — একের পর এক করে ফেলুন' : 'Six getting-started steps — follow them in order'}</p>
        </div>
        {steps.map((s, i) => (
          <div key={i} className="card p-4 flex gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">{s.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

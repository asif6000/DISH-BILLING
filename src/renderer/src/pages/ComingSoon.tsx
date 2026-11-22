import React from 'react'
import { Hammer } from 'lucide-react'
import { useI18n } from '../lib/i18n'

// Placeholder for menu items that exist in the classic app but have not been
// built in this version yet.
export default function ComingSoon() {
  const { t } = useI18n()
  return (
    <div className="card p-12 text-center max-w-md mx-auto mt-10">
      <Hammer size={40} className="mx-auto text-brand-500 mb-4" />
      <h2 className="text-lg font-bold">{t('comingSoon')}</h2>
      <p className="text-sm text-slate-400 mt-2">{t('appName')}</p>
    </div>
  )
}

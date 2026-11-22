import io

path = 'src/renderer/src/pages/Security.tsx'
lines = io.open(path, encoding='utf8').read().split('\n')

new_tab = r"""// Module permission keys for the role editor — legacy module keys not part of
// PERMISSION_CATALOG (bespoke IPC modules / entity pages).
const EXTRA_MODULES = [
  'connections', 'zones', 'sub_areas', 'roads', 'network_devices', 'network_faults',
  'attendance', 'leaves', 'salaries', 'cash_deposits', 'products', 'suppliers',
  'purchases', 'stock_movements', 'transactions', 'expense_categories', 'account_transfers',
  'discounts', 'customer_documents', 'branches', 'leads', 'followups', 'sms_templates',
  'messages', 'automation', 'settings'
].filter((m) => !PERMISSION_CATALOG.some((c) => c.module === m))

function RolesTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [perms, setPerms] = useState<Set<string>>(new Set())

  const load = () => window.api.roles.list().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  // SUPER_ADMIN keeps its exclusive full-access role — read-only for everyone.
  const readOnly = open && editing?.name === 'SUPER_ADMIN'
  const isSystem = !!editing?.is_system

  const toggle = (key: string) => setPerms((s) => {
    const n = new Set(s)
    const had = n.has(key)
    if (had) n.delete(key)
    else n.add(key)
    // a module key dominates its granular keys — adding/removing it also
    // drops the now-redundant 'module.action' keys so the set stays clean
    for (const k of [...n]) if (k.startsWith(key + '.')) n.delete(k)
    return n
  })

  const hasAccess = (mod: string) => perms.has(mod)
  const actionChecked = (mod: string, action: string) => perms.has(mod) || perms.has(`${mod}.${action}`)

  const save = async () => {
    try {
      // 'all' is reserved for SUPER_ADMIN — never grantable from the editor
      const list = [...perms].filter((k) => k !== 'all')
      await window.api.roles.save({ id: editing?.id, name: editing?.name || 'New Role', permissions: list })
      toast.push('success', t('saved'))
      setOpen(false)
      load()
    } catch (e) { toast.push('error', errMsg(e)) }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => { setEditing({ name: '' }); setPerms(new Set()); setOpen(true) }}><Plus size={16} /> {t('add')}</button>
      </div>
      <DataTable columns={[
        { key: 'name', label: t('role') },
        { key: 'permCount', label: t('permissions'), render: (r) => (JSON.parse(r.permissions || '[]').length) },
        { key: 'is_system', label: 'System', render: (r) => r.is_system ? '✓' : '-' }
      ]} rows={rows}
        actions={(r) => (
          <div className="flex justify-end gap-1">
            <button className="btn-secondary btn-sm" disabled={r.name === 'SUPER_ADMIN'}
              onClick={() => { setEditing(r); setPerms(new Set(JSON.parse(r.permissions || '[]'))); setOpen(true) }}><Pencil size={13} /></button>
            {!r.is_system && <button className="btn-secondary btn-sm text-red-600" onClick={() => window.api.roles.delete(r.id).then(load).catch((e) => toast.push('error', errMsg(e)))}><Trash2 size={13} /></button>}
          </div>
        )} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('security_roles')} width="max-w-2xl">
        {readOnly ? (
          <p className="text-sm text-slate-500 py-4">{lang === 'bn' ? 'SUPER_ADMIN role সম্পূর্ণ ক্ষমতার অধিকারী — এটি পরিবর্তন করা যায় না।' : 'The SUPER_ADMIN role holds full access and cannot be modified.'}</p>
        ) : (
          <>
            <div><label className="label">{t('role')}</label>
              <input className="input" value={editing?.name || ''} disabled={isSystem}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              {isSystem && <p className="text-[10px] text-slate-400 mt-1">{lang === 'bn' ? 'System role — শুধু permissions পরিবর্তন করা যাবে' : 'System role — only its permissions can be edited'}</p>}
            </div>
            <div className="flex items-center justify-between mt-3 mb-1">
              <label className="label mb-0">{t('permissions')}</label>
              <div className="flex gap-1">
                <button type="button" className="btn-secondary btn-sm"
                  onClick={() => setPerms(new Set([...PERMISSION_CATALOG.map((m) => m.module), ...EXTRA_MODULES]))}>{lang === 'bn' ? 'সব সিলেক্ট' : 'Select all'}</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setPerms(new Set())}>{lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}</button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">{lang === 'bn'
              ? 'মডিউল = পুরো অংশ। আলাদা action (দেখা/তৈরি/সম্পাদনা/মুছে ফেলা) দিলে শুধু সেই কাজটি অনুমোদিত হবে।'
              : 'Module = full section. Individual actions (View/Create/Edit/Delete) grant only that action.'}</p>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {PERMISSION_CATALOG.map((m) => (
                <div key={m.module} className="card p-2.5">
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${hasAccess(m.module) ? 'text-brand-700 dark:text-brand-400' : ''}`}>
                    <input type="checkbox" checked={hasAccess(m.module)} className="w-3.5 h-3.5"
                      onChange={() => toggle(m.module)} />
                    {lang === 'bn' ? m.labelBn : m.label}
                    <span className="font-mono text-[9px] text-slate-400">{m.module}</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-1.5 ml-6">
                    {m.actions.map((a) => {
                      const key = `${m.module}.${a.key}`
                      const checked = actionChecked(m.module, a.key)
                      return (
                        <label key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer ${checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <input type="checkbox" checked={checked} className="w-3 h-3"
                            onChange={() => toggle(key)} />
                          <span className="truncate">{lang === 'bn' ? a.labelBn : a.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="card p-2.5">
                <div className="text-xs font-semibold mb-1.5">{lang === 'bn' ? 'অন্যান্য অংশ (legacy)' : 'Other sections (legacy)'}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXTRA_MODULES.map((m) => (
                    <label key={m} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] cursor-pointer ${perms.has(m) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="checkbox" checked={perms.has(m)} className="w-3 h-3"
                        onChange={() => toggle(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-amber-600 mt-2">{lang === 'bn'
              ? "'all' (সম্পূর্ণ ক্ষমতা) শুধুই SUPER_ADMIN role-এর জন্য — অন্য role-এ দেওয়া যায় না।"
              : "'all' (full access) is exclusive to the SUPER_ADMIN role and cannot be granted here."}</p>
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={save}>{t('save')}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}"""

start = next(i for i, l in enumerate(lines) if l.startswith('function RolesTab()'))
end = next(i for i, l in enumerate(lines) if l.startswith('function LogsTab()'))
out = lines[:start] + new_tab.split('\n') + [''] + lines[end:]
io.open(path, 'w', encoding='utf8', newline='\n').write('\n'.join(out))
print('replaced', start, end)

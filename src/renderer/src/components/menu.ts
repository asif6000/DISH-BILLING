export interface MenuItem { labelKey: string; path: string; badge?: 'pending' }
export interface MenuGroup { labelKey: string; icon: string; path?: string; children?: MenuItem[] }

export const MENU: MenuGroup[] = [
  { labelKey: 'nav_dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  {
    labelKey: 'nav_areas', icon: 'MapPin',
    children: [
      { labelKey: 'areas_all', path: '/areas' },
      { labelKey: 'areas_zones', path: '/zones' },
      { labelKey: 'areas_sub', path: '/sub-areas' },
      { labelKey: 'areas_roads', path: '/roads' },
      { labelKey: 'areas_customers', path: '/areas/customers' },
      { labelKey: 'areas_collection', path: '/areas/collection' }
    ]
  },
  {
    labelKey: 'nav_network', icon: 'Cable',
    children: [
      { labelKey: 'network_devices', path: '/network' },
      { labelKey: 'network_faults', path: '/network/faults' }
    ]
  },
  {
    labelKey: 'nav_customers', icon: 'Users',
    children: [
      { labelKey: 'customers_all', path: '/customers' },
      { labelKey: 'customers_active', path: '/customers?status=active' },
      { labelKey: 'customers_inactive', path: '/customers?status=inactive' },
      { labelKey: 'customers_paid', path: '/customers?status=paid' },
      { labelKey: 'customers_due', path: '/customers?status=due' },
      { labelKey: 'customers_expired', path: '/customers?status=expired' },
      { labelKey: 'customers_free', path: '/customers?status=free' },
      { labelKey: 'customers_new', path: '/customers/new' },
      { labelKey: 'customers_transfer', path: '/customers/transfer' },
      { labelKey: 'customers_shift', path: '/customers/shift' },
      { labelKey: 'customers_documents', path: '/customers/documents' },
      { labelKey: 'customers_history', path: '/customers/history' },
      { labelKey: 'customers_import', path: '/customers/import' },
      { labelKey: 'customers_export', path: '/customers/export' }
    ]
  },
  {
    labelKey: 'nav_billing', icon: 'FileSpreadsheet',
    children: [
      { labelKey: 'billing_monthly', path: '/billing' },
      { labelKey: 'billing_generate', path: '/billing/generate' },
      { labelKey: 'billing_due', path: '/billing?status=due' },
      { labelKey: 'billing_partial', path: '/billing?status=partial' },
      { labelKey: 'billing_discounts', path: '/discounts' },
      { labelKey: 'billing_history', path: '/billing/history' }
    ]
  },
  {
    labelKey: 'nav_payments', icon: 'Wallet',
    children: [
      { labelKey: 'payments_collect', path: '/payments/collect' },
      { labelKey: 'payments_history', path: '/payments' },
      { labelKey: 'payments_cash', path: '/payments?method=cash' },
      { labelKey: 'payments_advance', path: '/payments?type=advance' },
      { labelKey: 'payments_refund', path: '/payments/refund' },
      { labelKey: 'payments_daily', path: '/payments/daily' }
    ]
  },
  {
    labelKey: 'nav_connections', icon: 'Plug',
    children: [
      { labelKey: 'connections_all', path: '/connections' },
      { labelKey: 'connections_history', path: '/connections/history' }
    ]
  },
  { labelKey: 'nav_packages', icon: 'Package', path: '/packages' },
  {
    labelKey: 'nav_staff', icon: 'IdCard',
    children: [
      { labelKey: 'staff_all', path: '/staff' },
      { labelKey: 'staff_attendance', path: '/attendance' },
      { labelKey: 'staff_leaves', path: '/leaves' },
      { labelKey: 'staff_salary', path: '/salaries' }
    ]
  },
  {
    labelKey: 'nav_collectors', icon: 'UserCheck',
    children: [
      { labelKey: 'collectors_all', path: '/collectors' },
      { labelKey: 'collectors_assign', path: '/collectors/assign' },
      { labelKey: 'collectors_deposit', path: '/deposits' },
      { labelKey: 'collectors_verification', path: '/collectors/report' }
    ]
  },
  {
    labelKey: 'nav_resellers', icon: 'Store',
    children: [
      { labelKey: 'resellers_all', path: '/resellers' },
      { labelKey: 'resellers_wallet', path: '/resellers/wallet' }
    ]
  },
  {
    labelKey: 'nav_messages', icon: 'MessageSquare',
    children: [
      { labelKey: 'messages_individual', path: '/messages' },
      { labelKey: 'messages_reminder', path: '/messages/reminders' },
      { labelKey: 'messages_templates', path: '/templates' },
      { labelKey: 'messages_history', path: '/messages/history' }
    ]
  },
  {
    labelKey: 'nav_complaints', icon: 'Wrench',
    children: [
      { labelKey: 'complaints_all', path: '/complaints' },
      { labelKey: 'complaints_pending', path: '/complaints?status=pending' },
      { labelKey: 'complaints_resolved', path: '/complaints?status=resolved' }
    ]
  },
  {
    labelKey: 'nav_inventory', icon: 'Boxes',
    children: [
      { labelKey: 'inventory_products', path: '/products' },
      { labelKey: 'inventory_stock', path: '/stock' },
      { labelKey: 'inventory_purchases', path: '/purchases' },
      { labelKey: 'inventory_suppliers', path: '/suppliers' }
    ]
  },
  {
    labelKey: 'nav_accounts', icon: 'Landmark',
    children: [
      { labelKey: 'accounts_cashbook', path: '/accounts/cashbook' },
      { labelKey: 'accounts_bank', path: '/accounts' },
      { labelKey: 'accounts_income', path: '/accounts/income' },
      { labelKey: 'accounts_expense', path: '/accounts/expense' },
      { labelKey: 'accounts_transfer', path: '/transfers' },
      { labelKey: 'accounts_receivables', path: '/accounts/receivables' },
      { labelKey: 'accounts_pl', path: '/accounts/pl' }
    ]
  },
  {
    labelKey: 'nav_expenses', icon: 'Receipt',
    children: [
      { labelKey: 'expenses_add', path: '/expenses/add' },
      { labelKey: 'expenses_daily', path: '/expenses' },
      { labelKey: 'expenses_categories', path: '/expense-categories' }
    ]
  },
  { labelKey: 'nav_reports', icon: 'BarChart3', path: '/reports' },
  {
    labelKey: 'nav_marketing', icon: 'Megaphone',
    children: [
      { labelKey: 'marketing_leads', path: '/leads' },
      { labelKey: 'marketing_followup', path: '/followups' }
    ]
  },
  { labelKey: 'nav_automation', icon: 'Bot', path: '/automation' },
  { labelKey: 'nav_branches', icon: 'Building2', path: '/branches' },
  {
    labelKey: 'nav_security', icon: 'ShieldCheck',
    children: [
      { labelKey: 'security_users', path: '/security/users' },
      { labelKey: 'security_roles', path: '/security/roles' },
      { labelKey: 'security_logs', path: '/security/logs' },
      { labelKey: 'security_logins', path: '/security/logins' },
      { labelKey: 'security_backup', path: '/security/backup' }
    ]
  },
  { labelKey: 'nav_settings', icon: 'Settings', path: '/settings' }
]

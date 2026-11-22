// Sidebar menu — mirrors the classic AVA app structure exactly:
// ড্যাশবোর্ড, এরিয়া, মাইক্লাজিক, গ্রাহক, রিপোর্ট, স্টাফ, রিসেলার, মেসেজ,
// একাউন্টেস, সাপোর্ট, সফটওয়্যার সাপোর্ট, একটিভিটি লগ
// `perm` = the module permission the page requires (matches requirePermission
// module names / generic entity keys). Items without perm are always visible;
// the Layout hides items the logged-in user has no permission for.
export interface MenuItem { labelKey: string; path: string; icon?: string; badge?: 'pending'; perm?: string }
export interface MenuGroup { labelKey: string; icon: string; path?: string; children?: MenuItem[]; perm?: string }

export const MENU: MenuGroup[] = [
  { labelKey: 'm_dashboard', icon: 'Home', path: '/dashboard', perm: 'dashboard' },
  { labelKey: 'm_area', icon: 'MapPin', path: '/areas', perm: 'areas' },
  { labelKey: 'm_myclassic', icon: 'ShoppingBasket', path: '/packages', perm: 'packages' },
  {
    labelKey: 'm_customers_group', icon: 'Users',
    children: [
      { labelKey: 'm_customers', path: '/customers', icon: 'Users', perm: 'customers' },
      { labelKey: 'm_customers_other', path: '/customers?status=inactive', icon: 'Users', perm: 'customers' }
    ]
  },
  {
    labelKey: 'm_reports_group', icon: 'BarChart3',
    children: [
      { labelKey: 'm_bill_report', path: '/reports/bills', icon: 'Printer', perm: 'reports' },
      { labelKey: 'm_collection', path: '/payments', icon: 'TrendingUp', perm: 'payments' },
      { labelKey: 'm_collection_history', path: '/payments/history', icon: 'History', perm: 'payments' },
      { labelKey: 'm_reseller_collection', path: '/collectors/report', icon: 'Users', perm: 'reports' },
      { labelKey: 'm_warning_message', path: '/messages/reminders', icon: 'Send', perm: 'messaging' }
    ]
  },
  {
    labelKey: 'm_staff_group', icon: 'UserCog',
    children: [
      { labelKey: 'm_manager', path: '/staff', icon: 'User', perm: 'staff' },
      { labelKey: 'm_collector', path: '/collectors', icon: 'Users', perm: 'collectors' },
      { labelKey: 'm_cashier', path: '/accounts/cashbook', icon: 'SquareUser', perm: 'accounts' }
    ]
  },
  {
    labelKey: 'm_reseller_group', icon: 'CircleUser',
    children: [
      { labelKey: 'm_reseller', path: '/resellers', icon: 'Users', perm: 'resellers' },
      { labelKey: 'm_recharge_history', path: '/resellers/wallet', icon: 'Banknote', perm: 'resellers' }
    ]
  },
  {
    labelKey: 'm_message_group', icon: 'MessageCircle',
    children: [
      { labelKey: 'm_bulk_message', path: '/messages', icon: 'MessageSquareMore', perm: 'messaging' },
      { labelKey: 'm_msg_settings', path: '/templates', icon: 'Settings', perm: 'sms_templates' },
      { labelKey: 'm_msg_log', path: '/messages/history', icon: 'MailOpen', perm: 'messaging' }
    ]
  },
  {
    labelKey: 'm_accounts_group', icon: 'Wallet',
    children: [
      { labelKey: 'm_expense', path: '/accounts/expense', icon: 'Banknote', perm: 'accounts' },
      { labelKey: 'm_inventory2', path: '/purchases', icon: 'ClipboardList', perm: 'inventory' }
    ]
  },
  {
    labelKey: 'm_support_group', icon: 'Headphones',
    children: [
      { labelKey: 'm_open_ticket', path: '/complaints', icon: 'UserMinus', perm: 'complaints' },
      { labelKey: 'm_support_numbers', path: '/support-numbers', icon: 'Smartphone' },
      { labelKey: 'm_package_change', path: '/packages?change=1', icon: 'RefreshCw', perm: 'packages' }
    ]
  },
  { labelKey: 'm_activity_log', icon: 'Clock', path: '/security/logs', perm: 'security' },
  { labelKey: 'security_roles', icon: 'ShieldCheck', path: '/security/roles', perm: 'security' },
  { labelKey: 'm_user_manage', icon: 'UserCog', path: '/security/users', perm: 'users' },
  { labelKey: 'm_settings', icon: 'Settings', path: '/settings' }
]

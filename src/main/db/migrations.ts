// Database schema. Applied in order, tracked by PRAGMA user_version.
// Version 1: initial schema
import { LEGACY_MODULES, PERMISSION_CATALOG } from '../../shared/permissions'
import { GENERIC_ENTITY_KEYS } from '../../shared/entities'

// Every permission key the app knows about: catalog modules, legacy modules and
// the generic-entity modules. A module key dominates all of its granular keys in
// hasPermission(), so holding all module keys == full access to every feature.
const ALL_MODULE_KEYS: string[] = Array.from(new Set<string>([
  ...PERMISSION_CATALOG.map((m) => m.module),
  ...LEGACY_MODULES,
  ...GENERIC_ENTITY_KEYS
]))
// SQL literal (JSON array) for the migrations below. JSON only contains double
// quotes, but escape single quotes defensively.
const ALL_MODULE_KEYS_JSON = JSON.stringify(ALL_MODULE_KEYS).replace(/'/g, "''")

export const MIGRATIONS: string[] = [
  `
  -- ================= AUTH / SECURITY =================
  CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL DEFAULT '["all"]',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    mobile TEXT,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'active',
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT,
    login_at TEXT NOT NULL DEFAULT (datetime('now')),
    logout_at TEXT,
    success INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    module TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= ORGANIZATION =================
  CREATE TABLE zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sub_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE roads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sub_area_id INTEGER REFERENCES sub_areas(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    mobile TEXT,
    manager_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= PACKAGES =================
  CREATE TABLE packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    price REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'standard',
    channels INTEGER,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= CUSTOMERS =================
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    father_name TEXT,
    mobile TEXT NOT NULL,
    address TEXT,
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    sub_area_id INTEGER REFERENCES sub_areas(id) ON DELETE SET NULL,
    road_id INTEGER REFERENCES roads(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
    connection_date TEXT,
    package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
    monthly_bill REAL NOT NULL DEFAULT 0,
    connection_fee REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    advance_balance REAL NOT NULL DEFAULT 0,
    nid TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_customers_status ON customers(status);
  CREATE INDEX idx_customers_area ON customers(area_id);
  CREATE INDEX idx_customers_mobile ON customers(mobile);
  CREATE INDEX idx_customers_name ON customers(name);

  CREATE TABLE customer_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,           -- new / transfer / shifting / upgrade / downgrade / disconnect / reconnect / temp_disconnect / perm_disconnect
    from_value TEXT,
    to_value TEXT,
    date TEXT NOT NULL,
    note TEXT,
    created_by TEXT
  );
  CREATE INDEX idx_conn_customer ON customer_connections(customer_id);

  CREATE TABLE customer_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= BILLING =================
  CREATE TABLE bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    month TEXT NOT NULL,            -- 'YYYY-MM'
    amount REAL NOT NULL DEFAULT 0, -- package amount
    discount REAL NOT NULL DEFAULT 0,
    late_fee REAL NOT NULL DEFAULT 0,
    previous_due REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'due', -- due / partial / paid / advance / cancelled
    generated_by TEXT NOT NULL DEFAULT 'auto',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_bills_customer ON bills(customer_id);
  CREATE INDEX idx_bills_month ON bills(month);
  CREATE INDEX idx_bills_status ON bills(status);

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',   -- cash / bkash / nagad / rocket / bank
    reference TEXT,
    note TEXT,
    collector_id INTEGER,
    reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
    payment_date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bill',      -- bill / advance / refund / connection_fee
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_payments_customer ON payments(customer_id);
  CREATE INDEX idx_payments_date ON payments(payment_date);
  CREATE INDEX idx_payments_method ON payments(method);

  CREATE TABLE discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    month TEXT,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= STAFF / COLLECTORS =================
  CREATE TABLE staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    designation TEXT NOT NULL DEFAULT 'technician',
    mobile TEXT,
    nid TEXT,
    address TEXT,
    join_date TEXT,
    salary REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    note TEXT
  );

  CREATE TABLE leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    basic REAL NOT NULL DEFAULT 0,
    bonus REAL NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    deduction REAL NOT NULL DEFAULT 0,
    paid_date TEXT,
    status TEXT NOT NULL DEFAULT 'unpaid'
  );

  CREATE TABLE collectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    target_amount REAL NOT NULL DEFAULT 0,
    commission_rate REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE collector_areas (
    collector_id INTEGER NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    PRIMARY KEY (collector_id, area_id)
  );

  CREATE TABLE cash_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collector_id INTEGER NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= RESELLERS =================
  CREATE TABLE resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    mobile TEXT NOT NULL,
    address TEXT,
    commission_rate REAL NOT NULL DEFAULT 0,
    wallet_balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE reseller_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,            -- recharge / payment / commission / due
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= COMPLAINTS =================
  CREATE TABLE complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'no_signal',
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    technician_id INTEGER,
    assigned_date TEXT,
    resolved_date TEXT,
    feedback TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_complaints_status ON complaints(status);

  -- ================= INVENTORY =================
  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    mobile TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT NOT NULL DEFAULT 'cable',
    unit TEXT DEFAULT 'pcs',
    purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 5,
    warranty_months INTEGER DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL UNIQUE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty REAL NOT NULL,
    price REAL NOT NULL
  );

  CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL,            -- in / out / adjust
    qty REAL NOT NULL,
    reason TEXT,
    ref TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= NETWORK =================
  CREATE TABLE network_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT NOT NULL DEFAULT 'main_line',
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    location TEXT,
    capacity INTEGER,
    parent_id INTEGER REFERENCES network_devices(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE network_faults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER REFERENCES network_devices(id) ON DELETE SET NULL,
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolved_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= ACCOUNTS =================
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash',
    bank_name TEXT,
    account_no TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    type TEXT NOT NULL,             -- income / expense
    category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    ref TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_tx_date ON transactions(date);
  CREATE INDEX idx_tx_type ON transactions(type);

  CREATE TABLE account_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account_id INTEGER NOT NULL REFERENCES accounts(id),
    to_account_id INTEGER NOT NULL REFERENCES accounts(id),
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= CRM / MESSAGING =================
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT,
    source TEXT NOT NULL DEFAULT 'walk_in',
    interest INTEGER,
    status TEXT NOT NULL DEFAULT 'new',
    followup_date TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    note TEXT NOT NULL,
    next_date TEXT,
    status TEXT NOT NULL DEFAULT 'done'
  );

  CREATE TABLE sms_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'due_reminder',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    mobile TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'sms',
    type TEXT NOT NULL DEFAULT 'individual',
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ================= SETTINGS =================
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,
  `
  -- Version 2: seed defaults
  INSERT INTO roles (name, permissions, is_system) VALUES ('Administrator', '["all"]', 1);
  INSERT INTO roles (name, permissions, is_system) VALUES ('Manager', '["dashboard","customers","billing","payments","areas","packages","complaints","reports","inventory","staff"]', 1);
  INSERT INTO roles (name, permissions, is_system) VALUES ('Collector', '["dashboard","payments","customers"]', 1);

  -- default expense/income categories
  INSERT INTO expense_categories (name, type) VALUES
    ('Staff Salary','expense'),
    ('Cable Purchase','expense'),
    ('Equipment Purchase','expense'),
    ('Electricity Bill','expense'),
    ('Office Rent','expense'),
    ('Transportation','expense'),
    ('Maintenance','expense'),
    ('Marketing','expense'),
    ('Other Expense','expense'),
    ('Connection Fee','income'),
    ('Monthly Bill','income'),
    ('Installation','income'),
    ('Other Income','income');

  INSERT INTO accounts (name, type, opening_balance, balance) VALUES ('Cash Box', 'cash', 0, 0);

  INSERT INTO sms_templates (name, type, content) VALUES
    ('Due Reminder', 'due_reminder', 'প্রিয় {{name}}, আপনার {{month}} মাসের বিল {{total}} টাকা বকেয়া আছে। দয়া করে পরিশোধ করুন। - {{company}}'),
    ('Payment Confirmation', 'payment_confirm', 'ধন্যবাদ {{name}}! আপনার {{amount}} টাকা পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে। - {{company}}');

  INSERT INTO settings (key, value) VALUES
    ('company_name', 'AVA Cable Network'),
    ('company_name_bn', 'এভা কেবল নেটওয়ার্ক'),
    ('company_address', ''),
    ('company_mobile', ''),
    ('company_logo', ''),
    ('invoice_prefix', 'INV'),
    ('bill_footer', 'পরিষেবার জন্য ধন্যবাদ'),
    ('currency', 'BDT'),
    ('language', 'bn'),
    ('theme', 'light'),
    ('late_fee', '0'),
    ('auto_billing', '1'),
    ('auto_backup', '1'),
    ('backup_dir', ''),
    ('session_timeout_min', '480'),
    ('customer_seq', '0'),
    ('invoice_seq', '0'),
    ('receipt_seq', '0'),
    ('purchase_seq', '0');
  `,

  `-- Version 2: package renewal — customer package validity date
  ALTER TABLE customers ADD COLUMN validity_till TEXT;
  CREATE INDEX idx_customers_validity ON customers(validity_till);
  `,

  `-- Version 3: login_history.user_id must allow NULL (failed logins with unknown
  -- usernames) and must survive user deletion.
  CREATE TABLE login_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT,
    login_at TEXT NOT NULL DEFAULT (datetime('now')),
    logout_at TEXT,
    success INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO login_history_new (id, user_id, username, login_at, logout_at, success)
    SELECT lh.id,
           CASE WHEN u.id IS NULL THEN NULL ELSE lh.user_id END,
           lh.username, lh.login_at, lh.logout_at, lh.success
    FROM login_history lh LEFT JOIN users u ON u.id = lh.user_id;
  DROP TABLE login_history;
  ALTER TABLE login_history_new RENAME TO login_history;
  `,

  `-- Version 4: per-user 7-day free trial (users.trial_ends).
  -- Existing users get a 7-day trial counted from this update;
  -- new users get 7 days from creation/approval. A purchased
  -- subscription (global sub_expire) always covers all users.
  ALTER TABLE users ADD COLUMN trial_ends TEXT;
  UPDATE users SET trial_ends = datetime('now', '+7 days');
  `,

  `-- Version 5: classic-menu pages — PPPoE users, message requests, payment withdraws
  CREATE TABLE pppoe_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT,
    customer_id INTEGER REFERENCES customers(id),
    mobile TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE message_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER REFERENCES resellers(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE payment_withdraws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER REFERENCES resellers(id),
    amount NUMERIC NOT NULL DEFAULT 0,
    method TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,

  `-- Version 6: reset the Collector role to a proper staff permission set
  -- (it previously had all permissions, making approved users admin-like).
  UPDATE roles SET permissions = '["dashboard","areas","customers","payments","collectors","cash_deposits","reports","messaging","complaints","packages","connections","messages","sms_templates","customer_documents"]'
    WHERE name = 'Collector' AND is_system = 1;
  `,

  `-- Version 7: RBAC hierarchy — SUPER_ADMIN > ADMIN > MANAGER > COLLECTOR
  -- 1) SUPER_ADMIN system role (only 'all' permission holder)
  INSERT INTO roles (name, permissions, is_system) VALUES ('SUPER_ADMIN', '["all"]', 1);
  -- 2) promote the existing seeded Administrator account to SUPER_ADMIN (credentials preserved)
  UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
    WHERE username = 'admin' AND role_id = (SELECT id FROM roles WHERE name = 'Administrator');
  -- 3) Administrator role = ADMIN: full operations + user management (Manager/Collector),
  --    but NOT 'security'/'settings' (SUPER_ADMIN-only) and NOT 'all'
  UPDATE roles SET permissions = '["dashboard","areas","customers","billing","payments","collectors","cash_deposits","reports","messaging","complaints","packages","connections","messages","sms_templates","customer_documents","staff","resellers","inventory","accounts","users"]'
    WHERE name = 'Administrator' AND is_system = 1;
  -- 4) account ownership tracking (who created the account — audit)
  ALTER TABLE users ADD COLUMN created_by TEXT;
  ALTER TABLE users ADD COLUMN owner_admin_id INTEGER REFERENCES users(id);
  UPDATE users SET created_by = 'admin' WHERE created_by IS NULL AND username != 'admin';
  `,

  `-- Version 8: dynamic per-user permissions + permission audit trail
  CREATE TABLE user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    can_delegate INTEGER NOT NULL DEFAULT 1,
    granted_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, permission_key)
  );
  CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
  CREATE TABLE permission_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    permission_key TEXT NOT NULL,
    action TEXT NOT NULL,            -- grant / revoke / delegate_on / delegate_off
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,

  `-- Version 9: collector ownership (Admin sees own collectors; NULL = company-wide)
  ALTER TABLE collectors ADD COLUMN owner_admin_id INTEGER REFERENCES users(id);
  `,

  `-- Version 10: product image + trusted purchase timestamp support
  ALTER TABLE products ADD COLUMN image TEXT;
  ALTER TABLE purchases ADD COLUMN created_local_time TEXT;
  `,

  `-- Version 11: expense auto date/time (Asia/Dhaka trusted timestamp)
  ALTER TABLE transactions ADD COLUMN created_local_time TEXT;
  `,

  `-- Version 12: collection history snapshots (due before/after per payment)
  ALTER TABLE payments ADD COLUMN due_before REAL;
  ALTER TABLE payments ADD COLUMN due_after REAL;
  ALTER TABLE payments ADD COLUMN created_local_time TEXT;
  `,

  `-- Version 13: company profile permission for Administrator (edit company name/mobile)
  UPDATE roles SET permissions = '["dashboard","areas","customers","billing","payments","collectors","cash_deposits","reports","messaging","complaints","packages","connections","messages","sms_templates","customer_documents","staff","resellers","inventory","accounts","users","company_profile"]'
    WHERE name = 'Administrator' AND is_system = 1;
  `,

  `-- Version 14: extended company profile keys (alternative mobile, email, logo)
  -- settings is a key/value table: setSetting() upserts (INSERT for new keys,
  -- UPDATE for existing) so company data persists across restarts, one row per key.
  -- OR IGNORE keeps this idempotent for databases that already have some keys.
  INSERT OR IGNORE INTO settings (key, value) VALUES ('company_mobile_alt', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('company_email', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('company_logo', '');
  `,

  `-- Version 15: area-wise customer serial numbers.
  -- Serial numbers are NOT globally unique — each area has its own sequence
  -- (Area A: 1-15, Area B: 1-25...). Uniqueness is only area_id + customer_serial.
  -- The global unique customer ID stays the existing customers.code (AVA-XXXXX).
  ALTER TABLE customers ADD COLUMN customer_serial INTEGER;
  CREATE INDEX idx_customers_area_serial ON customers(area_id, customer_serial);
  `
,
  `-- Version 16: connection type (paid/free) for customers.
  -- The New Connections form's Paid/Free dropdown writes here. Free connections
  -- always keep monthly_bill = 0 and connection_fee = 0 (enforced in the IPC
  -- create/update handlers), are skipped by monthly bill generation and are
  -- shown as Free in the customer list, profile, billing and reports.
  -- The old note column is NOT repurposed — existing note data stays untouched.
  ALTER TABLE customers ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'paid';
  CREATE INDEX idx_customers_conn_type ON customers(connection_type);
  `
,
  `-- Version 17: re-grant company_profile to the Administrator role.
  -- Security -> Roles edits could accidentally drop the company_profile key,
  -- which made Settings -> Company Profile unsaveable (PERMISSION_DENIED).
  -- This migration restores it (idempotent: skipped when already present).
  UPDATE roles SET permissions = substr(permissions, 1, length(permissions) - 1) || ', "company_profile"]'
    WHERE name = 'Administrator' AND permissions NOT LIKE '%company_profile%' AND length(permissions) > 2;
  UPDATE roles SET permissions = '["company_profile"]'
    WHERE name = 'Administrator' AND permissions NOT LIKE '%company_profile%' AND length(permissions) <= 2;
  `
,
  `-- Version 18: reminder month on messages (Due Reminders dedupe).
  -- messages:composeDue stores the billing month so repeated Generate clicks
  -- can UPDATE the existing draft reminder instead of duplicating rows, and
  -- 'sent' reminders keep their history (never re-spammed).
  ALTER TABLE messages ADD COLUMN month TEXT;
  CREATE INDEX idx_messages_type_month ON messages(type, month);
  `
,
  `-- Version 19: role descriptions (Role Management Add/Edit form).
  ALTER TABLE roles ADD COLUMN description TEXT;
  `,

  `-- Version 20: individual Collector Dashboard KPI overrides.
  -- Priority: individual override (this table) → role default (roles.permissions
  -- dashboard/dashboard.kpi.*) → deny. A row with allowed=0 DENIES a card even
  -- when the role grants it; allowed=1 grants it even when the role doesn't.
  -- No rows = pure role defaults. Cleared by "Reset to Role Defaults".
  CREATE TABLE collector_kpi_overrides (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kpi_key TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER,
    UNIQUE(user_id, kpi_key)
  );
  `,

  `-- Version 21: explicit user↔collector link.
  -- Identity resolution priority: collectors.user_id (set from
  -- Security → Users) → the legacy name match (users.full_name = staff.name)
  -- → no profile. Partial unique index: one account links to one collector.
  ALTER TABLE collectors ADD COLUMN user_id INTEGER REFERENCES users(id);
  CREATE UNIQUE INDEX idx_collectors_user ON collectors(user_id) WHERE user_id IS NOT NULL;
  `,

  `-- Version 22: customer-wise primary collector assignment.
  -- customers.collector_id = the collector assigned to collect this customer's
  -- bills (NULL = unassigned; a customer in a collector's assigned AREA is still
  -- covered by the legacy area rule when no explicit assignment exists).
  -- Reassign = update this column; remove = NULL; payment history keeps the
  -- original payments.collector_id of each receipt.
  ALTER TABLE customers ADD COLUMN collector_id INTEGER REFERENCES collectors(id);
  CREATE INDEX idx_customers_collector ON customers(collector_id);
  `
,
  `-- Version 23: backfill the explicit user↔collector link for existing data.
  -- 1) unique name match: an active Collector account whose full_name equals the
  --    Staff name of exactly one unlinked active collector.
  -- 2) single-collector bootstrap: exactly one unlinked active collector and
  --    exactly one unlinked active Collector account → link them (this is the
  --    common upgrade case where the account predates collectors.user_id).
  -- Never creates collector/staff rows and never links Admin/Manager accounts.
  UPDATE collectors
  SET user_id = (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'Collector' AND u.status = 'active'
      AND LOWER(TRIM(u.full_name)) = LOWER(TRIM((SELECT name FROM staff WHERE id = collectors.staff_id)))
      AND NOT EXISTS (SELECT 1 FROM collectors c2 WHERE c2.user_id = u.id)
    ORDER BY u.id LIMIT 1
  )
  WHERE user_id IS NULL
    AND status = 'active'
    AND (SELECT COUNT(*) FROM collectors c3
         WHERE c3.user_id IS NULL AND c3.status = 'active'
           AND LOWER(TRIM((SELECT name FROM staff WHERE id = c3.staff_id))) =
               LOWER(TRIM((SELECT name FROM staff WHERE id = collectors.staff_id)))) = 1
    AND (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'Collector' AND u.status = 'active'
           AND LOWER(TRIM(u.full_name)) = LOWER(TRIM((SELECT name FROM staff WHERE id = collectors.staff_id)))
           AND NOT EXISTS (SELECT 1 FROM collectors c2 WHERE c2.user_id = u.id)) = 1;

  UPDATE collectors
  SET user_id = (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'Collector' AND u.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM collectors c2 WHERE c2.user_id = u.id)
    ORDER BY u.id LIMIT 1
  )
  WHERE user_id IS NULL
    AND status = 'active'
    AND (SELECT COUNT(*) FROM collectors c3 WHERE c3.user_id IS NULL AND c3.status = 'active') = 1
    AND (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'Collector' AND u.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM collectors c2 WHERE c2.user_id = u.id)) = 1;
  `,
  `-- Version 25: SECURITY FIX — the reserved 'all' permission may exist ONLY on
  -- the SUPER_ADMIN role. hasPermission() treats 'all' as "everything" and
  -- isSuper() treats it as "is super admin", so any other role holding it (old
  -- seed data / hand-edited role JSON) silently became a SUPER_ADMIN. roles:save()
  -- already refuses to grant 'all' to a non-super role, so such rows are always
  -- stale data: strip the key and keep every other permission untouched.
  UPDATE roles
  SET permissions = COALESCE((
    SELECT json_group_array(value) FROM json_each(roles.permissions) WHERE value <> 'all'
  ), '[]')
  WHERE name <> 'SUPER_ADMIN'
    AND EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'all');
  `,
  `-- Version 26: Administrator = FULL access. The Administrator role now holds every
  -- permission key the app knows about (all catalog modules incl. security /
  -- settings / automation, the legacy modules and every generic-entity module), so
  -- an Administrator can do every job in the app. 'all' is still reserved for
  -- SUPER_ADMIN, and the SUPER_ADMIN account itself remains untouchable.
  UPDATE roles SET permissions = '${ALL_MODULE_KEYS_JSON}'
    WHERE name = 'Administrator' AND is_system = 1;
  `,
  `-- Version 27: impersonation audit trail (Super Admin “Login As User”).
  -- One row per impersonation session: who impersonated whom, when it started,
  -- when it ended, how long it lasted. No passwords/tokens are ever stored.
  CREATE TABLE IF NOT EXISTS impersonation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    super_admin_id INTEGER,
    super_admin_username TEXT NOT NULL,
    target_user_id INTEGER NOT NULL,
    target_username TEXT NOT NULL,
    target_role TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER,
    end_reason TEXT,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON impersonation_logs(target_user_id);
  CREATE INDEX IF NOT EXISTS idx_impersonation_logs_started ON impersonation_logs(started_at);
  `,
  `-- Version 28: SMS GATEWAY + PER-USER SMS WALLET (separate from money balances).
  -- All SMS accounting lives in the INSTALLATION database (primary), keyed by
  -- user_id, so a wallet follows the account and the Super Admin can audit every
  -- wallet. It is NEVER mixed with accounts.balance / transactions (BDT ledger).
  CREATE TABLE IF NOT EXISTS sms_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sms_count INTEGER NOT NULL CHECK (sms_count > 0),
    price REAL NOT NULL CHECK (price >= 0),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_wallets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    total_refunded INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES sms_packages(id) ON DELETE SET NULL,
    package_name TEXT NOT NULL,
    sms_count INTEGER NOT NULL CHECK (sms_count > 0),
    amount REAL NOT NULL CHECK (amount >= 0),
    method TEXT NOT NULL,
    trx_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    verified_by INTEGER REFERENCES users(id),
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(method, trx_id)
  );

  CREATE TABLE IF NOT EXISTS sms_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    sms_count INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reference TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sms_tx_user ON sms_transactions(user_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_sms_tx_type ON sms_transactions(type);

  CREATE TABLE IF NOT EXISTS sms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    sms_count INTEGER NOT NULL CHECK (sms_count > 0),
    provider TEXT,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT NOT NULL UNIQUE,
    wallet_txn_id INTEGER REFERENCES sms_transactions(id),
    refunded INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    delivered_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sms_messages_user ON sms_messages(user_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);

  CREATE TABLE IF NOT EXISTS sms_gateway_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider TEXT NOT NULL DEFAULT 'generic',
    gateway_url TEXT NOT NULL DEFAULT '',
    sender_id TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    refund_on_failed INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id)
  );
  INSERT OR IGNORE INTO sms_gateway_config (id) VALUES (1);

  -- Existing roles that already had SMS/messaging access also get the new
  -- 'sms' module key (wallet view/buy/send). Manager is included because the
  -- wallet is a standard staff feature. Super Admin grants further access from
  -- Security → Roles.
  UPDATE roles SET permissions = json_insert(permissions, '$[#]', 'sms')
    WHERE json_valid(permissions)
      AND (permissions LIKE '%"messaging"%' OR name = 'Manager')
      AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'sms');
  `,
  `-- Version 29: BulkSMSBD gateway metadata + delivery reports + low-balance alerts.
  -- Additive only: existing wallets/transactions/messages are preserved.
  ALTER TABLE sms_messages ADD COLUMN request_id TEXT;
  ALTER TABLE sms_messages ADD COLUMN gateway_response TEXT;
  ALTER TABLE sms_messages ADD COLUMN delivery_checked_at TEXT;
  ALTER TABLE sms_messages ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sms_gateway_config ADD COLUMN balance_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE sms_gateway_config ADD COLUMN dlr_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE sms_gateway_config ADD COLUMN low_balance_threshold INTEGER NOT NULL DEFAULT 20;
  -- Every existing account gets a real 0-SMS wallet row (never a fake credit).
  INSERT OR IGNORE INTO sms_wallets (user_id, balance) SELECT id, 0 FROM users;
  CREATE INDEX IF NOT EXISTS idx_sms_messages_request ON sms_messages(request_id);
  CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_id ON sms_messages(provider_message_id);
  `,
  `-- Version 30: provider-credit purchase history + guaranteed wallet rows.
  -- A provider purchase records real money/SMS bought from BulkSMSBD for the
  -- SHARED gateway account. It never changes any user's internal wallet; the
  -- Super Admin allocates wallet credits separately (audited adjustment).
  CREATE TABLE IF NOT EXISTS sms_provider_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    sms_count INTEGER NOT NULL CHECK (sms_count > 0),
    amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
    method TEXT NOT NULL DEFAULT 'bank',
    trx_id TEXT NOT NULL,
    note TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    purchased_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, method, trx_id)
  );
  CREATE INDEX IF NOT EXISTS idx_sms_provider_purchases_created ON sms_provider_purchases(id DESC);

  -- Every newly created account gets its own real (0 SMS) wallet row. Existing
  -- accounts were backfilled by version 29; this trigger closes the gap for all
  -- future users without any fake credit.
  CREATE TRIGGER IF NOT EXISTS trg_users_sms_wallet
  AFTER INSERT ON users
  BEGIN
    INSERT OR IGNORE INTO sms_wallets (user_id, balance) VALUES (NEW.id, 0);
  END;
  `,
  `-- Version 31: customer opening/previous due bill amount.
  -- This is the old dues a customer brought into the software. Existing NID
  -- data is preserved in the customers.nid column; this is a separate amount.
  ALTER TABLE customers ADD COLUMN previous_due_bill REAL NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS idx_customers_previous_due ON customers(previous_due_bill);
  `,
  `-- Version 32: default SMS plan catalogue (৳0.42 per SMS).
  -- Existing packages are preserved; these are inserted only once by name.
  INSERT OR IGNORE INTO sms_packages (name, sms_count, price, description, status)
  VALUES
    ('Starter 1,000 SMS', 1000, 420, '0.42 Taka per SMS', 'active'),
    ('Standard 5,000 SMS', 5000, 2100, '0.42 Taka per SMS', 'active'),
    ('Business 10,000 SMS', 10000, 4200, '0.42 Taka per SMS', 'active');
  `
]
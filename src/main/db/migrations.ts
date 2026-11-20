// Database schema. Applied in order, tracked by PRAGMA user_version.
// Version 1: initial schema
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
  `
]

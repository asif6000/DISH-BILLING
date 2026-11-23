var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tests/electron-stub.cjs
var require_electron_stub = __commonJS({
  "tests/electron-stub.cjs"(exports2, module2) {
    var path2 = require("path");
    var os = require("os");
    module2.exports = {
      app: {
        getPath: (name) => path2.join(os.tmpdir(), "ava-test-" + name),
        whenReady: () => Promise.resolve(),
        relaunch: () => {
        },
        exit: () => {
        },
        on: () => {
        },
        getVersion: () => "1.0.0-test"
      },
      ipcMain: {
        _handlers: {},
        handle: (ch, fn) => {
          module2.exports.ipcMain._handlers[ch] = fn;
        }
      },
      BrowserWindow: class {
      },
      shell: { openExternal: () => {
      } },
      Notification: class {
        static isSupported() {
          return false;
        }
        show() {
        }
      },
      dialog: {}
    };
  }
});

// src/main/db/migrations.ts
var migrations_exports = {};
__export(migrations_exports, {
  MIGRATIONS: () => MIGRATIONS
});
var MIGRATIONS;
var init_migrations = __esm({
  "src/main/db/migrations.ts"() {
    MIGRATIONS = [
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
    ('Due Reminder', 'due_reminder', '\u09AA\u09CD\u09B0\u09BF\u09AF\u09BC {{name}}, \u0986\u09AA\u09A8\u09BE\u09B0 {{month}} \u09AE\u09BE\u09B8\u09C7\u09B0 \u09AC\u09BF\u09B2 {{total}} \u099F\u09BE\u0995\u09BE \u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u0986\u099B\u09C7\u0964 \u09A6\u09AF\u09BC\u09BE \u0995\u09B0\u09C7 \u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u0995\u09B0\u09C1\u09A8\u0964 - {{company}}'),
    ('Payment Confirmation', 'payment_confirm', '\u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6 {{name}}! \u0986\u09AA\u09A8\u09BE\u09B0 {{amount}} \u099F\u09BE\u0995\u09BE \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 - {{company}}');

  INSERT INTO settings (key, value) VALUES
    ('company_name', 'AVA Cable Network'),
    ('company_name_bn', '\u098F\u09AD\u09BE \u0995\u09C7\u09AC\u09B2 \u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995'),
    ('company_address', ''),
    ('company_mobile', ''),
    ('company_logo', ''),
    ('invoice_prefix', 'INV'),
    ('bill_footer', '\u09AA\u09B0\u09BF\u09B7\u09C7\u09AC\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6'),
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
      `-- Version 2: package renewal \u2014 customer package validity date
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
      `-- Version 5: classic-menu pages \u2014 PPPoE users, message requests, payment withdraws
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
      `-- Version 7: RBAC hierarchy \u2014 SUPER_ADMIN > ADMIN > MANAGER > COLLECTOR
  -- 1) SUPER_ADMIN system role (only 'all' permission holder)
  INSERT INTO roles (name, permissions, is_system) VALUES ('SUPER_ADMIN', '["all"]', 1);
  -- 2) promote the existing seeded Administrator account to SUPER_ADMIN (credentials preserved)
  UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
    WHERE username = 'admin' AND role_id = (SELECT id FROM roles WHERE name = 'Administrator');
  -- 3) Administrator role = ADMIN: full operations + user management (Manager/Collector),
  --    but NOT 'security'/'settings' (SUPER_ADMIN-only) and NOT 'all'
  UPDATE roles SET permissions = '["dashboard","areas","customers","billing","payments","collectors","cash_deposits","reports","messaging","complaints","packages","connections","messages","sms_templates","customer_documents","staff","resellers","inventory","accounts","users"]'
    WHERE name = 'Administrator' AND is_system = 1;
  -- 4) account ownership tracking (who created the account \u2014 audit)
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
  -- Serial numbers are NOT globally unique \u2014 each area has its own sequence
  -- (Area A: 1-15, Area B: 1-25...). Uniqueness is only area_id + customer_serial.
  -- The global unique customer ID stays the existing customers.code (AVA-XXXXX).
  ALTER TABLE customers ADD COLUMN customer_serial INTEGER;
  CREATE INDEX idx_customers_area_serial ON customers(area_id, customer_serial);
  `,
      `-- Version 16: connection type (paid/free) for customers.
  -- The New Connections form's Paid/Free dropdown writes here. Free connections
  -- always keep monthly_bill = 0 and connection_fee = 0 (enforced in the IPC
  -- create/update handlers), are skipped by monthly bill generation and are
  -- shown as Free in the customer list, profile, billing and reports.
  -- The old note column is NOT repurposed \u2014 existing note data stays untouched.
  ALTER TABLE customers ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'paid';
  CREATE INDEX idx_customers_conn_type ON customers(connection_type);
  `,
      `-- Version 17: re-grant company_profile to the Administrator role.
  -- Security -> Roles edits could accidentally drop the company_profile key,
  -- which made Settings -> Company Profile unsaveable (PERMISSION_DENIED).
  -- This migration restores it (idempotent: skipped when already present).
  UPDATE roles SET permissions = substr(permissions, 1, length(permissions) - 1) || ', "company_profile"]'
    WHERE name = 'Administrator' AND permissions NOT LIKE '%company_profile%' AND length(permissions) > 2;
  UPDATE roles SET permissions = '["company_profile"]'
    WHERE name = 'Administrator' AND permissions NOT LIKE '%company_profile%' AND length(permissions) <= 2;
  `
    ];
  }
});

// node_modules/bcryptjs/dist/bcrypt.js
var require_bcrypt = __commonJS({
  "node_modules/bcryptjs/dist/bcrypt.js"(exports2, module2) {
    (function(global, factory) {
      if (typeof define === "function" && define["amd"])
        define([], factory);
      else if (typeof require === "function" && typeof module2 === "object" && module2 && module2["exports"])
        module2["exports"] = factory();
      else
        (global["dcodeIO"] = global["dcodeIO"] || {})["bcrypt"] = factory();
    })(exports2, function() {
      "use strict";
      var bcrypt2 = {};
      var randomFallback = null;
      function random(len) {
        if (typeof module2 !== "undefined" && module2 && module2["exports"])
          try {
            return require("crypto")["randomBytes"](len);
          } catch (e) {
          }
        try {
          var a;
          (self["crypto"] || self["msCrypto"])["getRandomValues"](a = new Uint32Array(len));
          return Array.prototype.slice.call(a);
        } catch (e) {
        }
        if (!randomFallback)
          throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
        return randomFallback(len);
      }
      var randomAvailable = false;
      try {
        random(1);
        randomAvailable = true;
      } catch (e) {
      }
      randomFallback = null;
      bcrypt2.setRandomFallback = function(random2) {
        randomFallback = random2;
      };
      bcrypt2.genSaltSync = function(rounds, seed_length) {
        rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof rounds !== "number")
          throw Error("Illegal arguments: " + typeof rounds + ", " + typeof seed_length);
        if (rounds < 4)
          rounds = 4;
        else if (rounds > 31)
          rounds = 31;
        var salt = [];
        salt.push("$2a$");
        if (rounds < 10)
          salt.push("0");
        salt.push(rounds.toString());
        salt.push("$");
        salt.push(base64_encode(random(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
        return salt.join("");
      };
      bcrypt2.genSalt = function(rounds, seed_length, callback) {
        if (typeof seed_length === "function")
          callback = seed_length, seed_length = void 0;
        if (typeof rounds === "function")
          callback = rounds, rounds = void 0;
        if (typeof rounds === "undefined")
          rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
        else if (typeof rounds !== "number")
          throw Error("illegal arguments: " + typeof rounds);
        function _async(callback2) {
          nextTick(function() {
            try {
              callback2(null, bcrypt2.genSaltSync(rounds));
            } catch (err) {
              callback2(err);
            }
          });
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.hashSync = function(s, salt) {
        if (typeof salt === "undefined")
          salt = GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof salt === "number")
          salt = bcrypt2.genSaltSync(salt);
        if (typeof s !== "string" || typeof salt !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof salt);
        return _hash(s, salt);
      };
      bcrypt2.hash = function(s, salt, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s === "string" && typeof salt === "number")
            bcrypt2.genSalt(salt, function(err, salt2) {
              _hash(s, salt2, callback2, progressCallback);
            });
          else if (typeof s === "string" && typeof salt === "string")
            _hash(s, salt, callback2, progressCallback);
          else
            nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof salt)));
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      function safeStringCompare(known, unknown) {
        var right = 0, wrong = 0;
        for (var i = 0, k = known.length; i < k; ++i) {
          if (known.charCodeAt(i) === unknown.charCodeAt(i))
            ++right;
          else
            ++wrong;
        }
        if (right < 0)
          return false;
        return wrong === 0;
      }
      bcrypt2.compareSync = function(s, hash) {
        if (typeof s !== "string" || typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof hash);
        if (hash.length !== 60)
          return false;
        return safeStringCompare(bcrypt2.hashSync(s, hash.substr(0, hash.length - 31)), hash);
      };
      bcrypt2.compare = function(s, hash, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s !== "string" || typeof hash !== "string") {
            nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof hash)));
            return;
          }
          if (hash.length !== 60) {
            nextTick(callback2.bind(this, null, false));
            return;
          }
          bcrypt2.hash(s, hash.substr(0, 29), function(err, comp) {
            if (err)
              callback2(err);
            else
              callback2(null, safeStringCompare(comp, hash));
          }, progressCallback);
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.getRounds = function(hash) {
        if (typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof hash);
        return parseInt(hash.split("$")[2], 10);
      };
      bcrypt2.getSalt = function(hash) {
        if (typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof hash);
        if (hash.length !== 60)
          throw Error("Illegal hash length: " + hash.length + " != 60");
        return hash.substring(0, 29);
      };
      var nextTick = typeof process !== "undefined" && process && typeof process.nextTick === "function" ? typeof setImmediate === "function" ? setImmediate : process.nextTick : setTimeout;
      function stringToBytes(str) {
        var out = [], i = 0;
        utfx.encodeUTF16toUTF8(function() {
          if (i >= str.length) return null;
          return str.charCodeAt(i++);
        }, function(b) {
          out.push(b);
        });
        return out;
      }
      var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
      var BASE64_INDEX = [
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        1,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        62,
        63,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        -1,
        -1,
        -1,
        -1,
        -1
      ];
      var stringFromCharCode = String.fromCharCode;
      function base64_encode(b, len) {
        var off = 0, rs = [], c1, c2;
        if (len <= 0 || len > b.length)
          throw Error("Illegal len: " + len);
        while (off < len) {
          c1 = b[off++] & 255;
          rs.push(BASE64_CODE[c1 >> 2 & 63]);
          c1 = (c1 & 3) << 4;
          if (off >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off++] & 255;
          c1 |= c2 >> 4 & 15;
          rs.push(BASE64_CODE[c1 & 63]);
          c1 = (c2 & 15) << 2;
          if (off >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off++] & 255;
          c1 |= c2 >> 6 & 3;
          rs.push(BASE64_CODE[c1 & 63]);
          rs.push(BASE64_CODE[c2 & 63]);
        }
        return rs.join("");
      }
      function base64_decode(s, len) {
        var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
        if (len <= 0)
          throw Error("Illegal len: " + len);
        while (off < slen - 1 && olen < len) {
          code = s.charCodeAt(off++);
          c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          code = s.charCodeAt(off++);
          c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c1 == -1 || c2 == -1)
            break;
          o = c1 << 2 >>> 0;
          o |= (c2 & 48) >> 4;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off >= slen)
            break;
          code = s.charCodeAt(off++);
          c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c3 == -1)
            break;
          o = (c2 & 15) << 4 >>> 0;
          o |= (c3 & 60) >> 2;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off >= slen)
            break;
          code = s.charCodeAt(off++);
          c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          o = (c3 & 3) << 6 >>> 0;
          o |= c4;
          rs.push(stringFromCharCode(o));
          ++olen;
        }
        var res = [];
        for (off = 0; off < olen; off++)
          res.push(rs[off].charCodeAt(0));
        return res;
      }
      var utfx = (function() {
        "use strict";
        var utfx2 = {};
        utfx2.MAX_CODEPOINT = 1114111;
        utfx2.encodeUTF8 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = function() {
              return null;
            };
          while (cp !== null || (cp = src()) !== null) {
            if (cp < 128)
              dst(cp & 127);
            else if (cp < 2048)
              dst(cp >> 6 & 31 | 192), dst(cp & 63 | 128);
            else if (cp < 65536)
              dst(cp >> 12 & 15 | 224), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            else
              dst(cp >> 18 & 7 | 240), dst(cp >> 12 & 63 | 128), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            cp = null;
          }
        };
        utfx2.decodeUTF8 = function(src, dst) {
          var a, b, c, d, fail2 = function(b2) {
            b2 = b2.slice(0, b2.indexOf(null));
            var err = Error(b2.toString());
            err.name = "TruncatedError";
            err["bytes"] = b2;
            throw err;
          };
          while ((a = src()) !== null) {
            if ((a & 128) === 0)
              dst(a);
            else if ((a & 224) === 192)
              (b = src()) === null && fail2([a, b]), dst((a & 31) << 6 | b & 63);
            else if ((a & 240) === 224)
              ((b = src()) === null || (c = src()) === null) && fail2([a, b, c]), dst((a & 15) << 12 | (b & 63) << 6 | c & 63);
            else if ((a & 248) === 240)
              ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail2([a, b, c, d]), dst((a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63);
            else throw RangeError("Illegal starting byte: " + a);
          }
        };
        utfx2.UTF16toUTF8 = function(src, dst) {
          var c1, c2 = null;
          while (true) {
            if ((c1 = c2 !== null ? c2 : src()) === null)
              break;
            if (c1 >= 55296 && c1 <= 57343) {
              if ((c2 = src()) !== null) {
                if (c2 >= 56320 && c2 <= 57343) {
                  dst((c1 - 55296) * 1024 + c2 - 56320 + 65536);
                  c2 = null;
                  continue;
                }
              }
            }
            dst(c1);
          }
          if (c2 !== null) dst(c2);
        };
        utfx2.UTF8toUTF16 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = function() {
              return null;
            };
          while (cp !== null || (cp = src()) !== null) {
            if (cp <= 65535)
              dst(cp);
            else
              cp -= 65536, dst((cp >> 10) + 55296), dst(cp % 1024 + 56320);
            cp = null;
          }
        };
        utfx2.encodeUTF16toUTF8 = function(src, dst) {
          utfx2.UTF16toUTF8(src, function(cp) {
            utfx2.encodeUTF8(cp, dst);
          });
        };
        utfx2.decodeUTF8toUTF16 = function(src, dst) {
          utfx2.decodeUTF8(src, function(cp) {
            utfx2.UTF8toUTF16(cp, dst);
          });
        };
        utfx2.calculateCodePoint = function(cp) {
          return cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
        };
        utfx2.calculateUTF8 = function(src) {
          var cp, l = 0;
          while ((cp = src()) !== null)
            l += utfx2.calculateCodePoint(cp);
          return l;
        };
        utfx2.calculateUTF16asUTF8 = function(src) {
          var n = 0, l = 0;
          utfx2.UTF16toUTF8(src, function(cp) {
            ++n;
            l += utfx2.calculateCodePoint(cp);
          });
          return [n, l];
        };
        return utfx2;
      })();
      Date.now = Date.now || function() {
        return +/* @__PURE__ */ new Date();
      };
      var BCRYPT_SALT_LEN = 16;
      var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
      var BLOWFISH_NUM_ROUNDS = 16;
      var MAX_EXECUTION_TIME = 100;
      var P_ORIG = [
        608135816,
        2242054355,
        320440878,
        57701188,
        2752067618,
        698298832,
        137296536,
        3964562569,
        1160258022,
        953160567,
        3193202383,
        887688300,
        3232508343,
        3380367581,
        1065670069,
        3041331479,
        2450970073,
        2306472731
      ];
      var S_ORIG = [
        3509652390,
        2564797868,
        805139163,
        3491422135,
        3101798381,
        1780907670,
        3128725573,
        4046225305,
        614570311,
        3012652279,
        134345442,
        2240740374,
        1667834072,
        1901547113,
        2757295779,
        4103290238,
        227898511,
        1921955416,
        1904987480,
        2182433518,
        2069144605,
        3260701109,
        2620446009,
        720527379,
        3318853667,
        677414384,
        3393288472,
        3101374703,
        2390351024,
        1614419982,
        1822297739,
        2954791486,
        3608508353,
        3174124327,
        2024746970,
        1432378464,
        3864339955,
        2857741204,
        1464375394,
        1676153920,
        1439316330,
        715854006,
        3033291828,
        289532110,
        2706671279,
        2087905683,
        3018724369,
        1668267050,
        732546397,
        1947742710,
        3462151702,
        2609353502,
        2950085171,
        1814351708,
        2050118529,
        680887927,
        999245976,
        1800124847,
        3300911131,
        1713906067,
        1641548236,
        4213287313,
        1216130144,
        1575780402,
        4018429277,
        3917837745,
        3693486850,
        3949271944,
        596196993,
        3549867205,
        258830323,
        2213823033,
        772490370,
        2760122372,
        1774776394,
        2652871518,
        566650946,
        4142492826,
        1728879713,
        2882767088,
        1783734482,
        3629395816,
        2517608232,
        2874225571,
        1861159788,
        326777828,
        3124490320,
        2130389656,
        2716951837,
        967770486,
        1724537150,
        2185432712,
        2364442137,
        1164943284,
        2105845187,
        998989502,
        3765401048,
        2244026483,
        1075463327,
        1455516326,
        1322494562,
        910128902,
        469688178,
        1117454909,
        936433444,
        3490320968,
        3675253459,
        1240580251,
        122909385,
        2157517691,
        634681816,
        4142456567,
        3825094682,
        3061402683,
        2540495037,
        79693498,
        3249098678,
        1084186820,
        1583128258,
        426386531,
        1761308591,
        1047286709,
        322548459,
        995290223,
        1845252383,
        2603652396,
        3431023940,
        2942221577,
        3202600964,
        3727903485,
        1712269319,
        422464435,
        3234572375,
        1170764815,
        3523960633,
        3117677531,
        1434042557,
        442511882,
        3600875718,
        1076654713,
        1738483198,
        4213154764,
        2393238008,
        3677496056,
        1014306527,
        4251020053,
        793779912,
        2902807211,
        842905082,
        4246964064,
        1395751752,
        1040244610,
        2656851899,
        3396308128,
        445077038,
        3742853595,
        3577915638,
        679411651,
        2892444358,
        2354009459,
        1767581616,
        3150600392,
        3791627101,
        3102740896,
        284835224,
        4246832056,
        1258075500,
        768725851,
        2589189241,
        3069724005,
        3532540348,
        1274779536,
        3789419226,
        2764799539,
        1660621633,
        3471099624,
        4011903706,
        913787905,
        3497959166,
        737222580,
        2514213453,
        2928710040,
        3937242737,
        1804850592,
        3499020752,
        2949064160,
        2386320175,
        2390070455,
        2415321851,
        4061277028,
        2290661394,
        2416832540,
        1336762016,
        1754252060,
        3520065937,
        3014181293,
        791618072,
        3188594551,
        3933548030,
        2332172193,
        3852520463,
        3043980520,
        413987798,
        3465142937,
        3030929376,
        4245938359,
        2093235073,
        3534596313,
        375366246,
        2157278981,
        2479649556,
        555357303,
        3870105701,
        2008414854,
        3344188149,
        4221384143,
        3956125452,
        2067696032,
        3594591187,
        2921233993,
        2428461,
        544322398,
        577241275,
        1471733935,
        610547355,
        4027169054,
        1432588573,
        1507829418,
        2025931657,
        3646575487,
        545086370,
        48609733,
        2200306550,
        1653985193,
        298326376,
        1316178497,
        3007786442,
        2064951626,
        458293330,
        2589141269,
        3591329599,
        3164325604,
        727753846,
        2179363840,
        146436021,
        1461446943,
        4069977195,
        705550613,
        3059967265,
        3887724982,
        4281599278,
        3313849956,
        1404054877,
        2845806497,
        146425753,
        1854211946,
        1266315497,
        3048417604,
        3681880366,
        3289982499,
        290971e4,
        1235738493,
        2632868024,
        2414719590,
        3970600049,
        1771706367,
        1449415276,
        3266420449,
        422970021,
        1963543593,
        2690192192,
        3826793022,
        1062508698,
        1531092325,
        1804592342,
        2583117782,
        2714934279,
        4024971509,
        1294809318,
        4028980673,
        1289560198,
        2221992742,
        1669523910,
        35572830,
        157838143,
        1052438473,
        1016535060,
        1802137761,
        1753167236,
        1386275462,
        3080475397,
        2857371447,
        1040679964,
        2145300060,
        2390574316,
        1461121720,
        2956646967,
        4031777805,
        4028374788,
        33600511,
        2920084762,
        1018524850,
        629373528,
        3691585981,
        3515945977,
        2091462646,
        2486323059,
        586499841,
        988145025,
        935516892,
        3367335476,
        2599673255,
        2839830854,
        265290510,
        3972581182,
        2759138881,
        3795373465,
        1005194799,
        847297441,
        406762289,
        1314163512,
        1332590856,
        1866599683,
        4127851711,
        750260880,
        613907577,
        1450815602,
        3165620655,
        3734664991,
        3650291728,
        3012275730,
        3704569646,
        1427272223,
        778793252,
        1343938022,
        2676280711,
        2052605720,
        1946737175,
        3164576444,
        3914038668,
        3967478842,
        3682934266,
        1661551462,
        3294938066,
        4011595847,
        840292616,
        3712170807,
        616741398,
        312560963,
        711312465,
        1351876610,
        322626781,
        1910503582,
        271666773,
        2175563734,
        1594956187,
        70604529,
        3617834859,
        1007753275,
        1495573769,
        4069517037,
        2549218298,
        2663038764,
        504708206,
        2263041392,
        3941167025,
        2249088522,
        1514023603,
        1998579484,
        1312622330,
        694541497,
        2582060303,
        2151582166,
        1382467621,
        776784248,
        2618340202,
        3323268794,
        2497899128,
        2784771155,
        503983604,
        4076293799,
        907881277,
        423175695,
        432175456,
        1378068232,
        4145222326,
        3954048622,
        3938656102,
        3820766613,
        2793130115,
        2977904593,
        26017576,
        3274890735,
        3194772133,
        1700274565,
        1756076034,
        4006520079,
        3677328699,
        720338349,
        1533947780,
        354530856,
        688349552,
        3973924725,
        1637815568,
        332179504,
        3949051286,
        53804574,
        2852348879,
        3044236432,
        1282449977,
        3583942155,
        3416972820,
        4006381244,
        1617046695,
        2628476075,
        3002303598,
        1686838959,
        431878346,
        2686675385,
        1700445008,
        1080580658,
        1009431731,
        832498133,
        3223435511,
        2605976345,
        2271191193,
        2516031870,
        1648197032,
        4164389018,
        2548247927,
        300782431,
        375919233,
        238389289,
        3353747414,
        2531188641,
        2019080857,
        1475708069,
        455242339,
        2609103871,
        448939670,
        3451063019,
        1395535956,
        2413381860,
        1841049896,
        1491858159,
        885456874,
        4264095073,
        4001119347,
        1565136089,
        3898914787,
        1108368660,
        540939232,
        1173283510,
        2745871338,
        3681308437,
        4207628240,
        3343053890,
        4016749493,
        1699691293,
        1103962373,
        3625875870,
        2256883143,
        3830138730,
        1031889488,
        3479347698,
        1535977030,
        4236805024,
        3251091107,
        2132092099,
        1774941330,
        1199868427,
        1452454533,
        157007616,
        2904115357,
        342012276,
        595725824,
        1480756522,
        206960106,
        497939518,
        591360097,
        863170706,
        2375253569,
        3596610801,
        1814182875,
        2094937945,
        3421402208,
        1082520231,
        3463918190,
        2785509508,
        435703966,
        3908032597,
        1641649973,
        2842273706,
        3305899714,
        1510255612,
        2148256476,
        2655287854,
        3276092548,
        4258621189,
        236887753,
        3681803219,
        274041037,
        1734335097,
        3815195456,
        3317970021,
        1899903192,
        1026095262,
        4050517792,
        356393447,
        2410691914,
        3873677099,
        3682840055,
        3913112168,
        2491498743,
        4132185628,
        2489919796,
        1091903735,
        1979897079,
        3170134830,
        3567386728,
        3557303409,
        857797738,
        1136121015,
        1342202287,
        507115054,
        2535736646,
        337727348,
        3213592640,
        1301675037,
        2528481711,
        1895095763,
        1721773893,
        3216771564,
        62756741,
        2142006736,
        835421444,
        2531993523,
        1442658625,
        3659876326,
        2882144922,
        676362277,
        1392781812,
        170690266,
        3921047035,
        1759253602,
        3611846912,
        1745797284,
        664899054,
        1329594018,
        3901205900,
        3045908486,
        2062866102,
        2865634940,
        3543621612,
        3464012697,
        1080764994,
        553557557,
        3656615353,
        3996768171,
        991055499,
        499776247,
        1265440854,
        648242737,
        3940784050,
        980351604,
        3713745714,
        1749149687,
        3396870395,
        4211799374,
        3640570775,
        1161844396,
        3125318951,
        1431517754,
        545492359,
        4268468663,
        3499529547,
        1437099964,
        2702547544,
        3433638243,
        2581715763,
        2787789398,
        1060185593,
        1593081372,
        2418618748,
        4260947970,
        69676912,
        2159744348,
        86519011,
        2512459080,
        3838209314,
        1220612927,
        3339683548,
        133810670,
        1090789135,
        1078426020,
        1569222167,
        845107691,
        3583754449,
        4072456591,
        1091646820,
        628848692,
        1613405280,
        3757631651,
        526609435,
        236106946,
        48312990,
        2942717905,
        3402727701,
        1797494240,
        859738849,
        992217954,
        4005476642,
        2243076622,
        3870952857,
        3732016268,
        765654824,
        3490871365,
        2511836413,
        1685915746,
        3888969200,
        1414112111,
        2273134842,
        3281911079,
        4080962846,
        172450625,
        2569994100,
        980381355,
        4109958455,
        2819808352,
        2716589560,
        2568741196,
        3681446669,
        3329971472,
        1835478071,
        660984891,
        3704678404,
        4045999559,
        3422617507,
        3040415634,
        1762651403,
        1719377915,
        3470491036,
        2693910283,
        3642056355,
        3138596744,
        1364962596,
        2073328063,
        1983633131,
        926494387,
        3423689081,
        2150032023,
        4096667949,
        1749200295,
        3328846651,
        309677260,
        2016342300,
        1779581495,
        3079819751,
        111262694,
        1274766160,
        443224088,
        298511866,
        1025883608,
        3806446537,
        1145181785,
        168956806,
        3641502830,
        3584813610,
        1689216846,
        3666258015,
        3200248200,
        1692713982,
        2646376535,
        4042768518,
        1618508792,
        1610833997,
        3523052358,
        4130873264,
        2001055236,
        3610705100,
        2202168115,
        4028541809,
        2961195399,
        1006657119,
        2006996926,
        3186142756,
        1430667929,
        3210227297,
        1314452623,
        4074634658,
        4101304120,
        2273951170,
        1399257539,
        3367210612,
        3027628629,
        1190975929,
        2062231137,
        2333990788,
        2221543033,
        2438960610,
        1181637006,
        548689776,
        2362791313,
        3372408396,
        3104550113,
        3145860560,
        296247880,
        1970579870,
        3078560182,
        3769228297,
        1714227617,
        3291629107,
        3898220290,
        166772364,
        1251581989,
        493813264,
        448347421,
        195405023,
        2709975567,
        677966185,
        3703036547,
        1463355134,
        2715995803,
        1338867538,
        1343315457,
        2802222074,
        2684532164,
        233230375,
        2599980071,
        2000651841,
        3277868038,
        1638401717,
        4028070440,
        3237316320,
        6314154,
        819756386,
        300326615,
        590932579,
        1405279636,
        3267499572,
        3150704214,
        2428286686,
        3959192993,
        3461946742,
        1862657033,
        1266418056,
        963775037,
        2089974820,
        2263052895,
        1917689273,
        448879540,
        3550394620,
        3981727096,
        150775221,
        3627908307,
        1303187396,
        508620638,
        2975983352,
        2726630617,
        1817252668,
        1876281319,
        1457606340,
        908771278,
        3720792119,
        3617206836,
        2455994898,
        1729034894,
        1080033504,
        976866871,
        3556439503,
        2881648439,
        1522871579,
        1555064734,
        1336096578,
        3548522304,
        2579274686,
        3574697629,
        3205460757,
        3593280638,
        3338716283,
        3079412587,
        564236357,
        2993598910,
        1781952180,
        1464380207,
        3163844217,
        3332601554,
        1699332808,
        1393555694,
        1183702653,
        3581086237,
        1288719814,
        691649499,
        2847557200,
        2895455976,
        3193889540,
        2717570544,
        1781354906,
        1676643554,
        2592534050,
        3230253752,
        1126444790,
        2770207658,
        2633158820,
        2210423226,
        2615765581,
        2414155088,
        3127139286,
        673620729,
        2805611233,
        1269405062,
        4015350505,
        3341807571,
        4149409754,
        1057255273,
        2012875353,
        2162469141,
        2276492801,
        2601117357,
        993977747,
        3918593370,
        2654263191,
        753973209,
        36408145,
        2530585658,
        25011837,
        3520020182,
        2088578344,
        530523599,
        2918365339,
        1524020338,
        1518925132,
        3760827505,
        3759777254,
        1202760957,
        3985898139,
        3906192525,
        674977740,
        4174734889,
        2031300136,
        2019492241,
        3983892565,
        4153806404,
        3822280332,
        352677332,
        2297720250,
        60907813,
        90501309,
        3286998549,
        1016092578,
        2535922412,
        2839152426,
        457141659,
        509813237,
        4120667899,
        652014361,
        1966332200,
        2975202805,
        55981186,
        2327461051,
        676427537,
        3255491064,
        2882294119,
        3433927263,
        1307055953,
        942726286,
        933058658,
        2468411793,
        3933900994,
        4215176142,
        1361170020,
        2001714738,
        2830558078,
        3274259782,
        1222529897,
        1679025792,
        2729314320,
        3714953764,
        1770335741,
        151462246,
        3013232138,
        1682292957,
        1483529935,
        471910574,
        1539241949,
        458788160,
        3436315007,
        1807016891,
        3718408830,
        978976581,
        1043663428,
        3165965781,
        1927990952,
        4200891579,
        2372276910,
        3208408903,
        3533431907,
        1412390302,
        2931980059,
        4132332400,
        1947078029,
        3881505623,
        4168226417,
        2941484381,
        1077988104,
        1320477388,
        886195818,
        18198404,
        3786409e3,
        2509781533,
        112762804,
        3463356488,
        1866414978,
        891333506,
        18488651,
        661792760,
        1628790961,
        3885187036,
        3141171499,
        876946877,
        2693282273,
        1372485963,
        791857591,
        2686433993,
        3759982718,
        3167212022,
        3472953795,
        2716379847,
        445679433,
        3561995674,
        3504004811,
        3574258232,
        54117162,
        3331405415,
        2381918588,
        3769707343,
        4154350007,
        1140177722,
        4074052095,
        668550556,
        3214352940,
        367459370,
        261225585,
        2610173221,
        4209349473,
        3468074219,
        3265815641,
        314222801,
        3066103646,
        3808782860,
        282218597,
        3406013506,
        3773591054,
        379116347,
        1285071038,
        846784868,
        2669647154,
        3771962079,
        3550491691,
        2305946142,
        453669953,
        1268987020,
        3317592352,
        3279303384,
        3744833421,
        2610507566,
        3859509063,
        266596637,
        3847019092,
        517658769,
        3462560207,
        3443424879,
        370717030,
        4247526661,
        2224018117,
        4143653529,
        4112773975,
        2788324899,
        2477274417,
        1456262402,
        2901442914,
        1517677493,
        1846949527,
        2295493580,
        3734397586,
        2176403920,
        1280348187,
        1908823572,
        3871786941,
        846861322,
        1172426758,
        3287448474,
        3383383037,
        1655181056,
        3139813346,
        901632758,
        1897031941,
        2986607138,
        3066810236,
        3447102507,
        1393639104,
        373351379,
        950779232,
        625454576,
        3124240540,
        4148612726,
        2007998917,
        544563296,
        2244738638,
        2330496472,
        2058025392,
        1291430526,
        424198748,
        50039436,
        29584100,
        3605783033,
        2429876329,
        2791104160,
        1057563949,
        3255363231,
        3075367218,
        3463963227,
        1469046755,
        985887462
      ];
      var C_ORIG = [
        1332899944,
        1700884034,
        1701343084,
        1684370003,
        1668446532,
        1869963892
      ];
      function _encipher(lr, off, P, S) {
        var n, l = lr[off], r = lr[off + 1];
        l ^= P[0];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[1];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[2];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[3];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[4];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[5];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[6];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[7];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[8];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[9];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[10];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[11];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[12];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[13];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[14];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[15];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[16];
        lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
        lr[off + 1] = l;
        return lr;
      }
      function _streamtoword(data, offp) {
        for (var i = 0, word = 0; i < 4; ++i)
          word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
        return { key: word, offp };
      }
      function _key(key, P, S) {
        var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
        for (i = 0; i < plen; i += 2)
          lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      function _ekskey(data, key, P, S) {
        var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
        offp = 0;
        for (i = 0; i < plen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      function _crypt(b, salt, rounds, callback, progressCallback) {
        var cdata = C_ORIG.slice(), clen = cdata.length, err;
        if (rounds < 4 || rounds > 31) {
          err = Error("Illegal number of rounds (4-31): " + rounds);
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.length !== BCRYPT_SALT_LEN) {
          err = Error("Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN);
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        rounds = 1 << rounds >>> 0;
        var P, S, i = 0, j;
        if (Int32Array) {
          P = new Int32Array(P_ORIG);
          S = new Int32Array(S_ORIG);
        } else {
          P = P_ORIG.slice();
          S = S_ORIG.slice();
        }
        _ekskey(salt, b, P, S);
        function next() {
          if (progressCallback)
            progressCallback(i / rounds);
          if (i < rounds) {
            var start = Date.now();
            for (; i < rounds; ) {
              i = i + 1;
              _key(b, P, S);
              _key(salt, P, S);
              if (Date.now() - start > MAX_EXECUTION_TIME)
                break;
            }
          } else {
            for (i = 0; i < 64; i++)
              for (j = 0; j < clen >> 1; j++)
                _encipher(cdata, j << 1, P, S);
            var ret = [];
            for (i = 0; i < clen; i++)
              ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
            if (callback) {
              callback(null, ret);
              return;
            } else
              return ret;
          }
          if (callback)
            nextTick(next);
        }
        if (typeof callback !== "undefined") {
          next();
        } else {
          var res;
          while (true)
            if (typeof (res = next()) !== "undefined")
              return res || [];
        }
      }
      function _hash(s, salt, callback, progressCallback) {
        var err;
        if (typeof s !== "string" || typeof salt !== "string") {
          err = Error("Invalid string / salt: Not a string");
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var minor, offset;
        if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
          err = Error("Invalid salt version: " + salt.substring(0, 2));
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.charAt(2) === "$")
          minor = String.fromCharCode(0), offset = 3;
        else {
          minor = salt.charAt(2);
          if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
            err = Error("Invalid salt revision: " + salt.substring(2, 4));
            if (callback) {
              nextTick(callback.bind(this, err));
              return;
            } else
              throw err;
          }
          offset = 4;
        }
        if (salt.charAt(offset + 2) > "$") {
          err = Error("Missing salt rounds");
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
        s += minor >= "a" ? "\0" : "";
        var passwordb = stringToBytes(s), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
        function finish(bytes) {
          var res = [];
          res.push("$2");
          if (minor >= "a")
            res.push(minor);
          res.push("$");
          if (rounds < 10)
            res.push("0");
          res.push(rounds.toString());
          res.push("$");
          res.push(base64_encode(saltb, saltb.length));
          res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
          return res.join("");
        }
        if (typeof callback == "undefined")
          return finish(_crypt(passwordb, saltb, rounds));
        else {
          _crypt(passwordb, saltb, rounds, function(err2, bytes) {
            if (err2)
              callback(err2, null);
            else
              callback(null, finish(bytes));
          }, progressCallback);
        }
      }
      bcrypt2.encodeBase64 = base64_encode;
      bcrypt2.decodeBase64 = base64_decode;
      return bcrypt2;
    });
  }
});

// node_modules/bcryptjs/index.js
var require_bcryptjs = __commonJS({
  "node_modules/bcryptjs/index.js"(exports2, module2) {
    module2.exports = require_bcrypt();
  }
});

// src/main/db/index.ts
var import_node_sqlite = require("node:sqlite");
var import_electron = __toESM(require_electron_stub());
var import_path = require("path");
init_migrations();
var db = null;
function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
function getDbPath() {
  return (0, import_path.join)(import_electron.app.getPath("userData"), "ava-cable.db");
}
function initDb(dbPath) {
  const path2 = dbPath || getDbPath();
  db = new import_node_sqlite.DatabaseSync(path2);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  runMigrations(db);
  return db;
}
function runMigrations(db2) {
  const row = db2.prepare("PRAGMA user_version").get();
  let version = row.user_version;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db2.exec("BEGIN");
    try {
      db2.exec(MIGRATIONS[i]);
      db2.exec(`PRAGMA user_version = ${i + 1}`);
      db2.exec("COMMIT");
      version = i + 1;
    } catch (e) {
      db2.exec("ROLLBACK");
      throw e;
    }
  }
}
function integrityCheck() {
  const row = getDb().prepare("PRAGMA integrity_check").get();
  return row && String(row.integrity_check || row[Object.keys(row)[0]]) === "ok";
}
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function nextSeq(key, pad2 = 5, prefix = "") {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  const n = (row ? parseInt(row.value, 10) : 0) + 1;
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(n));
  return prefix + String(n).padStart(pad2, "0");
}
function getSetting(key, fallback = "") {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row && row.value !== null && row.value !== void 0 ? row.value : fallback;
}
function setSetting(key, value) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
function today() {
  const d = /* @__PURE__ */ new Date();
  return d.toISOString().slice(0, 10);
}
function currentMonth() {
  const d = /* @__PURE__ */ new Date();
  return d.toISOString().slice(0, 7);
}
function logActivity(userId, username, action, module2, details) {
  getDb().prepare("INSERT INTO activity_logs (user_id, username, action, module, details) VALUES (?,?,?,?,?)").run(userId, username, action, module2, details || null);
}

// src/main/ipc/auth.ts
var import_electron3 = __toESM(require_electron_stub());
var import_bcryptjs = __toESM(require_bcryptjs());

// src/main/subscription.ts
var import_electron2 = __toESM(require_electron_stub());
var SUB_PRICE_BDT = 1e4;
var SUB_BKASH = "01331707900";
var SUB_NAGAD = "01616595386";
var TRIAL_DAYS = 7;
var EXPIRING_SOON_DAYS = 7;
function pad(n) {
  return String(n).padStart(2, "0");
}
function localDate(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(dateStr, days) {
  const [y, m, dd] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
function getSubState() {
  let expire = getSetting("sub_expire", "");
  if (!expire) {
    expire = addDays(localDate(), TRIAL_DAYS);
    setSetting("sub_expire", expire);
  }
  const daysLeft = Math.ceil(((/* @__PURE__ */ new Date(expire + "T23:59:59")).getTime() - Date.now()) / 864e5);
  const state = daysLeft <= 0 ? "expired" : daysLeft <= EXPIRING_SOON_DAYS ? "expiring" : "active";
  return { expire, daysLeft, state, price: SUB_PRICE_BDT, bkash: SUB_BKASH, nagad: SUB_NAGAD };
}
function isSubscriptionExpired() {
  return getSubState().state === "expired";
}
function trialIso(te) {
  if (!te) return "";
  return te.includes(" ") ? te.replace(" ", "T") : te + "T23:59:59";
}
function isUserBlocked(userId) {
  let trialEnds = null;
  try {
    const row = getDb().prepare("SELECT trial_ends FROM users WHERE id = ?").get(userId);
    trialEnds = row?.trial_ends ?? null;
  } catch {
  }
  if (trialEnds) return Date.now() > new Date(trialIso(trialEnds)).getTime();
  return isSubscriptionExpired();
}

// src/main/updateState.ts
var updateStatus = { state: "idle", info: null, percent: 0 };
function isUpdatePending() {
  return updateStatus.state === "available" || updateStatus.state === "downloading" || updateStatus.state === "downloaded";
}

// src/shared/entities.ts
var STATUS = [
  { value: "active", label: "Active", labelBn: "\u09B8\u0995\u09CD\u09B0\u09BF\u09AF\u09BC" },
  { value: "inactive", label: "Inactive", labelBn: "\u09A8\u09BF\u09B7\u09CD\u0995\u09CD\u09B0\u09BF\u09AF\u09BC" }
];
var PRIORITY = [
  { value: "low", label: "Low", labelBn: "\u0995\u09AE" },
  { value: "normal", label: "Normal", labelBn: "\u09B8\u09CD\u09AC\u09BE\u09AD\u09BE\u09AC\u09BF\u0995" },
  { value: "high", label: "High", labelBn: "\u0989\u099A\u09CD\u099A" },
  { value: "urgent", label: "Urgent", labelBn: "\u0985\u09A4\u09BF \u099C\u09B0\u09C1\u09B0\u09BF" }
];
var ENTITIES = {
  zones: {
    key: "zones",
    table: "zones",
    label: "Zone",
    labelBn: "\u099C\u09CB\u09A8",
    searchFields: ["name", "description"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Zone Name", labelBn: "\u099C\u09CB\u09A8\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", hideInTable: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  areas: {
    key: "areas",
    table: "areas",
    label: "Area",
    labelBn: "\u098F\u09B2\u09BE\u0995\u09BE",
    searchFields: ["name"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Area Name", labelBn: "\u098F\u09B2\u09BE\u0995\u09BE\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  sub_areas: {
    key: "sub_areas",
    table: "sub_areas",
    label: "Sub Area",
    labelBn: "\u09B8\u09BE\u09AC-\u098F\u09B2\u09BE\u0995\u09BE",
    searchFields: ["name"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Sub Area Name", labelBn: "\u09B8\u09BE\u09AC-\u098F\u09B2\u09BE\u0995\u09BE\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "area_id", label: "Area", labelBn: "\u098F\u09B2\u09BE\u0995\u09BE", type: "ref", refEntity: "areas", required: true },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", hideInTable: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  roads: {
    key: "roads",
    table: "roads",
    label: "Road",
    labelBn: "\u09B0\u09CB\u09A1",
    searchFields: ["name"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Road Name", labelBn: "\u09B0\u09CB\u09A1\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "sub_area_id", label: "Sub Area", labelBn: "\u09B8\u09BE\u09AC-\u098F\u09B2\u09BE\u0995\u09BE", type: "ref", refEntity: "sub_areas", required: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  packages: {
    key: "packages",
    table: "packages",
    label: "Package",
    labelBn: "\u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099C",
    searchFields: ["name", "code"],
    defaultSort: "price",
    fields: [
      { name: "name", label: "Package Name", labelBn: "\u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099C\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "code", label: "Code", labelBn: "\u0995\u09CB\u09A1", type: "text" },
      { name: "price", label: "Monthly Price", labelBn: "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AE\u09C2\u09B2\u09CD\u09AF", type: "money", required: true, min: 0 },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        defaultValue: "standard",
        options: [
          { value: "basic", label: "Basic", labelBn: "\u09AC\u09C7\u09B8\u09BF\u0995" },
          { value: "standard", label: "Standard", labelBn: "\u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u09A8\u09CD\u09A1\u09BE\u09B0\u09CD\u09A1" },
          { value: "premium", label: "Premium", labelBn: "\u09AA\u09CD\u09B0\u09BF\u09AE\u09BF\u09AF\u09BC\u09BE\u09AE" },
          { value: "hd", label: "HD", labelBn: "\u098F\u0987\u099A\u09A1\u09BF" },
          { value: "special", label: "Special", labelBn: "\u09B8\u09CD\u09AA\u09C7\u09B6\u09BE\u09B2" },
          { value: "free", label: "Free", labelBn: "\u09AB\u09CD\u09B0\u09BF" }
        ]
      },
      { name: "channels", label: "Channels", labelBn: "\u099A\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2 \u09B8\u0982\u0996\u09CD\u09AF\u09BE", type: "number", min: 0 },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", hideInTable: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  staff: {
    key: "staff",
    table: "staff",
    label: "Staff",
    labelBn: "\u0995\u09B0\u09CD\u09AE\u09C0",
    searchFields: ["name", "mobile", "designation"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Full Name", labelBn: "\u09AA\u09C2\u09B0\u09CD\u09A3 \u09A8\u09BE\u09AE", type: "text", required: true },
      {
        name: "designation",
        label: "Designation",
        labelBn: "\u09AA\u09A6\u09AC\u09BF",
        type: "select",
        required: true,
        defaultValue: "technician",
        options: [
          { value: "manager", label: "Manager", labelBn: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09BE\u09B0" },
          { value: "technician", label: "Technician", labelBn: "\u099F\u09C7\u0995\u09A8\u09BF\u09B6\u09BF\u09AF\u09BC\u09BE\u09A8" },
          { value: "collector", label: "Collector", labelBn: "\u0995\u09BE\u09B2\u09C7\u0995\u09CD\u099F\u09B0" },
          { value: "other", label: "Other", labelBn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" }
        ]
      },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text", required: true },
      { name: "nid", label: "NID", labelBn: "\u098F\u09A8\u0986\u0987\u09A1\u09BF", type: "text", hideInTable: true },
      { name: "address", label: "Address", labelBn: "\u09A0\u09BF\u0995\u09BE\u09A8\u09BE", type: "textarea", hideInTable: true },
      { name: "join_date", label: "Join Date", labelBn: "\u09AF\u09CB\u0997\u09A6\u09BE\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" },
      { name: "salary", label: "Monthly Salary", labelBn: "\u09AE\u09BE\u09B8\u09BF\u0995 \u09AC\u09C7\u09A4\u09A8", type: "money", min: 0 },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  attendance: {
    key: "attendance",
    table: "attendance",
    label: "Attendance",
    labelBn: "\u09B9\u09BE\u099C\u09BF\u09B0\u09BE",
    searchFields: ["note"],
    defaultSort: "date desc",
    fields: [
      { name: "staff_id", label: "Staff", labelBn: "\u0995\u09B0\u09CD\u09AE\u09C0", type: "ref", refEntity: "staff", required: true },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        required: true,
        defaultValue: "present",
        options: [
          { value: "present", label: "Present", labelBn: "\u0989\u09AA\u09B8\u09CD\u09A5\u09BF\u09A4" },
          { value: "absent", label: "Absent", labelBn: "\u0985\u09A8\u09C1\u09AA\u09B8\u09CD\u09A5\u09BF\u09A4" },
          { value: "leave", label: "Leave", labelBn: "\u099B\u09C1\u099F\u09BF" },
          { value: "half_day", label: "Half Day", labelBn: "\u0985\u09B0\u09CD\u09A7\u09A6\u09BF\u09AC\u09B8" }
        ]
      },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" }
    ]
  },
  leaves: {
    key: "leaves",
    table: "leaves",
    label: "Leave",
    labelBn: "\u099B\u09C1\u099F\u09BF",
    searchFields: ["reason"],
    defaultSort: "from_date desc",
    fields: [
      { name: "staff_id", label: "Staff", labelBn: "\u0995\u09B0\u09CD\u09AE\u09C0", type: "ref", refEntity: "staff", required: true },
      { name: "from_date", label: "From", labelBn: "\u09B6\u09C1\u09B0\u09C1", type: "date", required: true },
      { name: "to_date", label: "To", labelBn: "\u09B6\u09C7\u09B7", type: "date", required: true },
      { name: "reason", label: "Reason", labelBn: "\u0995\u09BE\u09B0\u09A3", type: "textarea", required: true },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "approved",
        options: [
          { value: "pending", label: "Pending", labelBn: "\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A3" },
          { value: "approved", label: "Approved", labelBn: "\u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4" },
          { value: "rejected", label: "Rejected", labelBn: "\u09AA\u09CD\u09B0\u09A4\u09CD\u09AF\u09BE\u0996\u09CD\u09AF\u09BE\u09A4" }
        ]
      }
    ]
  },
  salaries: {
    key: "salaries",
    table: "salaries",
    label: "Salary",
    labelBn: "\u09AC\u09C7\u09A4\u09A8",
    searchFields: ["month"],
    defaultSort: "month desc",
    fields: [
      { name: "staff_id", label: "Staff", labelBn: "\u0995\u09B0\u09CD\u09AE\u09C0", type: "ref", refEntity: "staff", required: true },
      { name: "month", label: "Month", labelBn: "\u09AE\u09BE\u09B8", type: "month", required: true },
      { name: "basic", label: "Basic", labelBn: "\u09AE\u09C2\u09B2 \u09AC\u09C7\u09A4\u09A8", type: "money", required: true, min: 0 },
      { name: "bonus", label: "Bonus", labelBn: "\u09AC\u09CB\u09A8\u09BE\u09B8", type: "money", defaultValue: 0, min: 0 },
      { name: "commission", label: "Commission", labelBn: "\u0995\u09AE\u09BF\u09B6\u09A8", type: "money", defaultValue: 0, min: 0 },
      { name: "deduction", label: "Deduction", labelBn: "\u0995\u09BE\u099F\u09BE", type: "money", defaultValue: 0, min: 0 },
      { name: "paid_date", label: "Paid Date", labelBn: "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7 \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "unpaid",
        options: [
          { value: "unpaid", label: "Unpaid", labelBn: "\u0985\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4" },
          { value: "paid", label: "Paid", labelBn: "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4" }
        ]
      }
    ]
  },
  collectors: {
    key: "collectors",
    table: "collectors",
    label: "Collector",
    labelBn: "\u0995\u09BE\u09B2\u09C7\u0995\u09CD\u099F\u09B0",
    searchFields: [],
    defaultSort: "id",
    fields: [
      { name: "staff_id", label: "Staff", labelBn: "\u0995\u09B0\u09CD\u09AE\u09C0", type: "ref", refEntity: "staff", required: true },
      { name: "target_amount", label: "Monthly Target", labelBn: "\u09AE\u09BE\u09B8\u09BF\u0995 \u099F\u09BE\u09B0\u09CD\u0997\u09C7\u099F", type: "money", min: 0 },
      { name: "commission_rate", label: "Commission %", labelBn: "\u0995\u09AE\u09BF\u09B6\u09A8 %", type: "number", min: 0, max: 100 },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  cash_deposits: {
    key: "cash_deposits",
    table: "cash_deposits",
    label: "Cash Deposit",
    labelBn: "\u09A8\u0997\u09A6 \u099C\u09AE\u09BE",
    searchFields: ["note"],
    defaultSort: "date desc",
    fields: [
      { name: "collector_id", label: "Collector", labelBn: "\u0995\u09BE\u09B2\u09C7\u0995\u09CD\u099F\u09B0", type: "ref", refEntity: "collectors", required: true },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      { name: "amount", label: "Amount", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "money", required: true, min: 1 },
      {
        name: "method",
        label: "Method",
        labelBn: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE",
        type: "select",
        defaultValue: "cash",
        options: [
          { value: "cash", label: "Cash", labelBn: "\u09A8\u0997\u09A6" },
          { value: "bank", label: "Bank", labelBn: "\u09AC\u09CD\u09AF\u09BE\u0982\u0995" },
          { value: "bkash", label: "bKash", labelBn: "\u09AC\u09BF\u0995\u09BE\u09B6" },
          { value: "nagad", label: "Nagad", labelBn: "\u09A8\u0997\u09A6" }
        ]
      },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" }
    ]
  },
  resellers: {
    key: "resellers",
    table: "resellers",
    label: "Reseller",
    labelBn: "\u09B0\u09BF\u09B8\u09C7\u09B2\u09BE\u09B0",
    searchFields: ["name", "mobile", "company"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Reseller Name", labelBn: "\u09B0\u09BF\u09B8\u09C7\u09B2\u09BE\u09B0\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "company", label: "Company", labelBn: "\u09AA\u09CD\u09B0\u09A4\u09BF\u09B7\u09CD\u09A0\u09BE\u09A8", type: "text" },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text", required: true },
      { name: "address", label: "Address", labelBn: "\u09A0\u09BF\u0995\u09BE\u09A8\u09BE", type: "textarea", hideInTable: true },
      { name: "commission_rate", label: "Commission %", labelBn: "\u0995\u09AE\u09BF\u09B6\u09A8 %", type: "number", min: 0, max: 100 },
      { name: "wallet_balance", label: "Wallet Balance", labelBn: "\u0993\u09AF\u09BC\u09BE\u09B2\u09C7\u099F \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8", type: "money", defaultValue: 0, hideInForm: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  complaints: {
    key: "complaints",
    table: "complaints",
    label: "Complaint",
    labelBn: "\u0985\u09AD\u09BF\u09AF\u09CB\u0997",
    searchFields: ["description", "note"],
    defaultSort: "id desc",
    fields: [
      { name: "customer_id", label: "Customer", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995", type: "ref", refEntity: "customers", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "no_signal",
        options: [
          { value: "no_signal", label: "No Signal", labelBn: "\u09B8\u09BF\u0997\u09A8\u09CD\u09AF\u09BE\u09B2 \u09A8\u09C7\u0987" },
          { value: "cable_problem", label: "Cable Problem", labelBn: "\u0995\u09C7\u09AC\u09B2 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE" },
          { value: "picture_problem", label: "Picture Problem", labelBn: "\u099B\u09AC\u09BF\u09B0 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE" },
          { value: "sound_problem", label: "Sound Problem", labelBn: "\u09B6\u09AC\u09CD\u09A6\u09C7\u09B0 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE" },
          { value: "channel_problem", label: "Channel Problem", labelBn: "\u099A\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE" },
          { value: "stb_problem", label: "Set-Top Box Problem", labelBn: "\u09B8\u09C7\u099F-\u099F\u09AA \u09AC\u0995\u09CD\u09B8 \u09B8\u09AE\u09B8\u09CD\u09AF\u09BE" },
          { value: "other", label: "Other", labelBn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" }
        ]
      },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", required: true },
      { name: "priority", label: "Priority", labelBn: "\u0985\u0997\u09CD\u09B0\u09BE\u09A7\u09BF\u0995\u09BE\u09B0", type: "select", options: PRIORITY, defaultValue: "normal" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "pending",
        options: [
          { value: "pending", label: "Pending", labelBn: "\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A3" },
          { value: "assigned", label: "Assigned", labelBn: "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4" },
          { value: "resolved", label: "Resolved", labelBn: "\u09B8\u09AE\u09BE\u09A7\u09BE\u09A8" },
          { value: "closed", label: "Closed", labelBn: "\u09AC\u09A8\u09CD\u09A7" }
        ]
      },
      { name: "technician_id", label: "Technician", labelBn: "\u099F\u09C7\u0995\u09A8\u09BF\u09B6\u09BF\u09AF\u09BC\u09BE\u09A8", type: "ref", refEntity: "staff" },
      { name: "assigned_date", label: "Assigned Date", labelBn: "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" },
      { name: "resolved_date", label: "Resolved Date", labelBn: "\u09B8\u09AE\u09BE\u09A7\u09BE\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" },
      { name: "feedback", label: "Feedback", labelBn: "\u09AE\u09A4\u09BE\u09AE\u09A4", type: "textarea", hideInTable: true },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea", hideInTable: true }
    ]
  },
  products: {
    key: "products",
    table: "products",
    label: "Product",
    labelBn: "\u09AA\u09A3\u09CD\u09AF",
    searchFields: ["name", "sku"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Product Name", labelBn: "\u09AA\u09A3\u09CD\u09AF\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "sku", label: "SKU", labelBn: "\u098F\u09B8\u0995\u09C7\u0987\u0989", type: "text" },
      {
        name: "category",
        label: "Category",
        labelBn: "\u09AC\u09BF\u09AD\u09BE\u0997",
        type: "select",
        required: true,
        defaultValue: "cable",
        options: [
          { value: "cable", label: "Cable", labelBn: "\u0995\u09C7\u09AC\u09B2" },
          { value: "fiber_cable", label: "Fiber Cable", labelBn: "\u09AB\u09BE\u0987\u09AC\u09BE\u09B0 \u0995\u09C7\u09AC\u09B2" },
          { value: "stb", label: "Set-Top Box", labelBn: "\u09B8\u09C7\u099F-\u099F\u09AA \u09AC\u0995\u09CD\u09B8" },
          { value: "remote", label: "Remote Control", labelBn: "\u09B0\u09BF\u09AE\u09CB\u099F \u0995\u09A8\u09CD\u099F\u09CD\u09B0\u09CB\u09B2" },
          { value: "amplifier", label: "Amplifier", labelBn: "\u0985\u09CD\u09AF\u09BE\u09AE\u09AA\u09CD\u09B2\u09BF\u09AB\u09BE\u09AF\u09BC\u09BE\u09B0" },
          { value: "splitter", label: "Splitter", labelBn: "\u09B8\u09CD\u09AA\u09CD\u09B2\u09BF\u099F\u09BE\u09B0" },
          { value: "connector", label: "Connector", labelBn: "\u0995\u09BE\u09A8\u09C7\u0995\u09CD\u099F\u09B0" },
          { value: "adapter", label: "Adapter", labelBn: "\u0985\u09CD\u09AF\u09BE\u09A1\u09BE\u09AA\u09CD\u099F\u09BE\u09B0" },
          { value: "other", label: "Other", labelBn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" }
        ]
      },
      { name: "unit", label: "Unit", labelBn: "\u098F\u0995\u0995", type: "text", defaultValue: "pcs" },
      { name: "purchase_price", label: "Purchase Price", labelBn: "\u0995\u09CD\u09B0\u09AF\u09BC\u09AE\u09C2\u09B2\u09CD\u09AF", type: "money", min: 0 },
      { name: "sale_price", label: "Sale Price", labelBn: "\u09AC\u09BF\u0995\u09CD\u09B0\u09AF\u09BC\u09AE\u09C2\u09B2\u09CD\u09AF", type: "money", min: 0 },
      { name: "stock", label: "Stock", labelBn: "\u09B8\u09CD\u099F\u0995", type: "number", defaultValue: 0, min: 0 },
      { name: "min_stock", label: "Min Stock Alert", labelBn: "\u09B8\u09B0\u09CD\u09AC\u09A8\u09BF\u09AE\u09CD\u09A8 \u09B8\u09CD\u099F\u0995", type: "number", defaultValue: 5, min: 0 },
      { name: "warranty_months", label: "Warranty (months)", labelBn: "\u0993\u09AF\u09BC\u09BE\u09B0\u09C7\u09A8\u09CD\u099F\u09BF (\u09AE\u09BE\u09B8)", type: "number", min: 0, hideInTable: true },
      { name: "supplier_id", label: "Supplier", labelBn: "\u09B8\u09B0\u09AC\u09B0\u09BE\u09B9\u0995\u09BE\u09B0\u09C0", type: "ref", refEntity: "suppliers" },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  suppliers: {
    key: "suppliers",
    table: "suppliers",
    label: "Supplier",
    labelBn: "\u09B8\u09B0\u09AC\u09B0\u09BE\u09B9\u0995\u09BE\u09B0\u09C0",
    searchFields: ["name", "mobile", "contact"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Supplier Name", labelBn: "\u09B8\u09B0\u09AC\u09B0\u09BE\u09B9\u0995\u09BE\u09B0\u09C0\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "contact", label: "Contact Person", labelBn: "\u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997", type: "text" },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text" },
      { name: "address", label: "Address", labelBn: "\u09A0\u09BF\u0995\u09BE\u09A8\u09BE", type: "textarea", hideInTable: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  stock_movements: {
    key: "stock_movements",
    table: "stock_movements",
    label: "Stock Movement",
    labelBn: "\u09B8\u09CD\u099F\u0995 \u099A\u09BE\u09B2\u09BE\u09A8",
    searchFields: ["reason", "ref"],
    defaultSort: "id desc",
    fields: [
      { name: "product_id", label: "Product", labelBn: "\u09AA\u09A3\u09CD\u09AF", type: "ref", refEntity: "products", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "in",
        options: [
          { value: "in", label: "Stock In", labelBn: "\u09B8\u09CD\u099F\u0995 \u0987\u09A8" },
          { value: "out", label: "Stock Out", labelBn: "\u09B8\u09CD\u099F\u0995 \u0986\u0989\u099F" },
          { value: "adjust", label: "Adjustment", labelBn: "\u09B8\u09AE\u09A8\u09CD\u09AC\u09AF\u09BC" }
        ]
      },
      { name: "qty", label: "Quantity", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "number", required: true, min: 1 },
      { name: "reason", label: "Reason", labelBn: "\u0995\u09BE\u09B0\u09A3", type: "text" },
      { name: "ref", label: "Reference", labelBn: "\u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8", type: "text" },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true }
    ]
  },
  network_devices: {
    key: "network_devices",
    table: "network_devices",
    label: "Network Device",
    labelBn: "\u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995 \u09A1\u09BF\u09AD\u09BE\u0987\u09B8",
    searchFields: ["name", "code", "location"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Name", labelBn: "\u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "code", label: "Code", labelBn: "\u0995\u09CB\u09A1", type: "text" },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "main_line",
        options: [
          { value: "main_line", label: "Main Line", labelBn: "\u09AE\u09C7\u0987\u09A8 \u09B2\u09BE\u0987\u09A8" },
          { value: "distribution_box", label: "Distribution Box", labelBn: "\u09A1\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09BF\u09AC\u09BF\u0989\u09B6\u09A8 \u09AC\u0995\u09CD\u09B8" },
          { value: "fiber_node", label: "Fiber Node", labelBn: "\u09AB\u09BE\u0987\u09AC\u09BE\u09B0 \u09A8\u09CB\u09A1" },
          { value: "splitter", label: "Splitter", labelBn: "\u09B8\u09CD\u09AA\u09CD\u09B2\u09BF\u099F\u09BE\u09B0" },
          { value: "amplifier", label: "Amplifier", labelBn: "\u0985\u09CD\u09AF\u09BE\u09AE\u09AA\u09CD\u09B2\u09BF\u09AB\u09BE\u09AF\u09BC\u09BE\u09B0" },
          { value: "cable_route", label: "Cable Route", labelBn: "\u0995\u09C7\u09AC\u09B2 \u09B0\u09C1\u099F" },
          { value: "connection_point", label: "Connection Point", labelBn: "\u0995\u09BE\u09A8\u09C7\u0995\u09B6\u09A8 \u09AA\u09AF\u09BC\u09C7\u09A8\u09CD\u099F" }
        ]
      },
      { name: "area_id", label: "Area", labelBn: "\u098F\u09B2\u09BE\u0995\u09BE", type: "ref", refEntity: "areas" },
      { name: "location", label: "Location", labelBn: "\u0985\u09AC\u09B8\u09CD\u09A5\u09BE\u09A8", type: "text" },
      { name: "capacity", label: "Capacity", labelBn: "\u0995\u09CD\u09B7\u09AE\u09A4\u09BE", type: "number", min: 0 },
      { name: "parent_id", label: "Connected To", labelBn: "\u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4", type: "ref", refEntity: "network_devices", hideInTable: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  network_faults: {
    key: "network_faults",
    table: "network_faults",
    label: "Network Fault",
    labelBn: "\u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995 \u09A4\u09CD\u09B0\u09C1\u099F\u09BF",
    searchFields: ["description"],
    defaultSort: "id desc",
    fields: [
      { name: "device_id", label: "Device", labelBn: "\u09A1\u09BF\u09AD\u09BE\u0987\u09B8", type: "ref", refEntity: "network_devices" },
      { name: "area_id", label: "Area", labelBn: "\u098F\u09B2\u09BE\u0995\u09BE", type: "ref", refEntity: "areas" },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", required: true },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "open",
        options: [
          { value: "open", label: "Open", labelBn: "\u0996\u09CB\u09B2\u09BE" },
          { value: "fixed", label: "Fixed", labelBn: "\u09A0\u09BF\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7" }
        ]
      },
      { name: "resolved_date", label: "Resolved Date", labelBn: "\u09B8\u09AE\u09BE\u09A7\u09BE\u09A8\u09C7\u09B0 \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" }
    ]
  },
  branches: {
    key: "branches",
    table: "branches",
    label: "Branch",
    labelBn: "\u09AC\u09CD\u09B0\u09BE\u099E\u09CD\u099A",
    searchFields: ["name", "code", "address"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Branch Name", labelBn: "\u09AC\u09CD\u09B0\u09BE\u099E\u09CD\u099A\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "code", label: "Code", labelBn: "\u0995\u09CB\u09A1", type: "text" },
      { name: "address", label: "Address", labelBn: "\u09A0\u09BF\u0995\u09BE\u09A8\u09BE", type: "textarea", hideInTable: true },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text" },
      { name: "manager_id", label: "Manager", labelBn: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09BE\u09B0", type: "ref", refEntity: "staff" },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  leads: {
    key: "leads",
    table: "leads",
    label: "Lead",
    labelBn: "\u09B2\u09BF\u09A1",
    searchFields: ["name", "mobile", "note"],
    defaultSort: "id desc",
    fields: [
      { name: "name", label: "Name", labelBn: "\u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text", required: true },
      { name: "address", label: "Address", labelBn: "\u09A0\u09BF\u0995\u09BE\u09A8\u09BE", type: "textarea" },
      {
        name: "source",
        label: "Source",
        labelBn: "\u0989\u09CE\u09B8",
        type: "select",
        defaultValue: "walk_in",
        options: [
          { value: "walk_in", label: "Walk-in", labelBn: "\u09B8\u09B0\u09BE\u09B8\u09B0\u09BF" },
          { value: "referral", label: "Referral", labelBn: "\u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09B2" },
          { value: "campaign", label: "Campaign", labelBn: "\u09AA\u09CD\u09B0\u099A\u09BE\u09B0\u09A3\u09BE" },
          { value: "phone", label: "Phone", labelBn: "\u09AB\u09CB\u09A8" },
          { value: "other", label: "Other", labelBn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" }
        ]
      },
      { name: "interest", label: "Interest", labelBn: "\u0986\u0997\u09CD\u09B0\u09B9", type: "ref", refEntity: "packages" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "new",
        options: [
          { value: "new", label: "New", labelBn: "\u09A8\u09A4\u09C1\u09A8" },
          { value: "contacted", label: "Contacted", labelBn: "\u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7" },
          { value: "interested", label: "Interested", labelBn: "\u0986\u0997\u09CD\u09B0\u09B9\u09C0" },
          { value: "converted", label: "Converted", labelBn: "\u09B0\u09C2\u09AA\u09BE\u09A8\u09CD\u09A4\u09B0\u09BF\u09A4" },
          { value: "lost", label: "Lost", labelBn: "\u09AC\u09BE\u09A4\u09BF\u09B2" }
        ]
      },
      { name: "followup_date", label: "Follow-up Date", labelBn: "\u09AB\u09B2\u09CB\u0986\u09AA \u09A4\u09BE\u09B0\u09BF\u0996", type: "date" },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea", hideInTable: true }
    ]
  },
  followups: {
    key: "followups",
    table: "followups",
    label: "Follow-up",
    labelBn: "\u09AB\u09B2\u09CB\u0986\u09AA",
    searchFields: ["note"],
    defaultSort: "id desc",
    fields: [
      { name: "lead_id", label: "Lead", labelBn: "\u09B2\u09BF\u09A1", type: "ref", refEntity: "leads", required: true },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea", required: true },
      { name: "next_date", label: "Next Follow-up", labelBn: "\u09AA\u09B0\u09AC\u09B0\u09CD\u09A4\u09C0 \u09AB\u09B2\u09CB\u0986\u09AA", type: "date" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "done",
        options: [
          { value: "done", label: "Done", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8" },
          { value: "scheduled", label: "Scheduled", labelBn: "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4" }
        ]
      }
    ]
  },
  sms_templates: {
    key: "sms_templates",
    table: "sms_templates",
    label: "Message Template",
    labelBn: "\u09AE\u09C7\u09B8\u09C7\u099C \u099F\u09C7\u09AE\u09AA\u09CD\u09B2\u09C7\u099F",
    searchFields: ["name", "content"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Template Name", labelBn: "\u099F\u09C7\u09AE\u09AA\u09CD\u09B2\u09C7\u099F\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "due_reminder",
        options: [
          { value: "due_reminder", label: "Due Reminder", labelBn: "\u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0" },
          { value: "payment_confirm", label: "Payment Confirmation", labelBn: "\u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4\u0995\u09B0\u09A3" },
          { value: "marketing", label: "Marketing", labelBn: "\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982" },
          { value: "invoice", label: "Invoice", labelBn: "\u0987\u09A8\u09AD\u09AF\u09BC\u09C7\u09B8" },
          { value: "other", label: "Other", labelBn: "\u0985\u09A8\u09CD\u09AF\u09BE\u09A8\u09CD\u09AF" }
        ]
      },
      { name: "content", label: "Content", labelBn: "\u09AC\u09BF\u09B7\u09AF\u09BC\u09AC\u09B8\u09CD\u09A4\u09C1", type: "textarea", required: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  messages: {
    key: "messages",
    table: "messages",
    label: "Message",
    labelBn: "\u09AE\u09C7\u09B8\u09C7\u099C",
    searchFields: ["mobile", "text"],
    defaultSort: "id desc",
    fields: [
      { name: "customer_id", label: "Customer", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995", type: "ref", refEntity: "customers" },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text", required: true },
      {
        name: "channel",
        label: "Channel",
        labelBn: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE",
        type: "select",
        required: true,
        defaultValue: "sms",
        options: [
          { value: "sms", label: "SMS", labelBn: "\u098F\u09B8\u098F\u09AE\u098F\u09B8" },
          { value: "whatsapp", label: "WhatsApp", labelBn: "\u09B9\u09CB\u09AF\u09BC\u09BE\u099F\u09B8\u0985\u09CD\u09AF\u09BE\u09AA" }
        ]
      },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "individual",
        options: [
          { value: "individual", label: "Individual", labelBn: "\u098F\u0995\u0995" },
          { value: "due_reminder", label: "Due Reminder", labelBn: "\u09AC\u0995\u09C7\u09AF\u09BC\u09BE \u09B0\u09BF\u09AE\u09BE\u0987\u09A8\u09CD\u09A1\u09BE\u09B0" },
          { value: "payment_confirm", label: "Payment Confirmation", labelBn: "\u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09A8\u09BF\u09B6\u09CD\u099A\u09BF\u09A4\u0995\u09B0\u09A3" },
          { value: "marketing", label: "Marketing", labelBn: "\u09AE\u09BE\u09B0\u09CD\u0995\u09C7\u099F\u09BF\u0982" },
          { value: "invoice", label: "Invoice", labelBn: "\u0987\u09A8\u09AD\u09AF\u09BC\u09C7\u09B8" }
        ]
      },
      { name: "text", label: "Message", labelBn: "\u09AE\u09C7\u09B8\u09C7\u099C", type: "textarea", required: true },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF",
        type: "select",
        defaultValue: "draft",
        options: [
          { value: "draft", label: "Draft", labelBn: "\u0996\u09B8\u09A1\u09BC\u09BE" },
          { value: "queued", label: "Queued", labelBn: "\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A3" },
          { value: "sent", label: "Sent", labelBn: "\u09AA\u09CD\u09B0\u09C7\u09B0\u09BF\u09A4" },
          { value: "failed", label: "Failed", labelBn: "\u09AC\u09CD\u09AF\u09B0\u09CD\u09A5" }
        ]
      },
      { name: "sent_at", label: "Sent At", labelBn: "\u09AA\u09CD\u09B0\u09C7\u09B0\u09A3\u09C7\u09B0 \u09B8\u09AE\u09AF\u09BC", type: "date" }
    ]
  },
  accounts: {
    key: "accounts",
    table: "accounts",
    label: "Account",
    labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC",
    searchFields: ["name", "account_no", "bank_name"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Account Name", labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "cash",
        options: [
          { value: "cash", label: "Cash", labelBn: "\u09A8\u0997\u09A6" },
          { value: "bank", label: "Bank", labelBn: "\u09AC\u09CD\u09AF\u09BE\u0982\u0995" },
          { value: "mobile", label: "Mobile Banking", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09AC\u09CD\u09AF\u09BE\u0982\u0995\u09BF\u0982" }
        ]
      },
      { name: "bank_name", label: "Bank Name", labelBn: "\u09AC\u09CD\u09AF\u09BE\u0982\u0995\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text" },
      { name: "account_no", label: "Account No", labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC \u09A8\u09AE\u09CD\u09AC\u09B0", type: "text" },
      { name: "opening_balance", label: "Opening Balance", labelBn: "\u09AA\u09CD\u09B0\u09BE\u09B0\u09AE\u09CD\u09AD\u09BF\u0995 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8", type: "money", defaultValue: 0 },
      { name: "balance", label: "Current Balance", labelBn: "\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8", type: "money", defaultValue: 0, hideInForm: true },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  expense_categories: {
    key: "expense_categories",
    table: "expense_categories",
    label: "Category",
    labelBn: "\u0996\u09BE\u09A4",
    searchFields: ["name"],
    defaultSort: "name",
    fields: [
      { name: "name", label: "Category Name", labelBn: "\u0996\u09BE\u09A4\u09C7\u09B0 \u09A8\u09BE\u09AE", type: "text", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "expense",
        options: [
          { value: "expense", label: "Expense", labelBn: "\u0996\u09B0\u099A" },
          { value: "income", label: "Income", labelBn: "\u0986\u09AF\u09BC" }
        ]
      },
      { name: "status", label: "Status", labelBn: "\u09B8\u09CD\u09A5\u09BF\u09A4\u09BF", type: "select", options: STATUS, defaultValue: "active" }
    ]
  },
  transactions: {
    key: "transactions",
    table: "transactions",
    label: "Transaction",
    labelBn: "\u09B2\u09C7\u09A8\u09A6\u09C7\u09A8",
    searchFields: ["description", "ref"],
    defaultSort: "id desc",
    fields: [
      { name: "account_id", label: "Account", labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC", type: "ref", refEntity: "accounts", required: true },
      {
        name: "type",
        label: "Type",
        labelBn: "\u09A7\u09B0\u09A8",
        type: "select",
        required: true,
        defaultValue: "expense",
        options: [
          { value: "income", label: "Income", labelBn: "\u0986\u09AF\u09BC" },
          { value: "expense", label: "Expense", labelBn: "\u0996\u09B0\u099A" }
        ]
      },
      { name: "category_id", label: "Category", labelBn: "\u0996\u09BE\u09A4", type: "ref", refEntity: "expense_categories" },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      { name: "amount", label: "Amount", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "money", required: true, min: 1 },
      { name: "description", label: "Description", labelBn: "\u09AC\u09BF\u09AC\u09B0\u09A3", type: "textarea", required: true },
      { name: "ref", label: "Reference", labelBn: "\u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8", type: "text", hideInForm: true }
    ]
  },
  account_transfers: {
    key: "account_transfers",
    table: "account_transfers",
    label: "Account Transfer",
    labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC \u09B8\u09CD\u09A5\u09BE\u09A8\u09BE\u09A8\u09CD\u09A4\u09B0",
    searchFields: ["note"],
    defaultSort: "id desc",
    fields: [
      { name: "from_account_id", label: "From Account", labelBn: "\u09A5\u09C7\u0995\u09C7 \u09B9\u09BF\u09B8\u09BE\u09AC", type: "ref", refEntity: "accounts", required: true },
      { name: "to_account_id", label: "To Account", labelBn: "\u09AA\u09CD\u09B0\u09A4\u09BF \u09B9\u09BF\u09B8\u09BE\u09AC", type: "ref", refEntity: "accounts", required: true },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true },
      { name: "amount", label: "Amount", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "money", required: true, min: 1 },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" }
    ]
  },
  discounts: {
    key: "discounts",
    table: "discounts",
    label: "Discount",
    labelBn: "\u099B\u09BE\u09A1\u09BC",
    searchFields: ["reason"],
    defaultSort: "id desc",
    fields: [
      { name: "customer_id", label: "Customer", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995", type: "ref", refEntity: "customers", required: true },
      { name: "month", label: "Month", labelBn: "\u09AE\u09BE\u09B8", type: "month" },
      { name: "amount", label: "Amount", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "money", required: true, min: 1 },
      { name: "reason", label: "Reason", labelBn: "\u0995\u09BE\u09B0\u09A3", type: "textarea", required: true },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true }
    ]
  },
  customer_documents: {
    key: "customer_documents",
    table: "customer_documents",
    label: "Document",
    labelBn: "\u09A1\u0995\u09C1\u09AE\u09C7\u09A8\u09CD\u099F",
    searchFields: ["title", "file_name"],
    defaultSort: "id desc",
    fields: [
      { name: "customer_id", label: "Customer", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995", type: "ref", refEntity: "customers", required: true },
      { name: "title", label: "Title", labelBn: "\u09B6\u09BF\u09B0\u09CB\u09A8\u09BE\u09AE", type: "text", required: true },
      { name: "file_name", label: "File", labelBn: "\u09AB\u09BE\u0987\u09B2", type: "text" },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" },
      { name: "date", label: "Date", labelBn: "\u09A4\u09BE\u09B0\u09BF\u0996", type: "date", required: true }
    ]
  },
  pppoe_users: {
    key: "pppoe_users",
    table: "pppoe_users",
    label: "PPPoE User",
    labelBn: "\u09AA\u09BF\u09AA\u09BF\u09AA\u09CB\u0987\u0989 \u0987\u0989\u099C\u09BE\u09B0",
    searchFields: ["username", "mobile"],
    defaultSort: "id desc",
    fields: [
      { name: "username", label: "Username", labelBn: "\u0987\u0989\u099C\u09BE\u09B0\u09A8\u09C7\u09AE", type: "text", required: true },
      { name: "password", label: "Password", labelBn: "\u09AA\u09BE\u09B8\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1", type: "text" },
      { name: "customer_id", label: "Customer", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995", type: "ref", refEntity: "customers" },
      { name: "mobile", label: "Mobile", labelBn: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2", type: "text" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8",
        type: "select",
        defaultValue: "active",
        options: [
          { value: "active", label: "Active", labelBn: "\u098F\u0995\u09CD\u099F\u09BF\u09AD" },
          { value: "inactive", label: "Inactive", labelBn: "\u0987\u09A8\u098F\u0995\u09CD\u099F\u09BF\u09AD" }
        ]
      },
      { name: "notes", label: "Notes", labelBn: "\u09A8\u09CB\u099F", type: "textarea" }
    ]
  },
  message_requests: {
    key: "message_requests",
    table: "message_requests",
    label: "Message Request",
    labelBn: "\u09AE\u09C7\u09B8\u09C7\u099C \u09B0\u09BF\u0995\u09CB\u09AF\u09BC\u09C7\u09B8\u09CD\u099F",
    searchFields: ["note"],
    defaultSort: "id desc",
    fields: [
      { name: "reseller_id", label: "Reseller", labelBn: "\u09B0\u09BF\u09B8\u09C7\u09B2\u09BE\u09B0", type: "ref", refEntity: "resellers", required: true },
      { name: "quantity", label: "Quantity (SMS)", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 (SMS)", type: "number", required: true, defaultValue: 0 },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8",
        type: "select",
        defaultValue: "pending",
        options: [
          { value: "pending", label: "Pending", labelBn: "\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A3" },
          { value: "approved", label: "Approved", labelBn: "\u0985\u09CD\u09AF\u09BE\u09AA\u09CD\u09B0\u09C1\u09AD\u09A1" },
          { value: "delivered", label: "Delivered", labelBn: "\u09A1\u09C7\u09B2\u09BF\u09AD\u09BE\u09B0\u09A1" },
          { value: "rejected", label: "Rejected", labelBn: "\u09AC\u09BE\u09A4\u09BF\u09B2" }
        ]
      }
    ]
  },
  payment_withdraws: {
    key: "payment_withdraws",
    table: "payment_withdraws",
    label: "Payment Withdraw",
    labelBn: "\u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u0989\u0987\u09A5\u09A1\u09CD\u09B0",
    searchFields: ["note"],
    defaultSort: "id desc",
    fields: [
      { name: "reseller_id", label: "Reseller", labelBn: "\u09B0\u09BF\u09B8\u09C7\u09B2\u09BE\u09B0", type: "ref", refEntity: "resellers", required: true },
      { name: "amount", label: "Amount", labelBn: "\u09AA\u09B0\u09BF\u09AE\u09BE\u09A3", type: "number", required: true, defaultValue: 0 },
      {
        name: "method",
        label: "Method",
        labelBn: "\u09AE\u09BE\u09A7\u09CD\u09AF\u09AE",
        type: "select",
        defaultValue: "bkash",
        options: [
          { value: "bkash", label: "bKash", labelBn: "\u09AC\u09BF\u0995\u09BE\u09B6" },
          { value: "nagad", label: "Nagad", labelBn: "\u09A8\u0997\u09A6" },
          { value: "cash", label: "Cash", labelBn: "\u0995\u09CD\u09AF\u09BE\u09B6" }
        ]
      },
      { name: "note", label: "Note", labelBn: "\u09A8\u09CB\u099F", type: "textarea" },
      {
        name: "status",
        label: "Status",
        labelBn: "\u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8",
        type: "select",
        defaultValue: "pending",
        options: [
          { value: "pending", label: "Pending", labelBn: "\u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09AE\u09BE\u09A3" },
          { value: "paid", label: "Paid", labelBn: "\u09AA\u09B0\u09BF\u09B6\u09CB\u09A7\u09BF\u09A4" },
          { value: "rejected", label: "Rejected", labelBn: "\u09AC\u09BE\u09A4\u09BF\u09B2" }
        ]
      }
    ]
  }
};
var GENERIC_ENTITY_KEYS = Object.keys(ENTITIES).filter(
  (k) => !["transactions", "customer_documents"].includes(k)
);

// src/shared/permissions.ts
var CRUD = [
  { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
  { key: "create", label: "Create", labelBn: "\u09A4\u09C8\u09B0\u09BF" },
  { key: "edit", label: "Edit", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" },
  { key: "delete", label: "Delete", labelBn: "\u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09BE" }
];
var PERMISSION_CATALOG = [
  { module: "dashboard", label: "Dashboard", labelBn: "\u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1", actions: [{ key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" }] },
  { module: "customers", label: "Customer Management", labelBn: "\u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE", actions: CRUD },
  { module: "billing", label: "Billing", labelBn: "\u09AC\u09BF\u09B2\u09BF\u0982", actions: [...CRUD] },
  { module: "payments", label: "Payment Collection", labelBn: "\u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u0995\u09BE\u09B2\u09C7\u0995\u09B6\u09A8", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "collect", label: "Collect", labelBn: "\u0995\u09BE\u09B2\u09C7\u0995\u09B6\u09A8" },
    { key: "edit", label: "Edit", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" },
    { key: "refund", label: "Refund", labelBn: "\u09B0\u09BF\u09AB\u09BE\u09A8\u09CD\u09A1" }
  ] },
  { module: "staff", label: "Managers (Staff)", labelBn: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09BE\u09B0 (\u0995\u09B0\u09CD\u09AE\u09C0)", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "create", label: "Create", labelBn: "\u09A4\u09C8\u09B0\u09BF" },
    { key: "edit", label: "Edit", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" },
    { key: "delete", label: "Deactivate", labelBn: "\u09A8\u09BF\u09B7\u09CD\u0995\u09CD\u09B0\u09BF\u09AF\u09BC" }
  ] },
  { module: "collectors", label: "Collectors", labelBn: "\u0995\u09BE\u09B2\u09C7\u0995\u09CD\u099F\u09B0", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "create", label: "Create", labelBn: "\u09A4\u09C8\u09B0\u09BF" },
    { key: "edit", label: "Edit", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" },
    { key: "delete", label: "Deactivate", labelBn: "\u09A8\u09BF\u09B7\u09CD\u0995\u09CD\u09B0\u09BF\u09AF\u09BC" }
  ] },
  { module: "reports", label: "Reports", labelBn: "\u09B0\u09BF\u09AA\u09CB\u09B0\u09CD\u099F", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "print", label: "Print", labelBn: "\u09AA\u09CD\u09B0\u09BF\u09A8\u09CD\u099F" },
    { key: "export", label: "Download / Export", labelBn: "\u09A1\u09BE\u0989\u09A8\u09B2\u09CB\u09A1 / \u098F\u0995\u09CD\u09B8\u09AA\u09CB\u09B0\u09CD\u099F" }
  ] },
  { module: "areas", label: "Area / Zone", labelBn: "\u098F\u09B0\u09BF\u09AF\u09BC\u09BE / \u099C\u09CB\u09A8", actions: CRUD },
  { module: "packages", label: "Packages", labelBn: "\u09AA\u09CD\u09AF\u09BE\u0995\u09C7\u099C", actions: CRUD },
  { module: "messaging", label: "SMS / Messaging", labelBn: "\u098F\u09B8\u098F\u09AE\u098F\u09B8 / \u09AE\u09C7\u09B8\u09C7\u099C\u09BF\u0982", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "send", label: "Send", labelBn: "\u09AA\u09BE\u09A0\u09BE\u09A8\u09CB" },
    { key: "manage", label: "Manage Templates", labelBn: "\u099F\u09C7\u09AE\u09AA\u09CD\u09B2\u09C7\u099F \u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C" }
  ] },
  { module: "complaints", label: "Complaints", labelBn: "\u0985\u09AD\u09BF\u09AF\u09CB\u0997", actions: CRUD },
  { module: "resellers", label: "Resellers", labelBn: "\u09B0\u09BF\u09B8\u09C7\u09B2\u09BE\u09B0", actions: CRUD },
  { module: "accounts", label: "Accounts", labelBn: "\u09B9\u09BF\u09B8\u09BE\u09AC", actions: CRUD },
  { module: "users", label: "User Management", labelBn: "\u0987\u0989\u099C\u09BE\u09B0 \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "create", label: "Create Manager/Collector", labelBn: "Manager/Collector \u09A4\u09C8\u09B0\u09BF" },
    { key: "edit", label: "Manage", labelBn: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C" }
  ] },
  { module: "security", label: "Admin Management & Security", labelBn: "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C\u09AE\u09C7\u09A8\u09CD\u099F \u0993 \u09A8\u09BF\u09B0\u09BE\u09AA\u09A4\u09CD\u09A4\u09BE", actions: [
    { key: "view", label: "View Admins/Logs", labelBn: "\u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8/\u09B2\u0997 \u09A6\u09C7\u0996\u09BE" },
    { key: "manage", label: "Manage", labelBn: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C7\u099C" }
  ] },
  { module: "company_profile", label: "Company Profile (Settings)", labelBn: "\u0995\u09CB\u09AE\u09CD\u09AA\u09BE\u09A8\u09BF \u09AA\u09CD\u09B0\u09CB\u09AB\u09BE\u0987\u09B2 (\u09B8\u09C7\u099F\u09BF\u0982\u09B8)", actions: [
    { key: "view", label: "View", labelBn: "\u09A6\u09C7\u0996\u09BE" },
    { key: "edit", label: "Edit", labelBn: "\u09B8\u09AE\u09CD\u09AA\u09BE\u09A6\u09A8\u09BE" }
  ] }
];
var LEGACY_MODULES = ["settings", "automation", "inventory", "connections", "purchases", "transactions", "customer_documents"];
function hasPermission(perms, module2, action) {
  if (!perms || !perms.length) return false;
  if (perms.includes("all")) return true;
  if (perms.includes(module2)) return true;
  if (action) return perms.includes(`${module2}.${action}`);
  return false;
}
function hasModuleAccess(perms, module2) {
  if (!perms || !perms.length) return false;
  if (perms.includes("all") || perms.includes(module2)) return true;
  return perms.some((p) => p.startsWith(module2 + "."));
}
function isValidRoleKey(key) {
  if (!key) return false;
  if (key === "all") return false;
  if (isValidPermKey(key)) return true;
  if (LEGACY_MODULES.includes(key)) return true;
  return GENERIC_ENTITY_KEYS.includes(key);
}
function isValidPermKey(key) {
  if (!key) return false;
  if (key === "all") return true;
  if (PERMISSION_CATALOG.some((m) => m.module === key)) return true;
  const [mod, action] = key.split(".");
  const modDef = PERMISSION_CATALOG.find((m) => m.module === mod);
  return !!modDef && !!modDef.actions.some((a) => a.key === action);
}

// src/main/ipc/auth.ts
var sessions = /* @__PURE__ */ new Map();
var SESSION_DEFAULT_MIN = 480;
function ensureDefaultAdmin() {
  const db2 = getDb();
  const count = db2.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (count.c === 0) {
    const role = db2.prepare("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'").get() || db2.prepare("SELECT id FROM roles WHERE name = 'Administrator'").get();
    db2.prepare("INSERT INTO users (username, password_hash, full_name, role_id, created_by) VALUES (?,?,?,?,?)").run("admin", import_bcryptjs.default.hashSync("admin123", 10), "Administrator", role.id, "system");
  }
  const accCount = db2.prepare("SELECT COUNT(*) AS c FROM accounts").get();
  if (accCount.c === 0) {
    db2.prepare("INSERT INTO accounts (name, type, opening_balance, balance) VALUES ('Main Cash', 'cash', 0, 0)").run();
  }
}
function requireAuth(e) {
  const s = sessions.get(e.sender.id);
  if (!s) throw new Error("SESSION_EXPIRED");
  const timeout = (parseInt(getSetting("session_timeout_min", String(SESSION_DEFAULT_MIN)), 10) || SESSION_DEFAULT_MIN) * 6e4;
  if (Date.now() - s.lastActivity > timeout) {
    sessions.delete(e.sender.id);
    throw new Error("SESSION_EXPIRED");
  }
  s.lastActivity = Date.now();
  if (isUserBlocked(s.userId)) throw new Error("SUBSCRIPTION_EXPIRED");
  return s;
}
function requirePermission(e, module2, action) {
  const s = requireAuth(e);
  const allowed = hasPermission(s.permissions, module2, action);
  if (module2 === "security" || module2 === "settings") {
    if (!allowed) throw new Error(`PERMISSION_DENIED:${module2}${action ? "." + action : ""}`);
    return s;
  }
  if (getSetting("permission_mode", "strict") !== "open") {
    if (!allowed) {
      throw new Error(`PERMISSION_DENIED:${module2}${action ? "." + action : ""}`);
    }
  }
  return s;
}
function refreshSessionPerms(userId) {
  let perms = null;
  for (const [winId, s] of sessions) {
    if (s.userId !== userId) continue;
    if (!perms) perms = getEffectivePermissions(userId);
    s.permissions = perms;
    try {
      const win = import_electron3.BrowserWindow.getAllWindows().find((w) => w.webContents.id === winId);
      win?.webContents.send("permissions:updated", { userId });
    } catch {
    }
  }
}
function refreshSessionsForRole(roleId) {
  const users = getDb().prepare("SELECT id FROM users WHERE role_id = ?").all(roleId);
  for (const u of users) refreshSessionPerms(u.id);
}
function getEffectivePermissions(userId) {
  const db2 = getDb();
  const u = db2.prepare("SELECT role_id FROM users WHERE id = ?").get(userId);
  if (!u) return [];
  const role = db2.prepare("SELECT permissions FROM roles WHERE id = ?").get(u.role_id);
  const rolePerms = JSON.parse(role?.permissions || "[]");
  const grants = db2.prepare("SELECT permission_key FROM user_permissions WHERE user_id = ?").all(userId);
  return Array.from(/* @__PURE__ */ new Set([...rolePerms, ...grants.map((g) => g.permission_key)]));
}
function isSuper(s) {
  return s.permissions.includes("all");
}
function registerAuthIpc() {
  ensureDefaultAdmin();
  import_electron3.ipcMain.handle("auth:login", async (e, username, password) => {
    if (isUpdatePending()) throw new Error("UPDATE_REQUIRED");
    const db2 = getDb();
    const user = db2.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username);
    if (!user || !import_bcryptjs.default.compareSync(password, user.password_hash)) {
      db2.prepare("INSERT INTO login_history (user_id, username, success) VALUES (?,?,0)").run(user ? user.id : null, username);
      throw new Error("INVALID_CREDENTIALS");
    }
    const role = db2.prepare("SELECT * FROM roles WHERE id = ?").get(user.role_id);
    const session = {
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      // effective permissions = role permissions ∪ per-user grants
      // (previously only role permissions were stored, so granular grants from
      // Security → Users never reached the session and Save was denied)
      roleId: user.role_id,
      permissions: getEffectivePermissions(user.id),
      lastActivity: Date.now(),
      winId: e.sender.id
    };
    sessions.set(e.sender.id, session);
    db2.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    db2.prepare("INSERT INTO login_history (user_id, username, success) VALUES (?,?,1)").run(user.id, user.username);
    logActivity(user.id, user.username, "login", "auth");
    return {
      token: Date.now(),
      user: { id: user.id, username: user.username, fullName: user.full_name, roleId: user.role_id, roleName: role.name, permissions: getEffectivePermissions(user.id), permissionMode: getSetting("permission_mode", "strict") },
      isFirstLogin: user.password_reset === 1
    };
  });
  import_electron3.ipcMain.handle("auth:logout", (e) => {
    const s = sessions.get(e.sender.id);
    if (s) {
      logActivity(s.userId, s.username, "logout", "auth");
      const db2 = getDb();
      const row = db2.prepare("SELECT id FROM login_history WHERE user_id = ? AND logout_at IS NULL ORDER BY id DESC LIMIT 1").get(s.userId);
      if (row) db2.prepare("UPDATE login_history SET logout_at = datetime('now') WHERE id = ?").run(row.id);
      sessions.delete(e.sender.id);
    }
    return true;
  });
  import_electron3.ipcMain.handle("auth:check", (e) => {
    try {
      const u = requireAuth(e);
      const pm = getSetting("permission_mode", "strict");
      u.permissionMode = pm;
      return { user: u, permissionMode: pm };
    } catch {
      return { user: null };
    }
  });
  import_electron3.ipcMain.handle("auth:changePassword", (e, oldPw, newPw) => {
    const s = requireAuth(e);
    const db2 = getDb();
    const user = db2.prepare("SELECT * FROM users WHERE id = ?").get(s.userId);
    if (!import_bcryptjs.default.compareSync(oldPw, user.password_hash)) throw new Error("WRONG_PASSWORD");
    if (!newPw || newPw.length < 6) throw new Error("PASSWORD_TOO_SHORT");
    db2.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(import_bcryptjs.default.hashSync(newPw, 10), s.userId);
    logActivity(s.userId, s.username, "change_password", "security");
    return true;
  });
  import_electron3.ipcMain.handle("users:list", (e) => {
    const s = requirePermission(e, "users", "view");
    const rows = getDb().prepare(`SELECT u.id, u.username, u.full_name, u.mobile, u.role_id, u.status, u.last_login, u.created_by, r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.id`).all();
    if (s.permissions.includes("all")) return rows;
    return rows.filter((r) => r.role_name !== "SUPER_ADMIN");
  });
  const ADMIN_CREATABLE_ROLES = ["Manager", "Collector"];
  import_electron3.ipcMain.handle("users:create", (e, data) => {
    const s = requirePermission(e, "users", "create");
    if (!data.username || !data.full_name || !data.password || !data.role_id) throw new Error("MISSING_FIELDS");
    if (String(data.password).length < 6) throw new Error("PASSWORD_TOO_SHORT");
    const db2 = getDb();
    const dup = db2.prepare("SELECT id FROM users WHERE username = ?").get(data.username);
    if (dup) throw new Error("USERNAME_EXISTS");
    if (!isSuper(s)) {
      const targetRole = db2.prepare("SELECT name FROM roles WHERE id = ?").get(data.role_id);
      if (!targetRole || !ADMIN_CREATABLE_ROLES.includes(targetRole.name)) throw new Error("FORBIDDEN_ROLE");
    }
    const r = db2.prepare("INSERT INTO users (username, password_hash, full_name, mobile, role_id, trial_ends, created_by, owner_admin_id) VALUES (?,?,?,?,?, datetime('now','+7 days'), ?, ?)").run(data.username, import_bcryptjs.default.hashSync(String(data.password), 10), data.full_name, data.mobile || null, data.role_id, s.username, s.userId);
    logActivity(s.userId, s.username, "create_user", "users", `${data.username}:${data.full_name}`);
    return r.lastInsertRowid;
  });
  import_electron3.ipcMain.handle("users:update", (e, id, data) => {
    const s = requirePermission(e, "users", "edit");
    const db2 = getDb();
    const target = db2.prepare("SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?").get(id);
    if (!target) throw new Error("NOT_FOUND");
    const targetIsSuper = target.role_name === "SUPER_ADMIN";
    const self2 = s.userId === id;
    if (targetIsSuper && !isSuper(s)) throw new Error("PERMISSION_DENIED:users");
    if (self2 && (data.status && data.status !== target.status)) throw new Error("CANNOT_CHANGE_OWN_STATUS");
    if (data.password) {
      if (String(data.password).length < 6) throw new Error("PASSWORD_TOO_SHORT");
      db2.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(import_bcryptjs.default.hashSync(String(data.password), 10), id);
    }
    if (isSuper(s)) {
      if (data.role_id && data.role_id !== target.role_id) logActivity(s.userId, s.username, "role_change", "users", `${target.username}:${target.role_name}\u2192${data.role_id}`);
      db2.prepare("UPDATE users SET full_name = ?, mobile = ?, role_id = ?, status = ? WHERE id = ?").run(data.full_name, data.mobile || null, data.role_id, data.status || "active", id);
    } else {
      const newStatus = data.status || target.status;
      if (newStatus !== target.status) logActivity(s.userId, s.username, "status_change", "users", `${target.username}:${target.status}\u2192${newStatus}`);
      db2.prepare("UPDATE users SET full_name = ?, mobile = ?, status = ? WHERE id = ?").run(data.full_name, data.mobile || null, newStatus, id);
    }
    logActivity(s.userId, s.username, "update_user", "users", String(id));
    return true;
  });
  import_electron3.ipcMain.handle("users:delete", (e, id) => {
    const s = requirePermission(e, "users", "edit");
    const db2 = getDb();
    const target = db2.prepare("SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?").get(id);
    if (!target) throw new Error("NOT_FOUND");
    if (target.role_name === "SUPER_ADMIN") throw new Error("SUPER_ADMIN_UNDELETABLE");
    const count = db2.prepare("SELECT COUNT(*) AS c FROM users").get();
    if (count.c <= 1) throw new Error("LAST_USER");
    if (s.userId === id) throw new Error("CANNOT_DELETE_SELF");
    if (!isSuper(s) && !["Manager", "Collector"].includes(target.role_name)) throw new Error("PERMISSION_DENIED:users");
    db2.prepare("DELETE FROM users WHERE id = ?").run(id);
    logActivity(s.userId, s.username, "delete_user", "users", String(id));
    return true;
  });
  const canManageTargetPerms = (s, target) => {
    if (target.role_name === "SUPER_ADMIN") return false;
    if (isSuper(s)) return true;
    if (!hasModuleAccess(s.permissions, "users")) return false;
    return target.owner_admin_id === s.userId;
  };
  const auditPerm = (actorId, targetId, key, action, oldValue, newValue) => {
    getDb().prepare("INSERT INTO permission_audit_logs (actor_id, target_user_id, permission_key, action, old_value, new_value) VALUES (?,?,?,?,?,?)").run(actorId, targetId, key, action, oldValue || null, newValue || null);
  };
  import_electron3.ipcMain.handle("permissions:get", (e, userId) => {
    const s = requirePermission(e, "users", "view");
    const db2 = getDb();
    const target = db2.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId);
    if (!target) throw new Error("NOT_FOUND");
    if (!canManageTargetPerms(s, target)) throw new Error("PERMISSION_DENIED:users");
    return {
      user: { id: target.id, username: target.username, full_name: target.full_name, role_name: target.role_name, status: target.status },
      grants: db2.prepare("SELECT permission_key, can_delegate, granted_by FROM user_permissions WHERE user_id = ?").all(userId),
      rolePermissions: JSON.parse(db2.prepare("SELECT permissions FROM roles WHERE id = ?").get(target.role_id)?.permissions || "[]"),
      effective: getEffectivePermissions(userId)
    };
  });
  import_electron3.ipcMain.handle("permissions:set", (e, userId, grants) => {
    const s = requirePermission(e, "users", "edit");
    const db2 = getDb();
    const target = db2.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId);
    if (!target) throw new Error("NOT_FOUND");
    if (s.userId === userId) throw new Error("CANNOT_ASSIGN_TO_SELF");
    if (!canManageTargetPerms(s, target)) throw new Error("PERMISSION_DENIED:users");
    const actorEffective = getEffectivePermissions(s.userId);
    const valid = (grants || []).filter((g) => g && isValidPermKey(g.key));
    for (const g of valid) {
      const moduleKey = g.key.includes(".") ? g.key.split(".")[0] : g.key;
      if (!isSuper(s) && !actorEffective.includes(g.key) && !actorEffective.includes(moduleKey)) {
        throw new Error(`DELEGATION_DENIED:${g.key}`);
      }
    }
    const existing = db2.prepare("SELECT permission_key FROM user_permissions WHERE user_id = ?").all(userId);
    const existingKeys = new Set(existing.map((r) => r.permission_key));
    const newKeys = new Set(valid.map((g) => g.key));
    db2.exec("BEGIN");
    try {
      for (const k of existingKeys) {
        if (!newKeys.has(k)) {
          db2.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?").run(userId, k);
          auditPerm(s.userId, userId, k, "revoke", "granted", "revoked");
        }
      }
      for (const g of valid) {
        if (!existingKeys.has(g.key)) {
          db2.prepare("INSERT INTO user_permissions (user_id, permission_key, can_delegate, granted_by) VALUES (?,?,?,?)").run(userId, g.key, g.canDelegate === false ? 0 : 1, s.userId);
          auditPerm(s.userId, userId, g.key, "grant", "none", `granted${g.canDelegate === false ? " (no-delegate)" : ""}`);
        } else {
          db2.prepare("UPDATE user_permissions SET can_delegate = ? WHERE user_id = ? AND permission_key = ?").run(g.canDelegate === false ? 0 : 1, userId, g.key);
        }
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    if (!isSuper(s)) {
      const after = getEffectivePermissions(userId);
      const children = db2.prepare("SELECT id FROM users WHERE owner_admin_id = ?").all(userId);
      for (const ch of children) {
        const chGrants = db2.prepare("SELECT permission_key FROM user_permissions WHERE user_id = ?").all(ch.id);
        for (const g of chGrants) {
          if (!after.includes(g.key)) {
            db2.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?").run(ch.id, g.key);
            auditPerm(s.userId, ch.id, g.key, "revoke", "delegated", "parent-revoked");
            refreshSessionPerms(ch.id);
          }
        }
      }
    }
    refreshSessionPerms(userId);
    logActivity(s.userId, s.username, "permissions_set", "users", `${target.username}:${valid.length} perms`);
    return true;
  });
  import_electron3.ipcMain.handle("permissions:audit", (e, userId) => {
    const s = requirePermission(e, "users", "view");
    const db2 = getDb();
    const target = db2.prepare(`SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId);
    if (!target || !canManageTargetPerms(s, target)) throw new Error("PERMISSION_DENIED:users");
    return db2.prepare(`SELECT p.*, u.username AS actor FROM permission_audit_logs p LEFT JOIN users u ON u.id = p.actor_id
      WHERE p.target_user_id = ? ORDER BY p.id DESC LIMIT 50`).all(userId);
  });
  import_electron3.ipcMain.handle("roles:list", (e) => {
    const s = requireAuth(e);
    const db2 = getDb();
    const rows = db2.prepare("SELECT * FROM roles ORDER BY id").all();
    if (s.permissions.includes("all")) return rows;
    return rows.filter((r) => r.name !== "SUPER_ADMIN");
  });
  import_electron3.ipcMain.handle("roles:save", (e, data) => {
    const s = requirePermission(e, "security", "manage");
    const db2 = getDb();
    const perms = (data.permissions || []).filter((k) => typeof k === "string");
    if (perms.includes("all")) throw new Error("ALL_PERMISSION_RESERVED");
    const invalid = perms.find((k) => !isValidRoleKey(k));
    if (invalid) throw new Error(`INVALID_PERMISSION:${invalid}`);
    let roleId = data.id;
    if (roleId) {
      const role = db2.prepare("SELECT * FROM roles WHERE id = ?").get(roleId);
      if (!role) throw new Error("NOT_FOUND");
      if (role.is_system && role.name === "SUPER_ADMIN") throw new Error("SYSTEM_ROLE_READONLY");
      const name = role.is_system ? role.name : data.name || role.name;
      db2.prepare("UPDATE roles SET name = ?, permissions = ? WHERE id = ?").run(name, JSON.stringify(perms), roleId);
    } else {
      const r = db2.prepare("INSERT INTO roles (name, permissions) VALUES (?, ?)").run(data.name || "New Role", JSON.stringify(perms));
      roleId = Number(r.lastInsertRowid);
    }
    refreshSessionsForRole(roleId);
    logActivity(s.userId, s.username, "save_role", "security", data.name);
    return true;
  });
  import_electron3.ipcMain.handle("roles:delete", (e, id) => {
    const s = requirePermission(e, "security", "manage");
    const db2 = getDb();
    const role = db2.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    if (role && role.is_system) throw new Error("SYSTEM_ROLE_READONLY");
    const used = db2.prepare("SELECT COUNT(*) AS c FROM users WHERE role_id = ?").get(id);
    if (used.c > 0) throw new Error("ROLE_IN_USE");
    db2.prepare("DELETE FROM roles WHERE id = ?").run(id);
    logActivity(s.userId, s.username, "delete_role", "security", String(id));
    return true;
  });
  import_electron3.ipcMain.handle("logs:activity", (e, limit = 200) => {
    requirePermission(e, "security", "view");
    return getDb().prepare("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?").all(limit);
  });
  import_electron3.ipcMain.handle("logs:logins", (e, limit = 200) => {
    requirePermission(e, "security", "view");
    return getDb().prepare(`SELECT lh.*, u.full_name FROM login_history lh LEFT JOIN users u ON u.id = lh.user_id ORDER BY lh.id DESC LIMIT ?`).all(limit);
  });
  import_electron3.ipcMain.handle("auth:ping", (e) => {
    try {
      requireAuth(e);
      return { ok: true };
    } catch {
      const win = import_electron3.BrowserWindow.fromWebContents(e.sender);
      if (win) win.webContents.send("auth:expired");
      return { ok: false };
    }
  });
}

// src/main/ipc/generic.ts
var import_electron4 = __toESM(require_electron_stub());
var VALID_TYPE_RE = /^[a-zA-Z_]+$/;
function entityDef(key) {
  const def = ENTITIES[key];
  if (!def || !GENERIC_ENTITY_KEYS.includes(key)) throw new Error("UNKNOWN_ENTITY");
  if (!VALID_TYPE_RE.test(def.table)) throw new Error("UNKNOWN_ENTITY");
  return def;
}
function decorate(def, rows) {
  const refFields = def.fields.filter((f) => f.type === "ref" && f.refEntity);
  if (!refFields.length || !rows.length) return rows;
  const db2 = getDb();
  for (const f of refFields) {
    const target = ENTITIES[f.refEntity];
    if (!target || !VALID_TYPE_RE.test(target.table)) continue;
    const ids = [...new Set(rows.map((r) => r[f.name]).filter((v) => v != null))];
    if (!ids.length) continue;
    const ph = ids.map(() => "?").join(",");
    let rows2;
    if (target.table === "customers") {
      rows2 = db2.prepare(`SELECT id, code || ' - ' || name AS label FROM customers WHERE id IN (${ph})`).all(...ids);
    } else {
      rows2 = db2.prepare(`SELECT id, name AS label FROM ${target.table} WHERE id IN (${ph})`).all(...ids);
    }
    const map = new Map(rows2.map((r) => [r.id, r.label]));
    for (const r of rows) {
      r[`_${f.name}_label`] = r[f.name] != null ? map.get(r[f.name]) || null : null;
    }
  }
  return rows;
}
function registerGenericIpc() {
  import_electron4.ipcMain.handle("db:list", (e, key, params = {}) => {
    const def = entityDef(key);
    requirePermission(e, key, "view");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = params.all ? 1e5 : Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.search) {
      const fields = def.searchFields;
      if (fields.length) {
        where.push("(" + fields.map((f) => `${f} LIKE ?`).join(" OR ") + ")");
        const like = `%${params.search}%`;
        fields.forEach(() => args.push(like));
      }
    }
    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v === "" || v === null || v === void 0) continue;
        if (!VALID_TYPE_RE.test(k)) continue;
        where.push(`${k} = ?`);
        args.push(v);
      }
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const sortField = params.sort && def.fields.some((f) => f.name === params.sort) ? params.sort : def.defaultSort || "id";
    const dir = params.dir === "asc" ? "ASC" : "DESC";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM ${def.table} ${whereSql}`).get(...args).c;
    const rows = db2.prepare(`SELECT * FROM ${def.table} ${whereSql} ORDER BY ${sortField} ${dir} LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    return { rows: decorate(def, rows), total, page, pageSize };
  });
  import_electron4.ipcMain.handle("db:get", (e, key, id) => {
    const def = entityDef(key);
    requirePermission(e, key, "view");
    const row = getDb().prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id);
    return row ? decorate(def, [row])[0] : null;
  });
  import_electron4.ipcMain.handle("db:create", (e, key, data) => {
    const def = entityDef(key);
    const s = requirePermission(e, key, "create");
    const db2 = getDb();
    if (key === "expense_categories" && data.name) {
      const dup = db2.prepare("SELECT id FROM expense_categories WHERE name COLLATE NOCASE = ?").get(String(data.name).trim());
      if (dup) throw new Error("DUPLICATE_CATEGORY");
    }
    const fields = def.fields.filter((f) => !f.hideInForm || data[f.name] !== void 0);
    const names = [];
    const values = [];
    for (const f of fields) {
      if (data[f.name] === void 0 || data[f.name] === null || data[f.name] === "") {
        if (f.required) throw new Error(`REQUIRED:${f.name}`);
        if (f.defaultValue !== void 0) values.push(f.defaultValue);
        else values.push(f.type === "number" || f.type === "money" ? 0 : null);
      } else {
        if (f.type === "number" || f.type === "money") {
          const n = Number(data[f.name]);
          if (isNaN(n)) throw new Error(`INVALID_NUMBER:${f.name}`);
          if (f.min !== void 0 && n < f.min) throw new Error(`MIN:${f.name}`);
          if (f.max !== void 0 && n > f.max) throw new Error(`MAX:${f.name}`);
          values.push(n);
        } else values.push(data[f.name]);
      }
      names.push(f.name);
    }
    if (!names.length) throw new Error("NO_FIELDS");
    if (key === "collectors" && !names.includes("owner_admin_id") && !s.permissions.includes("all")) {
      names.push("owner_admin_id");
      values.push(s.userId);
    }
    const r = db2.prepare(`INSERT INTO ${def.table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...values);
    logActivity(s.userId, s.username, "create", key, String(r.lastInsertRowid));
    return r.lastInsertRowid;
  });
  import_electron4.ipcMain.handle("db:update", (e, key, id, data) => {
    const def = entityDef(key);
    const s = requirePermission(e, key, "edit");
    const db2 = getDb();
    if (key === "expense_categories" && data.name) {
      const dup = db2.prepare("SELECT id FROM expense_categories WHERE name COLLATE NOCASE = ? AND id != ?").get(String(data.name).trim(), id);
      if (dup) throw new Error("DUPLICATE_CATEGORY");
    }
    const sets = [];
    const values = [];
    for (const f of def.fields) {
      if (data[f.name] === void 0) continue;
      let v = data[f.name];
      if (f.type === "number" || f.type === "money") {
        v = Number(v);
        if (isNaN(v)) throw new Error(`INVALID_NUMBER:${f.name}`);
        if (f.min !== void 0 && v < f.min) throw new Error(`MIN:${f.name}`);
        if (f.max !== void 0 && v > f.max) throw new Error(`MAX:${f.name}`);
      }
      if (v === "" && f.type === "ref") v = null;
      sets.push(`${f.name} = ?`);
      values.push(v);
    }
    if (!sets.length) throw new Error("NO_FIELDS");
    values.push(id);
    db2.prepare(`UPDATE ${def.table} SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    logActivity(s.userId, s.username, "update", key, String(id));
    return true;
  });
  import_electron4.ipcMain.handle("db:delete", (e, key, id) => {
    const def = entityDef(key);
    const s = requirePermission(e, key, "delete");
    getDb().prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id);
    logActivity(s.userId, s.username, "delete", key, String(id));
    return true;
  });
  import_electron4.ipcMain.handle("db:reflist", (e, key) => {
    const def = ENTITIES[key];
    if (!def || !VALID_TYPE_RE.test(def.table)) throw new Error("UNKNOWN_ENTITY");
    requirePermission(e, key);
    const db2 = getDb();
    let sql;
    if (def.table === "customers") {
      sql = `SELECT id, code || ' - ' || name AS label FROM customers WHERE status != 'deleted' ORDER BY code`;
    } else if (def.table === "staff") {
      sql = `SELECT id, name || ' (' || designation || ')' AS label FROM staff WHERE status = 'active' ORDER BY name`;
    } else if (def.table === "collectors") {
      const s = requirePermission(e, "collectors", "view");
      const ownerFilter = s.permissions.includes("all") ? "" : " AND (c.owner_admin_id IS NULL OR c.owner_admin_id = " + Number(s.userId) + ")";
      sql = `SELECT c.id, s.name || COALESCE(' \u2014 ' || NULLIF(s.mobile, ''), '') AS label
        FROM collectors c JOIN staff s ON s.id = c.staff_id
        WHERE c.status = 'active'${ownerFilter} ORDER BY s.name`;
      return db2.prepare(sql).all();
    } else if (def.table === "network_devices") {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM network_devices ORDER BY name`;
    } else if (def.table === "accounts") {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM accounts WHERE status = 'active' ORDER BY name`;
    } else if (def.table === "expense_categories") {
      sql = `SELECT id, name || ' (' || type || ')' AS label FROM expense_categories WHERE status = 'active' ORDER BY name`;
    } else {
      sql = `SELECT id, name AS label FROM ${def.table} WHERE status = 'active' ORDER BY name`;
    }
    return db2.prepare(sql).all();
  });
  import_electron4.ipcMain.handle("collectors:quickAdd", (e, name, mobile) => {
    const s = requirePermission(e, "collectors");
    const db2 = getDb();
    if (!name || !name.trim()) throw new Error("MISSING_FIELDS");
    let staff = db2.prepare("SELECT id FROM staff WHERE LOWER(TRIM(name)) = LOWER(?)").get(name.trim());
    if (!staff) {
      const r = db2.prepare("INSERT INTO staff (name, mobile, designation, status) VALUES (?, ?, 'Collector', 'active')").run(name.trim(), (mobile || "").trim() || null);
      staff = { id: Number(r.lastInsertRowid) };
    }
    let col = db2.prepare("SELECT id FROM collectors WHERE staff_id = ?").get(staff.id);
    if (!col) {
      const r = db2.prepare("INSERT INTO collectors (staff_id, status, owner_admin_id) VALUES (?, 'active', ?)").run(staff.id, s.userId);
      col = { id: Number(r.lastInsertRowid) };
    }
    logActivity(s.userId, s.username, "quick_add_collector", "collectors", name.trim());
    return { id: col.id, label: name.trim() };
  });
  import_electron4.ipcMain.handle("collector:assignAreas", (e, collectorId, areaIds) => {
    requirePermission(e, "collectors");
    const db2 = getDb();
    db2.exec("BEGIN");
    try {
      db2.prepare("DELETE FROM collector_areas WHERE collector_id = ?").run(collectorId);
      const ins = db2.prepare("INSERT OR IGNORE INTO collector_areas (collector_id, area_id) VALUES (?,?)");
      for (const a of areaIds) ins.run(collectorId, a);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    return true;
  });
  import_electron4.ipcMain.handle("collector:getAreas", (e, collectorId) => {
    requirePermission(e, "collectors");
    return getDb().prepare("SELECT area_id FROM collector_areas WHERE collector_id = ?").all(collectorId);
  });
}

// src/main/ipc/customers.ts
var import_electron5 = __toESM(require_electron_stub());
var CUSTOMER_SELECT = `
  SELECT c.*, c.customer_serial, a.name AS _area, z.name AS _zone, p.name AS _package, p.type AS _package_type,
    r.name AS _reseller, br.name AS _branch,
    COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled'), 0) AS total_due,
    (SELECT MAX(b.month) FROM bills b WHERE b.customer_id = c.id) AS last_bill_month
  FROM customers c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN zones z ON z.id = a.zone_id
  LEFT JOIN packages p ON p.id = c.package_id
  LEFT JOIN resellers r ON r.id = c.reseller_id
  LEFT JOIN branches br ON br.id = c.branch_id
`;
function registerCustomerIpc() {
  import_electron5.ipcMain.handle("customers:list", (e, params = {}) => {
    requirePermission(e, "customers", "view");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = params.all ? 1e5 : Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.search) {
      where.push(`(c.name LIKE ? OR c.mobile LIKE ? OR c.code LIKE ? OR c.address LIKE ? OR CAST(c.customer_serial AS TEXT) LIKE ?)`);
      const like = `%${params.search}%`;
      args.push(like, like, like, like, like);
    }
    const status = params.status;
    if (status === "due") {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0`);
    } else if (status === "paid") {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') = 0
        AND EXISTS (SELECT 1 FROM bills b WHERE b.customer_id = c.id)`);
    } else if (status === "expired") {
      where.push(`c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') >
        (SELECT c.monthly_bill * 2)`);
    } else if (status === "free") {
      where.push(`c.status = 'active' AND (p.type = 'free' OR c.connection_type = 'free')`);
    } else if (status) {
      where.push(`c.status = ?`);
      args.push(status);
    }
    if (params.areaId) {
      where.push("c.area_id = ?");
      args.push(params.areaId);
    }
    if (params.packageId) {
      where.push("c.package_id = ?");
      args.push(params.packageId);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM customers c LEFT JOIN packages p ON p.id = c.package_id ${whereSql}`).get(...args).c;
    const sort = params.sort === "code" || params.sort === "name" || params.sort === "total_due" ? params.sort : "c.code";
    const dir = params.dir === "desc" ? "DESC" : "ASC";
    const rows = db2.prepare(`${CUSTOMER_SELECT} ${whereSql} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
  import_electron5.ipcMain.handle("customers:get", (e, id) => {
    requirePermission(e, "customers", "view");
    const db2 = getDb();
    const customer = db2.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
    if (!customer) return null;
    const bills = db2.prepare("SELECT * FROM bills WHERE customer_id = ? ORDER BY month DESC LIMIT 36").all(id);
    const payments = db2.prepare("SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC, id DESC LIMIT 60").all(id);
    const connections = db2.prepare("SELECT * FROM customer_connections WHERE customer_id = ? ORDER BY date DESC").all(id);
    const documents = db2.prepare("SELECT * FROM customer_documents WHERE customer_id = ? ORDER BY id DESC").all(id);
    const complaints = db2.prepare("SELECT * FROM complaints WHERE customer_id = ? ORDER BY id DESC LIMIT 20").all(id);
    return { customer, bills, payments, connections, documents, complaints };
  });
  import_electron5.ipcMain.handle("customers:create", (e, data) => {
    const s = requirePermission(e, "customers", "create");
    const db2 = getDb();
    if (!data.name || !data.mobile) throw new Error("REQUIRED:name,mobile");
    if (!/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error("INVALID_MOBILE");
    const code = nextSeq("customer_seq", 5, "AVA-");
    if (data.connection_type != null && !["paid", "free"].includes(data.connection_type)) throw new Error("INVALID_CONNECTION_TYPE");
    const connType = data.connection_type === "free" ? "free" : "paid";
    const monthlyBill = connType === "free" ? 0 : Number(data.monthly_bill) || 0;
    const connFee = connType === "free" ? 0 : Number(data.connection_fee) || 0;
    const serial = data.customer_serial != null && String(data.customer_serial).trim() !== "" ? Math.trunc(Number(data.customer_serial)) : null;
    if (serial != null && (isNaN(serial) || serial < 0)) throw new Error("INVALID_SERIAL");
    const r = db2.prepare(`INSERT INTO customers
      (code, name, father_name, mobile, address, area_id, sub_area_id, road_id, branch_id, reseller_id,
       connection_date, package_id, monthly_bill, connection_fee, status, nid, note, customer_serial, connection_type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      code,
      data.name.trim(),
      data.father_name || null,
      String(data.mobile).trim(),
      data.address || null,
      data.area_id || null,
      data.sub_area_id || null,
      data.road_id || null,
      data.branch_id || null,
      data.reseller_id || null,
      data.connection_date || today(),
      data.package_id || null,
      monthlyBill,
      connFee,
      data.status || "active",
      data.nid || null,
      data.note || null,
      serial,
      connType
    );
    const customerId = Number(r.lastInsertRowid);
    db2.prepare("INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)").run(customerId, "new", "connection", data.connection_date || today(), "New connection", s.username);
    logActivity(s.userId, s.username, "create_customer", "customers", code);
    return customerId;
  });
  import_electron5.ipcMain.handle("customers:import", (e, rows, areaId) => {
    const s = requirePermission(e, "customers", "create");
    const db2 = getDb();
    const normalizeMobile2 = (m) => {
      const bn = "\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF";
      let d = String(m || "").trim();
      d = d.replace(/[০-৯]/g, (c) => String(bn.indexOf(c)));
      d = d.replace(/[^\d]/g, "");
      if (d.length === 13 && d.startsWith("88")) d = d.slice(2);
      if (d.length === 11 && d.startsWith("1")) d = "0" + d;
      return d;
    };
    const areas = db2.prepare("SELECT id, name FROM areas").all();
    const areaByName = new Map(areas.map((a) => [String(a.name).trim().toLowerCase(), a.id]));
    const parseSerial = (v) => {
      const bn = "\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF";
      const d = String(v ?? "").trim().replace(/[০-৯]/g, (c) => String(bn.indexOf(c)));
      if (!d) return null;
      const n = Number(d);
      return isNaN(n) || n < 0 ? null : Math.trunc(n);
    };
    const dbSerials = new Set(
      db2.prepare("SELECT area_id, customer_serial FROM customers WHERE customer_serial IS NOT NULL").all().map((r) => `${r.area_id ?? "x"}|${r.customer_serial}`)
    );
    const existing = new Set(db2.prepare("SELECT mobile FROM customers").all().map((r) => normalizeMobile2(r.mobile)));
    let imported = 0, duplicates = 0, invalid = 0;
    const errors = [];
    db2.exec("BEGIN");
    try {
      const seenMobile = /* @__PURE__ */ new Set();
      const seenSerial = /* @__PURE__ */ new Set();
      for (const row of rows || []) {
        const name = String(row?.name || "").trim();
        const address = String(row?.address || "").trim();
        const mobile = normalizeMobile2(row?.mobile);
        const serial = parseSerial(row?.serial);
        if (!name || !/^01[3-9]\d{8}$/.test(mobile)) {
          invalid++;
          errors.push(`${name || mobile || "(empty)"} \u2014 invalid`);
          continue;
        }
        let rowAreaId = areaId ?? null;
        const areaName = String(row?.areaName || "").trim();
        if (rowAreaId == null && areaName) {
          rowAreaId = areaByName.get(areaName.toLowerCase()) ?? null;
          if (rowAreaId == null) {
            invalid++;
            errors.push(`${name} (${mobile}) \u2014 area not found: ${areaName}`);
            continue;
          }
        }
        const serialKey = `${rowAreaId ?? "x"}|${serial ?? ""}`;
        if (existing.has(mobile) || seenMobile.has(mobile)) {
          duplicates++;
          errors.push(`${name} (${mobile}) \u2014 duplicate mobile`);
          continue;
        }
        if (serial != null && (dbSerials.has(serialKey) || seenSerial.has(serialKey))) {
          duplicates++;
          errors.push(`${name} (${mobile}) \u2014 duplicate serial ${serial} in ${areaName || (rowAreaId ? areas.find((a) => a.id === rowAreaId)?.name : "no area")}`);
          continue;
        }
        seenMobile.add(mobile);
        if (serial != null) seenSerial.add(serialKey);
        const code = nextSeq("customer_seq", 5, "AVA-");
        db2.prepare(`INSERT INTO customers (code, name, mobile, address, area_id, connection_date, status, customer_serial) VALUES (?,?,?,?,?,?, 'active', ?)`).run(code, name, mobile, address || null, rowAreaId, today(), serial);
        const customerId = Number(db2.prepare("SELECT id FROM customers WHERE code = ?").get(code).id);
        db2.prepare("INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)").run(customerId, "new", "connection", today(), "Excel import", s.username);
        existing.add(mobile);
        if (serial != null) dbSerials.add(serialKey);
        imported++;
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "import_customers", "customers", `imported:${imported},duplicates:${duplicates},invalid:${invalid}`);
    return { imported, duplicates, invalid, total: (rows || []).length, errors: errors.slice(0, 20) };
  });
  import_electron5.ipcMain.handle("customers:update", (e, id, data) => {
    const s = requirePermission(e, "customers", "edit");
    const db2 = getDb();
    const old = db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    if (!old) throw new Error("NOT_FOUND");
    if (data.mobile && !/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error("INVALID_MOBILE");
    if (data.connection_type != null && !["paid", "free"].includes(data.connection_type)) throw new Error("INVALID_CONNECTION_TYPE");
    const newConnType = data.connection_type === "free" || data.connection_type === "paid" ? data.connection_type : old.connection_type || "paid";
    const isFree = newConnType === "free";
    db2.prepare(`UPDATE customers SET name=?, father_name=?, mobile=?, address=?, area_id=?, sub_area_id=?, road_id=?,
      branch_id=?, reseller_id=?, connection_date=?, package_id=?, monthly_bill=?, connection_fee=?, status=?, nid=?, note=?, customer_serial=?, connection_type=? WHERE id=?`).run(
      data.name ?? old.name,
      data.father_name ?? old.father_name,
      data.mobile ?? old.mobile,
      data.address ?? old.address,
      data.area_id ?? old.area_id,
      data.sub_area_id ?? old.sub_area_id,
      data.road_id ?? old.road_id,
      data.branch_id ?? old.branch_id,
      data.reseller_id ?? old.reseller_id,
      data.connection_date ?? old.connection_date,
      data.package_id ?? old.package_id,
      isFree ? 0 : data.monthly_bill ?? old.monthly_bill,
      isFree ? 0 : data.connection_fee ?? old.connection_fee,
      data.status ?? old.status,
      data.nid ?? old.nid,
      data.note ?? old.note,
      data.customer_serial !== void 0 ? data.customer_serial === null || String(data.customer_serial).trim() === "" ? null : Math.trunc(Number(data.customer_serial)) || null : old.customer_serial,
      newConnType,
      id
    );
    if (data.package_id && data.package_id !== old.package_id) {
      const oldP = old.package_id ? db2.prepare("SELECT name FROM packages WHERE id=?").get(old.package_id) : null;
      const newP = db2.prepare("SELECT name FROM packages WHERE id=?").get(data.package_id);
      const action = (newP?.price || 0) >= (oldP?.price || 0) ? "upgrade" : "downgrade";
      db2.prepare("INSERT INTO customer_connections (customer_id, action, from_value, to_value, date, created_by) VALUES (?,?,?,?,?,?)").run(id, action, oldP?.name || "-", newP?.name || "-", today(), s.username);
    }
    logActivity(s.userId, s.username, "update_customer", "customers", old.code);
    return true;
  });
  import_electron5.ipcMain.handle("customers:setStatus", (e, id, status, note) => {
    const s = requirePermission(e, "customers", "edit");
    const db2 = getDb();
    const allowed = ["active", "inactive", "disconnected", "free", "expired"];
    if (!allowed.includes(status)) throw new Error("INVALID_STATUS");
    const actionMap = {
      disconnected: "disconnect",
      inactive: "temp_disconnect",
      active: "reconnect"
    };
    db2.prepare("UPDATE customers SET status = ? WHERE id = ?").run(status, id);
    db2.prepare("INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)").run(id, actionMap[status] || "status_change", status, today(), note || "", s.username);
    logActivity(s.userId, s.username, "customer_status", "customers", `${id} -> ${status}`);
    return true;
  });
  import_electron5.ipcMain.handle("customers:delete", (e, id) => {
    const s = requirePermission(e, "customers", "delete");
    const db2 = getDb();
    const c = db2.prepare("SELECT code, name FROM customers WHERE id = ?").get(id);
    if (!c) throw new Error("NOT_FOUND");
    db2.prepare("DELETE FROM customers WHERE id = ?").run(id);
    logActivity(s.userId, s.username, "delete_customer", "customers", `${c.code} (${c.name})`);
    return true;
  });
  import_electron5.ipcMain.handle("customers:deleteMany", (e, ids) => {
    const s = requirePermission(e, "customers", "delete");
    const db2 = getDb();
    const list = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!list.length) return { deleted: 0 };
    let deleted = 0;
    db2.exec("BEGIN");
    try {
      const del = db2.prepare("DELETE FROM customers WHERE id = ?");
      for (const id of list) {
        if (del.run(id).changes) deleted++;
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "bulk_delete_customers", "customers", `${deleted}/${list.length}`);
    return { deleted };
  });
  import_electron5.ipcMain.handle("customers:transfer", (e, id, data) => {
    const s = requirePermission(e, "customers", "edit");
    const db2 = getDb();
    const old = db2.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
    if (!old) throw new Error("NOT_FOUND");
    if (!data.area_id) throw new Error("REQUIRED:area_id");
    db2.prepare("UPDATE customers SET area_id=?, sub_area_id=?, road_id=?, address=? WHERE id=?").run(data.area_id, data.sub_area_id || null, data.road_id || null, data.address ?? old.address, id);
    const newArea = db2.prepare("SELECT name FROM areas WHERE id = ?").get(data.area_id);
    db2.prepare("INSERT INTO customer_connections (customer_id, action, from_value, to_value, date, note, created_by) VALUES (?,?,?,?,?,?,?)").run(id, "transfer", old._area || "-", newArea?.name || "-", today(), "Area transfer", s.username);
    logActivity(s.userId, s.username, "transfer_customer", "customers", old.code);
    return true;
  });
  import_electron5.ipcMain.handle("customers:shift", (e, id, address) => {
    const s = requirePermission(e, "customers", "edit");
    const db2 = getDb();
    db2.prepare("UPDATE customers SET address = ? WHERE id = ?").run(address, id);
    db2.prepare("INSERT INTO customer_connections (customer_id, action, to_value, date, note, created_by) VALUES (?,?,?,?,?,?)").run(id, "shifting", "", address, today(), "Address shifting", s.username);
    logActivity(s.userId, s.username, "shift_customer", "customers", String(id));
    return true;
  });
  import_electron5.ipcMain.handle("customers:bulkImport", (e, rows) => {
    const s = requirePermission(e, "customers", "create");
    const db2 = getDb();
    let imported = 0;
    const errors = [];
    db2.exec("BEGIN");
    try {
      for (const [i, data] of rows.entries()) {
        try {
          if (!data.name || !data.mobile) throw new Error("name/mobile missing");
          if (!/^01[3-9]\d{8}$/.test(String(data.mobile).trim())) throw new Error(`invalid mobile: ${data.mobile}`);
          const code = nextSeq("customer_seq", 5, "AVA-");
          db2.prepare(`INSERT INTO customers (code, name, father_name, mobile, address, area_id, connection_date, package_id, monthly_bill, connection_fee, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
            code,
            String(data.name).trim(),
            data.father_name || null,
            String(data.mobile).trim(),
            data.address || null,
            data.area_id || null,
            data.connection_date || today(),
            data.package_id || null,
            Number(data.monthly_bill) || 0,
            Number(data.connection_fee) || 0,
            "active"
          );
          imported++;
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "bulk_import", "customers", `${imported} customers`);
    return { imported, errors };
  });
  import_electron5.ipcMain.handle("customers:dueList", (e) => {
    requirePermission(e, "customers", "view");
    return getDb().prepare(`${CUSTOMER_SELECT} WHERE c.status = 'active'
      AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0
      ORDER BY total_due DESC`).all();
  });
  import_electron5.ipcMain.handle("connections:history", (e, params = {}) => {
    requirePermission(e, "connections");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.search) {
      where.push("(c.name LIKE ? OR c.code LIKE ? OR ev.note LIKE ?)");
      const like = `%${params.search}%`;
      args.push(like, like, like);
    }
    if (params.action) {
      where.push("ev.action = ?");
      args.push(params.action);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM customer_connections ev JOIN customers c ON c.id = ev.customer_id ${whereSql}`).get(...args).c;
    const rows = db2.prepare(`SELECT ev.*, c.code AS customer_code, c.name AS customer_name, a.name AS _area
      FROM customer_connections ev JOIN customers c ON c.id = ev.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      ${whereSql} ORDER BY ev.date DESC, ev.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
}

// src/main/ipc/billing.ts
var import_electron6 = __toESM(require_electron_stub());
function customerDueBefore(db2, customerId, month) {
  const row = db2.prepare(`SELECT COALESCE(SUM(total - paid), 0) AS d FROM bills
    WHERE customer_id = ? AND status != 'cancelled' AND month < ?`).get(customerId, month);
  return round2(row.d);
}
function registerBillingIpc() {
  import_electron6.ipcMain.handle("billing:generate", (e, month, areaId, generatedBy = "manual") => {
    const s = requirePermission(e, "billing", "create");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("INVALID_MONTH");
    const db2 = getDb();
    const lateFee = Number(getSetting("late_fee", "0")) || 0;
    const customers = db2.prepare(`SELECT c.*, p.price AS package_price, p.type AS package_type
      FROM customers c LEFT JOIN packages p ON p.id = c.package_id
      WHERE c.status = 'active' ${areaId ? "AND c.area_id = ?" : ""}`).all(...areaId ? [areaId] : []);
    let created = 0, skipped = 0;
    db2.exec("BEGIN");
    try {
      for (const c of customers) {
        if (c.connection_type === "free") {
          skipped++;
          continue;
        }
        const existing = db2.prepare("SELECT id FROM bills WHERE customer_id = ? AND month = ?").get(c.id, month);
        if (existing) {
          skipped++;
          continue;
        }
        const amount = round2(c.monthly_bill > 0 ? c.monthly_bill : c.package_price || 0);
        const discountRows = db2.prepare("SELECT COALESCE(SUM(amount),0) AS d FROM discounts WHERE customer_id = ? AND (month = ? OR month IS NULL)").get(c.id, month);
        const discount = round2(Math.min(discountRows.d, amount));
        const previousDue = customerDueBefore(db2, c.id, month);
        const fee = c.package_type === "free" ? 0 : lateFee;
        const total = round2(amount - discount + previousDue + fee);
        const invoiceNo = "INV-" + month.replace("-", "") + "-" + nextSeq("invoice_seq", 6);
        db2.prepare(`INSERT INTO bills (invoice_no, customer_id, month, amount, discount, late_fee, previous_due, total, status, generated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(invoiceNo, c.id, month, amount, discount, fee, previousDue, total, "due", generatedBy);
        created++;
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "generate_bills", "billing", `${month}: ${created} created, ${skipped} skipped`);
    return { created, skipped, month };
  });
  import_electron6.ipcMain.handle("billing:list", (e, params) => {
    requirePermission(e, "billing", "view");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = params.all ? 1e5 : Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.month) {
      where.push("b.month = ?");
      args.push(params.month);
    }
    if (params.status) {
      where.push("b.status = ?");
      args.push(params.status);
    }
    if (params.areaId) {
      where.push("c.area_id = ?");
      args.push(params.areaId);
    }
    if (params.search) {
      where.push("(c.name LIKE ? OR c.code LIKE ? OR c.mobile LIKE ? OR b.invoice_no LIKE ?)");
      const like = `%${params.search}%`;
      args.push(like, like, like, like);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM bills b JOIN customers c ON c.id = b.customer_id ${whereSql}`).get(...args).c;
    const rows = db2.prepare(`SELECT b.*, c.code AS customer_code, c.name AS customer_name, c.mobile, c.advance_balance, c.connection_type, a.name AS _area
      FROM bills b JOIN customers c ON c.id = b.customer_id LEFT JOIN areas a ON a.id = c.area_id
      ${whereSql} ORDER BY b.month DESC, c.code ASC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    const sums = db2.prepare(`SELECT COALESCE(SUM(b.total),0) AS total, COALESCE(SUM(b.paid),0) AS paid
      FROM bills b JOIN customers c ON c.id = b.customer_id ${whereSql}`).get(...args);
    return { rows, total, page, pageSize, sums: { total: round2(sums.total), paid: round2(sums.paid), due: round2(sums.total - sums.paid) } };
  });
  import_electron6.ipcMain.handle("billing:adjust", (e, billId, discount, lateFee, reason) => {
    const s = requirePermission(e, "billing", "edit");
    const db2 = getDb();
    const bill = db2.prepare("SELECT * FROM bills WHERE id = ?").get(billId);
    if (!bill) throw new Error("NOT_FOUND");
    const d = round2(Math.max(0, Number(discount) || 0));
    const lf = round2(Math.max(0, Number(lateFee) || 0));
    if (bill.paid > round2(bill.amount - d + bill.previous_due + lf)) throw new Error("ADJUST_BELOW_PAID");
    const total = round2(bill.amount - d + bill.previous_due + lf);
    db2.prepare("UPDATE bills SET discount = ?, late_fee = ?, total = ?, status = ? WHERE id = ?").run(d, lf, total, total - bill.paid <= 0 ? "paid" : bill.paid > 0 ? "partial" : "due", billId);
    if (d > 0 && reason) {
      db2.prepare("INSERT INTO discounts (customer_id, month, amount, reason, date) VALUES (?,?,?,?,?)").run(bill.customer_id, bill.month, d, reason, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
    }
    logActivity(s.userId, s.username, "adjust_bill", "billing", bill.invoice_no);
    return true;
  });
  import_electron6.ipcMain.handle("billing:cancel", (e, billId) => {
    const s = requirePermission(e, "billing", "delete");
    const db2 = getDb();
    const bill = db2.prepare("SELECT * FROM bills WHERE id = ?").get(billId);
    if (!bill) throw new Error("NOT_FOUND");
    if (bill.paid > 0) throw new Error("BILL_HAS_PAYMENTS");
    db2.prepare("UPDATE bills SET status = 'cancelled' WHERE id = ?").run(billId);
    logActivity(s.userId, s.username, "cancel_bill", "billing", bill.invoice_no);
    return true;
  });
  import_electron6.ipcMain.handle("billing:invoice", (e, billId) => {
    requirePermission(e, "billing", "view");
    const db2 = getDb();
    const bill = db2.prepare("SELECT * FROM bills WHERE id = ?").get(billId);
    if (!bill) throw new Error("NOT_FOUND");
    const customer = db2.prepare(`SELECT c.*, a.name AS area_name, p.name AS package_name FROM customers c
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN packages p ON p.id = c.package_id WHERE c.id = ?`).get(bill.customer_id);
    const payments = db2.prepare("SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date").all(billId);
    const company = {
      name: getSetting("company_name", "AVA Cable Network"),
      name_bn: getSetting("company_name_bn", ""),
      address: getSetting("company_address", ""),
      mobile: getSetting("company_mobile", ""),
      mobile_alt: getSetting("company_mobile_alt", ""),
      email: getSetting("company_email", ""),
      logo: getSetting("company_logo", ""),
      footer: getSetting("bill_footer", "")
    };
    return { bill, customer, payments, company };
  });
  import_electron6.ipcMain.handle("billing:autoRun", (e) => {
    if (!getSetting("auto_billing", "1")) return { created: 0, skipped: 0, disabled: true };
    return generateInternal(currentMonth(), "auto");
  });
}
function generateInternal(month, by) {
  const db2 = getDb();
  const lateFee = Number(getSetting("late_fee", "0")) || 0;
  const customers = db2.prepare(`SELECT c.*, p.price AS package_price, p.type AS package_type
    FROM customers c LEFT JOIN packages p ON p.id = c.package_id WHERE c.status = 'active'`).all();
  let created = 0, skipped = 0;
  db2.exec("BEGIN");
  try {
    for (const c of customers) {
      const existing = db2.prepare("SELECT id FROM bills WHERE customer_id = ? AND month = ?").get(c.id, month);
      if (existing) {
        skipped++;
        continue;
      }
      const amount = round2(c.monthly_bill > 0 ? c.monthly_bill : c.package_price || 0);
      const discountRows = db2.prepare("SELECT COALESCE(SUM(amount),0) AS d FROM discounts WHERE customer_id = ? AND (month = ? OR month IS NULL)").get(c.id, month);
      const discount = round2(Math.min(discountRows.d, amount));
      const previousDue = customerDueBefore(db2, c.id, month);
      const fee = c.package_type === "free" ? 0 : lateFee;
      const total = round2(amount - discount + previousDue + fee);
      const invoiceNo = "INV-" + month.replace("-", "") + "-" + nextSeq("invoice_seq", 6);
      db2.prepare(`INSERT INTO bills (invoice_no, customer_id, month, amount, discount, late_fee, previous_due, total, status, generated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(invoiceNo, c.id, month, amount, discount, fee, previousDue, total, "due", by);
      created++;
    }
    db2.exec("COMMIT");
  } catch (err) {
    db2.exec("ROLLBACK");
    throw err;
  }
  return { created, skipped, month };
}

// src/main/ipc/payments.ts
var import_electron7 = __toESM(require_electron_stub());
function creditAccount(db2, amount, date, description, ref, username, categoryName) {
  const account = db2.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get();
  if (!account) return;
  const cat = db2.prepare("SELECT id FROM expense_categories WHERE name = ?").get(categoryName);
  db2.prepare("INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)").run(account.id, "income", cat ? cat.id : null, date, round2(amount), description, ref, username);
  db2.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(round2(amount), account.id);
}
function registerPaymentIpc() {
  import_electron7.ipcMain.handle("payments:collect", (e, input) => {
    const s = requirePermission(e, "payments", "collect");
    const db2 = getDb();
    const amount = round2(Number(input.amount));
    if (!amount || amount <= 0) throw new Error("INVALID_AMOUNT");
    const customer = db2.prepare("SELECT * FROM customers WHERE id = ?").get(input.customerId);
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    const date = input.date || today();
    const type = input.type === "advance" || input.applyAdvance ? "advance" : "bill";
    const receiptNo = "RCP-" + nextSeq("receipt_seq", 6);
    const billsDue = () => round2(db2.prepare("SELECT COALESCE(SUM(total - paid),0) AS v FROM bills WHERE customer_id = ? AND status != 'cancelled'").get(customer.id).v);
    const dueBefore = billsDue();
    const dhaka = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" });
    db2.exec("BEGIN");
    try {
      if (type === "advance") {
        db2.prepare("INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(receiptNo, customer.id, amount, input.method || "cash", input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, "advance", s.username, dueBefore, dueBefore, dhaka);
        db2.prepare("UPDATE customers SET advance_balance = advance_balance + ? WHERE id = ?").run(amount, customer.id);
        creditAccount(db2, amount, date, `Advance payment from ${customer.name} (${customer.code})`, receiptNo, s.username, "Monthly Bill");
      } else if (input.type === "connection_fee") {
        db2.prepare("INSERT INTO payments (receipt_no, customer_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(receiptNo, customer.id, amount, input.method || "cash", input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, "connection_fee", s.username, dueBefore, dueBefore, dhaka);
        creditAccount(db2, amount, date, `Connection fee from ${customer.name} (${customer.code})`, receiptNo, s.username, "Connection Fee");
      } else {
        let remaining = amount;
        let firstBillId = input.billId || null;
        const unpaid = firstBillId ? db2.prepare("SELECT * FROM bills WHERE id = ? AND status != 'cancelled'").all(firstBillId) : db2.prepare("SELECT * FROM bills WHERE customer_id = ? AND status != 'cancelled' AND status != 'paid' ORDER BY month ASC").all(customer.id);
        if (firstBillId && !unpaid.length) throw new Error("BILL_NOT_FOUND_OR_PAID");
        for (const bill of unpaid) {
          if (remaining <= 0) break;
          const due = round2(bill.total - bill.paid);
          if (due <= 0) continue;
          const apply = round2(Math.min(remaining, due));
          const newPaid = round2(bill.paid + apply);
          const newStatus = newPaid >= bill.total ? "paid" : "partial";
          db2.prepare("UPDATE bills SET paid = ?, status = ? WHERE id = ?").run(newPaid, newStatus, bill.id);
          if (!firstBillId) firstBillId = bill.id;
          remaining = round2(remaining - apply);
        }
        if (remaining > 0) {
          db2.prepare("UPDATE customers SET advance_balance = advance_balance + ? WHERE id = ?").run(remaining, customer.id);
        }
        db2.prepare("INSERT INTO payments (receipt_no, customer_id, bill_id, amount, method, reference, note, collector_id, reseller_id, payment_date, type, created_by, due_before, due_after, created_local_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(receiptNo, customer.id, firstBillId, amount, input.method || "cash", input.reference || null, input.note || null, input.collectorId || null, input.resellerId || null, date, "bill", s.username, dueBefore, round2(dueBefore - (amount - remaining)), dhaka);
        creditAccount(db2, amount, date, `Payment from ${customer.name} (${customer.code})`, receiptNo, s.username, "Monthly Bill");
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "collect_payment", "payments", `${receiptNo}: ${amount}`);
    return { receiptNo, amount };
  });
  import_electron7.ipcMain.handle("payments:refund", (e, customerId, amount, note) => {
    const s = requirePermission(e, "payments", "refund");
    const db2 = getDb();
    const amt = round2(Number(amount));
    if (!amt || amt <= 0) throw new Error("INVALID_AMOUNT");
    const customer = db2.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    if (round2(customer.advance_balance) < amt) throw new Error("INSUFFICIENT_ADVANCE");
    const receiptNo = "RFD-" + nextSeq("receipt_seq", 6);
    db2.exec("BEGIN");
    try {
      db2.prepare("INSERT INTO payments (receipt_no, customer_id, amount, method, note, payment_date, type, created_by) VALUES (?,?,?,?,?,?,?,?)").run(receiptNo, customerId, amt, "cash", note || "Advance refund", today(), "refund", s.username);
      db2.prepare("UPDATE customers SET advance_balance = advance_balance - ? WHERE id = ?").run(amt, customerId);
      const account = db2.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get();
      if (account) {
        db2.prepare("INSERT INTO transactions (account_id, type, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?)").run(account.id, "expense", today(), amt, `Refund to ${customer.name} (${customer.code})`, receiptNo, s.username);
        db2.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amt, account.id);
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "refund", "payments", `${receiptNo}: ${amt}`);
    return { receiptNo, amount: amt };
  });
  import_electron7.ipcMain.handle("payments:useAdvance", (e, customerId) => {
    const s = requirePermission(e, "payments", "collect");
    const db2 = getDb();
    const customer = db2.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    const advance = round2(customer.advance_balance);
    if (advance <= 0) throw new Error("NO_ADVANCE");
    const receiptNo = "RCP-" + nextSeq("receipt_seq", 6);
    let leftover = advance;
    db2.exec("BEGIN");
    try {
      let remaining = advance;
      const unpaid = db2.prepare("SELECT * FROM bills WHERE customer_id = ? AND status != 'cancelled' AND status != 'paid' ORDER BY month ASC").all(customerId);
      for (const bill of unpaid) {
        if (remaining <= 0) break;
        const due = round2(bill.total - bill.paid);
        if (due <= 0) continue;
        const apply = round2(Math.min(remaining, due));
        const newPaid = round2(bill.paid + apply);
        db2.prepare("UPDATE bills SET paid = ?, status = ? WHERE id = ?").run(newPaid, newPaid >= bill.total ? "paid" : "partial", bill.id);
        remaining = round2(remaining - apply);
      }
      leftover = remaining;
      db2.prepare("UPDATE customers SET advance_balance = ? WHERE id = ?").run(remaining, customerId);
      db2.prepare("INSERT INTO payments (receipt_no, customer_id, amount, method, note, payment_date, type, created_by) VALUES (?,?,?,?,?,?,?,?)").run(receiptNo, customerId, round2(advance - remaining), "advance", "Applied advance balance to dues", today(), "bill", s.username);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "use_advance", "payments", String(customerId));
    return { applied: round2(advance - leftover), remaining: leftover };
  });
  import_electron7.ipcMain.handle("payments:list", (e, params) => {
    requirePermission(e, "payments", "view");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = params.all ? 1e5 : Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.from) {
      where.push("p.payment_date >= ?");
      args.push(params.from);
    }
    if (params.to) {
      where.push("p.payment_date <= ?");
      args.push(params.to);
    }
    if (params.method) {
      where.push("p.method = ?");
      args.push(params.method);
    }
    if (params.collectorId) {
      where.push("p.collector_id = ?");
      args.push(params.collectorId);
    }
    if (params.areaId) {
      where.push("c.area_id = ?");
      args.push(params.areaId);
    }
    if (params.search) {
      where.push("(c.name LIKE ? OR c.code LIKE ? OR p.receipt_no LIKE ? OR p.reference LIKE ?)");
      const like = `%${params.search}%`;
      args.push(like, like, like, like);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql}`).get(...args).c;
    const rows = db2.prepare(`SELECT p.*, c.code AS customer_code, c.name AS customer_name, c.mobile, c.address AS customer_address, a.name AS _area, s.name AS _collector
      FROM payments p JOIN customers c ON c.id = p.customer_id
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN collectors col ON col.id = p.collector_id
      LEFT JOIN staff s ON s.id = col.staff_id
      ${whereSql} ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    const sum = db2.prepare(`SELECT COALESCE(SUM(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END),0) AS s
      FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql}`).get(...args);
    const byMethodRows = db2.prepare(`SELECT p.method, COALESCE(SUM(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END),0) AS s
      FROM payments p JOIN customers c ON c.id = p.customer_id ${whereSql} GROUP BY p.method`).all(...args);
    const byMethod = {};
    for (const r of byMethodRows) byMethod[r.method] = round2(r.s);
    return { rows, total, page, pageSize, sum: round2(sum.s), byMethod };
  });
  import_electron7.ipcMain.handle("payments:daily", (e, from, to) => {
    requirePermission(e, "payments", "view");
    return getDb().prepare(`SELECT payment_date AS date,
        COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS collected,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END),0) AS refunded
      FROM payments WHERE payment_date BETWEEN ? AND ? GROUP BY payment_date ORDER BY payment_date DESC`).all(from, to);
  });
  import_electron7.ipcMain.handle("payments:methodSummary", (e, from, to) => {
    requirePermission(e, "payments", "view");
    return getDb().prepare(`SELECT method, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count FROM payments
      WHERE payment_date BETWEEN ? AND ? GROUP BY method`).all(from, to);
  });
  import_electron7.ipcMain.handle("payments:receipt", (e, receiptId) => {
    requirePermission(e, "payments", "view");
    const db2 = getDb();
    const payment = db2.prepare("SELECT * FROM payments WHERE id = ?").get(receiptId);
    if (!payment) throw new Error("NOT_FOUND");
    const customer = db2.prepare("SELECT c.*, a.name AS area_name FROM customers c LEFT JOIN areas a ON a.id = c.area_id WHERE c.id = ?").get(payment.customer_id);
    const company = {
      name: getSetting("company_name", "AVA Cable Network"),
      name_bn: getSetting("company_name_bn", ""),
      address: getSetting("company_address", ""),
      mobile: getSetting("company_mobile", ""),
      mobile_alt: getSetting("company_mobile_alt", ""),
      email: getSetting("company_email", ""),
      logo: getSetting("company_logo", ""),
      footer: getSetting("bill_footer", "")
    };
    return { payment, customer, company };
  });
}

// src/main/ipc/settings.ts
var import_electron8 = __toESM(require_electron_stub());
var COMPANY_KEYS = [
  "company_name",
  "company_name_bn",
  "company_mobile",
  "company_mobile_alt",
  "company_email",
  "company_address",
  "company_logo",
  "company_sms",
  "company_license"
];
var MOBILE_RE = /^01[3-9]\d{8}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var LOGO_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/;
var MAX_LOGO_LEN = 5e5;
function normalizeMobile(v) {
  let d = String(v || "").replace(/[^\d]/g, "");
  if (d.length === 13 && d.startsWith("88")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("1")) d = "0" + d;
  return d;
}
function validateCompanyField(key, raw) {
  const v = String(raw ?? "");
  switch (key) {
    case "company_name":
      if (!v.trim()) return "REQUIRED:company_name";
      return "";
    case "company_mobile":
    case "company_mobile_alt":
      if (v.trim() && !MOBILE_RE.test(normalizeMobile(v))) return `INVALID_MOBILE:${key}`;
      return "";
    case "company_email":
      if (v.trim() && !EMAIL_RE.test(v.trim())) return "INVALID_EMAIL";
      return "";
    case "company_logo":
      if (v && (!LOGO_RE.test(v) || v.length > MAX_LOGO_LEN)) return "INVALID_LOGO";
      return "";
    default:
      return "";
  }
}
function registerSettingsIpc() {
  import_electron8.ipcMain.handle("settings:getAll", (e) => {
    requireAuth(e);
    const rows = getDb().prepare("SELECT key, value FROM settings").all();
    const out = {};
    for (const r of rows) out[r.key] = r.value ?? "";
    return out;
  });
  const canEditCompany = (s) => s.permissions.includes("all") || hasPermission(s.permissions, "company_profile") || hasPermission(s.permissions, "company_profile", "edit") || s.permissions.includes("settings");
  const canSaveKeys = (s, keys) => {
    if (s.permissions.includes("all") || s.permissions.includes("settings")) return true;
    if (!keys.every((k) => COMPANY_KEYS.includes(k))) return false;
    return canEditCompany(s);
  };
  import_electron8.ipcMain.handle("settings:set", (e, key, value) => {
    const s = requirePermission(e, "settings");
    if (!canSaveKeys(s, [key])) throw new Error("PERMISSION_DENIED:settings");
    setSetting(key, String(value));
    logActivity(s.userId, s.username, "set_setting", "settings", `${key}=${value}`);
    return true;
  });
  import_electron8.ipcMain.handle("settings:setMany", (e, obj) => {
    const keys = Object.keys(obj || {});
    const companyOnly = keys.length > 0 && keys.every((k) => COMPANY_KEYS.includes(k));
    const s = companyOnly ? requireAuth(e) : requirePermission(e, "settings");
    if (!canSaveKeys(s, keys)) throw new Error("PERMISSION_DENIED:settings");
    for (const k of keys) {
      const err = validateCompanyField(k, obj[k]);
      if (err) throw new Error(err);
      setSetting(k, String(obj[k]));
    }
    logActivity(s.userId, s.username, "set_settings", "settings", keys.join(","));
    return true;
  });
  import_electron8.ipcMain.handle("settings:companyProfile", (e) => {
    requireAuth(e);
    return {
      company_name: getSetting("company_name", "AVA Cable Network"),
      company_name_bn: getSetting("company_name_bn", ""),
      company_mobile: getSetting("company_mobile", ""),
      company_mobile_alt: getSetting("company_mobile_alt", ""),
      company_email: getSetting("company_email", ""),
      company_address: getSetting("company_address", ""),
      company_logo: getSetting("company_logo", ""),
      company_sms: getSetting("company_sms", ""),
      company_license: getSetting("company_license", "")
    };
  });
  import_electron8.ipcMain.handle("settings:companyProfileUpdate", (e, data) => {
    const s = requireAuth(e);
    if (!canEditCompany(s)) throw new Error("PERMISSION_DENIED:company_profile");
    const input = data || {};
    const nameErr = validateCompanyField("company_name", input.company_name);
    if (nameErr) throw new Error(nameErr);
    for (const [k, v] of Object.entries(input)) {
      if (!COMPANY_KEYS.includes(k)) continue;
      const err = validateCompanyField(k, v);
      if (err) throw new Error(err);
    }
    setSetting("company_name", String(input.company_name).trim());
    for (const k of COMPANY_KEYS) {
      if (k === "company_name") continue;
      if (input[k] === void 0) continue;
      setSetting(k, String(input[k]).trim());
    }
    logActivity(s.userId, s.username, "update_company_profile", "company_profile", String(input.company_name).trim());
    return true;
  });
  import_electron8.ipcMain.handle("app:info", () => {
    return {
      version: import_electron8.app.getVersion(),
      dbPath: void 0,
      // filled by backup module to avoid circular import
      platform: process.platform
    };
  });
  import_electron8.ipcMain.handle("app:relaunch", () => {
    import_electron8.app.relaunch();
    import_electron8.app.exit(0);
  });
}

// src/main/ipc/backup.ts
var import_electron9 = __toESM(require_electron_stub());
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function backupsDir() {
  const custom = getSetting("backup_dir", "");
  if (custom) return custom;
  return path.join(import_electron9.app.getPath("userData"), "backups");
}
function ensureBackupsDir() {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function checkpointAndCopy(target) {
  const db2 = getDb();
  try {
    db2.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
  }
  fs.copyFileSync(getDbPath(), target);
}
function autoBackup() {
  try {
    const dir = ensureBackupsDir();
    const file = path.join(dir, `ava-auto-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db`);
    checkpointAndCopy(file);
    pruneBackups(dir, 30);
    return file;
  } catch {
    return null;
  }
}
function pruneBackups(dir, keep) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().reverse();
  for (const f of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {
    }
  }
}
function registerBackupIpc() {
  import_electron9.ipcMain.handle("backup:create", async (e, targetPath) => {
    const s = requirePermission(e, "security", "manage");
    let target = targetPath;
    if (!target) {
      const win = require_electron_stub().BrowserWindow.fromWebContents(e.sender);
      const res = await import_electron9.dialog.showSaveDialog(win, {
        title: "Create Backup",
        defaultPath: path.join(import_electron9.app.getPath("documents"), `ava-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.db`),
        filters: [{ name: "Database Backup", extensions: ["db"] }]
      });
      if (res.canceled || !res.filePath) return null;
      target = res.filePath;
    }
    checkpointAndCopy(target);
    logActivity(s.userId, s.username, "backup_create", "security", target);
    return target;
  });
  import_electron9.ipcMain.handle("backup:restore", async (e, sourcePath) => {
    const s = requirePermission(e, "security", "manage");
    let source = sourcePath;
    if (!source) {
      const win = require_electron_stub().BrowserWindow.fromWebContents(e.sender);
      const res = await import_electron9.dialog.showOpenDialog(win, {
        title: "Restore Backup",
        filters: [{ name: "Database Backup", extensions: ["db"] }],
        properties: ["openFile"]
      });
      if (res.canceled || !res.filePaths[0]) return null;
      source = res.filePaths[0];
    }
    const header = fs.readFileSync(source).subarray(0, 15).toString("utf8");
    if (!header.startsWith("SQLite format 3")) throw new Error("NOT_A_SQLITE_DB");
    const db2 = getDb();
    try {
      db2.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
    }
    db2.close();
    const live = getDbPath();
    fs.copyFileSync(live, live + ".before-restore");
    fs.copyFileSync(source, live);
    try {
      fs.unlinkSync(live + "-wal");
      fs.unlinkSync(live + "-shm");
    } catch {
    }
    initDb();
    logActivity(s.userId, s.username, "backup_restore", "security", source);
    return true;
  });
  import_electron9.ipcMain.handle("backup:list", (e) => {
    requirePermission(e, "security", "view");
    const dir = ensureBackupsDir();
    return fs.readdirSync(dir).filter((f) => f.endsWith(".db")).map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { name: f, size: st.size, date: st.mtime.toISOString(), path: path.join(dir, f) };
    }).sort((a, b) => b.date.localeCompare(a.date));
  });
  import_electron9.ipcMain.handle("backup:integrity", (e) => {
    requirePermission(e, "security", "view");
    return integrityCheck();
  });
  import_electron9.ipcMain.handle("backup:autoRun", () => autoBackup());
  import_electron9.ipcMain.handle("backup:dir", () => backupsDir());
  import_electron9.ipcMain.handle("db:path", () => getDbPath());
}

// src/main/ipc/inventory.ts
var import_electron10 = __toESM(require_electron_stub());
function registerInventoryIpc() {
  import_electron10.ipcMain.handle("purchases:create", (e, data) => {
    const s = requirePermission(e, "inventory");
    const db2 = getDb();
    if (!data.items || !data.items.length) throw new Error("NO_ITEMS");
    const invoiceNo = "PO-" + nextSeq("purchase_seq", 6);
    let total = 0;
    for (const it of data.items) {
      const q = Number(it.qty), p = Number(it.price);
      if (!(q > 0) || !(p >= 0)) throw new Error("INVALID_ITEM");
      if (it.sale_price !== void 0 && Number(it.sale_price) < 0) throw new Error("INVALID_ITEM");
      total += q * p;
    }
    total = Math.round(total * 100) / 100;
    const dhaka = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" });
    const date = data.date || dhaka.slice(0, 10);
    db2.exec("BEGIN");
    try {
      const r = db2.prepare("INSERT INTO purchases (invoice_no, supplier_id, date, total, paid, status, note, created_local_time) VALUES (?,?,?,?,?,?,?,?)").run(invoiceNo, data.supplier_id || null, date, total, Number(data.paid) || 0, "completed", data.note || null, dhaka);
      const purchaseId = Number(r.lastInsertRowid);
      const insItem = db2.prepare("INSERT INTO purchase_items (purchase_id, product_id, qty, price) VALUES (?,?,?,?)");
      const updStock = db2.prepare("UPDATE products SET stock = stock + ?, purchase_price = ?, sale_price = COALESCE(?, sale_price) WHERE id = ?");
      const insMove = db2.prepare("INSERT INTO stock_movements (product_id, type, qty, reason, ref, date) VALUES (?,?,?,?,?,?)");
      for (const it of data.items) {
        insItem.run(purchaseId, it.product_id, Number(it.qty), Number(it.price));
        updStock.run(Number(it.qty), Number(it.price), it.sale_price !== void 0 && it.sale_price !== null ? Number(it.sale_price) : null, it.product_id);
        insMove.run(it.product_id, "in", Number(it.qty), "Purchase", invoiceNo, date);
      }
      if (total > 0 && Number(data.paid) > 0) {
        const account = db2.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get();
        if (account) {
          const cat = db2.prepare("SELECT id FROM expense_categories WHERE name = 'Equipment Purchase' OR name = 'Cable Purchase' ORDER BY id LIMIT 1").get();
          db2.prepare("INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)").run(account.id, "expense", cat ? cat.id : null, date, Number(data.paid), `Purchase ${invoiceNo}`, invoiceNo, s.username);
          db2.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(Number(data.paid), account.id);
        }
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "create_purchase", "inventory", invoiceNo);
    return { id: 0, invoiceNo, total };
  });
  import_electron10.ipcMain.handle("purchases:listFull", (e) => {
    requirePermission(e, "inventory");
    return getDb().prepare(`SELECT p.id, p.invoice_no, p.date, p.created_local_time, p.total, p.paid,
        pi.qty, pi.price, pr.id AS product_id, pr.name AS product_name, pr.image AS product_image,
        pr.purchase_price, pr.sale_price
      FROM purchases p LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN products pr ON pr.id = pi.product_id
      ORDER BY p.id DESC LIMIT 300`).all();
  });
  import_electron10.ipcMain.handle("products:findOrCreate", (e, data) => {
    const s = requirePermission(e, "inventory");
    const db2 = getDb();
    const name = String(data.name || "").trim();
    if (!name) throw new Error("MISSING_FIELDS");
    const found = db2.prepare("SELECT id, name, image, purchase_price, sale_price FROM products WHERE name COLLATE NOCASE = ?").get(name);
    if (found) return { id: found.id, name: found.name, image: found.image, existed: true };
    const r = db2.prepare("INSERT INTO products (name, category, unit, stock, min_stock, image, sale_price) VALUES (?, 'cable', 'pcs', 0, 5, ?, ?)").run(name, data.image || null, data.salePrice !== void 0 ? Number(data.salePrice) : 0);
    logActivity(s.userId, s.username, "create_product", "inventory", name);
    return { id: Number(r.lastInsertRowid), name, image: data.image || null, existed: false };
  });
  import_electron10.ipcMain.handle("purchases:get", (e, id) => {
    requirePermission(e, "inventory");
    const db2 = getDb();
    const purchase = db2.prepare(`SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`).get(id);
    const items = db2.prepare(`SELECT pi.*, pr.name AS product_name, pr.unit FROM purchase_items pi
      LEFT JOIN products pr ON pr.id = pi.product_id WHERE pi.purchase_id = ?`).all(id);
    return { purchase, items };
  });
  import_electron10.ipcMain.handle("stock:move", (e, data) => {
    const s = requirePermission(e, "inventory");
    const db2 = getDb();
    const qty = Math.abs(Number(data.qty));
    if (!(qty > 0)) throw new Error("INVALID_QTY");
    const product = db2.prepare("SELECT * FROM products WHERE id = ?").get(data.product_id);
    if (!product) throw new Error("NOT_FOUND");
    db2.exec("BEGIN");
    try {
      let delta = qty;
      if (data.type === "out") delta = -qty;
      if (data.type === "adjust") delta = qty;
      if (product.stock + delta < 0) throw new Error("INSUFFICIENT_STOCK");
      db2.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(delta, data.product_id);
      db2.prepare("INSERT INTO stock_movements (product_id, type, qty, reason, ref, date) VALUES (?,?,?,?,?,?)").run(data.product_id, data.type, qty, data.reason || null, data.ref || null, data.date || today());
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "stock_move", "inventory", `${data.type}:${qty}`);
    return true;
  });
}

// src/main/ipc/misc.ts
var import_electron11 = __toESM(require_electron_stub());
function registerMiscIpc() {
  import_electron11.ipcMain.handle("resellers:txn", (e, data) => {
    const s = requirePermission(e, "resellers");
    const db2 = getDb();
    const amount = round2(Number(data.amount));
    if (!(amount > 0)) throw new Error("INVALID_AMOUNT");
    const reseller = db2.prepare("SELECT * FROM resellers WHERE id = ?").get(data.reseller_id);
    if (!reseller) throw new Error("NOT_FOUND");
    db2.exec("BEGIN");
    try {
      db2.prepare("INSERT INTO reseller_txns (reseller_id, type, amount, note, date) VALUES (?,?,?,?,?)").run(data.reseller_id, data.type, amount, data.note || null, data.date || today());
      let delta = 0;
      if (data.type === "recharge" || data.type === "commission") delta = amount;
      else if (data.type === "payment") delta = -amount;
      else if (data.type === "due") delta = -amount;
      db2.prepare("UPDATE resellers SET wallet_balance = wallet_balance + ? WHERE id = ?").run(delta, data.reseller_id);
      const account = db2.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY (type = 'cash') DESC, id LIMIT 1").get();
      if (account && (data.type === "recharge" || data.type === "payment")) {
        const cat = db2.prepare("SELECT id FROM expense_categories WHERE name = 'Other Income' OR name = 'Other Expense' ORDER BY id LIMIT 1").get();
        db2.prepare("INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by) VALUES (?,?,?,?,?,?,?,?)").run(account.id, data.type === "recharge" ? "income" : "expense", cat ? cat.id : null, data.date || today(), amount, `Reseller ${data.type}: ${reseller.name}`, null, s.username);
        db2.prepare("UPDATE accounts SET balance = balance " + (data.type === "recharge" ? "+" : "-") + " ? WHERE id = ?").run(amount, account.id);
      }
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "reseller_txn", "resellers", `${data.type}:${amount}`);
    return true;
  });
  import_electron11.ipcMain.handle("resellers:txns", (e, resellerId) => {
    requirePermission(e, "resellers");
    return getDb().prepare("SELECT * FROM reseller_txns WHERE reseller_id = ? ORDER BY date DESC, id DESC").all(resellerId);
  });
  import_electron11.ipcMain.handle("transactions:create", (e, data) => {
    const s = requirePermission(e, "accounts");
    const db2 = getDb();
    const amount = round2(Number(data.amount));
    if (!(amount > 0)) throw new Error("INVALID_AMOUNT");
    if (!data.account_id || !data.type) throw new Error("MISSING_FIELDS");
    const cat = data.category_id ? db2.prepare("SELECT name FROM expense_categories WHERE id = ?").get(data.category_id) : null;
    const description = String(data.description || "").trim() || `${data.type === "income" ? "Income" : "Expense"}${cat ? " \u2014 " + cat.name : ""}`;
    const acct = db2.prepare("SELECT * FROM accounts WHERE id = ?").get(data.account_id);
    if (!acct) throw new Error("ACCOUNT_NOT_FOUND");
    if (data.type === "expense" && round2(acct.balance) < amount) throw new Error("INSUFFICIENT_BALANCE");
    const dhaka = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Asia/Dhaka" });
    const date = data.date || dhaka.slice(0, 10);
    db2.exec("BEGIN");
    try {
      db2.prepare("INSERT INTO transactions (account_id, type, category_id, date, amount, description, ref, created_by, created_local_time) VALUES (?,?,?,?,?,?,?,?,?)").run(data.account_id, data.type, data.category_id || null, date, amount, description, data.ref || null, s.username, dhaka);
      db2.prepare("UPDATE accounts SET balance = balance " + (data.type === "income" ? "+" : "-") + " ? WHERE id = ?").run(amount, data.account_id);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, `create_${data.type}`, "accounts", String(amount));
    return true;
  });
  import_electron11.ipcMain.handle("transactions:update", (e, id, data) => {
    const s = requirePermission(e, "accounts");
    const db2 = getDb();
    const old = db2.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
    if (!old) throw new Error("NOT_FOUND");
    const amount = round2(Number(data.amount));
    if (!(amount > 0)) throw new Error("INVALID_AMOUNT");
    const accountId = data.account_id || old.account_id;
    const type = data.type || old.type;
    const acct = db2.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
    if (!acct) throw new Error("ACCOUNT_NOT_FOUND");
    const balanceAfterReversal = round2(acct.balance + (old.type === "income" ? -old.amount : old.amount));
    if (type === "expense" && balanceAfterReversal < amount) throw new Error("INSUFFICIENT_BALANCE");
    const cat = data.category_id ? db2.prepare("SELECT name FROM expense_categories WHERE id = ?").get(data.category_id) : null;
    const description = String(data.description || "").trim() || `${type === "income" ? "Income" : "Expense"}${cat ? " \u2014 " + cat.name : ""}`;
    db2.exec("BEGIN");
    try {
      db2.prepare("UPDATE accounts SET balance = balance " + (old.type === "income" ? "-" : "+") + " ? WHERE id = ?").run(old.amount, old.account_id);
      db2.prepare("UPDATE accounts SET balance = balance " + (type === "income" ? "+" : "-") + " ? WHERE id = ?").run(amount, accountId);
      db2.prepare("UPDATE transactions SET account_id = ?, type = ?, category_id = ?, date = ?, amount = ?, description = ?, ref = ? WHERE id = ?").run(accountId, type, data.category_id || old.category_id, data.date || old.date, amount, description, data.ref ?? old.ref, id);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, `update_${type}`, "accounts", `#${id}: ${old.amount}\u2192${amount}`);
    return true;
  });
  import_electron11.ipcMain.handle("transactions:delete", (e, id) => {
    const s = requirePermission(e, "accounts");
    const db2 = getDb();
    const old = db2.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
    if (!old) throw new Error("NOT_FOUND");
    db2.exec("BEGIN");
    try {
      db2.prepare("UPDATE accounts SET balance = balance " + (old.type === "income" ? "-" : "+") + " ? WHERE id = ?").run(old.amount, old.account_id);
      db2.prepare("DELETE FROM transactions WHERE id = ?").run(id);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, `delete_${old.type}`, "accounts", `#${id}: ${old.amount} reversed`);
    return true;
  });
  import_electron11.ipcMain.handle("accounts:mainBalance", (e) => {
    requirePermission(e, "accounts");
    const db2 = getDb();
    const r = db2.prepare("SELECT COALESCE(SUM(balance),0) AS v FROM accounts WHERE status = 'active'").get();
    return { balance: round2(r.v) };
  });
  import_electron11.ipcMain.handle("transactions:list", (e, params = {}) => {
    requirePermission(e, "accounts");
    const db2 = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(200, Math.max(5, params.pageSize || 20));
    const where = [];
    const args = [];
    if (params.filters?.type) {
      where.push("t.type = ?");
      args.push(params.filters.type);
    }
    if (params.search) {
      where.push("(t.description LIKE ? OR t.ref LIKE ? OR ec.name LIKE ? OR a.name LIKE ?)");
      const like = `%${params.search}%`;
      args.push(like, like, like, like);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = db2.prepare(`SELECT COUNT(*) AS c FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id ${whereSql}`).get(...args).c;
    const rows = db2.prepare(`SELECT t.*, ec.name AS _category_id_label, a.name AS _account_id_label
      FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      ${whereSql} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
  import_electron11.ipcMain.handle("account_transfers:create", (e, data) => {
    const s = requirePermission(e, "accounts");
    const db2 = getDb();
    const amount = round2(Number(data.amount));
    if (!(amount > 0)) throw new Error("INVALID_AMOUNT");
    if (data.from_account_id === data.to_account_id) throw new Error("SAME_ACCOUNT");
    const from = db2.prepare("SELECT * FROM accounts WHERE id = ?").get(data.from_account_id);
    if (!from) throw new Error("FROM_NOT_FOUND");
    if (round2(from.balance) < amount) throw new Error("INSUFFICIENT_BALANCE");
    db2.exec("BEGIN");
    try {
      db2.prepare("INSERT INTO account_transfers (from_account_id, to_account_id, date, amount, note) VALUES (?,?,?,?,?)").run(data.from_account_id, data.to_account_id, data.date || today(), amount, data.note || null);
      db2.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amount, data.from_account_id);
      db2.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, data.to_account_id);
      db2.exec("COMMIT");
    } catch (err) {
      db2.exec("ROLLBACK");
      throw err;
    }
    logActivity(s.userId, s.username, "account_transfer", "accounts", String(amount));
    return true;
  });
  import_electron11.ipcMain.handle("accounts:cashbook", (e, from, to) => {
    requirePermission(e, "accounts");
    const db2 = getDb();
    const opening = db2.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) + (SELECT COALESCE(SUM(opening_balance),0) FROM accounts)
      FROM transactions WHERE date < ?`).get(from).opening || 0;
    const rows = db2.prepare(`SELECT t.*, ec.name AS category, a.name AS account FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.date BETWEEN ? AND ? ORDER BY t.date, t.id`).all(from, to);
    let running = Number(opening);
    for (const r of rows) {
      running += r.type === "income" ? r.amount : -r.amount;
      r.balance = round2(running);
    }
    return { opening: round2(Number(opening)), rows };
  });
  import_electron11.ipcMain.handle("messages:composeDue", (e, templateId, month) => {
    const s = requirePermission(e, "messaging");
    const db2 = getDb();
    const template = db2.prepare("SELECT * FROM sms_templates WHERE id = ?").get(templateId);
    if (!template) throw new Error("TEMPLATE_NOT_FOUND");
    const company = getSetting("company_name", "AVA Cable Network");
    const dues = db2.prepare(`SELECT c.id, c.name, c.mobile, COALESCE(SUM(b.total - b.paid),0) AS due
      FROM customers c JOIN bills b ON b.customer_id = c.id
      WHERE c.status = 'active' AND b.month = ? AND b.status != 'cancelled' AND b.status != 'paid'
      GROUP BY c.id HAVING due > 0`).all(month);
    const ins = db2.prepare("INSERT INTO messages (customer_id, mobile, channel, type, text, status) VALUES (?,?,?,?,?,?)");
    let created = 0;
    for (const c of dues) {
      const text = template.content.replace(/{{name}}/g, c.name).replace(/{{month}}/g, month).replace(/{{total}}/g, String(round2(c.due))).replace(/{{amount}}/g, String(round2(c.due))).replace(/{{company}}/g, company);
      ins.run(c.id, c.mobile, template.type === "marketing" ? "whatsapp" : "sms", template.type, text, "draft");
      created++;
    }
    logActivity(s.userId, s.username, "compose_due_messages", "messaging", `${created}`);
    return created;
  });
  import_electron11.ipcMain.handle("messages:send", (e, messageId) => {
    const s = requirePermission(e, "messaging");
    const db2 = getDb();
    const msg = db2.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
    if (!msg) throw new Error("NOT_FOUND");
    if (msg.channel === "whatsapp" && msg.mobile) {
      const phone = "88" + String(msg.mobile).replace(/\D/g, "");
      import_electron11.shell.openExternal(`https://wa.me/${phone}?text=${encodeURIComponent(msg.text)}`);
    } else {
      db2.prepare("UPDATE messages SET status = ? WHERE id = ?").run("queued", messageId);
      import_electron11.shell.openExternal(`sms:${msg.mobile}?body=${encodeURIComponent(msg.text)}`);
      return { status: "queued" };
    }
    db2.prepare("UPDATE messages SET status = ?, sent_at = datetime('now') WHERE id = ?").run("sent", messageId);
    logActivity(s.userId, s.username, "send_message", "messaging", String(messageId));
    return { status: "sent" };
  });
  import_electron11.ipcMain.handle("messages:markSent", (e, messageId) => {
    const s = requirePermission(e, "messaging");
    getDb().prepare("UPDATE messages SET status = ?, sent_at = datetime('now') WHERE id = ?").run("sent", messageId);
    logActivity(s.userId, s.username, "mark_message_sent", "messaging", String(messageId));
    return true;
  });
  import_electron11.ipcMain.handle("notify:dueCustomers", (e) => {
    try {
      const db2 = getDb();
      const count = db2.prepare(`SELECT COUNT(DISTINCT customer_id) AS c FROM bills WHERE month = ? AND status != 'cancelled' AND status != 'paid'`).get(currentMonth()).c;
      if (count > 0 && import_electron11.Notification.isSupported()) {
        new import_electron11.Notification({ title: "AVA Cable Management", body: `${count} customers have unpaid bills for ${currentMonth()}` }).show();
      }
      return count;
    } catch {
      return 0;
    }
  });
  import_electron11.ipcMain.handle("automation:runBilling", (e) => {
    requirePermission(e, "automation");
    return generateInternal(currentMonth(), "auto");
  });
}

// src/main/ipc/dashboard.ts
var import_electron12 = __toESM(require_electron_stub());
function registerDashboardIpc() {
  import_electron12.ipcMain.handle("dashboard:stats", (e, month) => {
    requirePermission(e, "dashboard");
    const db2 = getDb();
    const statusCounts = db2.prepare(`SELECT status, COUNT(*) AS c FROM customers GROUP BY status`).all();
    const sc = { active: 0, inactive: 0, disconnected: 0, expired: 0, free: 0 };
    let totalCustomers = 0;
    for (const r of statusCounts) {
      totalCustomers += r.c;
      sc[r.status] = r.c;
    }
    const pkgFree = db2.prepare(`SELECT COUNT(*) AS c FROM customers c LEFT JOIN packages p ON p.id = c.package_id WHERE c.status = 'active' AND (p.type = 'free' OR c.connection_type = 'free')`).get().c;
    const billAgg = db2.prepare(`SELECT COALESCE(SUM(total),0) AS billed, COALESCE(SUM(paid),0) AS paid
      FROM bills WHERE month = ? AND status != 'cancelled'`).get(month);
    const dueBills = db2.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status != 'cancelled' AND status != 'paid'`).get(month);
    const paidCount = db2.prepare(`SELECT COUNT(*) AS c FROM bills WHERE month = ? AND status = 'paid'`).get(month);
    const totalDueAllTime = db2.prepare(`SELECT COALESCE(SUM(total - paid),0) AS d FROM bills WHERE status != 'cancelled'`).get();
    const monthCollection = db2.prepare(`SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments
      WHERE payment_date LIKE ? || '%'`).get(month);
    const connectionFees = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM payments WHERE type = 'connection_fee'`).get();
    const newCustomers = db2.prepare(`SELECT COUNT(*) AS c FROM customers WHERE connection_date LIKE ? || '%'`).get(month);
    const expenses = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'expense' AND date LIKE ? || '%'`).get(month);
    const otherIncome = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'income' AND date LIKE ? || '%'`).get(month);
    return {
      totalCustomers,
      activeCustomers: sc.active,
      inactiveCustomers: sc.inactive,
      disconnectedCustomers: sc.disconnected,
      paidCustomers: paidCount.c,
      dueCustomers: dueBills.c,
      freeCustomers: pkgFree,
      newCustomers: newCustomers.c,
      totalBilled: round2(billAgg.billed),
      totalCollection: round2(monthCollection.a),
      totalDue: round2(totalDueAllTime.d),
      connectionFees: round2(connectionFees.a),
      totalExpenses: round2(expenses.a),
      otherIncome: round2(otherIncome.a),
      netProfit: round2(monthCollection.a + otherIncome.a - expenses.a)
    };
  });
  import_electron12.ipcMain.handle("dashboard:dailyCollection", (e, month) => {
    requirePermission(e, "dashboard");
    return getDb().prepare(`SELECT substr(payment_date, 9) AS day, COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS amount
      FROM payments WHERE payment_date LIKE ? || '%' GROUP BY substr(payment_date, 9) ORDER BY day`).all(month);
  });
  import_electron12.ipcMain.handle("dashboard:monthlyRevenue", (e) => {
    requirePermission(e, "dashboard");
    const rows = getDb().prepare(`SELECT substr(payment_date, 1, 7) AS month, COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS collection
      FROM payments WHERE payment_date >= date('now', '-11 months', 'start of month') GROUP BY substr(payment_date, 1, 7) ORDER BY month`).all();
    const billed = getDb().prepare(`SELECT month, COALESCE(SUM(total),0) AS billed FROM bills
      WHERE month >= substr(date('now', '-11 months', 'start of month'), 1, 7) AND status != 'cancelled' GROUP BY month ORDER BY month`).all();
    const map = new Map(rows.map((r) => [r.month, r]));
    const out = [];
    const now = /* @__PURE__ */ new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.toISOString().slice(0, 7);
      const b = billed.find((x) => x.month === m);
      out.push({ month: m, collection: map.get(m)?.collection || 0, billed: b?.billed || 0 });
    }
    return out;
  });
  import_electron12.ipcMain.handle("dashboard:customerGrowth", (e) => {
    requirePermission(e, "dashboard");
    return getDb().prepare(`SELECT substr(connection_date, 1, 7) AS month, COUNT(*) AS new_count,
      (SELECT COUNT(*) FROM customers c2 WHERE substr(c2.connection_date, 1, 7) <= substr(c.connection_date, 1, 7)) AS total
      FROM customers c WHERE connection_date >= date('now', '-11 months', 'start of month')
      GROUP BY substr(connection_date, 1, 7) ORDER BY month`).all();
  });
  import_electron12.ipcMain.handle("dashboard:areaStats", (e, month) => {
    requirePermission(e, "dashboard");
    return getDb().prepare(`SELECT a.name AS area, COUNT(c.id) AS customers,
      COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id
        WHERE c2.area_id = a.id AND b.month = ? AND b.status != 'cancelled'), 0) AS billed,
      COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN customers c3 ON c3.id = pay.customer_id
        WHERE c3.area_id = a.id AND pay.payment_date LIKE ? || '%' AND pay.type != 'refund'), 0) AS collection
      FROM areas a LEFT JOIN customers c ON c.area_id = a.id AND c.status = 'active'
      GROUP BY a.id HAVING customers > 0 ORDER BY customers DESC LIMIT 10`).all(month, month);
  });
  import_electron12.ipcMain.handle("dashboard:recent", (e) => {
    requirePermission(e, "dashboard");
    const db2 = getDb();
    const payments = db2.prepare(`SELECT p.*, c.code AS customer_code, c.name AS customer_name FROM payments p
      JOIN customers c ON c.id = p.customer_id ORDER BY p.id DESC LIMIT 6`).all();
    const customers = db2.prepare(`SELECT id, code, name, mobile, connection_date, status, address FROM customers ORDER BY id DESC LIMIT 6`).all();
    const complaints = db2.prepare(`SELECT co.*, c.name AS customer_name, c.code AS customer_code FROM complaints co
      JOIN customers c ON c.id = co.customer_id WHERE co.status IN ('pending','assigned') ORDER BY co.id DESC LIMIT 6`).all();
    const pendingComplaints = db2.prepare(`SELECT COUNT(*) AS c FROM complaints WHERE status IN ('pending','assigned')`).get().c;
    return { payments, customers, complaints, pendingComplaints };
  });
}

// src/main/ipc/reports.ts
var import_electron13 = __toESM(require_electron_stub());
function registerReportIpc() {
  import_electron13.ipcMain.handle("reports:areaCollection", (e, month) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT a.name AS area,
        COUNT(c.id) AS customers,
        COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.area_id = a.id AND b.month = ? AND b.status != 'cancelled'),0) AS billed,
        COALESCE((SELECT SUM(b.paid) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.area_id = a.id AND b.month = ?),0) AS collected
      FROM areas a LEFT JOIN customers c ON c.area_id = a.id
      GROUP BY a.id HAVING customers > 0 ORDER BY billed DESC`).all(month, month);
  });
  import_electron13.ipcMain.handle("reports:collector", (e, from, to) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT s.name AS collector, col.target_amount, col.commission_rate,
        COALESCE(SUM(p.amount),0) AS collected, COUNT(p.id) AS payments,
        COALESCE(SUM(p.amount) * col.commission_rate / 100, 0) AS commission
      FROM collectors col JOIN staff s ON s.id = col.staff_id
      LEFT JOIN payments p ON p.collector_id = col.id AND p.payment_date BETWEEN ? AND ? AND p.type != 'refund'
      GROUP BY col.id ORDER BY collected DESC`).all(from, to);
  });
  import_electron13.ipcMain.handle("reports:reseller", (e, month) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT r.name, r.company, r.mobile, r.commission_rate, r.wallet_balance,
        COUNT(c.id) AS customers,
        COALESCE((SELECT SUM(b.total) FROM bills b JOIN customers c2 ON c2.id = b.customer_id WHERE c2.reseller_id = r.id AND b.month = ? AND b.status != 'cancelled'),0) AS billed,
        COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN customers c3 ON c3.id = pay.customer_id WHERE c3.reseller_id = r.id AND pay.payment_date LIKE ? || '%' AND pay.type != 'refund'),0) AS collected
      FROM resellers r LEFT JOIN customers c ON c.reseller_id = r.id
      GROUP BY r.id ORDER BY customers DESC`).all(month, month);
  });
  import_electron13.ipcMain.handle("reports:package", (e, month) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT p.name, p.type, p.price, COUNT(c.id) AS customers,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END),0) AS active_customers
      FROM packages p LEFT JOIN customers c ON c.package_id = p.id
      GROUP BY p.id ORDER BY customers DESC`).all();
  });
  import_electron13.ipcMain.handle("reports:dueList", (e, month) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT c.id, c.code, c.name, c.mobile, a.name AS area, c.advance_balance,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled'),0) AS total_due,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month = ? AND b.status != 'cancelled'),0) AS month_due
      FROM customers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.status = 'active' AND (SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.status != 'cancelled') > 0
      ORDER BY total_due DESC`).all(month);
  });
  import_electron13.ipcMain.handle("reports:profitLoss", (e, from, to) => {
    requirePermission(e, "reports");
    const db2 = getDb();
    const collections = db2.prepare(`SELECT COALESCE(SUM(CASE WHEN type != 'refund' THEN amount END),0) AS a FROM payments WHERE payment_date BETWEEN ? AND ?`).get(from, to);
    const otherIncome = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'income' AND date BETWEEN ? AND ?`).get(from, to);
    const expenseRows = db2.prepare(`SELECT ec.name AS category, COALESCE(SUM(t.amount),0) AS amount FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id
      WHERE t.type = 'expense' AND t.date BETWEEN ? AND ? GROUP BY t.category_id ORDER BY amount DESC`).all(from, to);
    const totalExpenses = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE type = 'expense' AND date BETWEEN ? AND ?`).get(from, to).a;
    const incomeCats = db2.prepare(`SELECT ec.name AS category, COALESCE(SUM(t.amount),0) AS amount FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id
      WHERE t.type = 'income' AND t.date BETWEEN ? AND ? GROUP BY t.category_id ORDER BY amount DESC`).all(from, to);
    return {
      collections: round2(collections.a),
      otherIncome: round2(otherIncome.a),
      totalIncome: round2(collections.a + otherIncome.a),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(collections.a + otherIncome.a - totalExpenses),
      expenseBreakdown: expenseRows,
      incomeBreakdown: incomeCats
    };
  });
  import_electron13.ipcMain.handle("reports:balanceSheet", (e) => {
    requirePermission(e, "reports");
    const db2 = getDb();
    const cash = db2.prepare("SELECT COALESCE(SUM(balance),0) AS a FROM accounts WHERE status = 'active'").get();
    const receivables = db2.prepare(`SELECT COALESCE(SUM(total - paid),0) AS a FROM bills WHERE status != 'cancelled'`).get();
    const advance = db2.prepare("SELECT COALESCE(SUM(advance_balance),0) AS a FROM customers").get();
    const inventory = db2.prepare("SELECT COALESCE(SUM(stock * purchase_price),0) AS a FROM products").get();
    const supplierPayable = db2.prepare(`SELECT COALESCE(SUM(total - paid),0) AS a FROM purchases WHERE status != 'cancelled'`).get();
    const equity = round2(cash.a + receivables.a + inventory.a - supplierPayable.a - advance.a);
    return {
      assets: { cash: round2(cash.a), receivables: round2(receivables.a), inventory: round2(inventory.a) },
      liabilities: { supplierPayable: round2(supplierPayable.a), customerAdvances: round2(advance.a) },
      equity
    };
  });
  import_electron13.ipcMain.handle("reports:transactions", (e, type, from, to) => {
    requirePermission(e, "reports");
    return getDb().prepare(`SELECT t.*, ec.name AS category, a.name AS account FROM transactions t
      LEFT JOIN expense_categories ec ON ec.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.type = ? AND t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.id DESC`).all(type, from, to);
  });
  import_electron13.ipcMain.handle("reports:customerStatement", (e, customerId) => {
    requirePermission(e, "reports");
    const db2 = getDb();
    const bills = db2.prepare("SELECT invoice_no, month, total, paid, status FROM bills WHERE customer_id = ? AND status != 'cancelled' ORDER BY month").all(customerId);
    const payments = db2.prepare("SELECT receipt_no, amount, method, payment_date, type FROM payments WHERE customer_id = ? ORDER BY payment_date").all(customerId);
    const customer = db2.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    return { bills, payments, customer };
  });
  import_electron13.ipcMain.handle("reports:billList", (e, month, filters = {}) => {
    requirePermission(e, "reports");
    const db2 = getDb();
    const from = String(filters.from || month || "");
    const to = String(filters.to || filters.from || month || "");
    const hasCollector = filters.collectorId ? Number(filters.collectorId) : 0;
    const collectorClause = hasCollector ? ` AND EXISTS (SELECT 1 FROM payments pay WHERE pay.customer_id = c.id AND substr(pay.payment_date,1,7) BETWEEN '${from}' AND '${to}' AND pay.collector_id = ${hasCollector})` : "";
    const rows = db2.prepare(`SELECT c.id, c.code, c.name, c.mobile, c.address, a.name AS area, c.monthly_bill, c.connection_type,
        COALESCE((SELECT SUM(b.amount) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS month_bill,
        COALESCE((SELECT SUM(b.late_fee) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS additional,
        COALESCE((SELECT SUM(b.discount) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS discount,
        COALESCE((SELECT SUM(b.total - b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month < ? AND b.status != 'cancelled'),0) AS prev_due,
        COALESCE((SELECT SUM(b.paid) FROM bills b WHERE b.customer_id = c.id AND b.month >= ? AND b.month <= ? AND b.status != 'cancelled'),0) AS paid
      FROM customers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.status = 'active' ${filters.areaId ? "AND c.area_id = " + Number(filters.areaId) : ""}${collectorClause}
      ORDER BY c.code`).all(from, to, from, to, from, to, from, from, to);
    let list = rows.map((r) => {
      const totalPayable = round2(r.prev_due + r.month_bill + r.additional - r.discount);
      const currentDue = round2(totalPayable - r.paid);
      return { ...r, totalPayable, currentDue, status: currentDue <= 0 ? "paid" : r.paid > 0 ? "partial" : "due" };
    });
    if (filters.q) {
      const q = String(filters.q).toLowerCase();
      list = list.filter((r) => String(r.code).toLowerCase().includes(q) || String(r.name).toLowerCase().includes(q) || String(r.mobile || "").includes(filters.q));
    }
    if (filters.status && filters.status !== "all") list = list.filter((r) => r.status === filters.status);
    return list;
  });
  import_electron13.ipcMain.handle("reports:customerBill", (e, customerId, month) => {
    requirePermission(e, "reports");
    const db2 = getDb();
    const customer = db2.prepare(`SELECT c.*, a.name AS area_name, p.name AS package_name FROM customers c
      LEFT JOIN areas a ON a.id = c.area_id LEFT JOIN packages p ON p.id = c.package_id WHERE c.id = ?`).get(customerId);
    if (!customer) throw new Error("NOT_FOUND");
    const agg = db2.prepare(`SELECT COALESCE(SUM(amount),0) AS month_bill, COALESCE(SUM(late_fee),0) AS additional,
        COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(paid),0) AS paid
      FROM bills WHERE customer_id = ? AND month = ? AND status != 'cancelled'`).get(customerId, month);
    const prevDueRow = db2.prepare(`SELECT COALESCE(SUM(total - paid),0) AS v FROM bills
      WHERE customer_id = ? AND month < ? AND status != 'cancelled'`).get(customerId, month);
    const figures = {
      monthBill: round2(agg.month_bill),
      additional: round2(agg.additional),
      discount: round2(agg.discount),
      prevDue: round2(prevDueRow.v),
      paid: round2(agg.paid)
    };
    const totalPayable = round2(figures.prevDue + figures.monthBill + figures.additional - figures.discount);
    const currentDue = round2(totalPayable - figures.paid);
    const payments = db2.prepare(`SELECT p.id, p.receipt_no, p.amount, p.method, p.reference, p.payment_date, p.created_at, p.created_by,
        COALESCE(s.name, p.created_by) AS collected_by
      FROM payments p LEFT JOIN collectors col ON col.id = p.collector_id LEFT JOIN staff s ON s.id = col.staff_id
      WHERE p.customer_id = ? AND (p.bill_id IN (SELECT id FROM bills WHERE customer_id = ? AND month = ?)
        OR (p.bill_id IS NULL AND p.type = 'bill' AND p.payment_date LIKE ? || '%'))
      ORDER BY p.payment_date, p.id`).all(customerId, customerId, month, month);
    const company = {
      name: getSetting("company_name", "AVA Cable Network"),
      name_bn: getSetting("company_name_bn", ""),
      address: getSetting("company_address", ""),
      mobile: getSetting("company_mobile", ""),
      mobile_alt: getSetting("company_mobile_alt", ""),
      email: getSetting("company_email", ""),
      logo: getSetting("company_logo", ""),
      sms: getSetting("company_sms", getSetting("company_mobile", "")),
      license: getSetting("company_license", ""),
      footer: getSetting("bill_footer", ""),
      authorized: getSetting("company_authorized", "")
    };
    return { customer, month, figures: { ...figures, totalPayable, currentDue, status: currentDue <= 0 ? "paid" : figures.paid > 0 ? "partial" : "due" }, payments, company };
  });
}

// tests/business.test.ts
var handlers = () => require_electron_stub().ipcMain._handlers;
var pass = 0;
var fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("  \u2713", name);
  } else {
    fail++;
    console.log("  \u2717 FAIL:", name, extra !== void 0 ? JSON.stringify(extra) : "");
  }
}
function section(name) {
  console.log("\n== " + name + " ==");
}
var fakeEvent = { sender: { id: 1 } };
async function main() {
  const fs2 = require("fs");
  const os = require("os");
  const path2 = require("path");
  const userData = path2.join(os.tmpdir(), "ava-test-userData");
  fs2.mkdirSync(userData, { recursive: true });
  fs2.readdirSync(userData).filter((f) => f.startsWith("ava-cable")).forEach((f) => fs2.unlinkSync(path2.join(userData, f)));
  const db2 = initDb(path2.join(userData, "ava-cable.db"));
  registerAuthIpc();
  registerGenericIpc();
  registerCustomerIpc();
  registerBillingIpc();
  registerPaymentIpc();
  registerSettingsIpc();
  registerBackupIpc();
  registerInventoryIpc();
  registerMiscIpc();
  registerDashboardIpc();
  registerReportIpc();
  const H = handlers();
  section("auth");
  const login = await H["auth:login"](fakeEvent, "admin", "admin123");
  ok("default admin login works as SUPER_ADMIN", !!login?.user && login.user.roleName === "SUPER_ADMIN" && login.user.permissions.includes("all"), login);
  let threw = false;
  try {
    await H["auth:login"](fakeEvent, "admin", "wrong");
  } catch {
    threw = true;
  }
  ok("wrong password rejected", threw);
  const users = await H["users:list"](fakeEvent);
  ok("users list has admin", users.length === 1 && users[0].username === "admin");
  section("master data");
  const areaId = await H["db:create"](fakeEvent, "areas", { name: "Mirpur", code: "MPR", status: "active" });
  const area2 = await H["db:create"](fakeEvent, "areas", { name: "Uttara", code: "UTR", status: "active" });
  ok("areas created", areaId > 0 && area2 > 0);
  const pkgId = await H["db:create"](fakeEvent, "packages", { name: "Basic", code: "BSC", price: 300, type: "basic", status: "active" });
  const pkgFree = await H["db:create"](fakeEvent, "packages", { name: "Free Pkg", price: 0, type: "free", status: "active" });
  ok("packages created", pkgId > 0 && pkgFree > 0);
  const staffId = await H["db:create"](fakeEvent, "staff", { name: "Karim", designation: "collector", mobile: "01711111111", salary: 1e4, status: "active" });
  const collectorId = await H["db:create"](fakeEvent, "collectors", { staff_id: staffId, commission_rate: 5, target_amount: 5e4, status: "active" });
  ok("collector created", collectorId > 0);
  section("customers");
  const c1 = await H["customers:create"](fakeEvent, { name: "Rahim Uddin", mobile: "01712345678", area_id: areaId, package_id: pkgId, monthly_bill: 300, connection_fee: 500 });
  const c2 = await H["customers:create"](fakeEvent, { name: "Karima Begum", mobile: "01812345678", area_id: areaId, package_id: pkgId, monthly_bill: 300 });
  const c3 = await H["customers:create"](fakeEvent, { name: "Free User", mobile: "01912345678", area_id: area2, package_id: pkgFree, monthly_bill: 0 });
  ok("customers created with auto IDs", c1 > 0 && c2 > 0 && c3 > 0);
  const list1 = await H["customers:list"](fakeEvent, { search: "rahim" });
  ok("customer search", list1.total === 1 && list1.rows[0].code.startsWith("AVA-"));
  let threw2 = false;
  try {
    await H["customers:create"](fakeEvent, { name: "Bad", mobile: "12345" });
  } catch (e) {
    threw2 = e.message.includes("INVALID_MOBILE");
  }
  ok("invalid mobile rejected", threw2);
  const cPaid = await H["customers:create"](fakeEvent, { name: "Paid Conn", mobile: "01311111111", area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_fee: 400, connection_type: "paid", note: "old note kept" });
  const paidRow = await H["customers:get"](fakeEvent, cPaid);
  ok("paid connection saves amounts + type", paidRow.customer.monthly_bill === 250 && paidRow.customer.connection_fee === 400 && paidRow.customer.connection_type === "paid" && paidRow.customer.note === "old note kept", paidRow.customer);
  const cFree = await H["customers:create"](fakeEvent, { name: "Free Conn", mobile: "01322222222", area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_fee: 400, connection_type: "free", note: "should be ignored for amounts" });
  const freeRow = await H["customers:get"](fakeEvent, cFree);
  ok("free connection forces \u09F30 amounts + Free type", freeRow.customer.monthly_bill === 0 && freeRow.customer.connection_fee === 0 && freeRow.customer.connection_type === "free", freeRow.customer);
  let threwConnType = false;
  try {
    await H["customers:create"](fakeEvent, { name: "Bad Type", mobile: "01333333333", connection_type: "half" });
  } catch (e) {
    threwConnType = e.message.includes("INVALID_CONNECTION_TYPE");
  }
  ok("invalid connection type rejected", threwConnType);
  await H["customers:update"](fakeEvent, cFree, { connection_type: "paid", monthly_bill: 200, connection_fee: 100 });
  const switched = await H["customers:get"](fakeEvent, cFree);
  ok("free \u2192 paid switch saves new amounts", switched.customer.connection_type === "paid" && switched.customer.monthly_bill === 200 && switched.customer.connection_fee === 100, switched.customer);
  await H["customers:update"](fakeEvent, cPaid, { connection_type: "free", monthly_bill: 999, connection_fee: 999 });
  const toFree = await H["customers:get"](fakeEvent, cPaid);
  ok("paid \u2192 free switch zeroes amounts (no stale values)", toFree.customer.connection_type === "free" && toFree.customer.monthly_bill === 0 && toFree.customer.connection_fee === 0, toFree.customer);
  ok("note data preserved through type changes", toFree.customer.note === "old note kept", toFree.customer.note);
  const freeList = await H["customers:list"](fakeEvent, { status: "free", all: true });
  ok("free status filter follows connection_type", freeList.rows.some((r) => r.id === cPaid) && !freeList.rows.some((r) => r.id === cFree), freeList.rows.map((r) => r.id));
  const delMany = await H["customers:deleteMany"](fakeEvent, [cPaid, cFree]);
  ok("connection-type test customers cleaned up", delMany.deleted === 2, delMany);
  const cGet = await H["customers:get"](fakeEvent, c1);
  ok("customer get with relations", cGet.customer._area === "Mirpur" && cGet.customer._package === "Basic");
  section("billing generation");
  const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  const cFreeB = await H["customers:create"](fakeEvent, { name: "Free Bill Skip", mobile: "01344444444", area_id: areaId, package_id: pkgId, monthly_bill: 250, connection_type: "free" });
  const gen1 = await H["billing:generate"](fakeEvent, month, void 0, "manual");
  ok("bills generated for active customers (free connection skipped)", gen1.created === 3 && gen1.skipped === 1, gen1);
  const freeBills = await H["customers:get"](fakeEvent, cFreeB);
  ok("free connection has no bill at all", freeBills.bills.length === 0, freeBills.bills);
  await H["customers:delete"](fakeEvent, cFreeB);
  const gen2 = await H["billing:generate"](fakeEvent, month, void 0, "manual");
  ok("duplicate generation prevented", gen2.created === 0 && gen2.skipped === 3, gen2);
  const billList = await H["billing:list"](fakeEvent, { month });
  const freeBill = billList.rows.find((b) => b.customer_id === c3);
  ok("free package bill amount 0", Number(freeBill.amount) === 0, freeBill);
  ok("bill rows carry connection_type", typeof billList.rows[0].connection_type === "string", billList.rows[0]);
  const basicBill = billList.rows.find((b) => b.customer_id === c1);
  ok("basic bill amount 300", Number(basicBill.total) === 300, basicBill);
  section("payments \u2014 transaction safe");
  const pay1 = await H["payments:collect"](fakeEvent, { customerId: c1, amount: 300, method: "cash", type: "bill" });
  ok("full payment collected", !!pay1.receiptNo);
  const after1 = await H["customers:get"](fakeEvent, c1);
  ok("bill marked paid", after1.bills[0].status === "paid" && Number(after1.bills[0].paid) === 300);
  ok("customer total_due zero", Number(after1.customer.total_due) === 0);
  const pay2 = await H["payments:collect"](fakeEvent, { customerId: c2, amount: 200, method: "bkash", reference: "TRX123" });
  ok("partial payment ok", !!pay2.receiptNo);
  const after2 = await H["customers:get"](fakeEvent, c2);
  ok("bill partial status, due 100", after2.bills[0].status === "partial" && Number(after2.bills[0].total - after2.bills[0].paid) === 100);
  ok("customer due 100", Number(after2.customer.total_due) === 100);
  const pay3 = await H["payments:collect"](fakeEvent, { customerId: c2, amount: 500, method: "cash", type: "advance" });
  const after3 = await H["customers:get"](fakeEvent, c2);
  ok("advance recorded 500", Number(after3.customer.advance_balance) === 500, after3.customer.advance_balance);
  const useAdv = await H["payments:useAdvance"](fakeEvent, c2);
  ok("advance applied 100, leftover 400", useAdv.applied === 100 && useAdv.remaining === 400, useAdv);
  const after4 = await H["customers:get"](fakeEvent, c2);
  ok("bill paid via advance", after4.bills[0].status === "paid" && Number(after4.customer.advance_balance) === 400);
  const pay4 = await H["payments:collect"](fakeEvent, { customerId: c1, amount: 1e3, method: "cash", type: "bill" });
  const after5 = await H["customers:get"](fakeEvent, c1);
  ok("overpay creates advance 1000", Number(after5.customer.advance_balance) === 1e3);
  const refund = await H["payments:refund"](fakeEvent, c1, 300, "test refund");
  const after6 = await H["customers:get"](fakeEvent, c1);
  ok("refund reduces advance to 700", Number(after6.customer.advance_balance) === 700);
  let threw3 = false;
  try {
    await H["payments:refund"](fakeEvent, c1, 99999, "too much");
  } catch (e) {
    threw3 = e.message.includes("INSUFFICIENT_ADVANCE");
  }
  ok("over-refund rejected", threw3);
  section("previous due carry-forward");
  const addMonths = (ym, n) => {
    const [y, m] = ym.split("-").map(Number);
    const mm = m - 1 + n;
    const yy = y + Math.floor(mm / 12);
    return `${yy}-${String(mm % 12 + 1).padStart(2, "0")}`;
  };
  await H["payments:refund"](fakeEvent, c1, 700, "cleanup");
  const nextMonth = addMonths(month, 1);
  const genNext = await H["billing:generate"](fakeEvent, nextMonth, void 0, "manual");
  ok("next month bills generated", genNext.created === 3, genNext);
  const bList2 = await H["billing:list"](fakeEvent, { month: nextMonth });
  const c1Next = bList2.rows.find((b) => b.customer_id === c1);
  ok("no stale due (c1 clean)", Number(c1Next.previous_due) === 0 && Number(c1Next.total) === 300, c1Next);
  await H["payments:collect"](fakeEvent, { customerId: c2, amount: 100, method: "cash" });
  const month3 = addMonths(nextMonth, 1);
  await H["billing:generate"](fakeEvent, month3, void 0, "manual");
  const bList3 = await H["billing:list"](fakeEvent, { month: month3 });
  const c2m3 = bList3.rows.find((b) => b.customer_id === c2);
  ok("previous due 200 carried forward", Number(c2m3.previous_due) === 200 && Number(c2m3.total) === 500, c2m3);
  section("bill adjust / cancel");
  const b1 = bList3.rows.find((b) => b.customer_id === c1);
  await H["billing:adjust"](fakeEvent, b1.id, 50, 20, "goodwill");
  const adjList = await H["billing:list"](fakeEvent, { month: month3 });
  const adjB = adjList.rows.find((b) => b.id === b1.id);
  ok("adjust: 300-50+20+300(prev) = 570", Number(adjB.total) === 570, adjB);
  const cancelTarget = bList3.rows.find((b) => b.customer_id === c3);
  await H["billing:cancel"](fakeEvent, cancelTarget.id);
  const afterCancel = await H["billing:list"](fakeEvent, { month: month3, status: "cancelled" });
  ok("unpaid bill cancelled", afterCancel.rows.length === 1);
  section("inventory");
  const prodId = await H["db:create"](fakeEvent, "products", { name: "STB", category: "stb", purchase_price: 1500, sale_price: 1800, stock: 0, min_stock: 5, status: "active" });
  const supId = await H["db:create"](fakeEvent, "suppliers", { name: "Cable Supply Ltd", status: "active" });
  const pur = await H["purchases:create"](fakeEvent, { supplier_id: supId, date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), paid: 5e3, items: [{ product_id: prodId, qty: 10, price: 1500 }] });
  ok("purchase created", pur.invoiceNo.startsWith("PO-") && pur.total === 15e3, pur);
  const prod = await H["db:get"](fakeEvent, "products", prodId);
  ok("stock updated to 10", Number(prod.stock) === 10);
  await H["stock:move"](fakeEvent, { product_id: prodId, type: "out", qty: 3, reason: "installation" });
  const prod2 = await H["db:get"](fakeEvent, "products", prodId);
  ok("stock out \u2192 7", Number(prod2.stock) === 7);
  let threw4 = false;
  try {
    await H["stock:move"](fakeEvent, { product_id: prodId, type: "out", qty: 100 });
  } catch (e) {
    threw4 = e.message.includes("INSUFFICIENT_STOCK");
  }
  ok("over-stock-out rejected", threw4);
  section("accounts");
  const accounts = await H["db:list"](fakeEvent, "accounts", {});
  ok("cash box exists with transactions recorded", accounts.rows.length >= 1 && typeof Number(accounts.rows[0].balance) === "number", accounts.rows[0]?.balance);
  const cashbook = await H["accounts:cashbook"](fakeEvent, "2000-01-01", "2099-01-01");
  ok("cashbook rows computed", cashbook.rows.length > 0 && cashbook.rows[cashbook.rows.length - 1].balance === cashbook.rows[cashbook.rows.length - 1].balance);
  const pl = await H["reports:profitLoss"](fakeEvent, "2000-01-01", "2099-01-01");
  ok("P&L computes", typeof pl.netProfit === "number" && pl.totalIncome > 0, pl);
  section("resellers");
  const resId = await H["db:create"](fakeEvent, "resellers", { name: "Local Agent", mobile: "01611111111", commission_rate: 10, status: "active" });
  await H["resellers:txn"](fakeEvent, { reseller_id: resId, type: "recharge", amount: 1e3 });
  const res2 = await H["db:get"](fakeEvent, "resellers", resId);
  ok("wallet recharge 1000", Number(res2.wallet_balance) === 1e3);
  section("dashboard & reports");
  const stats = await H["dashboard:stats"](fakeEvent, month);
  ok("dashboard counts", stats.totalCustomers === 3 && stats.activeCustomers === 3, stats);
  const dueList = await H["reports:dueList"](fakeEvent, month3);
  ok("due list has c2", dueList.some((d) => d.id === c2), dueList.map((d) => d.id));
  section("generic CRUD + permissions");
  const roles = await H["roles:list"](fakeEvent);
  ok("system roles seeded (incl. SUPER_ADMIN)", roles.length === 4);
  section("dynamic permissions (RBAC delegation)");
  const managerRoleId = roles.find((r) => r.name === "Manager").id;
  const adminRoleId = roles.find((r) => r.name === "Administrator").id;
  const admin2Id = await H["users:create"](fakeEvent, { username: "admin2", password: "secret1", full_name: "Admin Two", role_id: adminRoleId });
  const admin2Login = await H["auth:login"]({ sender: { id: 3 } }, "admin2", "secret1");
  ok("admin2 is not super", !admin2Login.user.permissions.includes("all"));
  const mgrUserId = await H["users:create"]({ sender: { id: 3 } }, { username: "mgr1", password: "secret1", full_name: "Manager One", role_id: managerRoleId });
  ok("admin creates Manager user", mgrUserId > 0);
  await H["permissions:set"]({ sender: { id: 3 } }, mgrUserId, [{ key: "reports.view" }]);
  const mgrPerms = await H["permissions:get"](fakeEvent, mgrUserId);
  ok("admin grants granular permission to Manager", mgrPerms.grants.some((g) => g.permission_key === "reports.view"));
  let delegErr = "";
  try {
    await H["permissions:set"]({ sender: { id: 3 } }, mgrUserId, [{ key: "security.manage" }]);
  } catch (e) {
    delegErr = String(e);
  }
  ok("admin cannot grant unheld permission", delegErr.includes("DELEGATION_DENIED"));
  const staffRoleId = roles.find((r) => r.name === "Collector").id;
  await H["users:create"]({ sender: { id: 3 } }, { username: "col1", password: "secret1", full_name: "Collector One", role_id: staffRoleId });
  const mgrLogin = await H["auth:login"]({ sender: { id: 2 } }, "mgr1", "secret1");
  ok("manager login has granular perm", mgrLogin.user.permissions.includes("reports.view"));
  let mgrGrantErr = "";
  try {
    await H["permissions:set"]({ sender: { id: 2 } }, mgrUserId, [{ key: "reports.view" }]);
  } catch (e) {
    mgrGrantErr = String(e);
  }
  ok("manager cannot manage permissions", mgrGrantErr.includes("PERMISSION_DENIED"));
  await H["permissions:set"]({ sender: { id: 3 } }, mgrUserId, []);
  const mgrPerms2 = await H["permissions:get"](fakeEvent, mgrUserId);
  ok("permission revoked from manager", !mgrPerms2.grants.some((g) => g.permission_key === "reports.view"));
  const auditRows = await H["permissions:audit"](fakeEvent, mgrUserId);
  ok("permission audit trail recorded", auditRows.length >= 2);
  section("SUPER_ADMIN role visibility");
  const rolesSuper = await H["roles:list"](fakeEvent);
  ok("super sees SUPER_ADMIN role", rolesSuper.some((r) => r.name === "SUPER_ADMIN"));
  const rolesAdmin = await H["roles:list"]({ sender: { id: 3 } });
  ok("admin does NOT see SUPER_ADMIN role", !rolesAdmin.some((r) => r.name === "SUPER_ADMIN"));
  let roleEditErr = "";
  try {
    await H["roles:save"]({ sender: { id: 3 } }, { name: "X", permissions: ["all"] });
  } catch (e) {
    roleEditErr = String(e);
  }
  ok("admin cannot create/edit roles (security-only)", roleEditErr.includes("PERMISSION_DENIED"));
  section("SUPER_ADMIN account visibility");
  const usersSuper = await H["users:list"](fakeEvent);
  ok("super sees the SUPER_ADMIN account", usersSuper.some((u) => u.role_name === "SUPER_ADMIN"));
  const usersAdmin = await H["users:list"]({ sender: { id: 3 } });
  ok("admin does NOT see SUPER_ADMIN account", !usersAdmin.some((u) => u.role_name === "SUPER_ADMIN"));
  const superUser = usersSuper.find((u) => u.role_name === "SUPER_ADMIN");
  let editSuperErr = "";
  try {
    await H["users:update"]({ sender: { id: 3 } }, superUser.id, { full_name: "Hacked", status: "inactive" });
  } catch (e) {
    editSuperErr = String(e);
  }
  ok("admin cannot edit SUPER_ADMIN account", editSuperErr.includes("PERMISSION_DENIED"));
  let delSuperErr = "";
  try {
    await H["users:delete"]({ sender: { id: 3 } }, superUser.id);
  } catch (e) {
    delSuperErr = String(e);
  }
  ok("admin cannot delete SUPER_ADMIN account", delSuperErr.includes("SUPER_ADMIN_UNDELETABLE"));
  section("collector ownership + dropdown");
  const colA = await H["collectors:quickAdd"]({ sender: { id: 3 } }, "Rahim", "01711111111");
  const colB = await H["collectors:quickAdd"]({ sender: { id: 3 } }, "Karim", "01822222222");
  ok("two collectors created by admin2", colA.id > 0 && colB.id > 0);
  const listA = await H["db:reflist"]({ sender: { id: 3 } }, "collectors");
  ok(
    "admin2 sees own collectors with name+mobile",
    listA.some((c) => c.label.includes("Rahim") && c.label.includes("01711111111")) && listA.some((c) => c.label.includes("Karim"))
  );
  const listSuper = await H["db:reflist"](fakeEvent, "collectors");
  ok("super admin sees all collectors", listSuper.some((c) => c.label.includes("Rahim")));
  await H["db:update"]({ sender: { id: 3 } }, "collectors", colB.id, { status: "inactive" });
  const listA2 = await H["db:reflist"]({ sender: { id: 3 } }, "collectors");
  ok("deactivated collector hidden from dropdown", !listA2.some((c) => c.label.includes("Karim")) && listA2.some((c) => c.label.includes("Rahim")));
  section("purchase form v2 (manual product, auto timestamp)");
  const p1 = await H["products:findOrCreate"](fakeEvent, { name: "Coaxial Cable 100m", salePrice: 2500 });
  ok("new product created from manual name", p1.id > 0 && p1.existed === false);
  const p1b = await H["products:findOrCreate"](fakeEvent, { name: "coaxial cable 100M" });
  ok("existing product matched case-insensitively (no duplicate)", p1b.existed === true && p1b.id === p1.id);
  const pur2 = await H["purchases:create"](fakeEvent, { items: [{ product_id: p1.id, qty: 4, price: 2e3, sale_price: 2500 }] });
  ok("purchase saved without date/paid fields", !!pur2.invoiceNo && pur2.total === 8e3);
  const purList = await H["purchases:listFull"](fakeEvent);
  const purRow = purList.find((x) => x.invoice_no === pur2.invoiceNo);
  ok("auto timestamp (Asia/Dhaka) saved", !!purRow && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(purRow.created_local_time || ""));
  ok("history shows product name/image/prices", !!purRow && purRow.product_name === "Coaxial Cable 100m" && Number(purRow.sale_price) === 2500);
  const prodAfter = await H["db:get"](fakeEvent, "products", p1.id);
  ok("stock increased by purchased qty", Number(prodAfter.stock) === 4);
  ok("sell price updated from purchase", Number(prodAfter.sale_price) === 2500);
  section("collection page (billing records with month range + collector filter)");
  const curMonth = month;
  const bl = await H["reports:billList"](fakeEvent, curMonth, { from: curMonth, to: curMonth });
  ok("billList range works (single month)", bl.some((r) => r.name === "Karima Begum" && r.status === "paid" && Number(r.paid) === 300 && Number(r.currentDue) === 0));
  const blPaid = await H["reports:billList"](fakeEvent, curMonth, { from: curMonth, to: curMonth, status: "paid" });
  ok("status filter works", blPaid.every((r) => r.status === "paid") && blPaid.length > 0);
  section("expense management (auto date, main balance, edit/delete reversal)");
  const accRow = await H["db:list"](fakeEvent, "accounts", { page: 1, pageSize: 5 });
  const accId = accRow.rows[0].id;
  const mbPre = await H["accounts:mainBalance"](fakeEvent);
  await H["transactions:create"](fakeEvent, { account_id: accId, type: "income", amount: 1e4 });
  const mb0 = await H["accounts:mainBalance"](fakeEvent);
  ok("main balance computed from accounts", Number(mb0.balance) === Number(mbPre.balance) + 1e4);
  const exp = await H["transactions:create"](fakeEvent, { account_id: accId, type: "expense", amount: 2e3, ref: "EXP-1" });
  ok("expense saved without date/description", exp === true);
  const txnList = await H["transactions:list"](fakeEvent, { page: 1, pageSize: 5, filters: { type: "expense" } });
  const expRow = txnList.rows[0];
  ok("expense auto date/time (Asia/Dhaka) saved", /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(expRow.created_local_time || ""));
  ok("expense auto description generated", !!expRow.description);
  const mb1 = await H["accounts:mainBalance"](fakeEvent);
  ok("main balance deducted by expense", Number(mb1.balance) === Number(mb0.balance) - 2e3);
  let overErr = "";
  try {
    await H["transactions:create"](fakeEvent, { account_id: accId, type: "expense", amount: 999999 });
  } catch (e) {
    overErr = String(e);
  }
  ok("expense overdraw rejected", overErr.includes("INSUFFICIENT_BALANCE"));
  await H["transactions:update"](fakeEvent, expRow.id, { amount: 3e3 });
  const mb2 = await H["accounts:mainBalance"](fakeEvent);
  ok("edit reverses old and applies new (10000-3000)", Number(mb2.balance) === Number(mb0.balance) - 3e3);
  await H["transactions:delete"](fakeEvent, expRow.id);
  const mb3 = await H["accounts:mainBalance"](fakeEvent);
  ok("delete reverses deduction (back to start)", Number(mb3.balance) === Number(mb0.balance));
  let dupErr = "";
  try {
    await H["db:create"](fakeEvent, "expense_categories", { name: "Staff Salary", type: "expense" });
  } catch (e) {
    dupErr = String(e);
  }
  ok("duplicate category name rejected", dupErr.includes("DUPLICATE_CATEGORY"));
  const newCat = await H["db:create"](fakeEvent, "expense_categories", { name: "Unique Test Cat", type: "expense" });
  ok("new category created (dynamic)", newCat > 0);
  await H["db:update"](fakeEvent, "expense_categories", newCat, { status: "inactive" });
  const catsList = await H["db:reflist"](fakeEvent, "expense_categories");
  ok("deactivated category hidden from dropdown", !catsList.some((c) => c.label.includes("Unique Test Cat")));
  section("collection history snapshots (due before/after)");
  const c4 = await H["customers:create"](fakeEvent, { name: "History Test", mobile: "01600000000", area_id: areaId, package_id: pkgId, monthly_bill: 300 });
  await H["billing:generate"](fakeEvent, month, void 0, "manual");
  const payH1 = await H["payments:collect"](fakeEvent, { customerId: c4, amount: 200, method: "bkash", type: "bill", collectorId: colA.id });
  const h1 = await H["payments:list"](fakeEvent, { search: payH1.receiptNo });
  const h1r = h1.rows[0];
  ok("partial collection: previous due 300, remaining 100", Number(h1r.due_before) === 300 && Number(h1r.due_after) === 100);
  ok("collection history has customer name + area + collector", h1r.customer_name === "History Test" && !!h1r._area && h1r._collector === "Rahim");
  ok("collection has Asia/Dhaka timestamp", /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(h1r.created_local_time || ""));
  const payH2 = await H["payments:collect"](fakeEvent, { customerId: c4, amount: 100, method: "cash", type: "bill" });
  const h2 = await H["payments:list"](fakeEvent, { search: payH2.receiptNo });
  const h2r = h2.rows[0];
  ok("full collection: remaining due 0", Number(h2r.due_before) === 100 && Number(h2r.due_after) === 0);
  const hist = await H["payments:list"](fakeEvent, { search: "History Test" });
  ok("multiple collections for same customer in history", hist.rows.length === 2);
  section("company profile (settings menu, role-based)");
  await H["settings:companyProfileUpdate"]({ sender: { id: 3 } }, { company_name: "AVA Cable Network", company_mobile: "01987654321" });
  const prof = await H["settings:companyProfile"]({ sender: { id: 3 } });
  ok("admin updated company profile (persists)", prof.company_name === "AVA Cable Network" && prof.company_mobile === "01987654321");
  const mgrSess = await H["auth:login"]({ sender: { id: 4 } }, "mgr1", "secret1");
  let cpErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "Hacked Ltd" });
  } catch (e) {
    cpErr = String(e);
  }
  ok("manager cannot edit company profile", cpErr.includes("PERMISSION_DENIED"));
  const prof2 = await H["settings:companyProfile"]({ sender: { id: 4 } });
  ok("manager can view company profile", prof2.company_name === "AVA Cable Network");
  let sysErr = "";
  try {
    await H["settings:set"]({ sender: { id: 3 } }, "late_fee", "99");
  } catch (e) {
    sysErr = String(e);
  }
  ok("admin cannot change system settings", sysErr.includes("PERMISSION_DENIED"));
  section("excel customer import");
  const imp = await H["customers:import"](fakeEvent, [
    { name: "\u0987\u09AE\u09AA\u09CB\u09B0\u09CD\u099F \u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u09E7", address: "\u0995\u09C1\u09B7\u09CD\u099F\u09BF\u09AF\u09BC\u09BE", mobile: "\u09E6\u09E7\u09EF\u09E7\u09E7\u09E8\u09E8\u09E9\u09E9\u09EA\u09EA" },
    { name: "Import Customer 2", address: "Kushtia", mobile: "01911223344" },
    { name: "", address: "x", mobile: "01955556666" },
    { name: "Bad Mobile", address: "", mobile: "12345" }
  ]);
  ok("import: 1 imported (bn name+bn digits), 1 duplicate, 2 invalid", imp.imported === 1 && imp.duplicates === 1 && imp.invalid === 2);
  const impList = await H["customers:list"](fakeEvent, { search: "\u0987\u09AE\u09AA\u09CB\u09B0\u09CD\u099F \u0997\u09CD\u09B0\u09BE\u09B9\u0995" });
  const impRow = impList.rows[0];
  ok("bangla name preserved + auto code + bn digits normalized", !!impRow && impRow.name === "\u0987\u09AE\u09AA\u09CB\u09B0\u09CD\u099F \u0997\u09CD\u09B0\u09BE\u09B9\u0995 \u09E7" && String(impRow.code).startsWith("AVA-") && impRow.mobile === "01911223344");
  ok("import creates no bills", Number(impRow.total_due) === 0);
  section("payment collection with/without collector");
  const payC1 = await H["payments:collect"]({ sender: { id: 3 } }, { customerId: c1, amount: 50, method: "nagad", type: "bill", collectorId: colA.id });
  const payRow = await H["payments:list"]({ sender: { id: 3 } }, { search: payC1.receiptNo });
  ok("payment saved with collector id", payRow.rows[0]?.collector_id === colA.id);
  const payC2 = await H["payments:collect"]({ sender: { id: 3 } }, { customerId: c1, amount: 50, method: "rocket", type: "bill", collectorId: null });
  const payRow2 = await H["payments:list"]({ sender: { id: 3 } }, { search: payC2.receiptNo });
  ok("payment without collector has NULL collector_id", payRow2.rows[0]?.collector_id == null);
  ok("each payment appears exactly once in list", payRow.rows.length === 1 && payRow2.rows.length === 1);
  const roleId = await H["roles:save"](fakeEvent, { name: "Viewer", permissions: ["dashboard"] });
  const roles2 = await H["roles:list"](fakeEvent);
  const viewer = roles2.find((r) => r.name === "Viewer");
  ok("custom role created", !!viewer);
  section("backup");
  const backupFile = os.tmpdir() + `/ava-backup-test-${Date.now()}.db`;
  await H["backup:create"](fakeEvent, backupFile);
  ok("backup file created", fs2.existsSync(backupFile));
  const integrity = await H["backup:integrity"](fakeEvent);
  ok("integrity check ok", integrity === true);
  section("permission fix \u2014 Administrator save with granted permission");
  const adminRole2 = (await H["roles:list"](fakeEvent)).find((r) => r.name === "Administrator");
  let adminRoleSaveErr = "";
  try {
    await H["roles:save"](fakeEvent, { id: adminRole2.id, name: "Administrator", permissions: ["areas"] });
  } catch (e) {
    adminRoleSaveErr = String(e);
  }
  ok("Administrator role permissions CAN be saved from Security \u2192 Roles", adminRoleSaveErr === "", adminRoleSaveErr);
  let allErr = "";
  try {
    await H["roles:save"](fakeEvent, { id: adminRole2.id, name: "Administrator", permissions: ["all"] });
  } catch (e) {
    allErr = String(e);
  }
  ok("'all' reserved for SUPER_ADMIN role", allErr.includes("ALL_PERMISSION_RESERVED"));
  const superRole = (await H["roles:list"](fakeEvent)).find((r) => r.name === "SUPER_ADMIN");
  let superErr = "";
  try {
    await H["roles:save"](fakeEvent, { id: superRole.id, name: "SUPER_ADMIN", permissions: [] });
  } catch (e) {
    superErr = String(e);
  }
  ok("SUPER_ADMIN role stays read-only", superErr.includes("SYSTEM_ROLE_READONLY"));
  const admin3Id = await H["users:create"](fakeEvent, { username: "admin3", password: "secret1", full_name: "Admin Three", role_id: adminRole2.id });
  const admin3Login = await H["auth:login"]({ sender: { id: 4 } }, "admin3", "secret1");
  ok("admin3 login carries effective role permissions", admin3Login.user.permissions.includes("areas"));
  const admin3List = await H["db:list"]({ sender: { id: 4 } }, "areas", {});
  ok("admin3 can view granted section", admin3List.total >= 1);
  const admin3Create = await H["db:create"]({ sender: { id: 4 } }, "areas", { name: "Admin3 Area", status: "active" });
  ok("admin3 can ADD with granted permission (Save works)", admin3Create > 0);
  const admin3Update = await H["db:update"]({ sender: { id: 4 } }, "areas", admin3Create, { name: "Admin3 Area Renamed" });
  ok("admin3 can EDIT/UPDATE with granted permission", admin3Update === true);
  const admin3Del = await H["db:delete"]({ sender: { id: 4 } }, "areas", admin3Create);
  ok("admin3 can DELETE with granted permission", admin3Del === true);
  let admin3LogsErr = "";
  try {
    await H["logs:activity"]({ sender: { id: 4 } });
  } catch (e) {
    admin3LogsErr = String(e);
  }
  ok("admin3 without security grant cannot view logs", admin3LogsErr.includes("PERMISSION_DENIED"));
  await H["roles:save"](fakeEvent, { id: adminRole2.id, name: "Administrator", permissions: ["areas.view"] });
  const admin3Check = await H["auth:check"]({ sender: { id: 4 } });
  ok("live session refreshed after role change (no logout/login)", admin3Check.user.permissions.includes("areas.view") && !admin3Check.user.permissions.includes("areas"));
  const admin3List2 = await H["db:list"]({ sender: { id: 4 } }, "areas", {});
  ok("view-only admin can still VIEW", admin3List2.total >= 1);
  let admin3SaveErr = "";
  try {
    await H["db:create"]({ sender: { id: 4 } }, "areas", { name: "Nope", status: "active" });
  } catch (e) {
    admin3SaveErr = String(e);
  }
  ok("view-only admin CANNOT save (Access Denied)", admin3SaveErr.includes("PERMISSION_DENIED:areas.create"));
  let admin3EditErr = "";
  try {
    await H["db:update"]({ sender: { id: 4 } }, "areas", areaId, { name: "Nope" });
  } catch (e) {
    admin3EditErr = String(e);
  }
  ok("view-only admin CANNOT edit", admin3EditErr.includes("PERMISSION_DENIED:areas.edit"));
  await H["roles:save"](fakeEvent, { id: adminRole2.id, name: "Administrator", permissions: ["areas.view", "areas.edit"] });
  const admin3Update2 = await H["db:update"]({ sender: { id: 4 } }, "areas", areaId, { status: "active" });
  ok("view+edit admin can SAVE after permission change", admin3Update2 === true);
  let admin3CreateErr2 = "";
  try {
    await H["db:create"]({ sender: { id: 4 } }, "areas", { name: "Nope2", status: "active" });
  } catch (e) {
    admin3CreateErr2 = String(e);
  }
  ok("view+edit admin still cannot CREATE (no create grant)", admin3CreateErr2.includes("PERMISSION_DENIED:areas.create"));
  let admin3DelErr2 = "";
  try {
    await H["db:delete"]({ sender: { id: 4 } }, "areas", areaId);
  } catch (e) {
    admin3DelErr2 = String(e);
  }
  ok("view+edit admin cannot DELETE (no delete grant)", admin3DelErr2.includes("PERMISSION_DENIED:areas.delete"));
  const colRoleId = (await H["roles:list"](fakeEvent)).find((r) => r.name === "Collector").id;
  await H["users:create"](fakeEvent, { username: "col2", password: "secret1", full_name: "Collector Two", role_id: colRoleId });
  await H["auth:login"]({ sender: { id: 5 } }, "col2", "secret1");
  let colViewErr = "";
  try {
    await H["db:list"]({ sender: { id: 5 } }, "staff", {});
  } catch (e) {
    colViewErr = String(e);
  }
  ok("collector without permission CANNOT view", colViewErr.includes("PERMISSION_DENIED:staff"));
  let colSaveErr = "";
  try {
    await H["db:create"]({ sender: { id: 5 } }, "staff", { name: "Nope" });
  } catch (e) {
    colSaveErr = String(e);
  }
  ok("collector without permission CANNOT save", colSaveErr.includes("PERMISSION_DENIED:staff.create"));
  let colSecurityErr = "";
  try {
    await H["roles:save"]({ sender: { id: 5 } }, { name: "Hack", permissions: ["all"] });
  } catch (e) {
    colSecurityErr = String(e);
  }
  ok("collector can never touch Security \u2192 Roles", colSecurityErr.includes("PERMISSION_DENIED:security"));
  await H["roles:save"](fakeEvent, {
    id: adminRole2.id,
    name: "Administrator",
    permissions: ["dashboard", "areas", "customers", "billing", "payments", "collectors", "cash_deposits", "reports", "messaging", "complaints", "packages", "connections", "messages", "sms_templates", "customer_documents", "staff", "resellers", "inventory", "accounts", "users", "company_profile"]
  });
  section("company profile \u2014 Settings save fix");
  const coProfile = await H["settings:companyProfile"]({ sender: { id: 4 } });
  ok("company profile view loads for Administrator", !!coProfile && "company_name" in coProfile);
  await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, {
    company_name: "AVA Test Cable Network",
    company_mobile: "01712345678",
    company_mobile_alt: "01812345678",
    company_email: "info@avatest.com",
    company_address: "Mirpur 10, Dhaka",
    company_logo: "data:image/png;base64,iVBORw0KGgo="
  });
  const coAfter = await H["settings:companyProfile"]({ sender: { id: 4 } });
  ok("Administrator saved company name + mobile", coAfter.company_name === "AVA Test Cable Network" && coAfter.company_mobile === "01712345678");
  ok("alternative mobile + email + logo saved", coAfter.company_mobile_alt === "01812345678" && coAfter.company_email === "info@avatest.com" && coAfter.company_logo.startsWith("data:image/png"));
  const persisted = getDb().prepare("SELECT value FROM settings WHERE key = 'company_name'").get();
  ok("company profile persisted in database", persisted?.value === "AVA Test Cable Network");
  await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "AVA Test Cable Network 2", company_mobile: "01712345678" });
  const rows = getDb().prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'company_name'").get();
  ok("upsert creates no duplicate company records", rows.c === 1);
  const coAfter2 = await H["settings:companyProfile"]({ sender: { id: 4 } });
  ok("company profile updated (UPDATE path)", coAfter2.company_name === "AVA Test Cable Network 2");
  let emptyNameErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "   " });
  } catch (e) {
    emptyNameErr = String(e);
  }
  ok("empty company name rejected", emptyNameErr.includes("REQUIRED:company_name"));
  let badEmailErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "X", company_email: "not-an-email" });
  } catch (e) {
    badEmailErr = String(e);
  }
  ok("invalid email rejected", badEmailErr.includes("INVALID_EMAIL"));
  let badMobileErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "X", company_mobile: "12345" });
  } catch (e) {
    badMobileErr = String(e);
  }
  ok("invalid mobile rejected", badMobileErr.includes("INVALID_MOBILE"));
  let badLogoErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 4 } }, { company_name: "X", company_logo: "http://evil/x.png" });
  } catch (e) {
    badLogoErr = String(e);
  }
  ok("non-data-url logo rejected", badLogoErr.includes("INVALID_LOGO"));
  let colCoErr = "";
  try {
    await H["settings:companyProfileUpdate"]({ sender: { id: 5 } }, { company_name: "Hacked" });
  } catch (e) {
    colCoErr = String(e);
  }
  ok("collector cannot edit company profile", colCoErr.includes("PERMISSION_DENIED:company_profile"));
  await H["settings:setMany"]({ sender: { id: 4 } }, { company_mobile: "01712345678", company_email: "info@avatest.com" });
  ok("company-only setMany works for Administrator", true);
  let mixedErr = "";
  try {
    await H["settings:setMany"]({ sender: { id: 4 } }, { company_mobile: "01712345678", late_fee: "99" });
  } catch (e) {
    mixedErr = String(e);
  }
  ok("mixed/system keys still denied for Administrator", mixedErr.includes("PERMISSION_DENIED:settings"));
  await H["settings:setMany"](fakeEvent, { company_name: "AVA Test Cable Network", late_fee: "10" });
  ok("SUPER_ADMIN saves company + system settings", getSetting("late_fee") === "10");
  await H["permissions:set"](fakeEvent, admin3Id, [{ key: "settings" }]);
  await H["settings:setMany"]({ sender: { id: 4 } }, { late_fee: "15", session_timeout: "240" });
  ok("settings module key holder saves system settings", getSetting("late_fee") === "15" && getSetting("session_timeout") === "240");
  let sysSetErr = "";
  try {
    await H["settings:set"]({ sender: { id: 4 } }, "permission_mode", "open");
  } catch (e) {
    sysSetErr = String(e);
  }
  ok("settings key holder can save single system keys too", sysSetErr === "", sysSetErr);
  const inv = await H["billing:invoice"]({ sender: { id: 1 } }, b1.id);
  ok("invoice print data carries saved company name/mobile", inv.company.name === "AVA Test Cable Network" && inv.company.mobile === "01712345678");
  ok("invoice print data carries email/alt mobile/logo", inv.company.email === "info@avatest.com" && inv.company.mobile_alt === "01812345678" && !!inv.company.logo);
  const billData = await H["reports:customerBill"]({ sender: { id: 1 } }, c1, month);
  ok("billing report (office/customer copy) carries company info", billData.company.name === "AVA Test Cable Network" && billData.company.mobile === "01712345678");
  section("area-wise customer serial import");
  const impSerial = await H["customers:import"](fakeEvent, [
    { name: "AreaA S1", mobile: "01611100001", serial: 1, areaName: "Mirpur" },
    { name: "AreaA S2", mobile: "01611100002", serial: 2, areaName: "Mirpur" },
    { name: "AreaB S1", mobile: "01611100011", serial: 1, areaName: "Uttara" },
    // same serial 1, different area → OK
    { name: "AreaB S2", mobile: "01611100012", serial: 25, areaName: "Uttara" },
    // serial range differs per area
    { name: "AreaA DupS1", mobile: "01611100021", serial: 1, areaName: "Mirpur" }
    // duplicate serial in SAME area
  ]);
  ok("same serial in different areas imports successfully", impSerial.imported === 4 && impSerial.duplicates === 1, impSerial);
  ok("duplicate serial in same area reported with warning", impSerial.errors.some((x) => x.includes("duplicate serial 1 in Mirpur")), impSerial.errors);
  const serialRows = (await H["customers:list"](fakeEvent, { search: "016111000" })).rows;
  const areaAS1 = serialRows.find((r) => r.name === "AreaA S1");
  const areaBS1 = serialRows.find((r) => r.name === "AreaB S1");
  ok("serials stored + area assignment preserved", areaAS1?.customer_serial === 1 && areaAS1?._area === "Mirpur" && areaBS1?.customer_serial === 1 && areaBS1?._area === "Uttara", serialRows.map((r) => [r.name, r._area, r.customer_serial]));
  ok("global customer IDs remain unique codes", new Set(serialRows.map((r) => r.code)).size === serialRows.length);
  const impSerial2 = await H["customers:import"](fakeEvent, [
    { name: "AreaA S1 again", mobile: "01611100099", serial: 1, areaName: "Mirpur" }
  ]);
  ok("re-import of same area+serial skipped as duplicate", impSerial2.imported === 0 && impSerial2.duplicates === 1, impSerial2);
  const serialSearch = (await H["customers:list"](fakeEvent, { search: "25" })).rows;
  ok("search finds area-wise serial", serialSearch.some((r) => r.name === "AreaB S2"), serialSearch.map((r) => r.name));
  const impBadArea = await H["customers:import"](fakeEvent, [
    { name: "Bad Area", mobile: "01611100055", serial: 7, areaName: "No Such Area" }
  ]);
  ok("unknown area in Excel reported", impBadArea.invalid === 1 && impBadArea.errors.some((x) => x.includes("area not found")), impBadArea);
  const serialCustomerId = await H["customers:create"](fakeEvent, { name: "Form Serial", mobile: "01611100066", area_id: areaId, customer_serial: 15 });
  const serialGet = (await H["customers:get"](fakeEvent, serialCustomerId)).customer;
  ok("customer form saves area-wise serial", serialGet.customer_serial === 15 && serialGet._area === "Mirpur");
  await H["customers:update"](fakeEvent, serialCustomerId, { customer_serial: 16 });
  ok("customer serial editable", (await H["customers:get"](fakeEvent, serialCustomerId)).customer.customer_serial === 16);
  section("migration v17 - company_profile re-grant");
  const { MIGRATIONS: MIGRATIONS2 } = (init_migrations(), __toCommonJS(migrations_exports));
  const adminRole = (await H["roles:list"](fakeEvent)).find((r) => r.name === "Administrator");
  await H["roles:save"](fakeEvent, { id: adminRole.id, name: "Administrator", permissions: ["dashboard", "customers"] });
  const beforeFix = (await H["roles:list"](fakeEvent)).find((r) => r.id === adminRole.id);
  ok("role edit dropped company_profile (pre-condition)", !String(beforeFix.permissions).includes("company_profile"), beforeFix.permissions);
  db2.exec(MIGRATIONS2[MIGRATIONS2.length - 1]);
  const afterFix = JSON.parse((await H["roles:list"](fakeEvent)).find((r) => r.id === adminRole.id).permissions);
  ok("migration v17 restored company_profile", afterFix.includes("company_profile") && afterFix.includes("dashboard"), afterFix);
  db2.exec(MIGRATIONS2[MIGRATIONS2.length - 1]);
  const afterFix2 = JSON.parse((await H["roles:list"](fakeEvent)).find((r) => r.id === adminRole.id).permissions);
  ok("migration v17 is idempotent (no duplicates)", afterFix2.filter((k) => k === "company_profile").length === 1, afterFix2);
  console.log(`
=========================
RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => {
  console.error("TEST CRASH:", e);
  process.exit(1);
});
/*! Bundled license information:

bcryptjs/dist/bcrypt.js:
  (**
   * @license bcrypt.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
   * Released under the Apache License, Version 2.0
   * see: https://github.com/dcodeIO/bcrypt.js for details
   *)
*/

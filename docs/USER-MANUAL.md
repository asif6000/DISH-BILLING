# AVA Cable Management System — User Manual

**Version 1.0 · Windows Desktop · 100% Offline**

---

## 1. Getting Started

### First Login
The application creates a default administrator account on first run:

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

> ⚠️ **Change this password immediately** — go to *Security & Permission → User Management → Change Password*.

### Language & Theme
- The app opens in **Bengali (বাংলা)** by default.
- Toggle language anytime from the top bar (`বাং / EN`) or in *Settings → Language*.
- Toggle **Light/Dark mode** with the sun/moon icon in the top bar.

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Alt + D` | Dashboard |
| `Alt + C` | Customers |
| `Alt + B` | Billing |
| `Alt + P` | Collect Payment |
| `Alt + R` | Reports |
| `Ctrl + P` | Print current view |

---

## 2. Recommended First-Run Setup

Do these once, in order:

1. **Settings → Company Profile** — company name (Bangla + English), address, mobile, invoice footer.
2. **Settings → Billing Settings** — set the monthly **Late Fee** and **Session Timeout**.
3. **Area Management → Zone Management** — create your zones.
4. **Area Management → All Areas** — create areas under zones.
5. **Package Management** — create your packages (Basic/Standard/Premium/HD/Special/Free) with monthly prices.
6. **Staff Management → All Staff** — add your staff (technicians, collectors, manager).
7. **Collector Management → All Collectors** — register collector profiles from staff, then *Assign Area* to each collector.
8. **Security & Permission → User Management** — create accounts for each employee with proper Roles & Permissions.
9. **Security & Permission → Backup & Restore** — take your first backup.

---

## 3. Daily Workflow

### 3.1 Adding a Customer (New Connection)
*Customer Management → All Customers → Add*

1. Fill **Customer Information** (name, father's name, mobile `01XXXXXXXXX`, address, area).
2. Fill **Connection Information** — package, connection date, monthly bill, connection fee.
3. A unique **Customer ID** (`AVA-00001` format) is generated automatically.
4. To receive the connection fee, go to *Payment Management → Collect Payment*, select the customer, choose type **Connection Fee**.

The new connection is recorded in the customer's **Connection History**.

### 3.2 Monthly Billing
*Billing Management → Monthly Billing → Generate Bills*

- Select the month (and optionally a single area) → **Generate**.
- The system creates one bill per **active** customer.
- **Duplicates are prevented** — customers who already have a bill for that month are skipped.
- **Previous due carries forward automatically** into the new bill's *Previous Due* column.
- Discounts registered in *Discount Management* are applied automatically.
- Free-package customers get a ৳0 bill.
- **Auto Billing**: if enabled in *Automation Management*, the current month's bills are generated automatically every time the app starts.

Each bill shows: Monthly Bill − Discount + Previous Due + Late Fee = **Net Total**.

### 3.3 Collecting Payments
*Payment Management → Collect Payment*

1. Search and select the customer (their **due** and **advance** are shown).
2. Enter amount and date.
3. Choose the payment method: **Cash / bKash / Nagad / Rocket / Bank** (record TrxID as reference for mobile banking).
4. Choose type: **Bill** (applies to oldest unpaid bills first) or **Advance**.
5. Click **Collect Payment** — a **payment receipt** opens for printing (A4 or Thermal 58/80mm selectable in the print window).

Payment rules:
- **Partial payment** — pay less than the bill; the bill becomes *Partial* and the rest stays due.
- **Advance payment** — pay more than the dues; the surplus goes to the customer's **Advance Balance**.
- **Use Advance** — on the customer profile, one click applies the advance balance to outstanding dues.
- **Refund** — *Payment Management → Refund Management* returns money from the advance balance.

Every payment is **transaction-safe** — it either completes fully or not at all.

### 3.4 Complaints
*Complaints Management → New Complaint* — register complaints (No Signal, Cable Problem, Picture/Sound/Channel Problem, Set-Top Box Problem), set priority, **assign a technician**, and mark them **Resolved** with feedback. Pending complaints appear on the dashboard and as a badge in the sidebar.

### 3.5 Daily Collection Review
- *Payment Management → Daily Collection* — date range + chart + table.
- *Collector Management → Cash Deposit* — record the cash collectors deposit; *Collection Verification* report shows collected vs deposited.

---

## 4. Module Guide

| Module | What you do there |
|--------|-------------------|
| **Dashboard** | 14 KPI cards, daily collection chart, monthly revenue chart, customer growth chart, area-wise stats, recent payments/customers, pending complaints. Month filter on top. |
| **Area Management** | Zones → Areas → Sub Areas → Roads; area-wise customer list & collection report. |
| **Network Management** | Register Main Lines, Distribution Boxes, Fiber Nodes, Splitters, Amplifiers, Cable Routes, Connection Points (with parent device links); log network faults with resolution dates. |
| **Customer Management** | All customers with status filters (Active/Inactive/Paid/Due/Expired/Free), profile with bills/payments/history/documents, **Transfer** (change area), **Shifting** (change address), **Bulk Import/Export** (CSV). |
| **Billing Management** | Generate bills, current/previous month views, due & partial bill filters, bill adjustment (discount + late fee with reason), discount management, billing history, invoice printing. |
| **Payment Management** | Collect payments (5 methods), payment history with filters, daily collection, advance payments, refunds. |
| **Connection Management** | Disconnect / reconnect / temporary disconnect, customer transfer, full installation & connection event history. |
| **Package Management** | Packages with pricing and types; changing a customer's package is logged as upgrade/downgrade in their history. |
| **Staff Management** | Staff records, attendance, leave management, salary management (with bonus/commission/deduction). |
| **Collector Management** | Collector profiles, area assignment, monthly targets & commission rates, cash deposits, collector report (collected vs target vs commission). |
| **Reseller Management** | Reseller profiles, customers per reseller, **wallet** (recharge / payment / commission transactions), reseller report. |
| **Message & Notification** | Message templates with placeholders (`{{name}}`, `{{month}}`, `{{total}}`, `{{company}}`), one-click **Due Reminder** generation for all due customers of a month, individual SMS/WhatsApp records. WhatsApp opens `wa.me` links when internet is available; everything is recorded offline. |
| **Complaints Management** | Full complaint lifecycle with technician assignment. |
| **Inventory Management** | Products (cable, fiber, STB, remote, amplifier, splitter, connector, adapter), suppliers, **purchases with line items** (stock auto-updates), stock in/out movements, low-stock view, warranty months. |
| **Accounts Management** | Cashbook (running balance), bank/mobile accounts, income & expense entries, account transfers, receivables, **Profit & Loss** with breakdowns, **Balance Sheet**. Payments/purchases/refunds flow into the default cash account automatically. |
| **Expenses Management** | Quick expense entry with categories (salary, cable purchase, electricity, rent, transport, maintenance...), daily/monthly views, category management. |
| **Reports Management** | Due list, area-wise collection, collector report, reseller report, package report, daily collection, **Profit & Loss** — every table exports to **Excel / PDF / CSV**. |
| **Marketing & CRM** | Customer leads with sources & status, follow-up history with next dates. |
| **Automation Management** | Toggle auto-billing & auto-backup, run billing now, database integrity check, backup history. |
| **Branch Management** | Branches with manager assignment for multi-branch setups. |
| **Security & Permission** | Users, **Roles with per-module permissions**, activity logs, login history, **Backup & Restore**. |
| **Settings** | Company profile, invoice prefix & footer, billing settings, language, database info. |

---

## 5. Printing

Clicking **Print** opens a print preview window with a paper selector:

| Option | Use |
|--------|-----|
| **A4** | Invoices, due lists, collection reports |
| **Thermal 80mm** | Payment receipts on 80mm thermal printers |
| **Thermal 58mm** | Payment receipts on 58mm thermal printers |

The native Windows print dialog lets you choose the printer. Receipts and invoices are also saved/viewable as PDF from the print dialog.

---

## 6. Data Safety (Very Important)

- The database lives in **`%APPDATA%\ava-cable-management\ava-cable.db`** (Electron userData) — **outside** the installation folder.
- **Software updates and uninstall/reinstall do NOT delete your data.**
- **Automatic backup** runs every 12 hours into `...\ava-cable-management\backups\` (last 30 kept) when enabled.
- Manual backups: *Security & Permission → Backup & Restore → Create New Backup* — save the `.db` file to a USB drive or any folder.
- **Restore** replaces the current database — **always take a fresh backup before restoring.**
- *Database Integrity Check* (Settings / Automation) verifies the file is healthy.

### Backup file
A backup is a single `.db` file — a complete copy of all data. To move your business to another computer: take a backup, install the app on the new PC, then **Restore** from that file.

---

## 7. Roles & Permissions

Roles control which modules a user can open. Create a role in *Security → Role Management* and tick the module permissions (e.g., a Collector sees only Dashboard, Payments, Customers). Users with the **Administrator** role have full access. All activity (create/update/delete/login) is recorded in **Activity Logs**.

---

## 8. Offline Behaviour

Everything — customers, billing, payments, reports, accounts, inventory, printing, backup — works with **no internet**. Only these optional features use internet when available:
- **WhatsApp messages** (opens web links)
- SMS app links (for gateway/manual sending)

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Wrong username/password | Check username; passwords are case-sensitive. Admin can reset via User Management (edit user → new password). |
| "Database integrity check failed" at startup | Restore your latest backup from *Security → Backup & Restore*. |
| Bill generated by mistake | Unpaid bills can be **Cancelled** from the billing row actions. |
| Printed receipt shows wrong printer | Select the printer in the Windows print dialog each time, or set a default printer in Windows. |
| App window too small | Resize normally; minimum width 1100px. Use `Ctrl + -/+` to zoom. |
| Need to move data to a new PC | Backup → install app → Restore. |
| Subscription expired / activation code not working | See **Section 10 — Subscription** below. |

---

## 10. Subscription

The app uses a **yearly subscription of ৳10,000 (ten thousand taka)**. The first install starts with a **30-day trial**. The current expiry date is shown in *Settings → Subscription*, and a warning banner appears in the header during the last 7 days.

### When the subscription expires

The app locks and shows a full-screen payment page with these payment numbers:

- **bKash:** 01331707900
- **Nagad:** 01616595386

### Activation — Option A: Online approval via Supabase (recommended)

Once Supabase is configured (see `supabase-setup.sql` and *Settings → Supabase*), the customer pays, then submits **company name, mobile, method and TrxID** on the payment page. Each installation gets a unique **App ID automatically** (used to identify the customer in the admin panel). The request appears as **pending** in the developer's **admin panel** (`admin-panel.html`).

**Admin account:** the developer creates it from **Supabase → SQL Editor** (open `admin-panel.html` — when no admin exists it shows the exact `INSERT` SQL to generate for your chosen username/password). Then log in to the panel.

After the developer clicks **Approve**, the customer's app checks Supabase (on startup, every 30 minutes, and the payment page polls every 60 seconds) and **activates automatically** until `expires_at` (+1 year from approval).

### Activation — Option B: Offline activation code (backup, works without internet)

1. Send **৳10,000** via bKash or Nagad to one of the numbers above.
2. Contact support and receive an **8-character activation code** (generated with `node scripts/gen-sub-code.js [YYYY-MM]`).
3. Enter the code on the payment page (or in *Settings → Subscription*) and click **Activate**.
4. The subscription extends by **1 full year** from the current expiry (renewing early never loses days).


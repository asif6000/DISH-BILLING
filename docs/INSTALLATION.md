# AVA Cable Management System — Installation & Build Guide

## 1. For End Users (Install from Setup EXE)

### Requirements
- Windows 10 or Windows 11 (64-bit)
- ~350 MB free disk space
- No internet required (ever, for normal operation)

### Steps
1. Double-click **`AVA-Cable-Management-Setup-1.0.0.exe`**.
2. If Windows SmartScreen shows a warning, click **More info → Run anyway** (the app is not code-signed; this is normal for private software).
3. Choose the installation folder (default is fine) → **Install**.
4. Shortcuts are created on the **Desktop** and in the **Start Menu** ("AVA Cable Management").
5. Launch the app and log in with `admin` / `admin123` (see the User Manual — change this immediately).

### Your data
Data is stored in `%APPDATA%\ava-cable-management\ava-cable.db` — **not** in the installation folder. Updating to a newer version (run the new Setup EXE) or uninstalling/reinstalling **does not delete your data**.

---

## 2. For Developers (Build from Source)

### Requirements
- Node.js 20+ (tested with Node 22/26) — includes `node:sqlite` used by the app
- npm 10+
- Windows 10/11 (for building the Windows EXE)
- No Visual Studio Build Tools needed — the app uses Node's built-in SQLite (no native compilation)

### Setup
```bash
npm install
```

> If npm skips install scripts (newer npm versions protect them), approve electron and esbuild:
> ```bash
> npm install-scripts approve electron
> npm install-scripts approve esbuild
> npm rebuild electron esbuild
> ```
> This downloads the official Electron runtime binary from GitHub releases.

### Verify
```bash
npm run typecheck   # TypeScript, both main + renderer
npm test            # 300+ business-logic tests (billing, payments, SMS wallet, backup)
npm run build       # bundles main / preload / renderer into out/
```

### Run in development
```bash
npm run dev
```

### Build the Windows EXE installer
```bash
npm run dist
```
Output (in `release/`):
- **`AVA-Cable-Management-Setup-1.0.0.exe`** — NSIS installer (desktop + start menu shortcuts, uninstaller)
- `win-unpacked/` — portable unpacked build

The build config (`build` section of `package.json`) targets **Windows 10/11 x64**, uses `build/icon.ico`, and names the artifact `AVA-Cable-Management-Setup-{version}.exe`.

### Test the EXE on a clean machine
1. Copy the Setup EXE to a fresh Windows 10/11 VM or PC (or a new user profile).
2. Install, launch, login, and run through the first-run checklist in the User Manual.
3. Verify `%APPDATA%\ava-cable-management\ava-cable.db` is created and persists across an uninstall/reinstall cycle.

---

## 3. Architecture Notes

```
src/
  main/            Electron main process (Node 22 inside Electron 38)
    index.ts       window, menu, startup automation (auto-billing, auto-backup)
    db/            node:sqlite connection + SQL migrations (PRAGMA user_version)
    ipc/           secure IPC handlers: auth, generic CRUD, customers,
                   billing, payments, dashboard, reports, settings,
                   backup, inventory, misc (resellers/accounts/messages)
    print.ts       print preview window (A4 / 58mm / 80mm thermal)
  preload/         contextBridge API (contextIsolation: on, nodeIntegration: off)
  renderer/        React 18 + TypeScript + Tailwind (Vite, bundled)
    components/    Layout, generic DataTable + EntityPage (config-driven CRUD)
    pages/         Dashboard, Customers, Billing, Payments, Reports, ...
  shared/          entity metadata + types used by both sides
tests/             business-logic test suite (300+ tests, runs in plain Node)
```

Key decisions:
- **Database**: `node:sqlite` (built into Electron ≥35's Node 22) — zero native modules, no rebuild on install, simplest possible EXE packaging. WAL journal mode, foreign keys ON, transactions for all money operations.
- **Data location**: `app.getPath('userData')` — survives updates/reinstalls.
- **Migrations**: embedded SQL applied in order, tracked by `PRAGMA user_version` — new versions just append migration strings.
- **Generic CRUD**: `src/shared/entities.ts` defines ~25 entities once; the main process whitelists them and the renderer renders tables/forms from the same metadata.
- **Money**: `round2()` everywhere; payments allocate to oldest unpaid bills first; surplus becomes advance balance.
- **Security**: bcryptjs password hashing, role-based permissions enforced in IPC handlers, session timeout, activity + login logs.

## 4. SMS Gateway Configuration (server side only)

The SMS gateway is called **only from the Electron main process**. The renderer
never receives the provider API key; the Super Admin UI only shows boolean
“configured / missing” status.

There are two supported server-side modes. **Supabase Edge Function mode is
recommended** because the provider API key and Sender ID are stored in Supabase
Edge Function Secrets instead of the desktop environment:

### Mode A — Supabase Edge Function (recommended)

1. Deploy `supabase/functions/bulksmsbd` (see `supabase/functions/README.md`)
   and set `BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID`, `SMS_GATEWAY_TOKEN`,
   `BULKSMSBD_GATEWAY_URL` and `BULKSMSBD_BALANCE_URL` as Supabase secrets.
2. On the desktop set only:

```bat
setx SMS_PROVIDER "bulksmsbd"
setx SMS_EDGE_URL "https://<project-ref>.supabase.co/functions/v1/bulksmsbd"
setx SMS_EDGE_TOKEN "<the same long random token>"
```

When `SMS_EDGE_URL` exists, **send, provider-balance and DLR** requests are
routed through the Edge Function. The provider API key never reaches the
installer, renderer, SQLite database or logs. The local per-user SMS wallets and
all atomic accounting remain in the Electron main process.

### Mode B — local main-process credentials

Set these **Windows environment variables** before launching the app (then sign
out/in or restart Windows so the new environment is inherited):

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `SMS_PROVIDER` | yes | `bulksmsbd` | `generic`, `bulksmsbd`, `smsnetbd`, `sslwireless` |
| `SMS_GATEWAY_URL` | yes | `https://bulksmsbd.net/api/smsapi` | BulkSMSBD send endpoint |
| `SMS_BALANCE_URL` | optional | `https://bulksmsbd.net/api/getBalanceApi` | Gateway balance check (defaults for BulkSMSBD) |
| `SMS_DLR_URL` | optional | `https://bulksmsbd.net/api/deliveryReportApi` | Delivery report endpoint (defaults for BulkSMSBD) |
| `SMS_LOW_BALANCE_THRESHOLD` | optional | `20` | In-app low SMS balance warning threshold |
| `SMS_SENDER_ID` | yes | `8809612...` | Approved sender / mask |
| `SMS_API_KEY` | yes | *(secret)* | API key from the provider |
| `SMS_API_SECRET` | for providers that need it | *(secret)* | API secret / password |
| `SMS_ENABLED` | optional | `1` | Force-enable the gateway (overrides the Super Admin toggle) |
| `SMS_REFUND_ON_FAILED` | optional | `1` | Refund wallet SMS if the provider rejects/fails a send |
| `SMS_TIMEOUT_MS` | optional | `15000` | Gateway HTTP timeout |
| `SMS_EDGE_URL` | Edge mode | `https://<ref>.supabase.co/functions/v1/bulksmsbd` | Secure Supabase proxy; when set, local key/sender are not used |
| `SMS_EDGE_TOKEN` | Edge mode | *(secret)* | Token shared with the Edge Function secret `SMS_GATEWAY_TOKEN` |

Example (Command Prompt, current user):

```bat
setx SMS_PROVIDER "bulksmsbd"
setx SMS_GATEWAY_URL "https://bulksmsbd.net/api/smsapi"
setx SMS_BALANCE_URL "https://bulksmsbd.net/api/getBalanceApi"
setx SMS_DLR_URL "https://bulksmsbd.net/api/deliveryReportApi"
setx SMS_SENDER_ID "8809612xxxxxx"
setx SMS_API_KEY "your-key"
setx SMS_API_SECRET "your-secret"
setx SMS_LOW_BALANCE_THRESHOLD "20"
```

Notes:
- `SMS_GATEWAY_URL` / `SMS_SENDER_ID` / `SMS_PROVIDER` may also be saved by the
  Super Admin in **SMS Admin → Gateway** when no environment override exists.
  Environment values always win.
- API key/secret and the Edge token are **never** written to the database, logs,
  SMS history or UI. Provider error text is redacted before it is stored.
- After configuring either mode, open **SMS Admin → Gateway** and click **Test**
  to send one real test SMS (this does not debit any user wallet).
- Each account has its own SMS wallet (`sms_wallets`), separate from
  `accounts.balance` and the BDT `transactions` ledger. Only the Super Admin can
  verify package payments, allocate wallet credits, or view other users'
  wallets. Every wallet change is an immutable `sms_transactions` row.
- **BulkSMSBD specifics:** ASCII messages use `type=text`; Bangla/Unicode
  messages use `type=unicode`. A provider response code **202 means SUBMITTED,
  not delivered** — it is stored as `sent` until a delivery report or manual
  override proves delivery. Error codes are mapped to readable messages
  (e.g. `1007 Provider balance is insufficient`). Before each send the main
  process checks the user's wallet, calculates the billable parts, and checks the
  shared provider balance; an insufficient provider balance blocks the send
  before any wallet debit. Personalized bulk sends use the official
  `smsapimany` endpoint: one batch request, one message row per recipient and
  one atomic debit for the total billable parts (maximum 100 recipients).
- **Provider credits vs user wallets:** BulkSMSBD's balance is the shared gateway
  balance. **SMS Admin → Provider Credits** records real provider purchases for
  bookkeeping. **SMS Admin → User Wallets → Adjust** allocates internal wallet
  SMS to an individual user. These are two separate ledgers by design.
- **Supabase architecture note:** this desktop app authenticates locally and
  keeps business data in a per-installation SQLite database; Supabase stores the
  account directory / subscription rows and (optionally) runs the Edge Function
  proxy. User SMS wallets are therefore local and keyed 1:1 to the local account
  provisioned from the unique Supabase `app_users.username`. They are never
  mixed with `accounts.balance` or the BDT `transactions` ledger.

---

## 5. Version Upgrades
1. Bump `version` in `package.json`.
2. Add a new SQL migration string to `src/main/db/migrations.ts` (it will auto-apply on next start).
3. `npm run dist` — build the new Setup EXE. User data is preserved.

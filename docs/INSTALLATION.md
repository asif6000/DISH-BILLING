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
npm test            # 45 business-logic tests (billing, payments, inventory, backup)
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
tests/             business-logic test suite (45 tests, runs in plain Node)
```

Key decisions:
- **Database**: `node:sqlite` (built into Electron ≥35's Node 22) — zero native modules, no rebuild on install, simplest possible EXE packaging. WAL journal mode, foreign keys ON, transactions for all money operations.
- **Data location**: `app.getPath('userData')` — survives updates/reinstalls.
- **Migrations**: embedded SQL applied in order, tracked by `PRAGMA user_version` — new versions just append migration strings.
- **Generic CRUD**: `src/shared/entities.ts` defines ~25 entities once; the main process whitelists them and the renderer renders tables/forms from the same metadata.
- **Money**: `round2()` everywhere; payments allocate to oldest unpaid bills first; surplus becomes advance balance.
- **Security**: bcryptjs password hashing, role-based permissions enforced in IPC handlers, session timeout, activity + login logs.

## 4. Version Upgrades
1. Bump `version` in `package.json`.
2. Add a new SQL migration string to `src/main/db/migrations.ts` (it will auto-apply on next start).
3. `npm run dist` — build the new Setup EXE. User data is preserved.

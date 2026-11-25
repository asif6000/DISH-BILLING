-- ============================================================
-- AVA Cable Management — Subscription Approval (Supabase setup)
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Payment requests sent from the desktop app
create table if not exists sub_requests (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,                  -- unique per app installation
  company_name text,
  mobile text not null,
  method text not null,                  -- 'bkash' | 'nagad'
  trx_id text not null,
  amount numeric not null default 10000,
  status text not null default 'pending',-- pending | approved | rejected
  current_expiry date,                   -- customer's expiry at request time (for renewals)
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at date
);

-- 2) Admin users for the approval panel (custom login)
create table if not exists sub_admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,           -- sha256 hex, created from the admin panel
  created_at timestamptz not null default now()
);

alter table sub_requests enable row level security;
alter table sub_admins enable row level security;

-- Migration for tables created before this column existed (safe to re-run):
alter table sub_requests add column if not exists current_expiry date;

-- Customers' apps (anon key) may SEND requests, but cannot read the table.
drop policy if exists "anon can send payment requests" on sub_requests;
create policy "anon can send payment requests"
  on sub_requests for insert to anon with check (true);

-- 3) Read-only status view for the customer's app (only approved rows).
--    The app checks this to auto-activate after you approve.
create or replace view sub_status as
  select app_id, status, approved_at, expires_at
  from sub_requests
  where status = 'approved';

grant select on sub_status to anon;

-- 4) (Optional) Example: create an admin manually.
--    Easier way: open admin-panel.html and use the first-run "Create admin" form.
-- insert into sub_admins (username, password_hash)
-- values ('admin', '<sha256-hex-of-password>');

-- ============================================================
-- 5) USER ACCOUNT APPROVAL (desktop app login accounts)
--    Signup -> pending -> Approve in admin panel -> login works
--    SAFE TO RE-RUN — always keep this version in Supabase.
--    If signup requests never appear in the panel, the main cause
--    is this part missing or the grants below not applied.
-- ============================================================
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text,
  mobile text,
  status text not null default 'pending',  -- pending | approved | rejected
  reset_hash text,                          -- new bcrypt password hash set by admin (reset)
  role_name text,                           -- role the developer assigns remotely (v1.0.55)
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- existing projects: add the column if it is missing (idempotent)
alter table app_users add column if not exists role_name text;

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  requested_at timestamptz not null default now()
);

alter table app_users enable row level security;
alter table password_resets enable row level security;

-- IMPORTANT: the desktop app signs up with the ANON key.
-- RLS policy alone is NOT enough — the anon role also needs explicit
-- table privileges, otherwise the INSERT fails with a permission error
-- and the signup request never reaches Supabase.
grant usage on schema public to anon;
grant insert on app_users to anon;
grant insert on password_resets to anon;

-- Only inserts are allowed for anon — anon must NEVER be able to read or
-- update app_users (otherwise anyone could approve their own account).
drop policy if exists "anon can sign up" on app_users;
create policy "anon can sign up"
  on app_users for insert to anon with check (true);

drop policy if exists "anon can request password reset" on password_resets;
create policy "anon can request password reset"
  on password_resets for insert to anon with check (true);

-- Read-only status view for the app (no password hashes, only reset hash for reset flow)
-- CRITICAL: security_invoker = false is REQUIRED.
-- If the view runs as invoker (anon), it inherits anon's rights on app_users,
-- which have NO select policy — so the app always sees an EMPTY list and
-- approvals never reach the desktop app (login stays 'pending').
-- Recreate (not replace) so an old security_invoker view is replaced:
drop view if exists app_user_status;
create view app_user_status with (security_invoker = false) as
  select username, status, reset_hash, role_name from app_users;

grant select on app_user_status to anon;

-- Bulletproof read path (preferred by the app): a SECURITY DEFINER function
-- runs with the owner's rights, so it is immune to view/RLS misconfiguration.
drop function if exists get_app_user_status();
create or replace function get_app_user_status()
returns table (username text, status text, reset_hash text, role_name text)
language sql
security definer
set search_path = public
as $$
  select username, status, reset_hash, role_name from app_users;
$$;

revoke all on function get_app_user_status() from public;
grant execute on function get_app_user_status() to anon;

-- Full user list for the desktop app's admin User Management page
-- (signup list with names/mobiles — approved & pending users visible to the admin)
drop function if exists get_app_users();
create or replace function get_app_users()
returns table (username text, full_name text, mobile text, status text, role_name text, created_at timestamptz, approved_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select username, full_name, mobile, status, role_name, created_at, approved_at from app_users order by created_at desc;
$$;

revoke all on function get_app_users() from public;
grant execute on function get_app_users() to anon;

-- Sanity checks (run in SQL Editor if signup/approval still fails):
-- select has_table_privilege('anon', 'app_users', 'insert') as anon_can_insert;  -- must be true
-- select count(*) from app_user_status;                                          -- run as ANON key, must be > 0

-- ============================================================
-- v1.0.55 UPGRADE (existing projects): remote role management
-- চালান: Supabase Dashboard → SQL Editor → পুরো ব্লকটা রান করুন
-- Admin Panel-এর Accounts ট্যাব থেকে ইউজারের role (Collector/Manager/
-- Administrator) সেট করলে কাস্টমারের অ্যাপে অটো apply হবে।
-- SUPER_ADMIN রিমোট থেকে কখনো দেওয়া যাবে না (নিরাপত্তা)।
-- ============================================================
alter table app_users add column if not exists role_name text;

drop view if exists app_user_status;
create view app_user_status with (security_invoker = false) as
  select username, status, reset_hash, role_name from app_users;
grant select on app_user_status to anon;

drop function if exists get_app_user_status();
create or replace function get_app_user_status()
returns table (username text, status text, reset_hash text, role_name text)
language sql
security definer
set search_path = public
as $$
  select username, status, reset_hash, role_name from app_users;
$$;
revoke all on function get_app_user_status() from public;
grant execute on function get_app_user_status() to anon;

drop function if exists get_app_users();
create or replace function get_app_users()
returns table (username text, full_name text, mobile text, status text, role_name text, created_at timestamptz, approved_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select username, full_name, mobile, status, role_name, created_at, approved_at from app_users order by created_at desc;
$$;
revoke all on function get_app_users() from public;
grant execute on function get_app_users() to anon;

-- ============================================================
-- v1.0.81 — ACCOUNT SWITCHING / IMPERSONATION SECURITY
--
-- IMPORTANT: customer, bill, payment, report and company-setting data is NOT
-- stored in Supabase. This desktop app keeps it in a per-account LOCAL SQLite
-- workspace, so its isolation is enforced by the Electron main process with a
-- physically separate database file per impersonated account (no SQL query can
-- ever see another account's rows). Supabase only stores the account directory
-- and subscription rows below. The policies here make that boundary explicit:
-- the anonymous key may INSERT a signup/reset request, and may read the account
-- status ONLY through the SECURITY DEFINER functions above. It may never read,
-- update or delete accounts directly.
-- ============================================================
drop policy if exists "anon cannot read app_users" on app_users;
create policy "anon cannot read app_users"
  on app_users for select to anon using (false);

drop policy if exists "anon cannot update app_users" on app_users;
create policy "anon cannot update app_users"
  on app_users for update to anon using (false) with check (false);

drop policy if exists "anon cannot delete app_users" on app_users;
create policy "anon cannot delete app_users"
  on app_users for delete to anon using (false);

drop policy if exists "anon cannot read password_resets" on password_resets;
create policy "anon cannot read password_resets"
  on password_resets for select to anon using (false);

drop policy if exists "anon cannot update password_resets" on password_resets;
create policy "anon cannot update password_resets"
  on password_resets for update to anon using (false) with check (false);

drop policy if exists "anon cannot delete password_resets" on password_resets;
create policy "anon cannot delete password_resets"
  on password_resets for delete to anon using (false);

-- sanity check (run manually): these must all return false
-- select has_table_privilege('anon', 'app_users', 'select');
-- select has_table_privilege('anon', 'app_users', 'update');
-- select has_table_privilege('anon', 'app_users', 'delete');

-- Remove any stale direct table privileges from older versions of this script.
-- Only INSERT (signup / reset request) is allowed for the anonymous key.
revoke select, update, delete on app_users from anon;
revoke select, update, delete on password_resets from anon;

-- ============================================================
-- SMS WALLET / BULKSMSBD — LOCAL WALLET, OPTIONAL SECURE EDGE PROXY
--
-- The desktop app authenticates locally (bcrypt) and Supabase only stores the
-- account directory / subscription rows above. Business data (customers,
-- bills, payments, SMS wallets) stays in the local installation SQLite DB so
-- the app remains offline-first and no anon key can read another user's data.
--
-- Therefore:
--   * do NOT create sms_wallets / sms_messages in Supabase;
--   * do NOT put BULKSMSBD_API_KEY in the anon key, app_users or any table;
--   * the recommended deployment is the Edge Function in
--     supabase/functions/bulksmsbd, with provider credentials stored as Edge
--     Function Secrets (BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID) and a private
--     SMS_GATEWAY_TOKEN. The Electron main process calls it server-to-server
--     with SMS_EDGE_URL / SMS_EDGE_TOKEN and still owns every wallet debit.
--   * alternatively set SMS_API_KEY / SMS_SENDER_ID in the local server
--     environment; the main process reads them and the renderer never does.
--
-- The local SMS wallet is keyed to the local account provisioned 1:1 from the
-- unique Supabase app_users.username. Package payment verification is Super-
-- Admin only, idempotent, and separate from the BDT accounts/transactions
-- ledger. When the Edge Function is used, its SMS_GATEWAY_TOKEN is the only
-- credential required in the desktop environment; RLS protects the account and
-- subscription tables, and no SMS table exists in Supabase to over-expose.
-- ============================================================

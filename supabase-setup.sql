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
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

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
  select username, status, reset_hash from app_users;

grant select on app_user_status to anon;

-- Bulletproof read path (preferred by the app): a SECURITY DEFINER function
-- runs with the owner's rights, so it is immune to view/RLS misconfiguration.
create or replace function get_app_user_status()
returns table (username text, status text, reset_hash text)
language sql
security definer
set search_path = public
as $$
  select username, status, reset_hash from app_users;
$$;

revoke all on function get_app_user_status() from public;
grant execute on function get_app_user_status() to anon;

-- Full user list for the desktop app's admin User Management page
-- (signup list with names/mobiles — approved & pending users visible to the admin)
create or replace function get_app_users()
returns table (username text, full_name text, mobile text, status text, created_at timestamptz, approved_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select username, full_name, mobile, status, created_at, approved_at from app_users order by created_at desc;
$$;

revoke all on function get_app_users() from public;
grant execute on function get_app_users() to anon;

-- Sanity checks (run in SQL Editor if signup/approval still fails):
-- select has_table_privilege('anon', 'app_users', 'insert') as anon_can_insert;  -- must be true
-- select count(*) from app_user_status;                                          -- run as ANON key, must be > 0

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

drop policy if exists "anon can sign up" on app_users;
create policy "anon can sign up"
  on app_users for insert to anon with check (true);

drop policy if exists "anon can request password reset" on password_resets;
create policy "anon can request password reset"
  on password_resets for insert to anon with check (true);

-- Read-only status view for the app (no password hashes, only reset hash for reset flow)
create or replace view app_user_status as
  select username, status, reset_hash from app_users;

grant select on app_user_status to anon;

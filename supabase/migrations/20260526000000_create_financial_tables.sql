-- =============================================================
-- My Financial Dashboard — Initial Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- =============================================================

-- ── Enable UUID generation ────────────────────────────────────
create extension if not exists "pgcrypto";

-- =============================================================
-- 1. SAVINGS
-- =============================================================
create table if not exists public.savings (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  type             text        not null
                               check (type in ('FD','Mutual Funds','Stocks','Chit Funds','PPF','Gold','Other')),
  amount_invested  numeric(14,2) not null check (amount_invested >= 0),
  current_value    numeric(14,2) not null check (current_value >= 0),
  start_date       date        not null,
  notes            text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger savings_updated_at
  before update on public.savings
  for each row execute procedure public.set_updated_at();

-- =============================================================
-- 2. EXPENSES
-- =============================================================
create table if not exists public.expenses (
  id          uuid        primary key default gen_random_uuid(),
  amount      numeric(14,2) not null check (amount > 0),
  category    text        not null
              check (category in ('Food','Transport','Rent','EMI','Entertainment','Health','Other')),
  date        date        not null,
  notes       text        not null default '',
  created_at  timestamptz not null default now()
);

-- =============================================================
-- 3. INDEXES (for common query patterns)
-- =============================================================
create index if not exists savings_created_at_idx  on public.savings  (created_at desc);
create index if not exists expenses_date_idx        on public.expenses (date desc);
create index if not exists expenses_category_idx    on public.expenses (category);
create index if not exists expenses_created_at_idx  on public.expenses (created_at desc);

-- =============================================================
-- 4. ROW LEVEL SECURITY
--    Currently open (no auth) — matches the app's no-login design.
--    Tighten these policies when you add Supabase Auth later.
-- =============================================================
alter table public.savings  enable row level security;
alter table public.expenses enable row level security;

-- Allow all operations for anonymous/public access (no login required)
create policy "public_savings_select"  on public.savings  for select using (true);
create policy "public_savings_insert"  on public.savings  for insert with check (true);
create policy "public_savings_update"  on public.savings  for update using (true);
create policy "public_savings_delete"  on public.savings  for delete using (true);

create policy "public_expenses_select" on public.expenses for select using (true);
create policy "public_expenses_insert" on public.expenses for insert with check (true);
create policy "public_expenses_update" on public.expenses for update using (true);
create policy "public_expenses_delete" on public.expenses for delete using (true);

-- =============================================================
-- 5. COMMENTS (documentation inside Postgres)
-- =============================================================
comment on table  public.savings                 is 'User savings portfolio entries (FD, MF, Stocks, etc.)';
comment on column public.savings.amount_invested is 'Original capital invested in INR';
comment on column public.savings.current_value   is 'Current market value in INR';

comment on table  public.expenses                is 'Daily expense entries';
comment on column public.expenses.date           is 'Calendar date of the expense (not timestamp)';

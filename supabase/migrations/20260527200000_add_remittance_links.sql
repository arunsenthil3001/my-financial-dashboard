-- ══════════════════════════════════════════════════════════════
-- Migration: add remittance_id link columns to expenses + savings
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fusbwarwjppcnfqwbmqi/sql/new
-- ══════════════════════════════════════════════════════════════

-- ── 1. expenses — add multi-currency + remittance link columns ────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency        text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS rate_used       numeric,
  ADD COLUMN IF NOT EXISTS home_amount     numeric,
  ADD COLUMN IF NOT EXISTS foreign_amount  numeric,
  ADD COLUMN IF NOT EXISTS remittance_id   uuid REFERENCES remittances(id) ON DELETE SET NULL;

-- Backfill: treat all existing rows as home-currency (INR) transactions
UPDATE expenses
SET
  currency        = 'INR',
  original_amount = amount,
  rate_used       = 1,
  home_amount     = amount,
  foreign_amount  = NULL
WHERE home_amount IS NULL;

CREATE INDEX IF NOT EXISTS expenses_remittance_id_idx ON expenses(remittance_id);

-- ── 2. savings — add remittance link column ────────────────────────────────────
ALTER TABLE savings
  ADD COLUMN IF NOT EXISTS remittance_id uuid REFERENCES remittances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS savings_remittance_id_idx ON savings(remittance_id);

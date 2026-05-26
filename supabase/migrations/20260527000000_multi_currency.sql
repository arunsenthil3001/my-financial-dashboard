-- ── Multi-Currency + Remittance Pipeline ─────────────────────────────────────
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fusbwarwjppcnfqwbmqi/sql/new

-- ── 1. user_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_currency   text NOT NULL DEFAULT 'INR',
  earning_currency text NOT NULL DEFAULT 'INR',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'allow_all_user_settings'
  ) THEN
    CREATE POLICY allow_all_user_settings ON user_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed a default row so there is always one row to read/update
INSERT INTO user_settings (home_currency, earning_currency)
SELECT 'INR', 'INR'
WHERE NOT EXISTS (SELECT 1 FROM user_settings);

-- ── 2. salary_history ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gross_amount    numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  effective_from  date NOT NULL,
  effective_to    date,          -- NULL means current
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'salary_history' AND policyname = 'allow_all_salary_history'
  ) THEN
    CREATE POLICY allow_all_salary_history ON salary_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS salary_history_effective_from_idx ON salary_history(effective_from DESC);

-- ── 3. remittances ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remittances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date   date NOT NULL DEFAULT CURRENT_DATE,
  from_currency   text NOT NULL,
  to_currency     text NOT NULL,
  from_amount     numeric NOT NULL,
  to_amount       numeric NOT NULL,
  rate_used       numeric NOT NULL,
  channel         text,          -- e.g. "Wise", "Bank", "Western Union"
  reference       text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'remittances' AND policyname = 'allow_all_remittances'
  ) THEN
    CREATE POLICY allow_all_remittances ON remittances FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS remittances_transfer_date_idx ON remittances(transfer_date DESC);

-- ── 4. expenses — add currency columns ───────────────────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency          text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS original_amount   numeric,        -- amount in transaction currency
  ADD COLUMN IF NOT EXISTS rate_used         numeric,        -- exchange rate at save time (1 foreign = X home)
  ADD COLUMN IF NOT EXISTS home_amount       numeric,        -- always in home currency
  ADD COLUMN IF NOT EXISTS foreign_amount    numeric,        -- same as original_amount when currency ≠ home
  ADD COLUMN IF NOT EXISTS remittance_id     uuid REFERENCES remittances(id) ON DELETE SET NULL;

-- Backfill: treat all existing rows as home-currency (INR) transactions
UPDATE expenses
SET
  currency       = 'INR',
  original_amount = amount,
  rate_used      = 1,
  home_amount    = amount,
  foreign_amount = NULL
WHERE home_amount IS NULL;

CREATE INDEX IF NOT EXISTS expenses_remittance_id_idx ON expenses(remittance_id);

-- ── 5. savings — add remittance_id ───────────────────────────────────────────
ALTER TABLE savings
  ADD COLUMN IF NOT EXISTS remittance_id uuid REFERENCES remittances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS savings_remittance_id_idx ON savings(remittance_id);

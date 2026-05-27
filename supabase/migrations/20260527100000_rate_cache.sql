-- ── Rate cache + snapshot history ────────────────────────────────────────────
-- Run after 20260527000000_multi_currency.sql

-- ── 1. Cache columns on user_settings ────────────────────────────────────────
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS cached_rate     numeric,       -- last fetched rate (1 earning = X home)
  ADD COLUMN IF NOT EXISTS rate_fetched_at timestamptz;   -- when it was last updated by cron

-- ── 2. rate_snapshots — full history written by the cron job ─────────────────
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency   text NOT NULL,
  rate          numeric NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rate_snapshots' AND policyname = 'allow_all_rate_snapshots'
  ) THEN
    CREATE POLICY allow_all_rate_snapshots ON rate_snapshots FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Index for time-series queries (latest rate, charts)
CREATE INDEX IF NOT EXISTS rate_snapshots_fetched_at_idx
  ON rate_snapshots(from_currency, to_currency, fetched_at DESC);

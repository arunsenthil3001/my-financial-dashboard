-- Add user_id to all tables (nullable so existing rows keep working)
ALTER TABLE expenses       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE savings        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE remittances    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE salary_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE user_settings  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE chit_cycles    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE rate_snapshots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Enable RLS on all tables
ALTER TABLE expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chit_cycles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop any existing open policies
DROP POLICY IF EXISTS allow_all_expenses       ON expenses;
DROP POLICY IF EXISTS allow_all_savings        ON savings;
DROP POLICY IF EXISTS allow_all_remittances    ON remittances;
DROP POLICY IF EXISTS allow_all_salary_history ON salary_history;
DROP POLICY IF EXISTS allow_all_user_settings  ON user_settings;
DROP POLICY IF EXISTS allow_all_chit_cycles    ON chit_cycles;
DROP POLICY IF EXISTS allow_all_rate_snapshots ON rate_snapshots;

-- Transitional policies: own rows + unclaimed (user_id IS NULL) rows are visible
-- After data is claimed, only user's own rows remain visible.

CREATE POLICY user_expenses ON expenses FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_savings ON savings FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_remittances ON remittances FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_salary_history ON salary_history FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings ON user_settings FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_chit_cycles ON chit_cycles FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_rate_snapshots ON rate_snapshots FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

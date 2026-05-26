-- Chit fund specific columns on savings table
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_members integer;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_face_value numeric;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_duration_months integer;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_bid_frequency integer;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_won_cycle integer;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_bid_received numeric;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS chit_is_foreman boolean DEFAULT false;

-- Chit cycle history table
CREATE TABLE IF NOT EXISTS chit_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saving_id uuid REFERENCES savings(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  amount_paid numeric NOT NULL,
  commission_received numeric,
  total_commission numeric,
  user_won boolean DEFAULT false,
  bid_amount_received numeric,
  cycle_date date,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE chit_cycles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chit_cycles' AND policyname = 'allow_all_chit_cycles'
  ) THEN
    CREATE POLICY allow_all_chit_cycles ON chit_cycles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chit_cycles_saving_id_idx ON chit_cycles(saving_id);

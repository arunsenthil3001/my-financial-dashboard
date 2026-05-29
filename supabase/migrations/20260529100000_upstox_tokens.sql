CREATE TABLE IF NOT EXISTS upstox_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE upstox_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_upstox_tokens ON upstox_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

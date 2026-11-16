CREATE TABLE registration_tokens (
  id uuid PRIMARY KEY,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX registration_tokens_active_idx
  ON registration_tokens (expires_at)
  WHERE consumed_at IS NULL;

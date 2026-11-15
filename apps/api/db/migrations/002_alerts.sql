CREATE TABLE alerts (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  details jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  UNIQUE (agent_id, fingerprint)
);

CREATE INDEX alerts_agent_last_seen_idx ON alerts (agent_id, last_seen_at DESC);

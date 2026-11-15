CREATE TABLE sites (
  id uuid PRIMARY KEY,
  site_url text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  secret_ciphertext bytea NOT NULL,
  secret_iv bytea NOT NULL,
  secret_tag bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_events (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload jsonb NOT NULL,
  collected_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, idempotency_key)
);

CREATE INDEX inventory_events_agent_received_at_idx ON inventory_events (agent_id, received_at DESC);

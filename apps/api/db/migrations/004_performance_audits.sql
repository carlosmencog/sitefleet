CREATE TABLE site_performance_targets (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance_audits (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  strategy text NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  scores jsonb NOT NULL,
  metrics jsonb NOT NULL,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX performance_audits_agent_strategy_fetched_at_idx
  ON performance_audits (agent_id, strategy, fetched_at DESC);

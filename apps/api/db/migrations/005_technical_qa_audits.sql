CREATE TABLE technical_qa_audits (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  summary jsonb NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX technical_qa_audits_agent_fetched_at_idx
  ON technical_qa_audits (agent_id, fetched_at DESC);

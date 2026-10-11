CREATE TABLE ai_requests (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  source text NOT NULL,
  requested_model text,
  provider_id text,
  model_id text,
  request_body jsonb NOT NULL,
  response_text text,
  finish_reason text,
  duration_ms integer CHECK (duration_ms >= 0),
  input_tokens bigint CHECK (input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens >= 0),
  cache_read_tokens bigint CHECK (cache_read_tokens >= 0),
  cache_creation_tokens bigint CHECK (cache_creation_tokens >= 0),
  reasoning_tokens bigint CHECK (reasoning_tokens >= 0),
  error_code text,
  error_message text,
  CHECK ((status = 'running' AND completed_at IS NULL) OR (status <> 'running' AND completed_at IS NOT NULL))
);
CREATE INDEX ai_requests_started_idx ON ai_requests (started_at DESC, id DESC);
CREATE INDEX ai_requests_status_started_idx ON ai_requests (status, started_at DESC);

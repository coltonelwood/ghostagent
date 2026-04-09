-- Persistent Stripe webhook idempotency table
-- Prevents duplicate processing when Stripe retries (process restarts lose in-memory Set)
CREATE TABLE IF NOT EXISTS stripe_events (
  id          text PRIMARY KEY,           -- Stripe event ID (evt_...)
  type        text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  workspace_id text                        -- for audit trail
);

-- Auto-expire old events after 30 days (Stripe retries within 72 hours)
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed
  ON stripe_events(processed_at);

-- Service role access
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access stripe_events" ON stripe_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SmartSales — secure session layer
-- Run this once against your Supabase project (SQL editor) before starting the
-- API with the cookie-based auth build.
-- ============================================================================

-- Bumping this number invalidates every access token already issued for a user.
-- Used on password reset, role change and deactivation so those take effect
-- immediately instead of at the next token expiry.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- One row per live refresh token (i.e. per signed-in device).
-- Only the SHA-256 of the current token id is stored, so a database dump does
-- not hand an attacker usable refresh tokens.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  rotated_count  INTEGER NOT NULL DEFAULT 0,
  user_agent     TEXT,
  ip_address     TEXT,
  revoked_at     TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user    ON auth_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Append-only audit trail: logins, refreshes, logouts, token-reuse detections.
CREATE TABLE IF NOT EXISTS auth_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email      TEXT,
  event      TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event, created_at DESC);

-- Both tables are reachable only through the service-role key held by the API.
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events   ENABLE ROW LEVEL SECURITY;

-- Created only if absent, rather than DROP-then-CREATE. Re-running this file is
-- still safe, and the script contains no destructive statement of any kind.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_sessions'
      AND policyname = 'Service role manages auth sessions'
  ) THEN
    CREATE POLICY "Service role manages auth sessions"
      ON auth_sessions
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_events'
      AND policyname = 'Service role manages auth events'
  ) THEN
    CREATE POLICY "Service role manages auth events"
      ON auth_events
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END
$$;

-- Housekeeping: drop sessions that expired or were revoked over 30 days ago.
-- Safe to run on a schedule (pg_cron) or by hand.
-- DELETE FROM auth_sessions
--  WHERE expires_at < NOW() - INTERVAL '30 days'
--     OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');

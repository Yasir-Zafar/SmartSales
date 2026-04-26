-- Migration: Update forecast columns from 30d to 5d
-- Run this on your Supabase database if upgrading from an older version

-- 1. Rename column (handles existing data gracefully)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ml_forecast_snapshots' AND column_name = 'ensemble_total_30d'
    ) THEN
        ALTER TABLE ml_forecast_snapshots
            RENAME COLUMN ensemble_total_30d TO ensemble_total_5d;
        RAISE NOTICE 'Renamed ensemble_total_30d to ensemble_total_5d';
    ELSE
        RAISE NOTICE 'Column ensemble_total_5d already exists, skipping rename';
    END IF;
END $$;

-- 2. Add failed login attempts table (if not exists)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email
  ON failed_login_attempts(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_time
  ON failed_login_attempts(attempted_at DESC);

-- 4. Enable RLS (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'failed_login_attempts' AND rowsecurity = true
    ) THEN
        ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on failed_login_attempts';
    END IF;
END $$;

-- 5. Add RLS policy for service role
DROP POLICY IF EXISTS "Service role has full access failed logins" ON failed_login_attempts;

CREATE POLICY "Service role has full access failed logins"
  ON failed_login_attempts
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- 6. Verify migration
DO $$
DECLARE
    col_exists boolean;
    table_exists boolean;
BEGIN
    -- Check ml_forecast_snapshots column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ml_forecast_snapshots' AND column_name = 'ensemble_total_5d'
    ) INTO col_exists;

    -- Check failed_login_attempts table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'failed_login_attempts'
    ) INTO table_exists;

    IF col_exists AND table_exists THEN
        RAISE NOTICE '✅ Migration completed successfully!';
        RAISE NOTICE '   - ensemble_total_5d column: OK';
        RAISE NOTICE '   - failed_login_attempts table: OK';
    ELSE
        RAISE WARNING '⚠️  Migration incomplete:';
        IF NOT col_exists THEN
            RAISE WARNING '   - ensemble_total_5d column: MISSING';
        END IF;
        IF NOT table_exists THEN
            RAISE WARNING '   - failed_login_attempts table: MISSING';
        END IF;
    END IF;
END $$;

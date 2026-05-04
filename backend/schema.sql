-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  role TEXT CHECK (role IN ('ADMIN','OWNER','ANALYST','STAFF')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_logged_in TIMESTAMP
);

-- Daily sales table used by CSV upload and analytics pages
CREATE TABLE IF NOT EXISTS daily_sales (
  id BIGSERIAL PRIMARY KEY,
  sale_date DATE NOT NULL,
  transaction_id TEXT NOT NULL,
  product_id INT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price > 0),
  customer_id INT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT,
  category TEXT,
  price NUMERIC(10,2),
  stock_quantity INT
);

-- Migration safety: ensure existing deployments get this column too
ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS customer_id INT;

-- CSV upload history table shown in staff dashboard
CREATE TABLE IF NOT EXISTS csv_uploads (
  id BIGSERIAL PRIMARY KEY,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  upload_date DATE NOT NULL,
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed', 'pending')),
  duration_seconds NUMERIC,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration safety: ensure existing deployments get this column too
ALTER TABLE csv_uploads
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;

-- ML inference snapshots (written by ML service after each forecast run)
CREATE TABLE IF NOT EXISTS ml_forecast_snapshots (
  id BIGSERIAL PRIMARY KEY,
  run_batch_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  product_name TEXT NOT NULL,
  category TEXT,
  forecast_start DATE NOT NULL,
  forecast_end DATE NOT NULL,
  ensemble_daily JSONB NOT NULL,
  lstm_daily JSONB NOT NULL,
  seasonal_daily JSONB NOT NULL,
  metrics JSONB,
  ensemble_total_5d NUMERIC(14,4)
);

-- Migration: rename old column if it exists
ALTER TABLE ml_forecast_snapshots
  RENAME COLUMN ensemble_total_30d TO ensemble_total_5d;

CREATE INDEX IF NOT EXISTS idx_ml_forecast_snapshots_batch ON ml_forecast_snapshots(run_batch_id);
CREATE INDEX IF NOT EXISTS idx_ml_forecast_snapshots_product ON ml_forecast_snapshots(product_name, created_at DESC);

-- Failed login attempts tracking (KAN-24)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_time ON failed_login_attempts(attempted_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access daily sales" ON daily_sales;
DROP POLICY IF EXISTS "Service role has full access csv uploads" ON csv_uploads;
DROP POLICY IF EXISTS "Service role has full access ml forecasts" ON ml_forecast_snapshots;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow service role to do anything (for backend operations)
CREATE POLICY "Service role has full access"
  ON profiles
  USING (auth.jwt()->>'role' = 'service_role');

-- Allow admins to view all profiles (using auth.jwt to check role first)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    (auth.jwt()->>'role' = 'service_role')
  );

CREATE POLICY "Service role has full access daily sales"
  ON daily_sales
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access csv uploads"
  ON csv_uploads
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access ml forecasts"
  ON ml_forecast_snapshots
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access failed logins"
  ON failed_login_attempts
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

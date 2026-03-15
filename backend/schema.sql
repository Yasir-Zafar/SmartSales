-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  role TEXT CHECK (role IN ('ADMIN','OWNER','ANALYST','STAFF')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_logged_in TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product_id INT,
  customer_id INT,
  quantity INT,
  total_price NUMERIC(10,2),
  sale_date DATE,
  uploaded_by UUID REFERENCES profiles(id),
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

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

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

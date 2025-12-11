-- 1. Helper Function: is_admin()
-- SECURITY DEFINER allows this function to bypass RLS, avoiding infinite recursion
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suite_numbers ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup old policies
DROP POLICY IF EXISTS "Allow admin access" ON users;
DROP POLICY IF EXISTS "Allow admin access" ON plans;
DROP POLICY IF EXISTS "Allow admin access" ON subscriptions;
DROP POLICY IF EXISTS "Allow admin access" ON subscription_status_logs;
DROP POLICY IF EXISTS "Allow admin access" ON admin_users;
DROP POLICY IF EXISTS "Allow admin access" ON suite_numbers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON plans;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subscriptions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subscription_status_logs;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON admin_users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON suite_numbers;

-- 4. Apply New Policies

-- Users Table
CREATE POLICY "Allow admin access" ON users
FOR ALL TO authenticated
USING (is_admin());

-- Plans Table
CREATE POLICY "Allow admin access" ON plans
FOR ALL TO authenticated
USING (is_admin());

-- Subscriptions Table
CREATE POLICY "Allow admin access" ON subscriptions
FOR ALL TO authenticated
USING (is_admin());

-- Logs
CREATE POLICY "Allow admin access" ON subscription_status_logs
FOR ALL TO authenticated
USING (is_admin());

-- Admin Users
-- Allow self-read (so you can see you are an admin) OR admin read
CREATE POLICY "Allow admin access" ON admin_users
FOR ALL TO authenticated
USING (
  user_id = auth.uid() OR is_admin()
);

-- Suite Numbers
-- Suite Numbers
CREATE POLICY "Allow admin access" ON suite_numbers
FOR ALL TO authenticated
USING (is_admin());

-- Subscription Files
ALTER TABLE subscription_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin access" ON subscription_files
FOR ALL TO authenticated
USING (is_admin());

-- Ensure RLS is enabled
ALTER TABLE subscription_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policy to avoid conflicts
DROP POLICY IF EXISTS "Allow admin access" ON subscription_files;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subscription_files;

-- Re-create policy using is_admin() function
-- FOR ALL covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Allow admin access" ON subscription_files
FOR ALL TO authenticated
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- Verify is_admin exists (idempotent check)
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

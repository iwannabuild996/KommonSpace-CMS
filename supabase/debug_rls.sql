-- TEMPORARY DEBUGGING SCRIPT
-- Allow ALL authenticated users to do ANYTHING on subscription_files
-- This rules out "is_admin()" issues

ALTER TABLE subscription_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin access" ON subscription_files;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subscription_files;
DROP POLICY IF EXISTS "Debug allow all" ON subscription_files;

CREATE POLICY "Debug allow all" ON subscription_files
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 1. Add 'name' column back to admin_users if missing (required by UI)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'name') THEN
        ALTER TABLE admin_users ADD COLUMN name TEXT;
    END IF;
END $$;

-- 2. Fix Foreign Key in subscription_status_logs
-- Drop the old constraint which likely references the non-existent 'id' column or is broken
ALTER TABLE subscription_status_logs DROP CONSTRAINT IF EXISTS subscription_status_logs_changed_by_fkey;

-- Add new constraint referencing 'user_id'
ALTER TABLE subscription_status_logs 
  ADD CONSTRAINT subscription_status_logs_changed_by_fkey 
  FOREIGN KEY (changed_by) 
  REFERENCES admin_users(user_id)
  ON DELETE SET NULL;

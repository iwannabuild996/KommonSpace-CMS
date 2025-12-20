-- Add added_by_email column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS added_by_email text;

-- Add comment
COMMENT ON COLUMN payments.added_by_email IS 'Email of the user who added the payment (for display purposes)';

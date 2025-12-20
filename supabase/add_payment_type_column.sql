-- Create ENUM type for payment_type
DO $$ BEGIN
    CREATE TYPE payment_type_enum AS ENUM ('Bank Transfer', 'Cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add payment_type column to payments table using the ENUM type
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type payment_type_enum NOT NULL DEFAULT 'Bank Transfer';

-- Add comment to describe expected values
COMMENT ON COLUMN payments.payment_type IS 'Type of payment: Bank Transfer or Cash';

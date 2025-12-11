-- Add extracted_data column to subscription_files
ALTER TABLE subscription_files ADD COLUMN IF NOT EXISTS extracted_data JSONB;

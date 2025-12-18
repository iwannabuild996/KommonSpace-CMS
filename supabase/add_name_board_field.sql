-- Add name_board field to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS name_board TEXT DEFAULT 'Not Available' CHECK (name_board IN ('Not Available', 'Available'));

-- Update existing records to have default value
UPDATE subscriptions 
SET name_board = 'Not Available' 
WHERE name_board IS NULL;

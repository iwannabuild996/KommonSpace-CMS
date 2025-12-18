-- Add tag field to plans table

ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS tag TEXT;

-- Add comment for documentation
COMMENT ON COLUMN plans.tag IS 'Plan tag/code (e.g., CR, VR, etc.) used for document generation and categorization';

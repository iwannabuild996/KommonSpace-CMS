-- Add new fields to subscriptions table

-- Activities: Array of text entries
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS activities TEXT[] DEFAULT '{}';

-- Board Resolution URLs
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS br_pdf_url TEXT;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS br_doc_url TEXT;

-- License/Legal URLs
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS ll_pdf_url TEXT;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS ll_doc_url TEXT;

-- Drive folder URL
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

ALTER TABLE bundles 
ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.activities IS 'List of activity text entries that can be added and removed';
COMMENT ON COLUMN subscriptions.br_pdf_url IS 'Board Resolution PDF URL';
COMMENT ON COLUMN subscriptions.br_doc_url IS 'Board Resolution Document URL';
COMMENT ON COLUMN subscriptions.ll_pdf_url IS 'License/Legal PDF URL';
COMMENT ON COLUMN subscriptions.ll_doc_url IS 'License/Legal Document URL';
COMMENT ON COLUMN subscriptions.drive_folder_url IS 'Google Drive or shared folder URL';

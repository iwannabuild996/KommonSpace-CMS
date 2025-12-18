-- Modify subscription_signatories
ALTER TABLE subscription_signatories
  DROP COLUMN aadhaar_file_id,
  ADD COLUMN aadhaar_file_path TEXT,
  ADD COLUMN aadhaar_file_name TEXT;

-- Modify subscription_companies
ALTER TABLE subscription_companies
  DROP COLUMN coi_file_id,
  ADD COLUMN coi_file_path TEXT,
  ADD COLUMN coi_file_name TEXT;

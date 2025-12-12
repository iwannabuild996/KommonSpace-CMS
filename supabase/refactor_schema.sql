-- 1. Create Subscription Signatories Table
CREATE TABLE subscription_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE UNIQUE,
  name TEXT,
  designation TEXT,
  aadhaar_number TEXT,
  address TEXT,
  aadhaar_file_id UUID REFERENCES subscription_files(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create Subscription Companies Table
CREATE TABLE subscription_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE UNIQUE,
  name TEXT,
  cin TEXT,
  pan TEXT,
  tan TEXT,
  address TEXT,
  coi_file_id UUID REFERENCES subscription_files(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE subscription_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_companies ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (Admins only for now, mirroring subscriptions)
-- Helper function presumably exists: is_admin()
CREATE POLICY "Admins can view all subscription_signatories"
  ON subscription_signatories FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can insert subscription_signatories"
  ON subscription_signatories FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can update subscription_signatories"
  ON subscription_signatories FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can delete subscription_signatories"
  ON subscription_signatories FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

-- Repeat for companies
CREATE POLICY "Admins can view all subscription_companies"
  ON subscription_companies FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can insert subscription_companies"
  ON subscription_companies FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can update subscription_companies"
  ON subscription_companies FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));

CREATE POLICY "Admins can delete subscription_companies"
  ON subscription_companies FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admin_users WHERE role = 'admin'));


-- 5. Data Migration
-- Move existing Signatory data
INSERT INTO subscription_signatories (subscription_id, name, designation, aadhaar_number, address)
SELECT id, signatory_name, signatory_designation, signatory_aadhaar, signatory_address
FROM subscriptions
WHERE signatory_name IS NOT NULL OR signatory_aadhaar IS NOT NULL;

-- Move existing Company data
INSERT INTO subscription_companies (subscription_id, name, address)
SELECT id, company_name, company_address
FROM subscriptions
WHERE company_name IS NOT NULL OR company_address IS NOT NULL;

-- 6. Cleanup (Drop old columns)
ALTER TABLE subscriptions
  DROP COLUMN signatory_name,
  DROP COLUMN signatory_designation,
  DROP COLUMN signatory_aadhaar,
  DROP COLUMN signatory_address,
  DROP COLUMN company_name,
  DROP COLUMN company_address;

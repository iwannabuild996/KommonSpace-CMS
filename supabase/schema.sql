-- Enums
CREATE TYPE subscription_status AS ENUM (
  'Advance Received',
  'Paper Collected',
  'Documents Ready',
  'Completed'
);

CREATE TYPE rubber_stamp_status AS ENUM (
  'Not Available',
  'Available',
  'With Client'
);

CREATE TYPE signatory_type AS ENUM (
  'company',
  'individual'
);

-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PLANS TABLE
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  features JSONB,
  status BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ADMIN USERS (LOGIN ACCOUNTS)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- SUBSCRIPTIONS TABLE
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,

  purchased_date DATE,
  start_date DATE,
  expiry_date DATE,

  purchase_amount NUMERIC,
  received_amount NUMERIC,

  status subscription_status DEFAULT 'Advance Received',
  suite_number TEXT,
  rubber_stamp rubber_stamp_status DEFAULT 'Not Available',

  -- Signatory details
  signatory_type signatory_type,
  signatory_designation TEXT,
  company_name TEXT,
  signatory_name TEXT,
  signatory_aadhaar TEXT,
  signatory_address TEXT,
  company_address TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- SUBSCRIPTION STATUS LOGS
CREATE TABLE subscription_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_status subscription_status,
  new_status subscription_status NOT NULL,
  changed_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: SUITE NUMBERS TABLE
CREATE TABLE suite_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

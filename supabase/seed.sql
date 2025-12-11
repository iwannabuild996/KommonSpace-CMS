-- Insert sample plans
INSERT INTO plans (id, name, description, price, features)
VALUES
  (gen_random_uuid(), 'Standard', 'Standard Virtual Office Plan', 4999,
      '{"includes": ["GST Registration Address", "Courier Handling", "Basic Support"]}'),
  (gen_random_uuid(), 'Premium', 'Premium Virtual Office Plan', 9999,
      '{"includes": ["GST Address", "Courier Handling", "Premium Support", "Dedicated Manager"]}');

-- Insert a sample user
INSERT INTO users (id, name, phone, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test User', '9999999999', 'testuser@example.com');

-- Fetch Standard Plan ID
WITH standard_plan AS (
  SELECT id FROM plans WHERE name = 'Standard' LIMIT 1
)
INSERT INTO subscriptions (
  id,
  user_id,
  plan_id,
  purchased_date,
  start_date,
  expiry_date,
  purchase_amount,
  received_amount,
  status,
  suite_number,
  rubber_stamp,
  signatory_type,
  signatory_designation,
  company_name,
  signatory_name,
  signatory_aadhaar,
  signatory_address,
  company_address
)
SELECT
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  standard_plan.id,
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '365 days',
  4999,
  4999,
  'Advance Received',
  'A-101',
  'Not Available',
  'company',
  'Director',
  'Sample Pvt Ltd',
  'Arun Kumar',
  '1234-5678-9012',
  '123, Sample Street, Kochi',
  '456, Business Bay, Kochi'
FROM standard_plan;

-- Initial Status Log Entry
INSERT INTO subscription_status_logs (
  id,
  subscription_id,
  old_status,
  new_status,
  changed_by
)
VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  NULL,
  'Advance Received',
  NULL
);

-- Optional: Insert suite numbers
INSERT INTO suite_numbers (suite_number, status)
VALUES
  ('A-101', 'assigned'),
  ('A-102', 'available'),
  ('A-103', 'available'),
  ('B-201', 'available');

ALTER TABLE subscription 
ADD COLUMN IF NOT EXISTS renewal_amount numeric DEFAULT 0;

CREATE TABLE services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  is_recurring boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE service_workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES services(id),
  status_code text NOT NULL,
  status_label text NOT NULL,
  step_order int NOT NULL,
  is_terminal boolean DEFAULT false,
  is_failure boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  UNIQUE (service_id, status_code)
);

CREATE TABLE subscription_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),
  service_id uuid NOT NULL REFERENCES services(id),
  current_workflow_id uuid REFERENCES service_workflows(id),
  status_updated_at timestamp without time zone,
  assigned_to uuid REFERENCES public.admin_users(user_id),
  created_at timestamp without time zone DEFAULT now(),
  UNIQUE (subscription_id, service_id)
);


CREATE TABLE subscription_service_status_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_service_id uuid NOT NULL REFERENCES subscription_services(id),
  old_workflow_id uuid REFERENCES service_workflows(id),
  new_workflow_id uuid NOT NULL REFERENCES service_workflows(id),
  changed_by uuid REFERENCES public.admin_users(user_id),
  remarks text,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE bundles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TYPE bundle_item_type AS ENUM (
  'VO',
  'SERVICE',
  'CONSUMABLE'
);

CREATE TABLE bundle_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES bundles(id),

  item_type bundle_item_type NOT NULL,

  -- VO pricing
  plan_id uuid REFERENCES plans(id),

  -- Services
  service_id uuid REFERENCES services(id),

  description text,
  amount numeric NOT NULL,

  -- Discount logic
  applies_first_year_only boolean DEFAULT false,

  created_at timestamp without time zone DEFAULT now()
);

CREATE TYPE revenue_nature_enum AS ENUM (
  'TURNOVER',      -- Virtual Office only
  'PASSTHROUGH'    -- LLP, GST, Stamp, etc.
);

CREATE TABLE subscription_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),

  item_type bundle_item_type NOT NULL,

  -- VO
  plan_id uuid REFERENCES plans(id),

  -- Services
  service_id uuid REFERENCES services(id),

  description text,
  amount numeric NOT NULL,

  -- ACCOUNTING CLASSIFICATION
  revenue_nature revenue_nature_enum NOT NULL,

  -- RECURRING LOGIC
  is_recurring boolean DEFAULT false,

  -- VO RENEWAL PRICE (FROZEN AT SALE TIME)
  renewal_amount numeric,

  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_service_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow admin access" ON subscription_items
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON subscription_items
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON services
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON services
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON service_workflows
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON service_workflows
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON subscription_services
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON subscription_services
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON subscription_service_status_logs
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON subscription_service_status_logs
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON bundles
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON bundles
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow admin access" ON bundle_items
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON bundle_items
FOR ALL TO authenticated
USING (is_staff());

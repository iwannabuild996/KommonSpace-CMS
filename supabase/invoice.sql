CREATE TYPE invoice_type_enum AS ENUM (
  'TAX_INVOICE',
  'PROFORMA',
  'CREDIT_NOTE',
  'DEBIT_NOTE'
);

CREATE TYPE invoice_status_enum AS ENUM (
  'DRAFT',
  'ISSUED',
  'CANCELLED'
);

/* =========================================================
   INVOICE SEQUENCES (FY-BASED, NO ACTIVE FLAG)
   ========================================================= */

CREATE TABLE invoice_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  financial_year text NOT NULL,      -- e.g. 2024-25
  prefix text NOT NULL,              -- e.g. IWB/VO/2024-25
  last_number int NOT NULL DEFAULT 0,

  created_at timestamp without time zone DEFAULT now(),

  UNIQUE (financial_year, prefix)
);

/* =========================================================
   INVOICE HEADER
   ========================================================= */

CREATE TABLE invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  subscription_id uuid NOT NULL REFERENCES subscriptions(id),
  user_id uuid NOT NULL REFERENCES users(id),

  invoice_number text UNIQUE,        -- Assigned ONLY when ISSUED
  invoice_type invoice_type_enum NOT NULL DEFAULT 'TAX_INVOICE',
  status invoice_status_enum NOT NULL DEFAULT 'DRAFT',

  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,

  subtotal numeric NOT NULL,
  tax_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL,

  -- Revision / linkage
  revised_from_invoice_id uuid REFERENCES invoices(id),
  revision_reason text,

  created_at timestamp without time zone DEFAULT now()
);

/* =========================================================
   INVOICE LINE ITEMS
   ========================================================= */

CREATE TABLE invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_item_id uuid REFERENCES subscription_items(id),

  description text NOT NULL,
  quantity int DEFAULT 1,
  unit_price numeric NOT NULL,
  amount numeric NOT NULL,

  -- Accounting clarity
  revenue_nature revenue_nature_enum NOT NULL,

  -- GST fields
  gst_rate numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,

  created_at timestamp without time zone DEFAULT now()
);

/* =========================================================
   SAFETY CONSTRAINTS (IMPORTANT)
   ========================================================= */

-- Invoice number must exist once invoice is ISSUED
ALTER TABLE invoices
ADD CONSTRAINT invoice_number_required_when_issued
CHECK (
  status <> 'ISSUED'
  OR invoice_number IS NOT NULL
);
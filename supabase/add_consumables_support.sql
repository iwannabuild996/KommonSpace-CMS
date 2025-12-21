-- Create consumables table
CREATE TABLE consumables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamp without time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin access" ON consumables
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow staff access" ON consumables
FOR ALL TO authenticated
USING (is_staff());

-- Add consumable_id to bundle_items
ALTER TABLE bundle_items
ADD COLUMN consumable_id uuid REFERENCES consumables(id);

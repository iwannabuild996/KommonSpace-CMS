
-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin access" ON invoices
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow admin access" ON invoice_items
FOR ALL TO authenticated
USING (is_admin());

CREATE POLICY "Allow admin access" ON invoice_sequences
FOR ALL TO authenticated
USING (is_admin());


CREATE POLICY "Allow staff access" ON invoices
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow staff access" ON invoice_items
FOR ALL TO authenticated
USING (is_staff());

CREATE POLICY "Allow staff access" ON invoice_sequences
FOR ALL TO authenticated
USING (is_staff());



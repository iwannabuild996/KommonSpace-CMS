
-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Policies for Invoices
CREATE POLICY "Enable all access for authenticated users on invoices"
ON invoices FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policies for Invoice Items
CREATE POLICY "Enable all access for authenticated users on invoice_items"
ON invoice_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policies for Invoice Sequences
CREATE POLICY "Enable all access for authenticated users on invoice_sequences"
ON invoice_sequences FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

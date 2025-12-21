
-- Function to generate invoice number and issue the invoice
CREATE OR REPLACE FUNCTION issue_invoice(invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_sequence invoice_sequences%ROWTYPE;
  v_fy text;
  v_new_number int;
  v_full_number text;
BEGIN
  -- 1. Get the invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- 2. Check if already issued
  IF v_invoice.status = 'ISSUED' THEN
    RETURN json_build_object('success', true, 'message', 'Already issued', 'invoice_number', v_invoice.invoice_number);
  END IF;

  -- 3. Determine Financial Year (Apr-Mar) based on invoice_date
  -- Example: 2024-12-22 -> FY 2024-25
  -- Example: 2025-01-15 -> FY 2024-25
  -- Example: 2025-04-01 -> FY 2025-26
  v_fy := to_char(
      v_invoice.invoice_date - INTERVAL '3 months',
      'YYYY'
  ) || '-' || to_char(
      (v_invoice.invoice_date - INTERVAL '3 months') + INTERVAL '1 year',
      'YY'
  );

  -- 4. Get or Create Sequence for this FY
  -- Default Prefix: INV/{FY}/
  -- You can customize prefix logic here if needed
  
  INSERT INTO invoice_sequences (financial_year, prefix, last_number)
  VALUES (v_fy, 'INV/' || v_fy || '/', 0)
  ON CONFLICT (financial_year, prefix) DO NOTHING;

  -- 5. Lock and Increment Sequence
  SELECT * INTO v_sequence
  FROM invoice_sequences
  WHERE financial_year = v_fy AND prefix = 'INV/' || v_fy || '/'
  FOR UPDATE;

  v_new_number := v_sequence.last_number + 1;
  v_full_number := v_sequence.prefix || lpad(v_new_number::text, 4, '0');

  -- 6. Update Sequence
  UPDATE invoice_sequences
  SET last_number = v_new_number
  WHERE id = v_sequence.id;

  -- 7. Update Invoice
  UPDATE invoices
  SET 
    status = 'ISSUED',
    invoice_number = v_full_number,
    invoice_date = COALESCE(invoice_date, CURRENT_DATE)
  WHERE id = invoice_id;

  RETURN json_build_object('success', true, 'invoice_number', v_full_number);
END;
$$;


-- Function to recalculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET 
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_items
      WHERE invoice_items.invoice_id = invoices.id
    ),
    tax_amount = (
      SELECT COALESCE(SUM(gst_amount), 0)
      FROM invoice_items
      WHERE invoice_items.invoice_id = invoices.id
    ),
    total_amount = (
      SELECT COALESCE(SUM(amount + gst_amount), 0)
      FROM invoice_items
      WHERE invoice_items.invoice_id = invoices.id
    )
  WHERE id = (
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
      ELSE NEW.invoice_id
    END
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to fire on any change to invoice_items
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;

CREATE TRIGGER update_invoice_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_totals();

-- Function to update received_amount on subscriptions
CREATE OR REPLACE FUNCTION update_subscription_received_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE subscriptions
    SET received_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments
      WHERE subscription_id = OLD.subscription_id
    )
    WHERE id = OLD.subscription_id;
    RETURN OLD;
  ELSE
    UPDATE subscriptions
    SET received_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments
      WHERE subscription_id = NEW.subscription_id
    )
    WHERE id = NEW.subscription_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS update_received_amount_trigger ON payments;

CREATE TRIGGER update_received_amount_trigger
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_subscription_received_amount();

-- Optional: Recalculate all existing subscriptions to ensure consistency
UPDATE subscriptions s
SET received_amount = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.subscription_id = s.id
);

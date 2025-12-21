ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS renewal_amount numeric;

ALTER TABLE subscriptions
ADD COLUMN bundle_id uuid REFERENCES bundles(id);

-- Optional: Ensure plan_id is nullable (it typically is, but good to be safe if enforcing one or other)
ALTER TABLE subscriptions
ALTER COLUMN plan_id DROP NOT NULL;

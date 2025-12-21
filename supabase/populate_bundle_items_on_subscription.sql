-- Ensure subscription_items has consumable_id ( User recently added this to schema file)
ALTER TABLE subscription_items 
ADD COLUMN IF NOT EXISTS consumable_id uuid REFERENCES consumables(id);

-- Function to handle bundle expansion
CREATE OR REPLACE FUNCTION public.handle_new_subscription_bundle()
RETURNS TRIGGER AS $$
DECLARE
    b_item RECORD;
    initial_workflow_id UUID;
    v_revenue_nature revenue_nature_enum;
BEGIN
    -- Only proceed if bundle_id is present
    IF NEW.bundle_id IS NOT NULL THEN
        
        FOR b_item IN 
            SELECT * FROM bundle_items WHERE bundle_id = NEW.bundle_id
        LOOP
            -- Determine Revenue Nature and Item Type Logic
            -- 'VO' = Plan/Virtual Office -> TURNOVER
            -- 'SERVICE' -> PASSTHROUGH
            -- 'CONSUMABLE' -> PASSTHROUGH
            
            IF b_item.item_type = 'VO' THEN
                v_revenue_nature := 'TURNOVER';
            ELSE
                v_revenue_nature := 'PASSTHROUGH';
            END IF;

            -- 1. Insert into subscription_items
            INSERT INTO subscription_items (
                subscription_id,
                item_type,
                plan_id,
                service_id,
                consumable_id,
                description,
                amount,
                revenue_nature,
                created_at
            ) VALUES (
                NEW.id,
                b_item.item_type,
                b_item.plan_id,
                b_item.service_id,
                b_item.consumable_id,
                b_item.description,
                b_item.amount,
                v_revenue_nature,
                NOW()
            );

            -- 2. If Service, insert into subscription_services
            IF b_item.item_type = 'SERVICE' AND b_item.service_id IS NOT NULL THEN
                
                -- Get initial workflow step (lowest step_order)
                initial_workflow_id := NULL; -- Reset
                
                SELECT id INTO initial_workflow_id
                FROM service_workflows
                WHERE service_id = b_item.service_id
                ORDER BY step_order ASC
                LIMIT 1;
                
                INSERT INTO subscription_services (
                    subscription_id,
                    service_id,
                    current_workflow_id,
                    status_updated_at,
                    created_at
                ) VALUES (
                    NEW.id,
                    b_item.service_id,
                    initial_workflow_id,
                    NOW(),
                    NOW()
                );
                
            END IF;

        END LOOP;

    -- Handle Plan-only subscriptions (No Bundle)
    ELSIF NEW.plan_id IS NOT NULL THEN
        -- Verify plan exists and get name
        -- Insert single subscription_item
        INSERT INTO subscription_items (
            subscription_id,
            item_type,
            plan_id,
            description,
            amount,
            revenue_nature,
            created_at
        ) 
        SELECT 
            NEW.id,
            'VO', -- Always VO for Plan
            NEW.plan_id,
            COALESCE((SELECT name FROM plans WHERE id = NEW.plan_id), 'Direct Plan Subscription'),
            NEW.purchase_amount, -- Use the purchase amount from subscription
            'TURNOVER',
            NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS on_subscription_created_from_bundle ON subscriptions;
CREATE TRIGGER on_subscription_created_from_bundle
    AFTER INSERT ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_subscription_bundle();

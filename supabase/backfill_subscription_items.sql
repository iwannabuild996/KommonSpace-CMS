
DO $$
DECLARE
    sub RECORD;
    b_item RECORD;
    initial_workflow_id UUID;
    v_revenue_nature revenue_nature_enum;
BEGIN
    -- Iterate over subscriptions that don't have items yet
    FOR sub IN
        SELECT s.*
        FROM subscriptions s
        WHERE NOT EXISTS (
            SELECT 1 FROM subscription_items si WHERE si.subscription_id = s.id
        )
    LOOP
        RAISE NOTICE 'Processing Subscription: %', sub.id;

        -- CASE 1: Bundle Subscription
        IF sub.bundle_id IS NOT NULL THEN
            FOR b_item IN
                SELECT * FROM bundle_items WHERE bundle_id = sub.bundle_id
            LOOP
                -- Determine Revenue Nature
                IF b_item.item_type = 'VO' THEN
                    v_revenue_nature := 'TURNOVER';
                ELSE
                    v_revenue_nature := 'PASSTHROUGH';
                END IF;

                -- Insert Item
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
                    sub.id,
                    b_item.item_type,
                    b_item.plan_id,
                    b_item.service_id,
                    b_item.consumable_id,
                    b_item.description,
                    b_item.amount,
                    v_revenue_nature,
                    NOW()
                );

                -- If Service, insert into subscription_services
                IF b_item.item_type = 'SERVICE' AND b_item.service_id IS NOT NULL THEN
                    -- Check if service already exists for this sub
                     IF NOT EXISTS (SELECT 1 FROM subscription_services ss WHERE ss.subscription_id = sub.id AND ss.service_id = b_item.service_id) THEN
                        -- Get initial workflow
                        initial_workflow_id := NULL;
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
                            sub.id,
                            b_item.service_id,
                            initial_workflow_id,
                            NOW(),
                            NOW()
                        );
                    END IF;
                END IF;
            END LOOP;

        -- CASE 2: Plan Only Subscription
        ELSIF sub.plan_id IS NOT NULL THEN
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
                sub.id,
                'VO',
                sub.plan_id,
                COALESCE((SELECT name FROM plans WHERE id = sub.plan_id), 'Direct Plan Subscription'),
                sub.purchase_amount,
                'TURNOVER',
                NOW();
        END IF;

    END LOOP;
END;
$$;

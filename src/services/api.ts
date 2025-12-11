import { supabase } from './supabase';

// --- Types ---

export type SubscriptionStatus =
    | 'Advance Received'
    | 'Paper Collected'
    | 'Documents Ready'
    | 'Completed';

export type RubberStampStatus =
    | 'Not Available'
    | 'Available'
    | 'With Client';

export type SignatoryType = 'company' | 'individual';

export interface User {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    created_at?: string;
}

export interface Plan {
    id: string;
    name: string;
    description?: string;
    price?: number;
    features?: Record<string, any>;
    status?: boolean;
    created_at?: string;
}

export interface Subscription {
    id: string;
    user_id: string;
    plan_id?: string;
    purchased_date?: string;
    start_date?: string;
    expiry_date?: string;
    purchase_amount?: number;
    received_amount?: number;
    status: SubscriptionStatus;
    suite_number?: string;
    rubber_stamp?: RubberStampStatus;
    signatory_type?: SignatoryType;
    signatory_designation?: string;
    company_name?: string;
    signatory_name?: string;
    signatory_aadhaar?: string;
    signatory_address?: string;
    company_address?: string;
    created_at?: string;
}

export interface SubscriptionLog {
    id: string;
    subscription_id: string;
    old_status?: SubscriptionStatus | null;
    new_status: SubscriptionStatus;
    changed_by?: string;
    created_at?: string;
}

// --- API Functions ---

// 1. Create User
export const createUser = async (payload: { name: string; phone?: string; email?: string }) => {
    const { data, error } = await supabase
        .from('users')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data as User;
};

// 2. Get Users (optional search query)
export const getUsers = async (q?: string) => {
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });

    if (q) {
        query = query.ilike('name', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as User[];
};

// 3. Create Plan
export const createPlan = async (payload: Omit<Plan, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('plans')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data as Plan;
};

// 4. Get Plans
export const getPlans = async () => {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('status', true)
        .order('price', { ascending: true });

    if (error) throw error;
    return data as Plan[];
};

// 4.5 Update Plan
export const updatePlan = async (id: string, payload: Partial<Plan>) => {
    const { data, error } = await supabase
        .from('plans')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data as Plan;
};

// 5. Create Subscription (Mock Transaction)
// NOTE: For true atomicity, use a Supabase RPC function. Here we chain calls.
export const createSubscription = async (
    payload: Omit<Subscription, 'id' | 'created_at' | 'status'> & { status?: SubscriptionStatus }
) => {
    const initialStatus: SubscriptionStatus = payload.status || 'Advance Received';
    const subscriptionData = { ...payload, status: initialStatus };

    // Step A: Insert Subscription
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

    if (subError) throw subError;
    if (!sub) throw new Error('Failed to create subscription');

    // Step B: Insert Log
    const { error: logError } = await supabase
        .from('subscription_status_logs')
        .insert({
            subscription_id: sub.id,
            old_status: null,
            new_status: initialStatus,
            // changed_by: ??? // Admin ID would typically come from auth context
        });

    // If log insertion fails, we arguably have a data inconsistency.
    // In a production app without RPC, we might try to revert the subscription or log the error.
    if (logError) {
        console.error('Failed to create initial status log:', logError);
        // Optional: rollback subscription?
        // await supabase.from('subscriptions').delete().eq('id', sub.id);
    }

    return sub as Subscription;
};

// 6. Update Subscription (Detect Status Change)
export const updateSubscription = async (id: string, payload: Partial<Subscription>) => {
    // Step A: Get current status if status is being updated
    let oldStatus: SubscriptionStatus | undefined;

    if (payload.status) {
        const { data: current, error: fetchError } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        oldStatus = current.status as SubscriptionStatus;
    }

    // Step B: Update Subscription
    const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (updateError) throw updateError;

    // Step C: If status changed, insert log
    if (payload.status && oldStatus && payload.status !== oldStatus) {
        const { error: logError } = await supabase
            .from('subscription_status_logs')
            .insert({
                subscription_id: id,
                old_status: oldStatus,
                new_status: payload.status,
            });

        if (logError) console.error('Failed to log status change', logError);
    }

    return updatedSub as Subscription;
};

// 7. Get Subscription Logs
export const getSubscriptionLogs = async (subscriptionId: string) => {
    const { data, error } = await supabase
        .from('subscription_status_logs')
        .select(`
      *,
      admin_users ( name )
    `)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as (SubscriptionLog & { admin_users?: { name: string } | null })[];
};

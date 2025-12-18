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

export type NameBoardStatus =
    | 'Not Available'
    | 'Available';

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
    tag?: string;
}

export interface SubscriptionSignatory {
    id: string;
    subscription_id: string;
    name?: string;
    designation?: string;
    aadhaar_number?: string;
    address?: string;
    aadhaar_file_path?: string;
    aadhaar_file_name?: string;
    created_at?: string;
}

export interface SubscriptionCompany {
    id: string;
    subscription_id: string;
    name?: string;
    cin?: string;
    pan?: string;
    tan?: string;
    address?: string;
    coi_file_path?: string;
    coi_file_name?: string;
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
    name_board?: NameBoardStatus;
    signatory_type?: SignatoryType;
    created_at?: string;
    // New fields
    activities?: string[];
    br_pdf_url?: string;
    br_doc_url?: string;
    ll_pdf_url?: string;
    ll_doc_url?: string;
    drive_folder_url?: string;
    // Relations
    subscription_signatories?: SubscriptionSignatory;
    subscription_companies?: SubscriptionCompany;
    users?: User;
    plans?: Plan;
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

// 4.6 Get Subscriptions
export const getSubscriptions = async () => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            *,
            users(name),
            plans(name),
            subscription_signatories(*),
            subscription_companies(*)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as any[];
};

// 4.7 Get Single Subscription
export const getSubscription = async (id: string) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            *,
            users(name),
            plans(name),
            subscription_signatories(*),
            subscription_companies(*)
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as any;
};

// 5. Create Subscription (Mock Transaction)
// NOTE: For true atomicity, use a Supabase RPC function. Here we chain calls.
export const createSubscription = async (
    payload: any // Accept any payload from form, we'll extract what we need
) => {
    const initialStatus: SubscriptionStatus = payload.status || 'Advance Received';

    // Extract subscription-only fields
    const subscriptionData = {
        user_id: payload.user_id,
        plan_id: payload.plan_id,
        purchased_date: payload.purchased_date,
        start_date: payload.start_date,
        expiry_date: payload.expiry_date,
        purchase_amount: payload.purchase_amount,
        received_amount: payload.received_amount,
        status: initialStatus,
        suite_number: payload.suite_number,
        rubber_stamp: payload.rubber_stamp,
        signatory_type: payload.signatory_type,
    };

    // Step A: Insert Subscription
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

    if (subError) throw subError;
    if (!sub) throw new Error('Failed to create subscription');

    // Step B: Insert Signatory Data
    const signatoryData = {
        subscription_id: sub.id,
        name: payload.signatory_name,
        designation: payload.signatory_designation,
        aadhaar_number: payload.signatory_aadhaar,
        address: payload.signatory_address,
    };

    const { error: signatoryError } = await supabase
        .from('subscription_signatories')
        .insert(signatoryData);

    if (signatoryError) {
        console.error('Failed to create signatory:', signatoryError);
        // Optionally rollback subscription
        await supabase.from('subscriptions').delete().eq('id', sub.id);
        throw new Error('Failed to create signatory data');
    }

    // Step C: Insert Company Data (if company signatory)
    if (payload.signatory_type === 'company' && payload.company_name) {
        const companyData = {
            subscription_id: sub.id,
            name: payload.company_name,
            address: payload.company_address,
        };

        const { error: companyError } = await supabase
            .from('subscription_companies')
            .insert(companyData);

        if (companyError) {
            console.error('Failed to create company:', companyError);
            // Optionally rollback
            await supabase.from('subscription_signatories').delete().eq('subscription_id', sub.id);
            await supabase.from('subscriptions').delete().eq('id', sub.id);
            throw new Error('Failed to create company data');
        }
    }

    // Step D: Insert Log
    const { error: logError } = await supabase
        .from('subscription_status_logs')
        .insert({
            subscription_id: sub.id,
            old_status: null,
            new_status: initialStatus,
        });

    if (logError) {
        console.error('Failed to create initial status log:', logError);
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
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as SubscriptionLog[];
};

// 7.5 Update Subscription Signatory
export const updateSubscriptionSignatory = async (subscriptionId: string, payload: Partial<SubscriptionSignatory>) => {
    const { data, error } = await supabase
        .from('subscription_signatories')
        .upsert({ ...payload, subscription_id: subscriptionId }, { onConflict: 'subscription_id' })
        .eq('subscription_id', subscriptionId)
        .select()
        .single();

    if (error) throw error;
    return data as SubscriptionSignatory;
};

// 7.6 Update Subscription Company
export const updateSubscriptionCompany = async (subscriptionId: string, payload: Partial<SubscriptionCompany>) => {
    const { data, error } = await supabase
        .from('subscription_companies')
        .upsert({ ...payload, subscription_id: subscriptionId }, { onConflict: 'subscription_id' })
        .eq('subscription_id', subscriptionId)
        .select()
        .single();

    if (error) throw error;
    return data as SubscriptionCompany;
};

// --- File Handling ---

export type SubscriptionFileLabel = 'Signatory Aadhaar' | 'Certificate of Incorporation' | 'Others';

export interface SubscriptionFile {
    id: string;
    subscription_id: string;
    label: SubscriptionFileLabel;
    file_name: string;
    file_path: string;
    mime_type?: string;
    file_size_bytes?: number;
    created_at?: string;
    extracted_data?: any; // New field for JSON data
    // Helper property for UI (signed URL)
    signedUrl?: string;
}

// 8. Upload Subscription File
export const uploadSubscriptionFile = async (
    subscriptionId: string,
    file: File,
    label: SubscriptionFileLabel
) => {
    // 1. Generate standardized file name based on label
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'pdf'; // Get extension or default to pdf

    let standardizedName: string;
    if (label === 'Signatory Aadhaar') {
        standardizedName = `aadhaar_${timestamp}.${fileExtension}`;
    } else if (label === 'Certificate of Incorporation') {
        standardizedName = `coi_${timestamp}.${fileExtension}`;
    } else {
        // For other file types, use sanitized original name
        standardizedName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    }

    const filePath = `${subscriptionId}/${standardizedName}`;

    const { error: uploadError } = await supabase.storage
        .from('kommonspace')
        .upload(filePath, file);

    if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

    // 2. Insert Record
    const user = await supabase.auth.getUser();

    const { data, error: dbError } = await supabase
        .from('subscription_files')
        .insert({
            subscription_id: subscriptionId,
            label: label,
            file_name: file.name,
            file_path: filePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            uploaded_by: user.data.user?.id // Optional linking
        })
        .select()
        .single();

    if (dbError) throw new Error(`Database Error: ${dbError.message}`);
    return data as SubscriptionFile;
};

// 10. Extract Data from File (Edge Function)
export const extractSubscriptionData = async (filePath: string, mimeType?: string, functionName: string = 'extract-aadhaar') => {
    const { data, error } = await supabase.functions.invoke(functionName, {
        body: { file_path: filePath, mime_type: mimeType }
    });

    if (error) throw error;
    return data;
};

// 11. Update Subscription File (e.g. save extracted data)
export const updateSubscriptionFile = async (fileId: string, updates: Partial<SubscriptionFile>) => {
    const { data, error } = await supabase
        .from('subscription_files')
        .update(updates)
        .eq('id', fileId)
        .select()
        .single();

    if (error) throw new Error(`Database Error: ${error.message}`);
    return data as SubscriptionFile;
}


// 9. Get Subscription Files (with Signed URLs)
export const getSubscriptionFiles = async (subscriptionId: string) => {
    // 1. Get Records
    const { data, error } = await supabase
        .from('subscription_files')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // 2. Generate Signed URLs for each
    const files = data as SubscriptionFile[];
    const filesWithUrls = await Promise.all(files.map(async (f) => {
        const { data: signedData } = await supabase.storage
            .from('kommonspace')
            .createSignedUrl(f.file_path, 3600); // 1 hour expiry

        return { ...f, signedUrl: signedData?.signedUrl };
    }));

    return filesWithUrls;
};

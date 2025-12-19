import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Get Authorization Header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Initialize Supabase Client for Auth (Service Role required for admin check)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase configuration');
        }

        // Verify User Token
        const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { Authorization: authHeader } }
        })

        console.log('Verifying user authentication...');
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()

        if (userError || !user) {
            console.error('Authentication failed:', userError);
            return new Response(
                JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Authenticated user: ${user.id}`);

        // 3. Verify Admin Role (Strict Check)
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (adminError || !adminUser || adminUser.role !== 'admin') {
            console.error('Admin check failed:', adminError || 'Role mismatch');
            return new Response(
                JSON.stringify({ error: 'Forbidden - Admin access required' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Admin verified: ${adminUser.role}`);

        // 4. Get request body
        const requestData = await req.json()
        console.log('Received document generation request:', requestData);

        // Validate required fields
        const requiredFields = [
            'plan', 'date_string', 'date', 'suite_number', 'company_name',
            'client_name', 'activity', 'client_address', 'company_address', 'license_fee',
            'signatory_designation', 'signatory_type'
        ];

        for (const field of requiredFields) {
            if (!requestData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // 5. Get DOC_SCRIPT URL from environment
        const docScriptUrl = Deno.env.get('DOC_SCRIPT')
        if (!docScriptUrl) {
            throw new Error('DOC_SCRIPT environment variable not configured');
        }

        console.log('Calling document generation script...');

        // 6. Call external document generation service
        const response = await fetch(docScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Document generation failed:', errorText);
            throw new Error(`Document generation failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Document generation successful:', result);

        // 7. Validate response structure
        if (!result.br_pdf_url || !result.br_doc_url || !result.ll_pdf_url || !result.ll_doc_url || !result.folder_url) {
            console.warn('Response missing some expected fields:', result);
        }

        // 8. Return the document URLs
        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in generate-documents function:', error);
        return new Response(
            JSON.stringify({
                error: error.message || 'Failed to generate documents',
                details: error.toString()
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

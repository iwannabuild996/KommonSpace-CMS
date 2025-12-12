import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

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
        const { file_path, mime_type } = await req.json()
        console.log(`Received request for file: ${file_path}, mime: ${mime_type}`);

        if (!file_path) {
            throw new Error('Missing file_path')
        }

        // 1. Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase configuration');
        }
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 2. Download File
        console.log(`Downloading file from storage...`);
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('kommonspace')
            .download(file_path)

        if (downloadError) {
            console.error('Storage Download Error:', downloadError);
            throw new Error(`Storage Download Failed: ${downloadError.message}`);
        }

        console.log(`File downloaded, size: ${fileData.size} bytes`);

        // 3. Convert to ArrayBuffer -> Base64
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Data = base64Encode(arrayBuffer);

        // 4. Initialize Gemini
        const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!googleApiKey) {
            throw new Error('Missing GOOGLE_API_KEY');
        }

        console.log('Initializing Gemini...');
        const genAI = new GoogleGenerativeAI(googleApiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

        // 5. Prompt for Extraction
        console.log('Sending to Gemini...');
        const prompt = `
      Extract the following details from this Aadhaar card document:
      - Name (as "name")
      - Address (as "address")
      - Aadhaar Number (as "aadhaar_number")
      
      Return ONLY a JSON object. Do not include markdown formatting like \`\`\`json.
      If a field is not found, return null for that field.
    `

        // Use passed mime_type or default to PDF
        const mimeType = mime_type || "application/pdf";
        console.log(`Using mimeType: ${mimeType}`);

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ])

        const response = await result.response;
        const text = response.text();
        console.log('Gemini Response:', text);

        // Clean up if markdown blocks exist
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let jsonResult;
        try {
            jsonResult = JSON.parse(cleanedText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            throw new Error(`Failed to parse Gemini response: ${text}`);
        }

        return new Response(
            JSON.stringify(jsonResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
})

// @ts-ignore
/// <reference path="https://deno.land/x/types/index.d.ts" />
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import OpenAI from "https://esm.sh/openai@4.24.1";

// @ts-ignore
const Deno = (globalThis as any).Deno;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple text splitter for RAG chunks
function splitTextIntoChunks(text: string, chunkSize: number = 800): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    // Naive splitting by paragraph/sentence (can be improved)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += " " + sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const AI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_API_KEY");
        if (!AI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Auth Check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Invalid user token');

        const openai = new OpenAI({
            apiKey: AI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        });

        const { title, description, textContent, fileUrl } = await req.json();

        if (!textContent && !fileUrl) {
            return new Response(JSON.stringify({ error: "Missing textContent or fileUrl" }), { status: 400, headers: corsHeaders });
        }

        // 1. Create Document Record
        const { data: doc, error: docError } = await supabase.from('documents').insert({
            title: title || 'Untitled Document',
            description: description,
            file_path: fileUrl || 'text-upload',
            uploaded_by: user.id,
            is_processed: false
        }).select().single();

        if (docError) throw docError;

        // 2. Determine Text Content (Currently assuming textContent is passed directly)
        // TODO: Fetch fileUrl and extract text if passed (would require pdf-parse or similar)
        const rawText = textContent || ""; // For now, we assume frontend extracts text or sends clean text

        // 3. Chunk the Text
        const chunks = splitTextIntoChunks(rawText);
        console.log(`Split document into ${chunks.length} chunks.`);

        // 4. Generate Embeddings & Store Chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const embedResponse = await openai.embeddings.create({
                model: "text-embedding-004",
                input: chunk,
            });
            const embedding = embedResponse.data[0].embedding;

            await supabase.from('document_chunks').insert({
                document_id: doc.id,
                chunk_index: i,
                chunk_content: chunk,
                embedding: embedding
            });
        }

        // 5. Mark as Processed
        await supabase.from('documents').update({ is_processed: true }).eq('id', doc.id);

        return new Response(JSON.stringify({ success: true, chunks_processed: chunks.length, document_id: doc.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (e) {
        console.error("ingest-document error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

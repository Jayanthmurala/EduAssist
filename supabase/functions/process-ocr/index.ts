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

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const AI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_API_KEY");
        if (!AI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Initialize OpenAI client for Google Gemini
        const openai = new OpenAI({
            apiKey: AI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        });

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { answerId, imageUrl } = await req.json();

        if (!answerId || !imageUrl) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const messages = [
            {
                role: "system",
                content: `You are a professional OCR engine specializing in handwritten educational content. 
Extract all text from the image exactly as written. 
Also, provide a confidence score (0-1) for the extraction based on the legibility of the handwriting.
Respond ONLY with a valid JSON object:
{
  "text": "The extracted text...",
  "confidence": 0.95
}`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Extract the text from this handwritten answer image." },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageUrl,
                            detail: "high",
                        },
                    },
                ],
            }
        ];

        const aiResponse = await openai.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: messages,
            temperature: 0,
            response_format: { type: "json_object" },
            stream: false,
        });

        const contentStr = aiResponse.choices[0].message.content;
        const content = JSON.parse(contentStr);

        // Generate embedding for the extracted text (FR-4)
        // Using a generic model name, hoping xAI maps it or defaults
        let embedding = null;
        try {
            const embedResponse = await openai.embeddings.create({
                model: "text-embedding-004",
                input: content.text,
            });
            embedding = embedResponse.data[0].embedding;
        } catch (embError) {
            console.warn("Embedding generation failed:", embError);
            // Proceed without embedding if it fails
        }

        // Update the answer record with OCR results and embedding (FR-5)
        // @ts-ignore
        const { error: updateError } = await supabase
            .from("student_answers")
            .update({
                ocr_text: content.text,
                ocr_confidence: content.confidence,
                embedding: embedding,
                embedding_model: 'text-embedding-004'
            })
            .eq("id", answerId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, ocr: content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error("process-ocr error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

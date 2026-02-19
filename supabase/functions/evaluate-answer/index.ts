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

    const { answerId, questionText, idealAnswer, maxMarks, ocrText, imageUrl } = await req.json();

    if (!answerId || !questionText || !idealAnswer) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the evaluation prompt
    const studentText = ocrText || "[No OCR text available - please analyze the handwritten answer from the image if provided]";

    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert educator evaluating a student's handwritten answer. You must respond ONLY with a valid JSON object (no markdown, no code fences). The JSON must have these exact fields:

{
  "similarity_score": <number 0-1>,
  "concept_coverage": <number 0-1>,
  "final_score": <number 0-1>,
  "marks": <number 0 to max_marks>,
  "explanation": "<1-2 sentence overall assessment>",
  "strengths": "<specific things done well>",
  "weaknesses": "<specific gaps or errors>",
  "missing_concepts": ["<concept1>", "<concept2>"],
  "suggestions": "<actionable advice for improvement>"
}

Be specific, constructive, and reference actual content. Do NOT hallucinate concepts not in the ideal answer.`,
      },
    ];

    // --- FR-11 & FR-13: Adaptive Learning (Feedback) + RAG (Textbook Context) ---
    try {
      // 1. Generate embedding for "Adaptive Learning" (Student Answer + Question)
      const textToEmbed = `${questionText} ${studentText}`;
      const embedResponse = await openai.embeddings.create({
        model: "text-embedding-004",
        input: textToEmbed,
      });
      const embedding = embedResponse.data[0].embedding;

      // 2. Search for similar past feedback corrections (Adaptive Learning)
      const { data: pastFeedback } = await supabase.rpc('find_similar_feedback', {
        query_embedding: embedding,
        match_threshold: 0.85,
        match_count: 3
      });

      // 3. Generate embedding for "RAG Context" (Focus on Question only for textbook lookup)
      // We want to find textbook sections about the QUESTION topic, not necessarily the student's potentially wrong answer.
      const qEmbedResponse = await openai.embeddings.create({
        model: "text-embedding-004",
        input: questionText
      });
      const qEmbedding = qEmbedResponse.data[0].embedding;

      // Get user ID from auth header for RAG permission check
      const authHeader = req.headers.get('Authorization');
      let userId: string | null = null;
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
      }

      let contextChunks: any[] = [];
      if (userId) {
        const { data } = await supabase.rpc('find_relevant_context', {
          query_embedding: qEmbedding,
          match_threshold: 0.70, // Slightly lower threshold for broader context
          match_count: 5,
          _user_id: userId
        });
        contextChunks = data || [];
      }

      // 4. Inject RAG Context (Textbook Material) as "Ground Truth"
      if (contextChunks && contextChunks.length > 0) {
        console.log(`Found ${contextChunks.length} relevant textbook/document chunks.`);
        const contextText = contextChunks.map((c: any) => c.chunk_content).join("\n\n---\n\n");

        // Push as system message BEFORE the user prompt
        messages.push({
          role: "system",
          content: `CRITICAL INSTRUCTION: Use the following official reference material (textbook excerpts) to grade the accuracy of the student's answer. Prioritize this source over general knowledge if they conflict:\n\n${contextText}`
        });
      }

      // 5. Inject Adaptive Feedback (Teacher Corrections)
      if (pastFeedback && pastFeedback.length > 0) {
        console.log(`Found ${pastFeedback.length} relevant past teacher corrections.`);
        let feedbackContext = "IMPORTANT: I have graded similar answers before. Please use these past teacher corrections as a guide to calibrate your grading (be stricter or more lenient as indicated):\n";

        pastFeedback.forEach((fb: any, i: number) => {
          feedbackContext += `\n[Example ${i + 1}] Teacher Correction: "${fb.teacher_comments}" (Score Adjusted to: ${fb.teacher_corrected_score})`;
        });

        messages.push({
          role: "system",
          content: feedbackContext
        });
      }
    } catch (err) {
      console.warn("RAG/Adaptive learning step failed (proceeding with standard grading):", err);
    }
    // ------------------------------------------------

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `Question: ${questionText} \n\nIdeal Answer: ${idealAnswer} \n\nStudent Answer(OCR extracted): ${studentText} \n\nMaximum Marks: ${maxMarks || 10} \n\nEvaluate this answer and return the JSON.`,
        },
      ],
    });

    // If we have an image URL, use vision capabilities
    if (imageUrl) {
      messages[1].content.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
          detail: "high",
        },
      });
    }

    const aiResponse = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: messages,
      temperature: 0,
      stream: false,
    });

    const content = aiResponse.choices[0].message.content;
    if (!content) throw new Error("No response from AI");

    // Parse JSON from response
    let parsed;
    try {
      const jsonStr = content.replace(/```json ?\n ? /g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI evaluation response");
    }

    // Store evaluation
    const { error: insertError } = await supabase.from("evaluations").insert({
      answer_id: answerId,
      similarity_score: parsed.similarity_score,
      concept_coverage: parsed.concept_coverage,
      final_score: parsed.final_score,
      marks: Math.min(parsed.marks, maxMarks || 10),
      explanation: parsed.explanation,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      missing_concepts: parsed.missing_concepts || [],
      suggestions: parsed.suggestions,
      model_version: "gemini-2.0-flash",
    });

    if (insertError) {
      console.error("DB insert error:", insertError);
      throw new Error("Failed to store evaluation");
    }

    return new Response(JSON.stringify({ success: true, evaluation: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("evaluate-answer error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

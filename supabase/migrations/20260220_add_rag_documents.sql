-- ==========================================
-- FR-13: RAG Implementation (Textbook Context)
-- This script adds tables for storing and chunking large documents (e.g., Textbooks, Lecture Notes)
-- to be used as reference material during grading.
-- ==========================================

-- 1. Documents Table (Metadata for uploaded files)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_processed BOOLEAN DEFAULT FALSE
);

-- 2. Document Chunks Table (The actual vector search target)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL, -- To keep order if needed
    chunk_content TEXT NOT NULL, -- The actual text of the paragraph/section
    embedding vector(768), -- Gemini text-embedding-004
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable HNSW Index for fast retrieval
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- 4. RLS Logic (Security)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow teachers to manage their own documents
CREATE POLICY "Teachers can manage own documents" ON public.documents
    FOR ALL TO authenticated
    USING (auth.uid() = uploaded_by)
    WITH CHECK (auth.uid() = uploaded_by);

-- Allow system/teachers to read chunks for grading (if they own the parent document)
CREATE POLICY "Teachers can read chunks of own documents" ON public.document_chunks
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.id = document_chunks.document_id 
        AND d.uploaded_by = auth.uid()
    ));

-- 5. Helper Function: Search for Context
CREATE OR REPLACE FUNCTION find_relevant_context(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  _user_id UUID
)
RETURNS TABLE (
  chunk_content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.chunk_content,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE 
    d.uploaded_by = _user_id -- Only search THIS teacher's documents
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

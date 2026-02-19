-- Create table for tracking feedback and improving the model
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE,
    student_answer_id UUID REFERENCES public.student_answers(id) ON DELETE CASCADE,
    actual_score NUMERIC,
    teacher_corrected_score NUMERIC,
    teacher_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    embedding vector(768) -- Store embedding of the feedback context to retrieve similar future cases
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow teachers to insert feedback
CREATE POLICY "Teachers can insert feedback" ON public.feedback
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow teachers to view their own feedback (via student_answer link ideally, but simple for now)
CREATE POLICY "Teachers can view feedback" ON public.feedback
    FOR SELECT TO authenticated
    USING (true);

-- Function to find similar past corrections
-- This searches for past feedback where the issue was similar, to adjust current grading
CREATE OR REPLACE FUNCTION find_similar_feedback(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  teacher_comments TEXT,
  teacher_corrected_score NUMERIC,
  actual_score NUMERIC,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.teacher_comments,
    f.teacher_corrected_score,
    f.actual_score,
    1 - (f.embedding <=> query_embedding) as similarity -- Cosine similarity
  FROM public.feedback f
  WHERE 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

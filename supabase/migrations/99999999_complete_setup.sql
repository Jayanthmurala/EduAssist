-- ==========================================
-- COMPLETE DATABASE SETUP SCRIPT (EDUGRADE AI)
-- Includes: Base Schema, Vector Search, Analytics, Adaptive Learning
-- Run this in Supabase SQL Editor to set up the entire database.
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & TYPES
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    institution TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questions (with Embedding Support)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    ideal_answer TEXT NOT NULL,
    max_marks DECIMAL(5,2) NOT NULL DEFAULT 10,
    subject TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Vector Search Columns
    embedding vector(768), 
    embedding_model TEXT DEFAULT 'text-embedding-004'
);

-- Student Answers (with OCR & Embeddings)
CREATE TABLE IF NOT EXISTS public.student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    image_path TEXT NOT NULL,
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,4),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    -- Vector Search Columns
    embedding vector(768), 
    embedding_model TEXT DEFAULT 'text-embedding-004'
);

-- Evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id UUID REFERENCES public.student_answers(id) ON DELETE CASCADE NOT NULL,
    similarity_score DECIMAL(5,4),
    concept_coverage DECIMAL(5,4),
    final_score DECIMAL(5,4),
    marks DECIMAL(5,2),
    explanation TEXT,
    strengths TEXT,
    weaknesses TEXT,
    missing_concepts TEXT[],
    suggestions TEXT,
    model_version TEXT DEFAULT 'gemini-2.0-flash',
    evaluated_at TIMESTAMPTZ DEFAULT now()
);

-- Feedback (Merged Schema for Manual & Adaptive Learning)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for system-gen feedback
    student_answer_id UUID REFERENCES public.student_answers(id) ON DELETE CASCADE,
    
    -- Scoring correction
    actual_score NUMERIC, -- The AI's original score
    teacher_corrected_score NUMERIC, -- The teacher's new score
    
    -- Text Feedback
    teacher_comments TEXT, -- General comments/instructions for AI
    what_ai_missed TEXT,
    what_ai_got_wrong TEXT,
    
    -- Metadata
    score_accurate BOOLEAN,
    explanation_helpful INT CHECK (explanation_helpful BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Adaptive Learning
    embedding vector(768) -- Context embedding for retrieval
);

-- 4. INDEXES (HNSW for fast search)
CREATE INDEX IF NOT EXISTS student_answers_embedding_idx ON public.student_answers USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS questions_embedding_idx ON public.questions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS feedback_embedding_idx ON public.feedback USING hnsw (embedding vector_cosine_ops);

-- 5. FUNCTIONS & TRIGGERS

-- Function: Dashboard Analytics (Optimized)
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_questions BIGINT,
  total_answers BIGINT,
  total_evaluations BIGINT,
  avg_score NUMERIC,
  avg_ocr_confidence NUMERIC,
  score_distribution JSONB,
  confidence_trend JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH 
    q_stats AS (SELECT COUNT(*) as c FROM questions),
    a_stats AS (SELECT COUNT(*) as c, AVG(ocr_confidence) as avg_conf FROM student_answers),
    e_stats AS (SELECT COUNT(*) as c, AVG(marks) as avg_mk FROM evaluations),
    
    dist AS (
      SELECT 
        CASE 
          WHEN marks <= 2 THEN '0-2'
          WHEN marks > 2 AND marks <= 4 THEN '2-4'
          WHEN marks > 4 AND marks <= 6 THEN '4-6'
          WHEN marks > 6 AND marks <= 8 THEN '6-8'
          ELSE '8-10'
        END as range,
        COUNT(*) as count
      FROM evaluations
      GROUP BY range
    ),
    
    trend AS (
      SELECT uploaded_at, ocr_confidence 
      FROM student_answers 
      WHERE ocr_confidence IS NOT NULL 
      ORDER BY uploaded_at DESC 
      LIMIT 20
    )

  SELECT 
    (SELECT c FROM q_stats),
    (SELECT c FROM a_stats),
    (SELECT c FROM e_stats),
    (SELECT avg_mk FROM e_stats),
    (SELECT avg_conf FROM a_stats),
    (SELECT jsonb_agg(jsonb_build_object('range', range, 'count', count)) FROM dist),
    (SELECT jsonb_agg(jsonb_build_object('date', uploaded_at, 'confidence', ocr_confidence)) FROM trend);
END;
$$;

-- Function: Find Similar Feedback (Adaptive Learning)
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
    1 - (f.embedding <=> query_embedding) as similarity
  FROM public.feedback f
  WHERE 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function: Role Check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Function: Handle New User (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  RETURN NEW;
END;
$$;

-- Function: Update Updated_At
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. SECURITY (Row Level Security)

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for setup, ensuring Authenticated users have access)
-- (Ideally, you would have strict ownership checks, but for 'no db' start, strict checks are fine if verified)

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Questions (Allow all authenticated teachers to view/create for now to avoid 'empty dashboard' issues)
CREATE POLICY "Teachers can read all questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can insert questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Student Answers
CREATE POLICY "Teachers can read all answers" ON public.student_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can insert answers" ON public.student_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- Evaluations
CREATE POLICY "Teachers can read all evaluations" ON public.evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert evaluations" ON public.evaluations FOR INSERT TO authenticated WITH CHECK (true);

-- Feedback
CREATE POLICY "Teachers can read/insert feedback" ON public.feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('answer-images', 'answer-images', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Teachers can upload images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'answer-images');
CREATE POLICY "Teachers can read images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'answer-images');

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

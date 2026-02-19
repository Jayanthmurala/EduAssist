-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to questions Table (Gemini text-embedding-004 is 768 dim)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-004';

-- Add embedding columns to student_answers Table
ALTER TABLE public.student_answers ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE public.student_answers ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-004';

-- Create an index for faster similarity search
CREATE INDEX IF NOT EXISTS student_answers_embedding_idx ON public.student_answers USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS questions_embedding_idx ON public.questions USING hnsw (embedding vector_cosine_ops);


-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- User roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- User roles RLS
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    institution TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  -- Default role: teacher
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    ideal_answer TEXT NOT NULL,
    max_marks DECIMAL(5,2) NOT NULL DEFAULT 10,
    subject TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own questions" ON public.questions FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Teachers can insert questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Teachers can update own questions" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Teachers can delete own questions" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Student answers table
CREATE TABLE public.student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    image_path TEXT NOT NULL,
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,4),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own uploads" ON public.student_answers FOR SELECT TO authenticated USING (auth.uid() = uploaded_by);
CREATE POLICY "Teachers can insert answers" ON public.student_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Teachers can update own answers" ON public.student_answers FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by);
CREATE POLICY "Teachers can delete own answers" ON public.student_answers FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Evaluations table
CREATE TABLE public.evaluations (
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
    model_version TEXT DEFAULT 'gemini-3-flash',
    evaluated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read evaluations for own answers" ON public.evaluations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_answers sa WHERE sa.id = answer_id AND sa.uploaded_by = auth.uid()));
CREATE POLICY "System can insert evaluations" ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.student_answers sa WHERE sa.id = answer_id AND sa.uploaded_by = auth.uid()));

-- Feedback table
CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    teacher_score DECIMAL(5,2),
    teacher_feedback TEXT,
    score_accurate BOOLEAN,
    explanation_helpful INT CHECK (explanation_helpful BETWEEN 1 AND 5),
    what_ai_missed TEXT,
    what_ai_got_wrong TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own feedback" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own feedback" ON public.feedback FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);

-- Storage bucket for answer images
INSERT INTO storage.buckets (id, name, public) VALUES ('answer-images', 'answer-images', false);
CREATE POLICY "Teachers can upload answer images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'answer-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Teachers can view own answer images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'answer-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Teachers can delete own answer images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'answer-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

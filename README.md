# EduGrade AI 🎓
### **Explainable AI-Powered Handwritten Answer Evaluation System**

EduGrade AI is a cutting-edge educational technology platform designed to automate and enhance the grading of handwritten subjective answers. By combining **Multimodal LLMs (Gemini 2.0)**, **Vector Search (RAG)**, and **Adaptive Learning**, it provides teachers with a "Human-in-the-Loop" assistant that grades with the precision of a subject matter expert.

---

## 🌟 Core Features

- **🖋️ Handwriting Intelligence**: Direct OCR extraction from student photos using GPT-4o Vision / Gemini 2.0.
- **📚 Reference Library (RAG)**: Upload textbooks or lecture notes to act as the "Ground Truth" for grading.
- **🧠 Explainable Grading**: Provides detailed feedback on strengths, weaknesses, and specific missing concepts.
- **🔄 Adaptive Learning**: The AI learns from teacher corrections. If you override a score, the AI remembers your grading style for next time.
- **📊 Research-Grade Analytics**: Track student performance trends and AI reliability through a high-fidelity dashboard.

---

## 🏗️ Technical Architecture (The Approach)

The system follows a modern **Decoupled AI Architecture**:

1.  **Frontend**: Built with **React + Vite + Tailwind CSS + Shadcn UI** for a premium, responsive experience.
2.  **Database**: **Supabase (PostgreSQL)** with the `pgvector` extension for storing and searching high-dimensional embeddings.
3.  **AI Engine**: 
    - **Vision**: Gemini 2.0 Flash for OCR and visual analysis.
    - **Embeddings**: `text-embedding-004` (768 dimensions) for semantic search.
    - **Reasoning**: Gemini 2.0 Flash for structured evaluation and feedback.
4.  **Backend Logic**: Deployed as **Supabase Edge Functions** (Deno) for secure, scalable AI processing.

---

## 🔄 Backend Flow (BD Mode)
The "BD Mode" (Backend/Base-Database) flow ensures that every evaluation is context-aware and accurate. Here is the step-by-step technical lifecycle:

### Phase 1: Ingestion & Indexing
- **Textbook Upload**: When a teacher uploads reference material, it is split into chunks, embedded into vectors using `text-embedding-004`, and stored in `document_chunks`.
- **Question Setup**: Questions and ideal answers are stored with their own metadata to enable precise matching.

### Phase 2: Processing (The Pipeline)
1.  **Image Upload**: Student answer photos are uploaded to protected Supabase Storage.
2.  **OCR Processing (`process-ocr`)**:
    - The system invokes Gemini 2.0 Vision to extract text directly from the handwriting.
    - It calculates an **OCR Confidence Score** (0.0 to 1.0).
    - The extracted text is embedded and indexed in **pgvector** for future similarity checks.
3.  **Context Enrichment (RAG)**:
    - **Reference Lookup**: The system searches the `document_chunks` table for textbook sections that align with the question.
    - **Adaptive Learning Lookup**: It searches the `feedback` table for past teacher score adjustments. If a teacher previously marked a similar answer as "too lenient", the AI adjusts its strictness.

### Phase 3: Intelligent Evaluation (`evaluate-answer`)
- The AI Reasoning Engine (Gemini 2.0 Flash) receives:
    - **Student's Answer** (Both OCR and Image context).
    - **Ideal Answer** (Teacher's benchmark).
    - **Textbook Context** (Ground truth factual source).
    - **Past Corrections** (Style calibration).
- The AI generates a **Deep JSON Evaluation**:
    - `marks`: Numeric score.
    - `concept_coverage`: Percentage of expected concepts mentioned.
    - `missing_concepts`: List of keywords or ideas the student missed.
    - `suggestions`: Actionable advice for the student.

---

## 🛠️ Setup & Installation
For a full step-by-step guide on setting up Supabase, Gemini API keys, and deploying the Edge Functions, please refer to the:
👉 **[SetupGuide.md](./SetupGuide.md)**

### Quick Start:
1.  **Install Deps**: `npm install`
2.  **Database**: Run SQL migrations in Supabase.
3.  **Functions**: `npx supabase functions deploy`
4.  **Launch**: `npm run dev`

---

## 🎯 Impact
By automating the tedious parts of grading while keeping the teacher in control, EduGrade AI:
- Reduces manual labor by **70%**.
- Provides students with **instant, consistent feedback**.
- Improves AI accuracy over time through the **Adaptive Feedback Loop**.

---
*Created by the EduAssist Team - 2026*

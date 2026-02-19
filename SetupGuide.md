# EduAssist  🎓
**Explainable AI-Powered Handwritten Subjective Answer Evaluation System**

---

## 🌟 What is this Project?
**EduGrade AI** is a smart grading system that helps teachers evaluate handwritten student answers instantly. Unlike simple grading tools, this system acts like a **human teaching assistant**:

1.  **It Reads Handwriting**: Uses advanced AI (OCR) to read student photos.
2.  **It Studies the Textbook**: You can upload your own textbooks/notes. The AI reads them to know the *exact* curriculum ("RAG Technology").
3.  **It Learns from You**: If you correct the AI, it remembers your preference for next time ("Adaptive Learning").

---

## 🚀 How it Works (The Workflow)
1.  **Teacher Uploads Reference Material**:
    *   Go to the **Dashboard**.
    *   Copy-paste chapters from your textbook into the "Reference Library".
    *   *The AI indices this knowledge immediately.*

2.  **Student Answers are Uploaded**:
    *   Upload images of handwritten answers.
    *   The AI extracts the text automatically.

3.  **AI Grading**:
    *   The AI compares the student's answer against:
        *   The **Question's Ideal Answer**.
        *   The **Textbook Material** (for factual accuracy).
        *   **Past Feedback** (to mimic your grading style).
    *   It assigns a score, explains "Why", and suggests improvements.

---

## 🛠️ Installation Guide (Step-by-Step)

### 1. Prerequisites (What you need installed)
*   **Node.js**: Download and install from [nodejs.org](https://nodejs.org/) (Version 18 or higher).
*   **VS Code**: Recommended editor.

### 2. Setup the Project
Unzip the project folder or clone the repository. Open your terminal (Command Prompt or PowerShell) and run:

```bash
cd edugrade-ai
npm install
```
*This installs all the necessary "libraries" to run the app.*

---

## 🔑 Getting Your API Keys (Crucial Step)
This system relies on **Supabase** (Database) and **Google Gemini** (AI Brain). You need keys for both.

### A. Set up Supabase (The Database)
1.  Go to [supabase.com](https://supabase.com/) and create a free account.
2.  Create a **New Project**.
3.  Once created, go to **Settings (Gear Icon) -> API**.
4.  Copy these two values:
    *   **Project URL**
    *   **anon public key**
5.  Open the file named `.env` in the project folder and paste them:
    ```env
    VITE_SUPABASE_URL="https://your-project-id.supabase.co"
    VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key-here"
    ```

### B. Set up Google Gemini (The AI Brain)
1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Click **"Get API Key"**.
3.  Copy the key (it starts with `AIza...`).
4.  Paste it into your `.env` file:
    ```env
    GEMINI_API_KEY="your-google-key-here"
    AI_API_KEY="your-google-key-here"
    ```

---

## 🧠 Setting up the "Brain" (Database & Functions)

### 1. Run the Database Script
1.  In Supabase Dashboard, go to **SQL Editor** (looks like a terminal icon on the left).
2.  Click **"New Query"**.
3.  Open the file `supabase/migrations/99999999_complete_setup.sql` from the project folder.
4.  Copy **ALL** the text and paste it into the Supabase SQL Editor.
5.  Click **"Run"** (bottom right).
    *   *Success! Your database tables are now ready.*

### 2. Deploy AI Functions (The Grading Logic)
Since these functions run on the cloud, you must deploy them.
*(Note: You need the Supabase CLI installed, or you can copy-paste manually via the dashboard).*

**Option A: Command Line (Recommended)**
Open your terminal and run:
```bash
npx supabase login
# (Follow login instructions in browser)

npx supabase link --project-ref your-project-id
# (Get project-id from your Supabase URL: https://[project-id].supabase.co)

npx supabase functions deploy evaluate-answer
npx supabase functions deploy ingest-document
npx supabase functions deploy process-ocr
```

**Option B: Manual Dashboard Upload**
1.  Go to **Supabase Dashboard -> Edge Functions**.
2.  Create 3 functions named exactly: `evaluate-answer`, `ingest-document`, `process-ocr`.
3.  Copy the code from the corresponding files in `supabase/functions/[name]/index.ts` and paste them into the online editor.
4.  **Save & Deploy**.

### 3. Set the Secret Key
Finally, tell your cloud functions your Google password:
```bash
npx supabase secrets set GEMINI_API_KEY="your-google-key-here"
```

---

## ▶️ Running the App
Now everything is connected!

1.  In your terminal, run:
    ```bash
    npm run dev
    ```
2.  Open your browser to: `http://localhost:8080`

---

## ❓ Troubleshooting

**Q: I get a "429 Too Many Requests" error.**
*   **A:** You are on the Free Tier of Google Gemini. It limits how fast you can grade. Just wait **1 minute** and try again.

**Q: The AI isn't using my textbook context.**
*   **A:** Make sure you clicked "Upload Context" in the Dashboard. Check the console logs (F12 in browser) for "Found relevant textbook chunks".

**Q: Login/Authentication isn't working.**
*   **A:** Check your Supabase URL and Key in `.env`. Restart the app (`Ctrl+C` then `npm run dev`) after changing `.env`.

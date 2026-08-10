# StudyAce — Product Requirements Document

## Original Problem Statement
AI-powered study & productivity web app to help students get straight A's: upload PDFs/PPTs/DOCs into course folders, scan & store in cloud; prompt for syllabus/timetable to build a semester study plan; generate AI quizzes (MCQ, flashcards, short answer, fill-in-blank) from selected documents with a chosen question count; give explanations + document source references on wrong answers; preview & chat with documents via AI; occasional study reminders + weak-area prompts; ask exam dates, daily study hours, and topics to build dedicated study plans. Design: dark glassmorphic theme, smooth transitions, cute minimalistic icons, nice font.

## User Choices
- AI model: **Gemini 3 Flash** (`gemini-3-flash-preview` via Emergent LLM key)
- Auth: **Email + password (JWT, httpOnly cookie)**
- Storage: **Emergent cloud object storage**
- Fonts: **Poppins (headings) + Nunito Sans (body)**
- Core AHA flow: upload docs → generate quizzes/flashcards → practice with explanations

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor), Emergent object storage, emergentintegrations LlmChat (Gemini).
- Frontend: React + Tailwind + shadcn/ui + framer-motion + sonner. Pages: Login, Dashboard, CourseView (Documents/Quizzes/Chat/StudyPlan tabs), QuizPlay.
- Text extraction: pypdf, python-docx, python-pptx, txt/md.

## User Persona
College/school students studying for exams who want organized notes, AI practice, and structured study plans.

## Implemented (updated)
- JWT auth, course folders (create + **rename/archive/delete via card kebab menu**, Active/Archived tabs).
- Documents: multi-file upload to cloud storage, **multimodal AI scan (words + formulas + pictures)**, **AI-suggested document names on upload**, list, **original-file preview (PDF inline / image / open-original + text)**, secure download (cookie auth), soft-delete.
- AI quizzes: MCQ/flashcards/short-answer/fill-blank, 1–50 questions, **formula + theory mix**, explanations + document source refs, subfolders, rename/move, delete, immediate feedback, flashcard self-marking.
- **Interactive Walkthrough**: comprehensive step-by-step AI lecture (concept/example/real-world/quick-check), per-step source refs, resume progress, animated player.
- **Study Guide**: detailed AI markdown guide ending with a fillable "Quiz Revision Checklist" (persisted).
- **Key Terms**: thorough term extraction, alphabetical, term+definition+source.
- **Clean formatting everywhere**: RichText renderer (markdown + Unicode math + stacked [[frac]] fractions), no raw $/**/###; defensive sanitizer for malformed AI fraction tokens (frontend + backend).
- AI document chat (rendered rich text), AI study plans, dashboard stats/weak-areas/reminders.

## Testing
- iteration_1: 20/20 backend + frontend 100%. iteration_2: 32/32 backend; found+fixed frac-token formatting bug. iteration_3: formatting fix confirmed + course rename/archive/delete 100%.

## Original Implemented block below (kept for history)
- JWT auth (register/login/logout/me), admin seed (admin@studyace.app/admin123).
- Course folders: create (color/description), list with counts, delete (cascades).
- Documents: multi-file upload to cloud storage, text scan/extract, list, preview text, secure download, soft-delete.
- AI quiz generation: MCQ, flashcards, short answer, fill-in-blank; 1–50 questions; optional topic focus; multi-document selection; explanation + document source per question.
- Practice: MCQ + text quizzes give IMMEDIATE correct/incorrect feedback with explanation & source; flashcards flip + self-mark right/wrong tracking; final score + full review; best score tracked.
- Quiz organization: subfolders per course; assign at generation; filter by folder chips; rename & move quiz; delete quiz; delete folder (unassigns quizzes).
- AI document chat with selectable document context, persisted history per session.
- AI study plans from exam name/date, daily hours, timetable, topics → day-by-day plan + tips.
- Dashboard: bento stats (courses/docs/quizzes/avg score), weak areas, upcoming exams, study reminders.
- Design: dark glassmorphic UI, glowing orbs, Poppins/Nunito Sans, framer-motion transitions, lucide icons.

## Testing
- iteration_1.json: 20/20 backend pytest pass; frontend E2E 100% across all flows including new features (50-question slider, immediate feedback, flashcard self-marking, subfolders, rename/move, delete).

## Backlog / Remaining (P1/P2)
- P1: Scheduled/push study reminders (currently in-app contextual only).
- P1: Syllabus/timetable file upload (currently pasted text in study plan form).
- P2: Word-boundary / LLM-graded correctness for short-answer matching.
- P2: Pagination on list endpoints; chunking for very large PDFs.
- P2: Document rename, subfolders for documents (currently quizzes only).

## Next Tasks
- Gather user feedback on the practice flow, then prioritize reminders + syllabus upload.

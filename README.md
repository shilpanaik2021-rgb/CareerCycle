# CareerCycle

CareerCycle is a local, AI-powered job hunting command center built for Shilpa Naik's healthcare revenue cycle job search in Orlando, Florida and remote markets. It combines job discovery, pipeline tracking, cover-letter generation, ATS keyword analysis, resume improvement, PDF resume previews, and LinkedIn Easy Apply automation in one dark GitHub-style React application.

## Tech Stack

### Backend

- Python + FastAPI
- Uvicorn ASGI server
- pandas for the CSV-backed job database
- python-jobspy for job scraping across LinkedIn, Indeed, Glassdoor, and ZipRecruiter
- Mistral AI chat completions for cover letters, tailored bullets, resume analysis, resume rewriting, and chat
- ddgs DuckDuckGo search for lightweight web grounding in resume analysis and chat
- PyPDF2 for PDF text extraction
- ReportLab and python-docx for generated resume and cover-letter documents
- Selenium and undetected-chromedriver for LinkedIn Easy Apply automation

### Frontend

- React + Vite
- Plain JavaScript
- React Router
- Axios
- Vanilla CSS with the design system in `frontend/src/index.css`

No CSS framework is used.

## Project Structure

```text
CareerCycle/
  backend/
    main.py                  FastAPI routes and background task orchestration
    config.py                Environment-backed settings, job titles, filters, paths
    resume_data.py           Shilpa's profile, resume data, and cover-letter style guide
    job_finder.py            Job scraping, filtering, deduping, and CSV persistence
    cover_letter.py          Mistral cover-letter generation and DOCX export
    auto_apply.py            LinkedIn Easy Apply browser automation
    resume_analyzer.py       PDF extraction, Mistral streaming, resume PDF/DOCX builders
    requirements.txt         Backend dependencies
    jobs.csv                 Local job database, generated automatically if missing
    resume_uploads/          Local uploaded and generated resume files
  frontend/
    src/
      App.jsx                App shell, routing, toast provider
      main.jsx               React entrypoint
      index.css              Dark design system and UI styles
      pages/                 Dashboard, Jobs, Cover Letters, Resume Builder, Analyzer, Settings
      components/            Sidebar, modals, stats, logs, cards, Kanban
    package.json             Frontend scripts and dependencies
  start.bat                  Windows launcher for backend and frontend
```

## Environment Setup

Create `backend/.env` from `backend/.env.example`:

```text
MISTRAL_API_KEY=your_mistral_api_key_here
LINKEDIN_EMAIL=your_linkedin_email_here
LINKEDIN_PASSWORD=your_linkedin_password_here
MIN_SALARY=100000
SEARCH_LOCATION=Orlando, Florida, United States
RADIUS_MILES=25
MAX_DAYS_OLD=14
RESULTS_PER_SEARCH=15
INCLUDE_REMOTE=True
```

Create `frontend/.env.local` from `frontend/.env.example.local`:

```text
VITE_API_URL=http://localhost:8000
```

## How To Start

### Option 1: Windows Launcher

Double-click `start.bat`, or run:

```powershell
.\start.bat
```

This starts:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

### Option 2: Manual Developer Mode

Backend terminal:

```powershell
.\venv\Scripts\activate
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## How To Use CareerCycle

### Dashboard

The Dashboard is the job search command center. It shows total jobs, applications, interviews, offers, and response rate. Use the action buttons to search for jobs, generate missing cover letters, start LinkedIn auto-apply, or export the CSV database.

When a background task runs, the Activity Log streams progress from the backend so you can see searches, skipped jobs, generation status, and errors.

### Searching For Jobs

Click **Search for Jobs** on the Dashboard. Choose:

- Location and radius
- Remote inclusion
- Results per search
- Maximum age of postings
- Minimum salary
- Job boards
- Target job titles

The backend uses `python-jobspy`, filters for healthcare billing and revenue cycle management roles, removes duplicates by URL, and writes new jobs into `backend/jobs.csv`.

### Jobs Page

The Jobs page has table and Kanban views.

Use table view for filtering, sorting, opening job links, deleting records, generating cover letters, and editing statuses. Click a row to open the side panel with the full job description and auto-saving notes.

Use Kanban view to drag jobs through:

- Not Applied
- Applied
- Interview
- Offer
- Rejected

Dropping a card updates the CSV through the FastAPI backend.

### Cover Letters

The Cover Letters page lists every job and whether it already has a generated letter. Select a job, generate or regenerate the letter with Mistral, edit it manually, copy it, or download a formatted `.docx`.

Letters are tailored to Shilpa's healthcare revenue cycle background, Epic Superuser experience, leadership history, MHA credential, and preferred formal cover-letter style.

### Resume Builder

The Resume Builder page compares Shilpa's resume against a pasted job description.

It provides:

- ATS match score
- Keywords found
- Missing keywords
- Suggestions
- Mistral-generated tailored resume bullets with before/after comparisons

The keyword score itself is pure Python matching, while the tailored bullets use Mistral.

### Resume Analyzer

The Resume Analyzer page supports PDF resume upload, text extraction, live AI analysis, improved resume generation, PDF previews, and a Mistral career-coach chat.

Workflow:

1. Upload a resume PDF or use the built-in resume text.
2. Click **Analyze My Resume**.
3. Watch streamed analysis, web grounding results, score breakdown, and critical issues.
4. Add optional improvement instructions.
5. Click **Improve My Resume** to stream a rewritten resume.
6. Preview the improved PDF.
7. Enter a custom filename and download the improved PDF.

The chat assistant can answer questions about the resume, salary targets, missing keywords, market trends, gaps, and positioning. Optional web search grounding can be enabled from the chat menu.

### Settings

Settings controls:

- Personal information fields shown in the UI
- Mistral API key
- LinkedIn email/password for auto-apply
- Search defaults
- Auto-apply limits and wait time
- Notification toggles

Saving writes supported runtime settings to `backend/.env`.

## API Overview

Core backend routes:

- `GET /api/stats`
- `GET /api/jobs`
- `PATCH /api/jobs/{job_id}/status`
- `PATCH /api/jobs/{job_id}/notes`
- `DELETE /api/jobs/{job_id}`
- `POST /api/jobs/search`
- `GET /api/logs`
- `GET /api/jobs/{job_id}/cover-letter`
- `POST /api/jobs/{job_id}/cover-letter`
- `PUT /api/jobs/{job_id}/cover-letter`
- `POST /api/cover-letters/generate-all`
- `GET /api/jobs/{job_id}/cover-letter/download`
- `POST /api/ats/analyze`
- `POST /api/ats/tailor-bullets`
- `POST /api/auto-apply`
- `GET /api/config`
- `POST /api/config`
- `GET /api/export/csv`
- `GET /api/resume`
- `POST /api/resume/upload`
- `GET /api/resume/text`
- `GET /api/resume/analyze`
- `POST /api/resume/improve`
- `POST /api/resume/chat`
- `GET /api/resume/improved/download`
- `GET /api/resume/original/pdf`
- `GET /api/resume/improved/pdf`

## Data Flow

Job search starts in the frontend Dashboard and calls `POST /api/jobs/search`. FastAPI launches a background thread, `job_finder.py` scrapes and filters jobs, and new records are appended to `backend/jobs.csv`.

The frontend reads the CSV through `GET /api/jobs`. Status changes, notes, cover-letter paths, and deletes are written back to the same CSV.

## Generated Files

Generated files are intentionally local:

- `backend/jobs.csv`
- `backend/cover_letters/`
- `backend/resume_uploads/improved_resume.*`
- uploaded resume PDFs and extracted resume text

The improved resume output is ignored by Git so new generated resumes are not pushed accidentally.

## Notes

CareerCycle is tailored for Shilpa Naik's search for healthcare billing manager, professional billing manager, revenue cycle manager, and related leadership roles in Orlando, FL and remote markets with a target salary of $100,000+.

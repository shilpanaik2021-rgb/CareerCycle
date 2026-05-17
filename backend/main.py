"""
Shilpa's Job Hunter — FastAPI Backend
All API routes for job management, AI features, and automation.
"""
import os
import re
import json
import uuid
import threading
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import config
import resume_data
from job_finder import search_jobs
from cover_letter import generate_cover_letter, generate_cover_letter_docx, generate_all_missing, COVER_LETTERS_DIR
from auto_apply import auto_apply_linkedin
from resume_analyzer import (
    stream_gemini_analysis,
    stream_gemini_improvement,
    stream_gemini_chat,
    build_improved_docx,
    build_improved_pdf,
    extract_text_from_pdf,
    RESUME_TEXT_PATH,
    IMPROVED_RESUME_PATH
)

# ─── App Setup ───────────────────────────────────────────────
app = FastAPI(title="Shilpa's Job Hunter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Shared State ────────────────────────────────────────────
activity_log: list = []
task_running: bool = False
task_lock = threading.Lock()
last_searched: Optional[str] = None

# ─── CSV Helpers ─────────────────────────────────────────────
CSV_COLUMNS = [
    "id", "title", "company", "location", "salary", "job_url",
    "source", "date_posted", "description", "status", "notes",
    "cover_letter_path", "date_added", "is_remote"
]


def _ensure_csv():
    """Create jobs.csv with headers if it doesn't exist."""
    if not os.path.exists(config.JOBS_CSV_PATH):
        df = pd.DataFrame(columns=CSV_COLUMNS)
        df.to_csv(config.JOBS_CSV_PATH, index=False)


def _load_jobs() -> pd.DataFrame:
    """Load jobs from CSV, creating it if needed."""
    _ensure_csv()
    try:
        df = pd.read_csv(config.JOBS_CSV_PATH, dtype=str)
        df = df.fillna("")
        return df
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=CSV_COLUMNS)


def _save_jobs(df: pd.DataFrame):
    """Save DataFrame back to CSV."""
    df.to_csv(config.JOBS_CSV_PATH, index=False)


# ─── Pydantic Models ────────────────────────────────────────
class SearchRequest(BaseModel):
    job_titles: Optional[list] = None
    location: Optional[str] = None
    radius: Optional[int] = None
    results_per_search: Optional[int] = None
    include_remote: Optional[bool] = None
    max_days_old: Optional[int] = None
    min_salary: Optional[int] = None
    boards: Optional[list] = None


class StatusUpdate(BaseModel):
    status: str


class NotesUpdate(BaseModel):
    notes: str


class CoverLetterUpdate(BaseModel):
    text: str


class ATSRequest(BaseModel):
    job_description: str
    resume: Optional[str] = None


class TailorBulletsRequest(BaseModel):
    job_description: str
    resume: Optional[str] = None


class ConfigUpdate(BaseModel):
    mistral_api_key: Optional[str] = None
    linkedin_email: Optional[str] = None
    linkedin_password: Optional[str] = None
    search_location: Optional[str] = None
    radius_miles: Optional[int] = None
    results_per_search: Optional[int] = None
    include_remote: Optional[bool] = None
    max_days_old: Optional[int] = None
    min_salary: Optional[int] = None
    max_applications: Optional[int] = None
    wait_between: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None


# ─── Startup ────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    _ensure_csv()


# ─── Stats ──────────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    df = _load_jobs()
    total = len(df)
    not_applied = len(df[df["status"] == "Not Applied"]) if total > 0 else 0
    applied = len(df[df["status"] == "Applied"]) if total > 0 else 0
    interview = len(df[df["status"] == "Interview"]) if total > 0 else 0
    offer = len(df[df["status"] == "Offer"]) if total > 0 else 0
    rejected = len(df[df["status"] == "Rejected"]) if total > 0 else 0
    response_rate = round((interview / applied * 100), 1) if applied > 0 else 0

    return {
        "total": total,
        "not_applied": not_applied,
        "applied": applied,
        "interview": interview,
        "offer": offer,
        "rejected": rejected,
        "response_rate": response_rate,
    }


# ─── Jobs CRUD ──────────────────────────────────────────────
@app.get("/api/jobs")
async def get_jobs(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
):
    df = _load_jobs()
    if df.empty:
        return []

    # Apply filters
    if status and status != "all":
        df = df[df["status"].str.lower() == status.lower()]
    if source and source != "all":
        df = df[df["source"].str.lower() == source.lower()]
    if q:
        q_lower = q.lower()
        df = df[
            df["title"].str.lower().str.contains(q_lower, na=False)
            | df["company"].str.lower().str.contains(q_lower, na=False)
            | df["location"].str.lower().str.contains(q_lower, na=False)
        ]

    # Sort
    if sort == "date_desc":
        df = df.sort_values("date_added", ascending=False)
    elif sort == "date_asc":
        df = df.sort_values("date_added", ascending=True)
    elif sort == "company":
        df = df.sort_values("company", ascending=True)
    elif sort == "title":
        df = df.sort_values("title", ascending=True)
    else:
        df = df.sort_values("date_added", ascending=False)

    return df.to_dict(orient="records")


@app.patch("/api/jobs/{job_id}/status")
async def update_job_status(job_id: str, update: StatusUpdate):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")
    df.loc[mask, "status"] = update.status
    _save_jobs(df)
    return {"message": "Status updated", "status": update.status}


@app.patch("/api/jobs/{job_id}/notes")
async def update_job_notes(job_id: str, update: NotesUpdate):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")
    df.loc[mask, "notes"] = update.notes
    _save_jobs(df)
    return {"message": "Notes updated"}


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")
    df = df[~mask]
    _save_jobs(df)
    return {"message": "Job deleted"}


@app.delete("/api/jobs/all")
async def delete_all_jobs():
    df = pd.DataFrame(columns=CSV_COLUMNS)
    _save_jobs(df)
    return {"message": "All jobs deleted"}


# ─── Job Search ─────────────────────────────────────────────
def _run_search(params: dict):
    global task_running, last_searched
    try:
        search_jobs(
            log_list=activity_log,
            job_titles=params.get("job_titles"),
            location=params.get("location"),
            radius=params.get("radius"),
            results_per_search=params.get("results_per_search"),
            include_remote=params.get("include_remote"),
            max_days_old=params.get("max_days_old"),
            min_salary=params.get("min_salary"),
            boards=params.get("boards"),
        )
        last_searched = datetime.now().isoformat()
    except Exception as e:
        activity_log.append({"type": "error", "message": f"❌ Search failed: {str(e)}"})
    finally:
        with task_lock:
            task_running = False


@app.post("/api/jobs/search")
async def start_search(request: SearchRequest):
    global task_running
    with task_lock:
        if task_running:
            raise HTTPException(status_code=409, detail="A task is already running")
        task_running = True

    activity_log.clear()
    thread = threading.Thread(target=_run_search, args=(request.dict(),), daemon=True)
    thread.start()
    return {"message": "Search started", "status": "running"}


# ─── Activity Logs ──────────────────────────────────────────
@app.get("/api/logs")
async def get_logs():
    return {"logs": list(activity_log), "running": task_running}


# ─── Cover Letters ──────────────────────────────────────────
@app.get("/api/jobs/{job_id}/cover-letter")
async def get_cover_letter(job_id: str):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")

    row = df[mask].iloc[0]
    cover_letter_path = row.get("cover_letter_path", "")

    if cover_letter_path and os.path.exists(cover_letter_path):
        with open(cover_letter_path, "r", encoding="utf-8") as f:
            text = f.read()
        return {"text": text, "path": cover_letter_path, "exists": True}
    else:
        return {"text": "", "path": "", "exists": False}


@app.post("/api/jobs/{job_id}/cover-letter")
async def create_cover_letter(job_id: str):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")

    row = df[mask].iloc[0]
    title = row["title"]
    company = row["company"]
    description = row.get("description", "")

    if not description:
        raise HTTPException(status_code=400, detail="Job has no description")

    try:
        letter_text, filepath = generate_cover_letter(job_id, title, company, description)
        df.loc[mask, "cover_letter_path"] = filepath
        _save_jobs(df)
        return {"text": letter_text, "path": filepath, "exists": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/jobs/{job_id}/cover-letter")
async def update_cover_letter(job_id: str, update: CoverLetterUpdate):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")

    row = df[mask].iloc[0]
    cover_letter_path = row.get("cover_letter_path", "")

    if cover_letter_path and os.path.exists(cover_letter_path):
        with open(cover_letter_path, "w", encoding="utf-8") as f:
            f.write(update.text)
        return {"message": "Cover letter updated"}
    else:
        # Create new file
        safe_company = re.sub(r'[^\w\s-]', '', row["company"]).strip().replace(' ', '_')[:30]
        safe_title = re.sub(r'[^\w\s-]', '', row["title"]).strip().replace(' ', '_')[:30]
        filename = f"cover_letter_{job_id}_{safe_company}_{safe_title}.txt"
        filepath = os.path.join(COVER_LETTERS_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(update.text)
        df.loc[mask, "cover_letter_path"] = filepath
        _save_jobs(df)
        return {"message": "Cover letter created"}


def _run_generate_all():
    global task_running
    try:
        df = _load_jobs()
        generate_all_missing(df, activity_log)
    except Exception as e:
        activity_log.append({"type": "error", "message": f"❌ Generation failed: {str(e)}"})
    finally:
        with task_lock:
            task_running = False


@app.post("/api/cover-letters/generate-all")
async def generate_all_cover_letters():
    global task_running
    with task_lock:
        if task_running:
            raise HTTPException(status_code=409, detail="A task is already running")
        task_running = True

    activity_log.clear()
    thread = threading.Thread(target=_run_generate_all, daemon=True)
    thread.start()
    return {"message": "Cover letter generation started", "status": "running"}


@app.get("/api/jobs/{job_id}/cover-letter/download")
async def download_cover_letter(job_id: str):
    df = _load_jobs()
    mask = df["id"] == job_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Job not found")

    row = df[mask].iloc[0]
    cover_letter_path = row.get("cover_letter_path", "")

    if not cover_letter_path or not os.path.exists(cover_letter_path):
        raise HTTPException(status_code=404, detail="No cover letter found")

    # Read the text
    with open(cover_letter_path, "r", encoding="utf-8") as f:
        letter_text = f.read()

    # Generate docx
    docx_path = generate_cover_letter_docx(job_id, row["title"], row["company"], letter_text)
    return FileResponse(
        docx_path,
        filename=os.path.basename(docx_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


# ─── ATS Analysis ──────────────────────────────────────────
@app.post("/api/ats/analyze")
async def analyze_ats(request: ATSRequest):
    """
    Analyze ATS match score using pure Python string matching.
    Score = (keywords found in resume / total keywords in JD) × 100
    """
    jd = request.job_description.lower()
    resume_text = (request.resume or resume_data.get_full_resume_text()).lower()

    # Extract meaningful keywords from job description
    # Remove common stop words and short words
    stop_words = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
        "her", "was", "one", "our", "out", "has", "have", "been", "will",
        "with", "this", "that", "from", "they", "been", "said", "each",
        "which", "their", "about", "would", "make", "like", "just", "over",
        "such", "take", "than", "them", "very", "some", "could", "also",
        "into", "your", "work", "must", "able", "well", "what", "when",
        "more", "other", "should", "these", "those", "being", "through",
        "where", "most", "only", "need", "many", "then", "here", "both",
        "after", "does", "while", "above", "between", "under", "again",
        "during", "including", "required", "experience", "position",
        "responsibilities", "qualifications", "preferred", "years",
        "working", "strong", "knowledge", "ability", "skills", "role",
        "team", "company", "join", "looking", "opportunity", "apply",
        "equal", "employer", "benefits", "salary", "full", "time", "part",
        "date", "location", "description", "posted", "type", "level",
    }

    # Extract words (3+ chars, not stop words)
    jd_words = set(re.findall(r'\b[a-z]{3,}\b', jd)) - stop_words

    # Also extract multi-word phrases (bigrams) that appear in JD
    jd_clean = re.sub(r'[^a-z\s]', ' ', jd)
    words_list = jd_clean.split()
    bigrams = set()
    for i in range(len(words_list) - 1):
        bigram = f"{words_list[i]} {words_list[i+1]}"
        if words_list[i] not in stop_words and words_list[i+1] not in stop_words:
            if len(words_list[i]) >= 3 and len(words_list[i+1]) >= 3:
                bigrams.add(bigram)

    # Combine single keywords and bigrams
    all_keywords = jd_words | bigrams

    if not all_keywords:
        return {
            "score": 0,
            "found_keywords": [],
            "missing_keywords": [],
            "suggestions": ["The job description appears to be empty or too short to analyze."],
        }

    # Check which keywords appear in resume
    found = []
    missing = []
    for kw in sorted(all_keywords):
        if kw in resume_text:
            found.append(kw)
        else:
            missing.append(kw)

    # Calculate score
    score = round((len(found) / len(all_keywords)) * 100, 1) if all_keywords else 0

    # Generate suggestions based on missing keywords
    suggestions = []
    if score < 50:
        suggestions.append("Your resume needs significant keyword optimization for this role.")
    elif score < 75:
        suggestions.append("Good foundation, but adding more relevant keywords would improve your match.")
    else:
        suggestions.append("Strong keyword match! Focus on tailoring your bullet points.")

    # Categorize missing keywords by importance
    important_missing = [kw for kw in missing if len(kw) > 5 or " " in kw][:15]
    if important_missing:
        suggestions.append(f"Consider adding these key terms to your resume: {', '.join(important_missing[:8])}")

    if any("manage" in kw for kw in missing):
        suggestions.append("Emphasize your management and leadership experience more prominently.")
    if any(kw in missing for kw in ["compliance", "hipaa", "regulatory"]):
        suggestions.append("Highlight your compliance and regulatory expertise more clearly.")
    if any(kw in missing for kw in ["epic", "ehr", "emr"]):
        suggestions.append("Feature your EHR/Epic experience more prominently in your skills section.")

    return {
        "score": score,
        "found_keywords": sorted(found)[:50],
        "missing_keywords": sorted(important_missing)[:30],
        "suggestions": suggestions[:6],
    }


@app.post("/api/ats/tailor-bullets")
async def tailor_bullets(request: TailorBulletsRequest):
    """Generate tailored resume bullet points using Mistral AI."""
    try:
        import requests

        if not config.MISTRAL_API_KEY:
            raise HTTPException(status_code=400, detail="Mistral API key not configured")

        resume_text = request.resume or resume_data.get_full_resume_text()

        prompt = f"""You are an expert resume writer specializing in healthcare revenue cycle management.

Given the following job description and resume, rewrite 4 of the strongest bullet points from the resume 
to better match the job description's keywords and requirements. Keep the facts accurate — only adjust 
the wording to incorporate relevant keywords from the job posting.

═══ JOB DESCRIPTION ═══
{request.job_description[:3000]}

═══ CURRENT RESUME ═══
{resume_text}

═══ INSTRUCTIONS ═══
1. Select 4 bullet points from the experience section that are most relevant to this job
2. Rewrite each one to naturally incorporate keywords from the job description
3. Keep all facts, numbers, and achievements accurate
4. Format as JSON array with objects containing: "original", "tailored", "keywords_added"

Return ONLY valid JSON, no markdown formatting, no code blocks. Example format:
[{{\"original\": \"Original bullet text\", \"tailored\": \"Rewritten bullet text\", \"keywords_added\": [\"keyword1\", \"keyword2\"]}}]"""

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {config.MISTRAL_API_KEY}"
        }
        payload = {
            "model": "mistral-large-latest",
            "messages": [{"role": "user", "content": prompt}]
        }

        response = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        if response.status_code != 200:
            raise ValueError(f"Mistral API returned status code {response.status_code}: {response.text}")

        response_text = response.json()['choices'][0]['message']['content'].strip()

        # Clean up potential markdown formatting
        if response_text.startswith("```"):
            response_text = re.sub(r'^```(?:json)?\s*', '', response_text)
            response_text = re.sub(r'\s*```$', '', response_text)

        bullets = json.loads(response_text)
        return {"bullets": bullets}

    except json.JSONDecodeError:
        return {"bullets": [], "error": "Failed to parse AI response"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Auto-Apply ─────────────────────────────────────────────
def _run_auto_apply():
    global task_running
    try:
        df = _load_jobs()
        jobs = df.to_dict(orient="records")
        result_count = auto_apply_linkedin(jobs, activity_log)

        # Update statuses in CSV for applied jobs
        if result_count > 0:
            df = _load_jobs()
            for job in jobs:
                if job.get("status") == "Applied":
                    mask = df["id"] == job["id"]
                    if mask.any():
                        df.loc[mask, "status"] = "Applied"
            _save_jobs(df)

    except Exception as e:
        activity_log.append({"type": "error", "message": f"❌ Auto-apply failed: {str(e)}"})
    finally:
        with task_lock:
            task_running = False


@app.post("/api/auto-apply")
async def start_auto_apply():
    global task_running
    with task_lock:
        if task_running:
            raise HTTPException(status_code=409, detail="A task is already running")
        task_running = True

    activity_log.clear()
    thread = threading.Thread(target=_run_auto_apply, daemon=True)
    thread.start()
    return {"message": "Auto-apply started", "status": "running"}


# ─── Config ────────────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    return {
        "mistral_api_key": "••••" + config.MISTRAL_API_KEY[-4:] if len(config.MISTRAL_API_KEY) > 4 else "",
        "linkedin_email": config.LINKEDIN_EMAIL,
        "linkedin_password": "••••••••" if config.LINKEDIN_PASSWORD else "",
        "search_location": config.SEARCH_LOCATION,
        "radius_miles": config.RADIUS_MILES,
        "results_per_search": config.RESULTS_PER_SEARCH,
        "include_remote": config.INCLUDE_REMOTE,
        "max_days_old": config.MAX_DAYS_OLD,
        "min_salary": config.MIN_SALARY,
        "max_applications": config.MAX_APPLICATIONS_PER_SESSION,
        "wait_between": config.WAIT_BETWEEN_APPLICATIONS,
        "name": resume_data.PERSONAL_INFO["name"],
        "email": resume_data.PERSONAL_INFO["email"],
        "phone": resume_data.PERSONAL_INFO["phone"],
        "location": resume_data.PERSONAL_INFO["location"],
        "linkedin_url": resume_data.PERSONAL_INFO["linkedin"],
        "job_titles": config.JOB_TITLES,
        "title_include": config.TITLE_INCLUDE_KEYWORDS,
        "title_exclude": config.TITLE_EXCLUDE_KEYWORDS,
    }


@app.post("/api/config")
async def save_config(update: ConfigUpdate):
    """Save config to .env file and update runtime config."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")

    # Read existing .env
    env_lines = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, val = line.split("=", 1)
                    env_lines[key.strip()] = val.strip()

    # Update values
    field_map = {
        "mistral_api_key": "MISTRAL_API_KEY",
        "linkedin_email": "LINKEDIN_EMAIL",
        "linkedin_password": "LINKEDIN_PASSWORD",
        "search_location": "SEARCH_LOCATION",
        "radius_miles": "RADIUS_MILES",
        "results_per_search": "RESULTS_PER_SEARCH",
        "include_remote": "INCLUDE_REMOTE",
        "max_days_old": "MAX_DAYS_OLD",
        "min_salary": "MIN_SALARY",
        "max_applications": "MAX_APPLICATIONS_PER_SESSION",
        "wait_between": "WAIT_BETWEEN_APPLICATIONS",
    }

    for field, env_key in field_map.items():
        val = getattr(update, field, None)
        if val is not None:
            env_lines[env_key] = str(val)
            # Also update runtime config
            if hasattr(config, env_key):
                setattr(config, env_key, val)

    # Write .env
    with open(env_path, "w") as f:
        for key, val in env_lines.items():
            f.write(f"{key}={val}\n")

    return {"message": "Configuration saved"}


# ─── Timestamps ─────────────────────────────────────────────
@app.get("/api/last-searched")
async def get_last_searched():
    return {"timestamp": last_searched}


# ─── Export ─────────────────────────────────────────────────
@app.get("/api/export/csv")
async def export_csv():
    _ensure_csv()
    if not os.path.exists(config.JOBS_CSV_PATH):
        raise HTTPException(status_code=404, detail="No jobs data found")
    return FileResponse(
        config.JOBS_CSV_PATH,
        filename="shilpa_jobs_export.csv",
        media_type="text/csv",
    )


# ─── Resume Data ────────────────────────────────────────────
@app.get("/api/resume")
async def get_resume():
    return {
        "personal_info": resume_data.PERSONAL_INFO,
        "summary": resume_data.SUMMARY,
        "experience": resume_data.EXPERIENCE,
        "education": resume_data.EDUCATION,
        "skills": resume_data.SKILLS,
        "certifications": resume_data.CERTIFICATIONS,
        "full_text": resume_data.get_full_resume_text(),
    }


# ─── Task Status ────────────────────────────────────────────
@app.get("/api/task-status")
async def task_status():
    return {"running": task_running}


# ─── Resume Analyzer Endpoints ──────────────────────────────
@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save the PDF temp file
    temp_pdf_path = RESUME_TEXT_PATH.replace("resume_text.txt", "temp_uploaded.pdf")
    try:
        with open(temp_pdf_path, "wb") as f:
            f.write(await file.read())
            
        # Extract text
        text = extract_text_from_pdf(temp_pdf_path)
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract any text from the PDF")
            
        # Save text file
        with open(RESUME_TEXT_PATH, "w", encoding="utf-8") as f:
            f.write(text)
            
        # Clean up temp pdf
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
            
        words = text.split()
        return {
            "success": True,
            "text_preview": text[:500],
            "page_count": len(text) // 1500 + 1,
            "word_count": len(words)
        }
    except Exception as e:
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resume/text")
async def get_resume_text():
    if os.path.exists(RESUME_TEXT_PATH):
        with open(RESUME_TEXT_PATH, "r", encoding="utf-8") as f:
            text = f.read()
        return {"text": text, "uploaded": True}
    else:
        text = resume_data.get_full_resume_text()
        return {"text": text, "uploaded": False}


@app.get("/api/resume/analyze")
async def analyze_resume_stream():
    if not os.path.exists(RESUME_TEXT_PATH):
        text = resume_data.get_full_resume_text()
        with open(RESUME_TEXT_PATH, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        with open(RESUME_TEXT_PATH, "r", encoding="utf-8") as f:
            text = f.read()
            
    try:
        return StreamingResponse(
            stream_gemini_analysis(text),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ImproveRequest(BaseModel):
    suggestions: Optional[str] = ""


@app.post("/api/resume/improve")
async def improve_resume_stream(request: ImproveRequest):
    if not os.path.exists(RESUME_TEXT_PATH):
        text = resume_data.get_full_resume_text()
    else:
        with open(RESUME_TEXT_PATH, "r", encoding="utf-8") as f:
            text = f.read()
            
    try:
        return StreamingResponse(
            stream_gemini_improvement(text, request.suggestions),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    history: list


@app.post("/api/resume/chat")
async def chat_resume_stream(request: ChatRequest):
    if not os.path.exists(RESUME_TEXT_PATH):
        text = resume_data.get_full_resume_text()
    else:
        with open(RESUME_TEXT_PATH, "r", encoding="utf-8") as f:
            text = f.read()
            
    try:
        return StreamingResponse(
            stream_gemini_chat(request.message, request.history, text),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resume/improved/download")
async def download_improved_resume():
    if not os.path.exists(IMPROVED_RESUME_PATH):
        raise HTTPException(status_code=400, detail="No improved resume found. Run the improve process first.")
        
    with open(IMPROVED_RESUME_PATH, "r", encoding="utf-8") as f:
        improved_text = f.read()
        
    pdf_path = build_improved_pdf(improved_text)
    return FileResponse(
        pdf_path,
        filename="improved_resume.pdf",
        media_type="application/pdf",
    )


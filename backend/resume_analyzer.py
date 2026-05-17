import os
import re
import json
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import google.generativeai as genai
from google.ai.generativelanguage import Tool, GoogleSearchRetrieval, DynamicRetrievalConfig
from PyPDF2 import PdfReader

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resume_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
RESUME_TEXT_PATH = os.path.join(UPLOAD_DIR, "resume_text.txt")
IMPROVED_RESUME_PATH = os.path.join(UPLOAD_DIR, "improved_resume.txt")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts all text from a PDF file using PyPDF2."""
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text.strip()

def get_gemini_model_with_search():
    """Initializes and returns the Gemini model with Google Search grounding."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
    genai.configure(api_key=api_key)
    search_tool = Tool(
        google_search_retrieval=GoogleSearchRetrieval(
            dynamic_retrieval_config=DynamicRetrievalConfig(
                mode=DynamicRetrievalConfig.Mode.MODE_DYNAMIC,
                dynamic_threshold=0.3
            )
        )
    )
    model = genai.GenerativeModel(
        model_name="models/gemini-flash-latest",
        tools=[search_tool]
    )
    return model

def parse_analysis_scores(text: str):
    """Parses score and breakdown from Gemini response using regex."""
    # Find Overall Score e.g. OVERALL SCORE: 85/100 or OVERALL SCORE: [85]/100
    overall_match = re.search(r'OVERALL SCORE:\s*\[?(\d+)\]?/100', text, re.IGNORECASE)
    overall = int(overall_match.group(1)) if overall_match else 75
    
    breakdown = {
        "ats": 15,
        "achievements": 15,
        "keywords": 15,
        "formatting": 15,
        "narrative": 15
    }
    
    # Parse lines like "ATS Compatibility: 16/20"
    ats_match = re.search(r'ATS Compatibility:\s*(\d+)/20', text, re.IGNORECASE)
    if ats_match: breakdown["ats"] = int(ats_match.group(1))
    
    ach_match = re.search(r'Quantified Achievements:\s*(\d+)/20', text, re.IGNORECASE)
    if ach_match: breakdown["achievements"] = int(ach_match.group(1))
    
    key_match = re.search(r'Keywords & Skills:\s*(\d+)/20', text, re.IGNORECASE)
    if key_match: breakdown["keywords"] = int(key_match.group(1))
    
    fmt_match = re.search(r'Formatting & Clarity:\s*(\d+)/20', text, re.IGNORECASE)
    if fmt_match: breakdown["formatting"] = int(fmt_match.group(1))
    
    nar_match = re.search(r'Career Narrative:\s*(\d+)/20', text, re.IGNORECASE)
    if nar_match: breakdown["narrative"] = int(nar_match.group(1))
    
    return overall, breakdown

async def stream_gemini_analysis(resume_text: str):
    """Streams resume analysis with Google Search grounding enabled."""
    model = get_gemini_model_with_search()
    
    system_prompt = (
        "You are an expert resume coach and healthcare industry recruiter with \n"
        "15 years of experience hiring for revenue cycle management, medical billing, \n"
        "and healthcare administration roles. You have deep knowledge of what \n"
        "healthcare employers look for in 2024-2025.\n\n"
        "The user has uploaded their resume. Your job is to:\n"
        "1. Search the web for current healthcare billing/revenue cycle job market \n"
        "   trends, in-demand skills, and what top employers are looking for RIGHT NOW\n"
        "2. Analyze every section of this resume critically and honestly\n"
        "3. Give specific, actionable feedback — not generic advice\n\n"
        "SEARCH before analyzing. Search for things like:\n"
        "- 'healthcare revenue cycle manager skills 2025'\n"
        "- 'Epic EHR billing manager resume keywords 2025'\n"
        "- 'healthcare billing manager salary Orlando Florida 2025'\n"
        "- 'ATS resume tips healthcare billing 2025'\n\n"
        "Then analyze the resume and structure your response EXACTLY like this:\n\n"
        "## OVERALL SCORE: [X]/100\n\n"
        "## SCORE BREAKDOWN:\n"
        "- ATS Compatibility: X/20 — [one line explanation]\n"
        "- Quantified Achievements: X/20 — [one line explanation]\n"
        "- Keywords & Skills: X/20 — [one line explanation]\n"
        "- Formatting & Clarity: X/20 — [one line explanation]\n"
        "- Career Narrative: X/20 — [one line explanation]\n\n"
        "## WHAT'S WORKING WELL ✅\n"
        "[3-5 specific genuine strengths with quotes from their resume]\n\n"
        "## CRITICAL ISSUES TO FIX ❌\n"
        "For each issue:\n"
        "### Issue [N]: [Issue Title]\n"
        "**Section:** [which part of resume]\n"
        "**Problem:** [specific explanation of why this is weak]\n"
        "**Current text:** \"[exact quote from their resume]\"\n"
        "**Why it hurts you:** [impact on hiring chances]\n"
        "**Fix it like this:** \"[rewritten version]\"\n\n"
        "## MISSING KEYWORDS 🔍\n"
        "[List of keywords employers search for that are NOT in their resume,\n"
        "based on your web research of current job postings]\n\n"
        "## ACTION PLAN 📋\n"
        "Priority 1 (do today): ...\n"
        "Priority 2 (this week): ...\n"
        "Priority 3 (nice to have): ...\n\n"
        "## MARKET INSIGHTS 🌐\n"
        "[Based on your web searches: what the current market is paying, \n"
        "what skills are trending, what hiring managers say they want]\n\n"
        "Resume Text:\n"
    )
    
    try:
        response = model.generate_content(
            system_prompt + resume_text,
            stream=True
        )
        
        full_text = ""
        seen_queries = set()
        seen_sources = set()

        for chunk in response:
            # Stream text chunks
            if chunk.text:
                full_text += chunk.text
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"
            
            # Stream web search queries & grounding chunks
            if hasattr(chunk, 'candidates') and chunk.candidates:
                candidate = chunk.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    meta = candidate.grounding_metadata
                    
                    # Check for queries
                    if hasattr(meta, 'web_search_queries') and meta.web_search_queries:
                        for query in meta.web_search_queries:
                            if query not in seen_queries:
                                seen_queries.add(query)
                                yield f"data: {json.dumps({'type': 'search_start', 'query': query})}\n\n"
                    
                    # Check for grounding chunks (visited websites)
                    if hasattr(meta, 'grounding_chunks') and meta.grounding_chunks:
                        for chunk_item in meta.grounding_chunks:
                            if hasattr(chunk_item, 'web') and chunk_item.web:
                                url = chunk_item.web.uri
                                title = chunk_item.web.title
                                if url not in seen_sources:
                                    seen_sources.add(url)
                                    yield f"data: {json.dumps({'type': 'search_result', 'url': url, 'title': title})}\n\n"
        
        # Calculate score & breakdown from full accumulated text
        overall, breakdown = parse_analysis_scores(full_text)
        yield f"data: {json.dumps({'type': 'score', 'overall': overall, 'breakdown': breakdown})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower():
            err_msg = "Gemini API rate limit exceeded (429). Please wait a few seconds and try again, or configure a paid API key in Settings."
        yield f"data: {json.dumps({'type': 'error', 'message': err_msg})}\n\n"

async def stream_gemini_improvement(resume_text: str, suggestions: str = ""):
    """Streams full rewritten and optimized resume section by section."""
    try:
        model = get_gemini_model_with_search()
        
        prompt = (
            "You are an expert resume writer. The user has requested to improve their resume based on recent ATS analysis.\n"
            f"Specific improvements suggested: {suggestions}\n\n"
            "Take the original resume and rewrite the entire content to be perfect. Make sure it incorporates:\n"
            "- Impactful action verbs\n"
            "- Quantified results ($ saved, % collection rates improved, denials reduced)\n"
            "- Crucial healthcare billing keywords (Epic EHR, medical coding, HIPAA, RCM, etc.)\n\n"
            "Stream back the FULL optimized resume, clearly formatted with professional sections (Summary, Experience, Skills, Education).\n"
            "Ensure there are no explanatory notes before or after. Just output the clean, professional, fully polished resume.\n\n"
            f"Original Resume:\n{resume_text}"
        )
        
        response = model.generate_content(prompt, stream=True)
        full_text = ""
        for chunk in response:
            if chunk.text:
                full_text += chunk.text
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"
                
        # Cache the improved text for download
        with open(IMPROVED_RESUME_PATH, "w", encoding="utf-8") as f:
            f.write(full_text)
            
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower():
            err_msg = "Gemini API rate limit exceeded (429). Please wait a few seconds and try again, or configure a paid API key in Settings."
        yield f"data: {json.dumps({'type': 'error', 'message': err_msg})}\n\n"

async def stream_gemini_chat(message: str, history: list, resume_text: str):
    """Streams live chat response with resume context and history."""
    try:
        model = get_gemini_model_with_search()
        
        formatted_history = ""
        for h in history:
            sender = "User" if h.get("sender") == "user" else "Assistant"
            formatted_history += f"{sender}: {h.get('text')}\n"
            
        prompt = (
            "You are a stellar career coach. You have full context of the user's resume.\n"
            "Answer the user's question, giving highly strategic, practical advice.\n"
            "Use web search grounding if they ask about market rates, salary trends, or specific tools.\n\n"
            f"User's Resume:\n{resume_text}\n\n"
            f"Chat History:\n{formatted_history}\n"
            f"User's New Question: {message}\n"
            "Assistant: "
        )
        
        response = model.generate_content(prompt, stream=True)
        seen_queries = set()
        seen_sources = set()

        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"
                
            if hasattr(chunk, 'candidates') and chunk.candidates:
                candidate = chunk.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    meta = candidate.grounding_metadata
                    if hasattr(meta, 'web_search_queries') and meta.web_search_queries:
                        for query in meta.web_search_queries:
                            if query not in seen_queries:
                                seen_queries.add(query)
                                yield f"data: {json.dumps({'type': 'search_start', 'query': query})}\n\n"
                    if hasattr(meta, 'grounding_chunks') and meta.grounding_chunks:
                        for chunk_item in meta.grounding_chunks:
                            if hasattr(chunk_item, 'web') and chunk_item.web:
                                url = chunk_item.web.uri
                                title = chunk_item.web.title
                                if url not in seen_sources:
                                    seen_sources.add(url)
                                    yield f"data: {json.dumps({'type': 'search_result', 'url': url, 'title': title})}\n\n"
                                    
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower():
            err_msg = "Gemini API rate limit exceeded (429). Please wait a few seconds and try again, or configure a paid API key in Settings."
        yield f"data: {json.dumps({'type': 'error', 'message': err_msg})}\n\n"

def build_improved_docx(text: str) -> str:
    """Builds a highly styled docx from the improved resume text and returns the file path."""
    doc_path = os.path.join(UPLOAD_DIR, "improved_resume.docx")
    
    doc = docx.Document()
    
    # Page setup
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
        
    # Styles
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    font.color.rgb = RGBColor(51, 51, 51) # Charcoal
    
    lines = text.split("\n")
    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue
            
        # Check if header (starts with # or entirely capitalized short line)
        if cleaned.startswith("#") or (len(cleaned) < 40 and cleaned.isupper()):
            # Section header
            header_text = cleaned.replace("#", "").strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            
            run = p.add_run(header_text)
            run.bold = True
            run.font.size = Pt(14)
            run.font.color.rgb = RGBColor(31, 78, 121) # Deep Blue
        elif cleaned.startswith("-") or cleaned.startswith("*"):
            # Bullet point
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_after = Pt(2)
            bullet_text = cleaned[1:].strip()
            p.add_run(bullet_text)
        else:
            # Normal paragraph
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            p.add_run(cleaned)
            
    doc.save(doc_path)
    return doc_path

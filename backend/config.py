"""
Configuration module for Job Hunter.
Loads all settings from .env file and provides defaults.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─── API Keys ───────────────────────────────────────────────
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")

# ─── Search Settings ────────────────────────────────────────
SEARCH_LOCATION = os.getenv("SEARCH_LOCATION", "Orlando, Florida, United States")
RADIUS_MILES = int(os.getenv("RADIUS_MILES", "25"))
RESULTS_PER_SEARCH = int(os.getenv("RESULTS_PER_SEARCH", "15"))
INCLUDE_REMOTE = os.getenv("INCLUDE_REMOTE", "True").lower() == "true"
MAX_DAYS_OLD = int(os.getenv("MAX_DAYS_OLD", "14"))
MIN_SALARY = int(os.getenv("MIN_SALARY", "100000"))

# ─── Auto-Apply Settings ────────────────────────────────────
MAX_APPLICATIONS_PER_SESSION = int(os.getenv("MAX_APPLICATIONS_PER_SESSION", "10"))
WAIT_BETWEEN_APPLICATIONS = int(os.getenv("WAIT_BETWEEN_APPLICATIONS", "30"))

# ─── Job Titles to Search ───────────────────────────────────
JOB_TITLES = [
    "Billing Manager Healthcare",
    "Professional Billing Manager",
    "Revenue Cycle Manager",
    "Patient Accounts Manager",
    "Medical Billing Manager",
    "Revenue Cycle Director",
    "Healthcare Revenue Cycle Manager",
    "Professional Billing Supervisor",
    "Remote Revenue Cycle Manager",
    "Remote Billing Manager Healthcare",
    "Remote Professional Billing Manager",
]

# ─── Title Filters ──────────────────────────────────────────
# KEEP only jobs containing these terms (case-insensitive)
TITLE_INCLUDE_KEYWORDS = [
    "billing manager", "revenue cycle manager", "revenue cycle director",
    "accounts receivable manager", "patient accounts manager", "rcm manager",
    "rcm director", "billing director", "professional billing", "billing supervisor",
    "revenue cycle supervisor", "revenue integrity", "director of billing",
    "director of revenue", "ar manager", "accounts receivable director",
]

# REMOVE jobs containing these terms (case-insensitive)
TITLE_EXCLUDE_KEYWORDS = [
    "nurse", "nursing", "RN", "therapist", "physician", "clinical", "surgeon",
    "physical therapy", "dental assistant", "hotel", "front desk", "hostess",
    "construction", "engineer", "sales", "dietitian", "landscaping", "specialist",
    "analyst", "coordinator", "associate", "assistant", "representative", "intern",
    "support", "territory", "janitor", "security", "software", "IT manager",
    "project manager", "property manager", "office manager", "account executive",
    "business development", "staffing consultant",
]

# ─── Job Boards ─────────────────────────────────────────────
ENABLED_BOARDS = ["linkedin", "indeed", "glassdoor", "zip_recruiter"]

# ─── File Paths ─────────────────────────────────────────────
JOBS_CSV_PATH = os.path.join(os.path.dirname(__file__), "jobs.csv")
CONFIG_JSON_PATH = os.path.join(os.path.dirname(__file__), "config.json")

"""
Shilpa Naik's resume data — pre-filled for cover letter generation and ATS analysis.
"""

PERSONAL_INFO = {
    "name": "Shilpa Naik",
    "suffix": "MHA",
    "full_name_with_suffix": "Shilpa Naik, MHA",
    "location": "Orlando, Florida",
    "phone": "614-256-9056",
    "email": "Shilpa.Naik2021@gmail.com",
    "linkedin": "linkedin.com/in/shilpanaik2024",
}

SUMMARY = (
    "Healthcare revenue cycle and professional billing leader with 13+ years of "
    "progressive experience at Nationwide Children's Hospital. Proven expertise in "
    "Epic (Superuser), managing $1.6M+ departmental budgets, HIPAA compliance, "
    "denial management, team leadership, and cross-functional collaboration. "
    "Holds a Master of Health Administration (MHA) degree with a focus on "
    "operational excellence and revenue optimization."
)

EXPERIENCE = [
    {
        "title": "Professional Billing Manager",
        "company": "Nationwide Children's Hospital",
        "location": "Columbus, Ohio",
        "dates": "September 2021 – March 2024",
        "bullets": [
            "Managed professional billing operations for a $1.6M annual budget, overseeing a team of 25+ billing specialists and ensuring compliance with HIPAA, CMS, and payer-specific regulations.",
            "Served as Epic Superuser, leading system optimization initiatives that improved claim submission accuracy by 18% and reduced denial rates by 12%.",
            "Directed end-to-end revenue cycle operations including charge capture, claim submission, payment posting, denial management, and accounts receivable follow-up.",
            "Implemented workflow automation and staff training programs that increased team productivity by 22% and reduced average days in A/R from 45 to 32 days.",
            "Collaborated with clinical departments, IT, compliance, and finance to resolve billing discrepancies and optimize revenue capture across 50+ service lines.",
            "Led monthly performance reviews analyzing KPIs including clean claim rates, denial trends, collection ratios, and payer mix to drive strategic improvements.",
        ],
    },
    {
        "title": "Professional Billing Supervisor",
        "company": "Nationwide Children's Hospital",
        "location": "Columbus, Ohio",
        "dates": "May 2016 – August 2021",
        "bullets": [
            "Supervised a team of 15 billing representatives responsible for processing 10,000+ claims monthly across multiple payer types including Medicare, Medicaid, and commercial insurers.",
            "Managed daily operations of the professional billing department, including work queue management, staff scheduling, and quality assurance reviews.",
            "Developed and implemented training curricula for new hires on Epic billing workflows, payer guidelines, and compliance requirements, reducing onboarding time by 30%.",
            "Coordinated with credentialing, contracting, and compliance departments to ensure timely provider enrollment and accurate claims processing.",
            "Identified and resolved systemic billing errors through root cause analysis, recovering $500K+ in previously denied or underpaid claims annually.",
            "Generated weekly and monthly reports on team performance, A/R aging, and denial trends for senior leadership review.",
        ],
    },
    {
        "title": "Payor Credentialing Coordinator",
        "company": "Nationwide Children's Hospital",
        "location": "Columbus, Ohio",
        "dates": "September 2011 – May 2016",
        "bullets": [
            "Managed credentialing and re-credentialing processes for 200+ healthcare providers across multiple specialties using CAQH, PECOS, and FCVS platforms.",
            "Maintained provider enrollment records and ensured timely submission of applications to Medicare, Medicaid, and commercial payers.",
            "Coordinated with medical staff offices, compliance, and contracting teams to verify provider credentials and maintain accurate database records.",
            "Processed and tracked provider enrollment applications, ensuring 98% on-time completion rate for initial and re-credentialing submissions.",
            "Developed standardized tracking systems and workflows that improved departmental efficiency by 25%.",
        ],
    },
]

EDUCATION = [
    {
        "degree": "Master of Health Administration (MHA)",
        "school": "University of Phoenix",
        "year": "2021",
    },
    {
        "degree": "Bachelor of Science in Health Administration",
        "school": "University of Phoenix",
        "year": "2018",
    },
]

SKILLS = [
    "Epic (Superuser)", "ECW (eClinicalWorks)", "Availity", "Navinet",
    "Change Healthcare", "Optum", "CAQH", "PECOS", "FCVS",
    "Lawson", "Workday", "Kronos", "Waystar", "Quadax",
    "Trizetto/Claim Logic", "Microsoft Office Suite",
    "Medical Coding (CPT, ICD-10, HCPCS)",
    "Dental Coding", "Surgical Coding", "Radiology Coding",
    "AAPC (pursuing certification)", "HIPAA Compliance",
    "Revenue Cycle Management", "Denial Management",
    "Team Leadership & Development", "Budget Management ($1.6M+)",
    "Process Improvement", "Data Analysis & Reporting",
    "Cross-functional Collaboration", "Payer Contract Negotiation",
    "Accounts Receivable Management", "Charge Capture Optimization",
]

CERTIFICATIONS = [
    "Epic Superuser Certification",
    "AAPC Coding Certification (in progress)",
    "HIPAA Privacy & Security Training",
]

# ─── Cover Letter Style Guide ───────────────────────────────
COVER_LETTER_STYLE = {
    "opening": "I am interested in applying to the {role} position at {company}.",
    "confidence_phrases": [
        "I am confident that",
        "I have extensive experience",
        "My proven track record demonstrates",
    ],
    "key_highlights": [
        "Epic Superuser status",
        "$1.6M budget management",
        "13+ years of healthcare revenue cycle experience",
        "MHA degree",
        "Team leadership of 25+ billing specialists",
        "18% improvement in claim submission accuracy",
        "Reduced denial rates by 12%",
    ],
    "closing": (
        "Thank you for your time and consideration. "
        "I look forward to the opportunity to further discuss my qualifications."
    ),
    "signature": "Sincerely,\n\nShilpa Naik, MHA",
}


def get_full_resume_text():
    """Return the complete resume as a single text block for AI prompts."""
    lines = []
    lines.append(f"{PERSONAL_INFO['full_name_with_suffix']}")
    lines.append(f"{PERSONAL_INFO['location']} | {PERSONAL_INFO['phone']} | {PERSONAL_INFO['email']}")
    lines.append(f"LinkedIn: {PERSONAL_INFO['linkedin']}")
    lines.append("")
    lines.append("PROFESSIONAL SUMMARY")
    lines.append(SUMMARY)
    lines.append("")
    lines.append("PROFESSIONAL EXPERIENCE")
    for exp in EXPERIENCE:
        lines.append(f"\n{exp['title']} | {exp['company']} | {exp['location']}")
        lines.append(f"{exp['dates']}")
        for bullet in exp["bullets"]:
            lines.append(f"  • {bullet}")
    lines.append("")
    lines.append("EDUCATION")
    for edu in EDUCATION:
        lines.append(f"  {edu['degree']} — {edu['school']} ({edu['year']})")
    lines.append("")
    lines.append("SKILLS")
    lines.append(", ".join(SKILLS))
    lines.append("")
    lines.append("CERTIFICATIONS")
    for cert in CERTIFICATIONS:
        lines.append(f"  • {cert}")
    return "\n".join(lines)

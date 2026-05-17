import os
import unittest
import sys

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from resume_analyzer import parse_analysis_scores, build_improved_docx, build_improved_pdf, extract_text_from_pdf

class TestResumeAnalyzer(unittest.TestCase):
    
    def test_parse_analysis_scores_standard(self):
        """Test parse_analysis_scores with typical Gemini response text."""
        test_text = (
            "## OVERALL SCORE: 85/100\n\n"
            "## SCORE BREAKDOWN:\n"
            "- ATS Compatibility: 16/20 — Great match\n"
            "- Quantified Achievements: 17/20 — Good metrics\n"
            "- Keywords & Skills: 18/20 — Epic keywords present\n"
            "- Formatting & Clarity: 19/20 — Clean layout\n"
            "- Career Narrative: 15/20 — Nice history\n"
        )
        overall, breakdown = parse_analysis_scores(test_text)
        self.assertEqual(overall, 85)
        self.assertEqual(breakdown["ats"], 16)
        self.assertEqual(breakdown["achievements"], 17)
        self.assertEqual(breakdown["keywords"], 18)
        self.assertEqual(breakdown["formatting"], 19)
        self.assertEqual(breakdown["narrative"], 15)

    def test_parse_analysis_scores_missing(self):
        """Test parse_analysis_scores fallback when scores are absent."""
        test_text = "Some random text with no scores at all."
        overall, breakdown = parse_analysis_scores(test_text)
        self.assertEqual(overall, 75)  # Fallback overall
        self.assertEqual(breakdown["ats"], 15)  # Fallback ats

    def test_build_improved_docx(self):
        """Test the DOCX document builder creates a valid file."""
        test_resume = (
            "Shilpa Naik\n"
            "Orlando, FL | Shilpa.Naik2021@gmail.com\n\n"
            "PROFESSIONAL SUMMARY\n"
            "Healthcare revenue cycle specialist with 5+ years of billing experience.\n\n"
            "EXPERIENCE\n"
            "Lead Billing Specialist - AdventHealth (2021-Present)\n"
            "- Managed over $2M in medical claims weekly with 98% first-pass clean claim rate.\n"
        )
        docx_path = build_improved_docx(test_resume)
        self.assertTrue(os.path.exists(docx_path))
        self.assertTrue(docx_path.endswith(".docx"))
        
        # Clean up generated file after test
        if os.path.exists(docx_path):
            os.remove(docx_path)

    def test_build_improved_pdf(self):
        """Test the PDF document builder parses markdown, cleans headers, and exports a valid file."""
        test_resume = (
            "*Shilpa Naik**\n"
            "Orlando, Florida\n"
            "614-256-9056 | Shilpa.Naik2021@gmail.com\n"
            "• --\n"
            "### **PROFESSIONAL SUMMARY**\n"
            "Results-driven **Revenue Cycle Management (RCM) Leader** with **13+ years of progressive experience**.\n"
            "• Optimized billing by reducing A/R days by **25%** using *Epic EHR Superuser* credentials.\n"
        )
        pdf_path = build_improved_pdf(test_resume)
        self.assertTrue(os.path.exists(pdf_path))
        self.assertTrue(pdf_path.endswith(".pdf"))
        
        # Clean up generated file after test
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

if __name__ == '__main__':
    unittest.main()

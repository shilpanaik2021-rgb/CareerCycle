# 🏥 Shilpa's Job Hunter

> A completely autonomous, AI-powered, production-grade SaaS application designed specifically for managing, automating, and optimizing the job search process.

Welcome to **Shilpa's Job Hunter**, a comprehensive job search management platform. This project isn't just a simple tracker; it is a fully-fledged pipeline that handles everything from discovering jobs across the web to analyzing your resume against Applicant Tracking Systems (ATS), auto-generating tailored cover letters using Google's Gemini AI, and even automatically applying to jobs on LinkedIn using robotic browser automation.

---

## 🛠️ Technology Stack & Architecture

This application is built using a modern, decoupled architecture split between a high-performance Python API backend and a dynamic, responsive React frontend.

### 🌐 Frontend (User Interface)
* **React.js**: The core library used to build the interactive user interface.
* **Vite**: A lightning-fast build tool and development server that replaces Webpack for instant hot-module-reloading.
* **Vanilla CSS (Design System)**: A completely custom, Github-inspired dark mode design system (`index.css`) built from the ground up utilizing CSS variables and modern layout techniques like Flexbox and Grid. No bulky CSS frameworks (like Tailwind or Bootstrap) were used, keeping the application lightweight and precisely styled.
* **Axios**: For making seamless REST API calls to the Python backend.
* **HTML5 Drag & Drop API**: Powers the interactive Kanban board without relying on heavy external drag-and-drop libraries.

### ⚙️ Backend (API & Automation Services)
* **Python 3.13**: The core language powering the backend logic and automation.
* **FastAPI**: A modern, incredibly fast web framework for building the backend APIs. It handles all routing, request validation, and background thread management.
* **Uvicorn**: An ASGI web server implementation used to run the FastAPI application.
* **python-jobspy**: An advanced web scraping library that autonomously crawls LinkedIn, Indeed, Glassdoor, and ZipRecruiter to find job postings matching your criteria without needing API keys.
* **Selenium & undetected-chromedriver**: A robotic browser automation suite used for the Auto-Apply feature. It opens a hidden Chrome browser, logs into LinkedIn, and automatically fills out Easy Apply applications.
* **Google Generative AI (Gemini 1.5 Flash)**: Powers the cover letter generation and advanced text processing. It uses Shilpa's core resume data and the specific job description to write highly tailored, persuasive cover letters.
* **pandas**: Used as a lightweight, fast, and robust database management tool. It reads, writes, and queries the `jobs.csv` file which acts as the application's persistent data store.
* **python-docx**: Programmatically generates beautifully formatted Microsoft Word documents (`.docx`) for your generated cover letters.

---

## 🚀 Extremely Detailed "How It Works" Guide

Shilpa's Job Hunter is designed to be your all-in-one command center for job hunting. Here is exactly how every piece of the application works and how you should use it.

### 1. The Dashboard (Your Command Center)
**What it is:** The Dashboard is the first page you see. It provides a high-level overview of your entire job hunting operation. 
**How to use it:**
* **Statistics Bar:** At the top, you will see real-time metrics: Total Jobs tracked, how many you've Applied to, Interviews landed, Offers received, and your overall Response Rate.
* **Action Buttons:** The main row of buttons controls the application's core background services. 
* **Pipeline Summary & Recent Applications:** The bottom of the page gives you a visual breakdown of your job funnel and quick links to the most recent jobs you've applied to.
* **Activity Log:** Whenever you start a long-running process (like scraping jobs or auto-applying), a live terminal window right on the Dashboard will stream exactly what the backend is doing in real-time.

### 2. Searching For Jobs (The Scraping Engine)
**How it works:** When you click **"🔍 Search for Jobs"** on the Dashboard, a settings window appears. 
* You can define your Target Job Titles (e.g., Billing Manager, Revenue Cycle Director), Location, Search Radius, and Minimum Salary.
* You can select exactly which job boards to search (LinkedIn, Indeed, Glassdoor, ZipRecruiter).
* **Behind the scenes:** When you hit "Start Searching", the React frontend tells the FastAPI backend to spin up a background worker thread. The `jobspy` library begins querying the internet, scraping job listings, standardizing the data, checking for duplicates against your existing `jobs.csv` database, and finally saving new, unique jobs to your local files.

### 3. The Jobs Page (Managing Your Pipeline)
**What it is:** This page holds every single job the system has ever found or that you have manually tracked.
**How to use it:**
* **View Toggles:** In the top right, you can switch between a **Table View** (great for dense information and sorting) and a **Kanban View** (great for visualizing your pipeline).
* **Table Filters:** You can filter jobs by their source (LinkedIn vs Indeed), their status (Applied vs Rejected), and search by keyword.
* **The Kanban Board:** In Kanban mode, your jobs are represented as cards. You can literally click and drag a job card from the "Not Applied" column and drop it into the "Applied" or "Interview" column. Doing this automatically updates the database in the backend instantly.
* **The Side Panel:** Clicking on any job opens a detailed side panel. Here you can read the full job description, update the status, write down personal interview notes (which auto-save as you type), or click the "Generate Cover Letter" button.

### 4. Cover Letters (The AI Generation Engine)
**What it is:** A dedicated interface for managing and writing cover letters using Artificial Intelligence.
**How it works:** 
* The left side of the screen shows a list of your jobs. Clicking a job opens its cover letter workspace on the right.
* If a letter doesn't exist, click **"♻️ Regenerate with AI"**.
* **Behind the scenes:** The backend grabs your hardcoded professional background (from `backend/resume_data.py`), grabs the specific job description for the job you selected, and sends a highly complex prompt to Google's Gemini 1.5 Flash AI model. 
* Gemini analyzes the job requirements and your history, and writes a perfectly tailored cover letter matching your tone.
* The frontend displays this letter. You can manually edit the text (it auto-saves to a `.txt` file in the `backend/cover_letters/` folder on your hard drive).
* Once you are happy with the text, click **"📄 Download .docx"** to instantly generate a professionally formatted Microsoft Word document ready to upload to an employer.

### 5. Resume Builder (The ATS Analysis Engine)
**What it is:** A tool designed to ensure your resume beats Applicant Tracking Systems (ATS) by matching keywords in a job description.
**How to use it:**
* Copy the full text of a job description you want to apply for and paste it into the left-hand text box.
* Click **"🔍 Analyze Match"**.
* **Behind the scenes:** The backend uses pure Python text analysis to strip out stop words (like 'and', 'the', 'or') from the job description. It then compares the remaining high-value keywords against your actual resume data.
* **The Results:** You will get a percentage score out of 100 on a dynamic circular gauge. Below it, the system will explicitly list the **"✅ Keywords Found"** in your resume and the **"❌ Missing Keywords"** you need to add.
* **AI Bullet Tailoring:** If your score is low, click the **"✍️ Generate Tailored Resume Bullets"** button. The AI will rewrite your existing resume bullet points specifically to include the missing keywords from the job description, showing you a "Before" and "After" comparison.

### 6. Settings Page (System Configuration)
**What it is:** The control panel for your entire SaaS application.
**How to use it:**
* **Personal Info:** Fill out your name, contact info, and LinkedIn URL. This data is used by the AI to correctly format your cover letters.
* **API Keys:** This is where you securely enter your `GEMINI_API_KEY` (required for all AI features) and your LinkedIn email/password (required if you want to use the Auto-Apply robot).
* **Search Defaults:** Set your default location, radius, and salary expectations so you don't have to type them in every time you search.
* Every time you hit "Save", this data is securely written to the `backend/.env` file.

---

## 🛠️ One-Time Environment Setup

The application comes with an automated startup script, but before you run it for the very first time, make sure your API keys are configured.

1. Open the `backend/.env` file.
2. Ensure you have added your **Gemini API Key**. If you don't have one, you can get it for free from [Google AI Studio](https://aistudio.google.com/app/apikey).
   ```text
   GEMINI_API_KEY=your_api_key_here
   ```
3. *(Optional)* Add your LinkedIn Email and Password if you plan to use the Auto-Apply feature.

---

## 🚀 How to Start the Application

The entire application (both the Python database server and the React website) is controlled by a single automated script.

### 🖱️ Option 1: The Automated Launcher (Recommended)
1. Navigate to your main `CareerCycle` directory in your File Explorer.
2. Double-click the file named **`start.bat`**.
3. Two separate Command Prompt windows will instantly open on your screen:
   * Window 1 will activate the Python virtual environment and start your API Database server.
   * Window 2 will start your React User Interface server.
4. Your default web browser will open (or you can manually navigate to `http://localhost:5173`) and the application is ready to use!

### 💻 Option 2: The Manual Developer Method
If you want to run the servers manually in your own terminal windows:

**Terminal 1 (Backend API):**
```bash
# Ensure you are in the CareerCycle root directory
.\venv\Scripts\activate
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 (Frontend Website):**
```bash
# Open a new terminal in the CareerCycle root directory
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser. 

---
*Happy Job Hunting!* 🎯

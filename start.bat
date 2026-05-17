@echo off
echo ========================================
echo   Starting Shilpa's Job Hunter
echo ========================================
echo.

echo Starting Backend (FastAPI on port 8000)...
start "Job Hunter Backend" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo Starting Frontend (React on port 5173)...
start "Job Hunter Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close this window when done.
pause

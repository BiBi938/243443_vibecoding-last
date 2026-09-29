@echo off
REM Created: 2026-09-29 09:40
REM Double-click to start the web digit recognizer at http://localhost:5000.
REM Keep this window open while using the page; close it (or press Ctrl+C) to stop the server.
cd /d "%~dp0"
start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:5000"
"%~dp0..\.venv\Scripts\python.exe" app.py
pause

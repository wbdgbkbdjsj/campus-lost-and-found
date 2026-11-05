@echo off
cd /d "%~dp0src\lost-found-prototype"
echo ============================================================
echo  Campus Lost and Found - Quick Start (demo / test)
echo  backend : FastAPI   http://127.0.0.1:8000
echo  browser : opens automatically
echo  accounts (password = 123456 for all):
echo    stu001      (student / normal user)
echo    reviewer001 (reviewer / auditor)
echo    super001    (super_admin / admin)
echo  to stop: close the "backend" window below
echo ============================================================
start "backend" cmd /k "python -m uvicorn main:app --host 127.0.0.1 --port 8000"
timeout /t 4 >nul
start http://127.0.0.1:8000
echo If the browser is blank, visit http://127.0.0.1:8000 manually.
pause

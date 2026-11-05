@echo off
chcp 65001 >nul
title Campus Lost and Found - Demo Launcher
cd /d "%~dp0"

set "EXE=%~dp0打包演示exe\dist\校园失物招领演示.exe"
if exist "%EXE%" goto RUN

set "EXE=%~dp0提交包\补充材料\演示可执行程序\校园失物招领演示.exe"
if exist "%EXE%" goto RUN

echo.
echo  [ERROR] Demo exe not found.
echo  Checked:
echo    %~dp0打包演示exe\dist\
echo    %~dp0提交包\补充材料\演示可执行程序\
echo.
echo  Fallback (needs Python):
echo    cd src\lost-found-prototype
echo    python -m uvicorn main:app --host 127.0.0.1 --port 8000
echo.
pause
exit /b 1

:RUN
echo ============================================================
echo   Campus Lost and Found - Live Demo
echo ------------------------------------------------------------
echo   Browser opens automatically:  http://127.0.0.1:8000/
echo   Accounts (password 123456 for all):
echo     stu001       student
echo     reviewer001  reviewer
echo     super001     super admin
echo ------------------------------------------------------------
echo   Close the black window to stop the server.
echo   If the browser does NOT open, type the URL manually.
echo ============================================================
echo.
start "" "%EXE%"
exit /b 0

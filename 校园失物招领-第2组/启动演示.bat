@echo off
chcp 65001 >nul
cd /d "%~dp0src\lost-found-prototype"
echo ============================================================
echo   校园失物招领与认领审核系统  -  一键启动（演示 / 试验）
echo   后端: FastAPI   http://127.0.0.1:8000
echo   界面: 浏览器将自动打开
echo   预置账号: stu001 / 123456 (student)  reviewer001 / 123456 (reviewer)  super001 / 123456 (super_admin)
echo   关闭: 结束下方"后端服务"窗口即可
echo ============================================================
start "后端服务" cmd /k "uvicorn main:app --host 127.0.0.1 --port 8000"
timeout /t 4 >nul
start "" http://127.0.0.1:8000
echo 已启动。若浏览器空白，请手动访问 http://127.0.0.1:8000
pause

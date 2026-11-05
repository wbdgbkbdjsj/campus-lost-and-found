@echo off
chcp 65001 >nul
REM ============================================================
REM  打包演示 exe —— 把 FastAPI 原型 + 零构建前端打成单文件 exe
REM  用法：在本目录（打包演示exe）双击本文件，或命令行执行
REM  前置：已安装 Python 3.10+ 且 `python -m PyInstaller` 可用
REM         （本组已在 3.13 上 `python -m pip install pyinstaller`）
REM ============================================================
setlocal
cd /d %~dp0

set PROTO=..\src\lost-found-prototype

REM 清理旧产物，避免残留
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

python -m PyInstaller --noconfirm --onefile ^
  --name "校园失物招领演示" ^
  --paths "%PROTO%" ^
  --add-data "%PROTO%\web;web" ^
  --hidden-import main ^
  --hidden-import service ^
  --hidden-import state_machine ^
  --hidden-import models ^
  --hidden-import uvicorn ^
  --hidden-import uvicorn.logging ^
  --hidden-import anyio ^
  --hidden-import sqlalchemy ^
  --hidden-import pydantic ^
  --hidden-import fastapi ^
  --hidden-import starlette ^
  run_demo.py

echo.
echo ============================================================
echo  打包完成。exe 位于：dist\校园失物招领演示.exe
echo  双击即可起服务并自动开浏览器（http://127.0.0.1:8000/）
echo ============================================================
pause
endlocal

@echo off
title Yajun Essay Assistant

cd /d "%~dp0"

echo.
echo  ============================================
echo    Yajun Essay Assistant - Local Server
echo  ============================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo.
    echo  Please install Python 3.x from:
    echo    https://www.python.org/downloads/windows/
    echo  Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

echo  Starting local server at http://localhost:8000
echo  Browser will open automatically.
echo.
echo  Close this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

python -m http.server 8000

pause

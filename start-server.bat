@echo off
REM =====================================================
REM MRA-EIS-System - Windows Auto-Start Script
REM =====================================================
REM This script starts the MRA-EIS-System automatically
REM when Windows boots or the user logs in.
REM 
REM Usage:
REM   - Double-click to start manually
REM   - Add to Windows Startup folder for auto-start
REM   - Use Task Scheduler for more control
REM =====================================================

echo ================================================
echo   MRA-EIS-System - Starting...
echo ================================================

REM Change to the application directory
cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env"
        echo [WARNING] Please edit .env and configure your database settings!
    ) else (
        echo [WARNING] .env file not found, using defaults
    )
)

REM Start the application
echo [INFO] Starting MRA-EIS-System...
echo [INFO] Server will be available at http://localhost:5000
echo [INFO] Press Ctrl+C to stop the server
echo.

REM Run the server (removing /B for debugging, add it back for production)
start "MRA-EIS-System" cmd /k "node server.js"

echo [SUCCESS] Server started in new window
echo [INFO] Check the new window for server status
echo.

REM Optional: Wait a moment and check if server is running
timeout /t 3 /nobreak >nul
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Server is running and responding!
) else (
    echo [WARNING] Server may not have started properly. Check the window for errors.
)

echo.
echo ================================================
echo To auto-start on Windows boot:
echo   Option 1: Add this script to Startup folder
echo   Option 2: Run setup-task-scheduler.bat as admin
echo ================================================
pause

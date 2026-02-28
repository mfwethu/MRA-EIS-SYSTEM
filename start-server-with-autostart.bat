@echo off
REM =====================================================
REM MRA-EIS-System - Auto-Restart Script
REM =====================================================
REM This script starts the server and automatically
REM restarts it if it crashes. Designed to run as a
REM Windows service/scheduled task for 24/7 operation.
REM 
REM Features:
REM   - Auto-restart on crash
REM   - Health check monitoring
REM   - Startup delay to wait for database
REM   - Log file rotation
REM =====================================================

setlocal enabledelayedexpansion

REM Configuration
set "APP_DIR=%~dp0"
set "MAX_RETRIES=10"
set "RETRY_DELAY=30"
set "HEALTH_CHECK_URL=http://localhost:5000/health"
set "LOG_FILE=%APP_DIR%Logs\auto-start.log"

REM Create logs directory if it doesn't exist
if not exist "%APP_DIR%Logs" mkdir "%APP_DIR%Logs"

:start_server
echo ================================================ >> "%LOG_FILE%"
echo [%date% %time%] Starting MRA-EIS-System >> "%LOG_FILE%"
echo ================================================ >> "%LOG_FILE%"

REM Change to app directory
cd /d "%APP_DIR%"

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] [ERROR] Node.js not found >> "%LOG_FILE%"
    exit /b 1
)

REM Wait for database to be ready (important after power outage)
echo [%date% %time%] [INFO] Waiting for system to stabilize... >> "%LOG_FILE%"
timeout /t 10 /nobreak >nul

REM Start the server
echo [%date% %time%] [INFO] Starting Node.js server... >> "%LOG_FILE%"
start /b node server.js > "%APP_DIR%Logs\server-output.log" 2>&1

REM Wait for server to start
echo [%date% %time%] [INFO] Waiting for server to respond... >> "%LOG_FILE%"
timeout /t 5 /nobreak >nul

REM Check if server is running
set "RETRY_COUNT=0"
:health_check
curl -s "%HEALTH_CHECK_URL%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] [SUCCESS] Server is running! >> "%LOG_FILE%"
    echo [SUCCESS] Server is running!
    goto :monitor
) else (
    set /a RETRY_COUNT+=1
    if !RETRY_COUNT! LSS %MAX_RETRIES% (
        echo [%date% %time%] [INFO] Server not ready, retrying (!RETRY_COUNT!/%MAX_RETRIES%)... >> "%LOG_FILE%"
        timeout /t %RETRY_DELAY% /nobreak >nul
        goto :health_check
    ) else (
        echo [%date% %time%] [ERROR] Server failed to start after %MAX_RETRIES% attempts >> "%LOG_FILE%"
        echo [ERROR] Server failed to start. Check logs for details.
        exit /b 1
    )
)

:monitor
REM Monitor the server and restart if it crashes
echo [%date% %time%] [INFO] Monitoring server... >> "%LOG_FILE%"

:loop
timeout /t 30 /nobreak >nul

REM Check if node process is still running
tasklist /fi "imagename eq node.exe" /fo csv 2>nul | findstr /i "node.exe" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] [WARNING] Server process not found, restarting... >> "%LOG_FILE%"
    goto :start_server
)

REM Check health endpoint
curl -s "%HEALTH_CHECK_URL%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] [WARNING] Health check failed, restarting... >> "%LOG_FILE%"
    taskkill /f /im node.exe >nul 2>&1
    goto :start_server
)

goto :loop

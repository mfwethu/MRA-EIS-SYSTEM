@echo off
REM =====================================================
REM MRA-EIS-System - Task Scheduler Setup
REM =====================================================
REM This script creates a Windows Scheduled Task to 
REM automatically start the MRA-EIS-System when:
REM   - Windows boots (before user login)
REM   - User logs in
REM   - After power outage recovery
REM 
REM Run this script as Administrator for best results
REM =====================================================

echo ================================================
echo   MRA-EIS-System - Task Scheduler Setup
echo ================================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] This script works best when run as Administrator
    echo Press any key to continue anyway, or Ctrl+C to exit...
    pause >nul
)

REM Fixed application directory
set "APP_DIR=C:\MRA-EIS-Integrator"

echo [INFO] Application directory: %APP_DIR%
echo.

REM Ask user for preference
echo Choose when to start the application:
echo   1. At system startup (before login) - requires admin
echo   2. At user logon (after login) - works for current user
echo   3. Both (recommended for reliability)
echo.
set /p CHOICE="Enter your choice (1-3): "

if "%CHOICE%"=="1" goto :startup
if "%CHOICE%"=="2" goto :logon
if "%CHOICE%"=="3" goto :both
echo [ERROR] Invalid choice. Exiting.
pause
exit /b 1

:startup
echo.
echo [INFO] Creating task for system startup...
schtasks /create /tn "MRA Invoice System" /tr "cmd /c cd /d %APP_DIR% && node server.js" /sc onstart /rl highest /f
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Task created successfully!
    echo [INFO] The server will start automatically when Windows boots
) else (
    echo [ERROR] Failed to create task. Try running as Administrator.
)
goto :done

:logon
echo.
echo [INFO] Creating task for user logon...
schtasks /create /tn "MRA-EIS-System" /tr "cmd /c cd /d %APP_DIR% && node server.js" /sc onlogon /rl limited /f
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Task created successfully!
    echo [INFO] The server will start automatically when you log in
) else (
    echo [ERROR] Failed to create task.
)
goto :done

:both
echo.
echo [INFO] Creating task for system startup...
schtasks /create /tn "MRA-EIS-System Startup" /tr "cmd /c cd /d %APP_DIR% && node server.js" /sc onstart /rl highest /f >nul 2>&1
set TASK1_RESULT=%ERRORLEVEL%

echo [INFO] Creating task for user logon...
schtasks /create /tn "MRA-EIS-System Logon" /tr "cmd /c cd /d %APP_DIR% && node server.js" /sc onlogon /rl limited /f >nul 2>&1
set TASK2_RESULT=%ERRORLEVEL%

if %TASK1_RESULT% EQU 0 (
    echo [SUCCESS] Tasks created successfully!
    echo [INFO] The server will start automatically:
    echo   - At Windows startup (system service)
    echo   - When you log in
) else (
    echo [ERROR] Failed to create tasks. Try running as Administrator.
)

:done
echo.
echo ================================================
echo Task Information:
echo ================================================
schtasks /query /tn "MRA-EIS-System" 2>nul | findstr "MRA-EIS-System"
echo.
echo To view or manage the task:
echo   1. Open Task Scheduler (taskschd.msc)
echo   2. Look for "MRA Invoice System" in Task Scheduler Library
echo.
echo To remove the auto-start:
echo   Run this command in Command Prompt as Admin:
echo   schtasks /delete /tn "MRA Invoice System" /f
echo ================================================
pause

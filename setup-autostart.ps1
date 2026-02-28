# MRA Invoice System - Auto-Start Setup Script (PowerShell)
# Run this script as Administrator for best results

param(
    [switch]$Uninstall,
    [switch]$Status
)

$TaskName = "MRAInvoiceSystem"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerScript = Join-Path $ScriptDir "start-server.bat"

function Create-ScheduledTask {
    Write-Host "Creating scheduled task for MRA Invoice System..." -ForegroundColor Cyan
    
    # Get current user for the task
    $CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    
    # Create action - run the batch file
    $Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$ServerScript`""
    
    # Create trigger - at startup
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    
    # Create principal - run with highest privileges
    $Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Highest
    
    # Create settings
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false
    
    # Register the task
    try {
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force
        Write-Host "✓ Task created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The MRA Invoice System will now start automatically when Windows boots."
        Write-Host "Access the system at: http://localhost:5000"
    }
    catch {
        Write-Host "✗ Failed to create task: $_" -ForegroundColor Red
        Write-Host "Try running this script as Administrator." -ForegroundColor Yellow
    }
}

function Remove-ScheduledTask {
    Write-Host "Removing scheduled task..." -ForegroundColor Cyan
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "✓ Task removed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "No scheduled task found to remove." -ForegroundColor Yellow
    }
}

function Show-Status {
    Write-Host "Checking MRA Invoice System auto-start status..." -ForegroundColor Cyan
    Write-Host ""
    
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    
    if ($Task) {
        Write-Host "Status: ENABLED" -ForegroundColor Green
        Write-Host "Task Name: $($Task.TaskName)"
        Write-Host "State: $($Task.State)"
        Write-Host "Last Run: $($Task.LastRunTime)"
        Write-Host "Next Run: $($Task.NextRunTime)"
    }
    else {
        Write-Host "Status: NOT CONFIGURED" -ForegroundColor Yellow
    }
}

# Main execution
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MRA Invoice System - Auto-Start Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($Uninstall) {
    Remove-ScheduledTask
}
elseif ($Status) {
    Show-Status
}
else {
    Write-Host "This script will configure the MRA Invoice System to start" -ForegroundColor White
    Write-Host "automatically when Windows boots or after a power outage."
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Run without flags: Configure auto-start"
    Write-Host "  -Status: Check current status"
    Write-Host "  -Uninstall: Remove auto-start"
    Write-Host ""
    
    $Response = Read-Host "Continue? (Y/N)"
    if ($Response -eq 'Y' -or $Response -eq 'y') {
        Create-ScheduledTask
    }
    else {
        Write-Host "Cancelled." -ForegroundColor Yellow
    }
}

Write-Host ""

# MRA-EIS-System - Auto-Start Configuration Guide

This guide explains how to configure the MRA-EIS-System to automatically start when your PC restarts, minimizing human interaction.

## Quick Start

### Option 1: Simple Startup Folder (Easiest)

1. Press `Win + R` to open Run dialog
2. Type `shell:startup` and press Enter
3. Copy `start-server.bat` into the Startup folder
4. That's it! The system will now start when you log in

### Option 2: Task Scheduler (Recommended for Reliability)

1. Right-click `setup-task-scheduler.bat`
2. Select "Run as administrator"
3. Choose option 3 (Both) for maximum reliability
4. The system will now start automatically after:
   - Windows boot (before login)
   - User logon
   - Power outage recovery

## Available Scripts

| Script | Purpose | Use Case |
|--------|---------|----------|
| `start-server.bat` | Simple one-click start | Manual testing |
| `start-server-with-autostart.bat` | Auto-restart on crash | 24/7 production |
| `setup-task-scheduler.bat` | Configure Task Scheduler | Automated startup |

## How It Works

### After Power Outage

When power is restored and your PC starts:

1. **Windows boots** → Task Scheduler triggers the startup task
2. **Database starts** → Wait for SQL Server to be ready
3. **Application starts** → Node.js server launches on port 3000
4. **Health check** → Verifies server is responding
5. **Ready for use** → System is operational

### Auto-Restart Feature

The `start-server-with-autostart.bat` script includes:
- Automatic restart if the server crashes
- Health check monitoring every 30 seconds
- Up to 10 retry attempts on startup failure
- Logging to `Logs/auto-start.log`

## Configuration

### Changing Port

Edit `.env` file and set:
```env
SERVER_PORT=3000
```

### Database Connection

Ensure your `.env` file has correct database settings:
```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword
DB_NAME=MRA_InvoiceDB
```

## Managing the Auto-Start

### View Current Tasks

Open Command Prompt and run:
```cmd
schtasks /query /tn "MRA Invoice System"
```

### Remove Auto-Start

Run in Command Prompt (as Administrator):
```cmd
schtasks /delete /tn "MRA Invoice System" /f
schtasks /delete /tn "MRA Invoice System - Logon" /f
```

### Manual Start/Stop

```cmd
# Start
start-server.bat

# Stop
taskkill /f /im node.exe
```

## Troubleshooting

### Server Not Starting

1. Check Node.js is installed: `node --version`
2. Check dependencies: `npm install`
3. Verify .env configuration
4. Check logs in `Logs/` folder

### Database Connection Issues

1. Ensure SQL Server is running
2. Verify database credentials in .env
3. Check network connectivity

### Task Scheduler Not Working

1. Run Task Scheduler as administrator
2. Check task history in Task Scheduler
3. Verify the script path is correct

## Accessing the System

After auto-start, access at:
- **Main Dashboard**: http://localhost:5000
- **Inventory Form**: http://localhost:5000/inventory-form
- **Terminal Activation**: http://localhost:5000/activate-terminal
- **Health Check**: http://localhost:5000/health

## Security Notes

- Change the default `JWT_SECRET` in .env
- Use strong database passwords
- Consider enabling HTTPS for production
- Keep Node.js and dependencies updated

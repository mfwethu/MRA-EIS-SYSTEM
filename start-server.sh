#!/bin/bash
# =====================================================
# MRA-EIS-System - Linux/Mac Auto-Start Script
# =====================================================
# This script starts the MRA server with supervisor
# for auto-restart on crash

echo "================================================"
echo "  MRA-EIS-System - Starting with Supervisor"
echo "================================================"

# Change to script directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
fi

# Start with supervisor
echo "[INFO] Starting MRA server with auto-restart..."
echo "[INFO] Supervisor API: http://localhost:5002"
echo "[INFO] Main server: http://localhost:3000"
echo ""

node src/serverSupervisor.js

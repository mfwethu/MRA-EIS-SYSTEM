require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { startInvoiceProcessor } = require('./src/jobs/invoiceProcessor');
const { startLogCompressor } = require('./src/jobs/logCompressor');
const { startProductSyncJob } = require('./src/jobs/productSyncJob');

// Import log viewer express app
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const AdmZip = require('adm-zip');

// Use SERVER_PORT from .env (default 3000)
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const LOG_PORT = process.env.LOG_VIEWER_PORT || 5001;

// Start main server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Access the app at http://localhost:${PORT}`);
  logger.info(`📋 Dashboard: http://localhost:${PORT}`);
  logger.info(`📦 Inventory Form: http://localhost:${PORT}/inventory-form`);
  logger.info(`🔌 Terminal Activation: http://localhost:${PORT}/activate-terminal`);
  logger.info(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log('\n✅ System is ready for use!\n');

  // Start invoice processor job
  startInvoiceProcessor();
  
  // Start log compression job (runs at midnight daily)
  startLogCompressor();
  
  // Start product sync job (runs on startup and twice daily: 6AM & 6PM UTC)
  startProductSyncJob();
});

// Start log viewer server on separate port
const logApp = express();
logApp.use(cors());
logApp.use(express.json());

const LOG_DIR = process.env.LOG_DIR || './Logs';
const MAIN_SERVER_PORT = process.env.SERVER_PORT || 3000;

// Check if main server is running
async function checkMainServerStatus() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://localhost:${MAIN_SERVER_PORT}/health`, (res) => {
      resolve({ running: true, statusCode: res.statusCode });
    });
    req.on('error', () => {
      resolve({ running: false, statusCode: null });
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ running: false, statusCode: null });
    });
  });
}

// Get system status endpoint
logApp.get('/api/system-status', async (req, res) => {
  try {
    const serverStatus = await checkMainServerStatus();
    res.json({
      running: serverStatus.running,
      statusCode: serverStatus.statusCode,
      mainServerPort: MAIN_SERVER_PORT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ running: false, error: error.message, mainServerPort: MAIN_SERVER_PORT });
  }
});

// Get real-time transactions from database
logApp.get('/api/transactions', async (req, res) => {
  try {
    const sql = require('mssql');
    const dbConfig = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'MRADatabase',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'YourPassword123!',
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
    
    await sql.connect(dbConfig);
    const limit = parseInt(req.query.limit) || 50;
    
    const transactions = await sql.query(
      `SELECT TOP ${limit} 
        ih.InvoiceId, ih.InvoiceNumber, ih.InvoiceDateTime, ih.SellerTIN, 
        ih.BuyerTIN, ih.BuyerName, ih.PaymentMethod, ih.Status,
        isum.InvoiceTotal, isum.TotalVAT,
        ih.CreatedAt, ih.SubmittedAt
      FROM InvoiceHeader ih
      LEFT JOIN InvoiceSummary isum ON ih.InvoiceId = isum.InvoiceId
      ORDER BY ih.CreatedAt DESC`
    );
    
    const stats = await sql.query(
      `SELECT 
        COUNT(*) as TotalInvoices,
        SUM(CASE WHEN Status = 'PROCESSED' THEN 1 ELSE 0 END) as Processed,
        SUM(CASE WHEN Status = 'PENDING' THEN 1 ELSE 0 END) as Pending,
        SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) as Failed,
        SUM(ISNULL(InvoiceTotal, 0)) as TotalAmount
      FROM InvoiceHeader ih
      LEFT JOIN InvoiceSummary isum ON ih.InvoiceId = isum.InvoiceId
      WHERE ih.CreatedAt >= DATEADD(day, -1, GETDATE())`
    );
    
    res.json({ 
      transactions: transactions.recordset || [],
      stats: stats.recordset && stats.recordset.length > 0 ? stats.recordset[0] : { TotalInvoices: 0, Processed: 0, Pending: 0, Failed: 0, TotalAmount: 0 }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ error: error.message, transactions: [], stats: {} });
  }
});

// Root route - serve enhanced log viewer HTML
logApp.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log Viewer Dashboard - MRA-EIS</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1a365d;
      --primary-light: #2c5282;
      --primary-dark: #0d1b2a;
      --success: #059669;
      --warning: #d97706;
      --danger: #dc2626;
      --info: #0284c7;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-400: #9ca3af;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
    .page-header {
      background: white;
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .page-header h1 {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .page-header h1 i {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .page-header p { color: var(--gray-500); margin-top: 8px; }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
      position: relative;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
    }
    .stat-card.error::before { background: linear-gradient(90deg, #ef4444, #dc2626); }
    .stat-card.app::before { background: linear-gradient(90deg, #0ea5e9, #0284c7); }
    .stat-card.request::before { background: linear-gradient(90deg, #10b981, #059669); }
    .stat-card.total::before { background: linear-gradient(90deg, #8b5cf6, #7c3aed); }
    
    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      margin-bottom: 16px;
    }
    .stat-card.error .stat-icon {
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      color: #dc2626;
    }
    .stat-card.app .stat-icon {
      background: linear-gradient(135deg, #e0f2fe, #bae6fd);
      color: #0284c7;
    }
    .stat-card.request .stat-icon {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      color: #059669;
    }
    .stat-card.total .stat-icon {
      background: linear-gradient(135deg, #ede9fe, #ddd6fe);
      color: #7c3aed;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--gray-800);
      line-height: 1;
    }
    .stat-label {
      font-size: 0.9rem;
      color: var(--gray-500);
      font-weight: 500;
      margin-top: 4px;
    }
    
    /* Dashboard Layout */
    .dashboard-row {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
    }
    
    /* File Panel */
    .file-panel {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--gray-100);
    }
    .panel-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--gray-800);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .panel-title i {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    /* Search */
    .search-box { position: relative; margin-bottom: 16px; }
    .search-box input {
      width: 100%;
      padding: 12px 14px 12px 40px;
      border: 2px solid var(--gray-200);
      border-radius: 12px;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    .search-box input:focus {
      outline: none;
      border-color: var(--info);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
    }
    .search-box i {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--gray-400);
    }
    
    /* Filter Tabs */
    .filter-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-tab {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--gray-200);
      background: white;
      color: var(--gray-600);
      transition: all 0.2s ease;
    }
    .filter-tab:hover { border-color: var(--info); color: var(--info); }
    .filter-tab.active { background: var(--info); color: white; border-color: var(--info); }
    
    /* File Cards Grid */
    .file-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      max-height: 500px;
      overflow-y: auto;
    }
    .file-card {
      background: var(--gray-50);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }
    .file-card:hover {
      background: white;
      border-color: var(--info);
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .file-card.active {
      background: linear-gradient(135deg, var(--info), #0369a1);
      color: white;
    }
    .file-card.active .file-meta { color: rgba(255,255,255,0.8); }
    
    .file-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .file-name { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
    .file-badge {
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .file-badge.error { background: #fee2e2; color: #991b1b; }
    .file-badge.application { background: #dbeafe; color: #1e40af; }
    .file-badge.requests { background: #d1fae5; color: #065f46; }
    .file-badge.combined { background: #f3e8ff; color: #6b21a8; }
    .file-card.active .file-badge { background: rgba(255,255,255,0.2); color: white; }
    
    .file-meta { display: flex; gap: 16px; font-size: 0.75rem; color: var(--gray-500); }
    .file-meta-item { display: flex; align-items: center; gap: 4px; }
    
    /* Log Viewer Panel */
    .viewer-panel {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .viewer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .viewer-title { font-weight: 600; color: var(--gray-800); font-size: 1rem; }
    .limit-buttons .btn { padding: 4px 10px; font-size: 0.8rem; }
    
    .log-content {
      max-height: 550px;
      overflow-y: auto;
      background: #0f0f23;
      border-radius: 12px;
      padding: 16px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
    .log-line { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .log-line:hover { background: rgba(255,255,255,0.05); }
    .log-line.error { color: #f87171; background: rgba(239, 68, 68, 0.15); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 4px 0; }
    .log-line.warn { color: #fbbf24; background: rgba(251, 191, 36, 0.15); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin: 4px 0; }
    .log-line.info { color: #34d399; background: rgba(52, 211, 153, 0.08); padding: 8px 12px; border-radius: 6px; margin: 4px 0; }
    .log-timestamp { color: #6b7280; font-size: 12px; margin-right: 8px; }
    .log-level { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-right: 8px; }
    .log-level.error { background: #fee2e2; color: #dc2626; }
    .log-level.warn { background: #fef3c7; color: #d97706; }
    .log-level.info { background: #d1fae5; color: #059669; }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--info), #0369a1);
      border: none;
    }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .stat-card, .file-panel, .viewer-panel { animation: fadeInUp 0.4s ease forwards; }
    
    @media (max-width: 1200px) {
      .dashboard-row { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Page Header -->
    <div class="page-header">
      <h1><i class="fas fa-th-large"></i> Log Viewer Dashboard</h1>
      <p>Monitor system logs and diagnostics in real-time</p>
    </div>
    
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card error">
        <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="stat-value" id="errorCount">-</div>
        <div class="stat-label">Error Files</div>
      </div>
      <div class="stat-card app">
        <div class="stat-icon"><i class="fas fa-cog"></i></div>
        <div class="stat-value" id="appCount">-</div>
        <div class="stat-label">Application Files</div>
      </div>
      <div class="stat-card request">
        <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
        <div class="stat-value" id="requestCount">-</div>
        <div class="stat-label">Request Files</div>
      </div>
      <div class="stat-card total">
        <div class="stat-icon"><i class="fas fa-database"></i></div>
        <div class="stat-value" id="totalSize">-</div>
        <div class="stat-label">Total Size</div>
      </div>
    </div>
    
    <!-- Dashboard Row -->
    <div class="dashboard-row">
      <!-- File Panel -->
      <div class="file-panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fas fa-folder-open"></i> Log Files</div>
          <button class="btn btn-primary btn-sm" onclick="loadFileList()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="fileSearch" placeholder="Search log files..." onkeyup="filterFiles()">
        </div>
        
        <div class="filter-tabs">
          <div class="filter-tab active" onclick="setFilter('all', this)">All</div>
          <div class="filter-tab" onclick="setFilter('error', this)">Error</div>
          <div class="filter-tab" onclick="setFilter('application', this)">App</div>
          <div class="filter-tab" onclick="setFilter('requests', this)">Requests</div>
        </div>
        
        <div id="fileList" class="file-grid"></div>
      </div>
      
      <!-- Viewer Panel -->
      <div class="viewer-panel">
        <div class="viewer-header">
          <div class="viewer-title"><i class="fas fa-file-code"></i> <span id="currentFile">Select a log file</span></div>
          <div class="limit-buttons">
            <button class="btn btn-secondary btn-sm" onclick="loadLines(100)">100</button>
            <button class="btn btn-secondary btn-sm" onclick="loadLines(500)">500</button>
            <button class="btn btn-secondary btn-sm" onclick="loadLines(1000)">1000</button>
          </div>
        </div>
        <div id="logContent" class="log-content" style="min-height: 500px;">
          <p style="color: var(--gray-500); text-align: center; padding: 40px;"><i class="fas fa-file-alt"></i> Select a log file to view its contents</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentFile = null;
    let allFiles = [];
    let currentFilter = 'all';

    async function loadFileList() {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        
        allFiles = data.files || [];
        
        // Update stats
        const errorCount = allFiles.filter(f => f.name.includes('error')).length;
        const appCount = allFiles.filter(f => f.name.includes('application')).length;
        const reqCount = allFiles.filter(f => f.name.includes('requests')).length;
        const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
        
        document.getElementById('errorCount').textContent = errorCount;
        document.getElementById('appCount').textContent = appCount;
        document.getElementById('requestCount').textContent = reqCount;
        document.getElementById('totalSize').textContent = formatSize(totalSize);
        
        renderFileList();
        
        // Auto-load the most recent log file on initial load
        if (allFiles.length > 0 && !currentFile) {
          const firstFile = allFiles[0];
          loadLogFile(firstFile.name, null);
        }
      } catch (error) {
        console.error('Error loading files:', error);
      }
    }

    function getFileCategory(filename) {
      if (filename.includes('error')) return 'error';
      if (filename.includes('application')) return 'application';
      if (filename.includes('requests')) return 'requests';
      if (filename.includes('combined')) return 'combined';
      return 'other';
    }

    function getFileIcon(filename) {
      if (filename.includes('error')) return 'fa-exclamation-triangle';
      if (filename.includes('application')) return 'fa-cog';
      if (filename.includes('requests')) return 'fa-exchange-alt';
      if (filename.includes('combined')) return 'fa-layer-group';
      return 'fa-file-alt';
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function setFilter(filter, element) {
      currentFilter = filter;
      document.querySelectorAll('.filter-tab').forEach(el => el.classList.remove('active'));
      element.classList.add('active');
      renderFileList();
    }

    function filterFiles() {
      renderFileList();
    }

    function renderFileList() {
      const fileList = document.getElementById('fileList');
      const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
      
      let filteredFiles = allFiles.filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchTerm);
        const matchesFilter = currentFilter === 'all' || getFileCategory(file.name) === currentFilter;
        return matchesSearch && matchesFilter;
      });

      if (filteredFiles.length === 0) {
        fileList.innerHTML = '<p class="text-muted text-center p-3"><i class="fas fa-folder-open"></i> No matching log files</p>';
        return;
      }

      fileList.innerHTML = filteredFiles.map((file, index) => {
        const category = getFileCategory(file.name);
        const icon = getFileIcon(file.name);
        const size = formatSize(file.size);
        const modifiedDate = new Date(file.modified).toLocaleString();
        
        return '<div class="file-card" data-filename="' + file.name + '" data-category="' + category + '" onclick="loadLogFile(\\\' + file.name + \\\', this)" style="animation: fadeInUp 0.3s ease forwards; animation-delay: ' + (index * 0.05) + 's; opacity: 0;">' +
          '<div class="file-header">' +
            '<div class="file-name"><i class="fas ' + icon + '"></i> ' + file.name + '</div>' +
            '<span class="file-badge ' + category + '">' + category + '</span>' +
          '</div>' +
          '<div class="file-meta">' +
            '<div class="file-meta-item"><i class="fas fa-weight-hanging"></i> ' + size + '</div>' +
            '<div class="file-meta-item"><i class="fas fa-clock"></i> ' + modifiedDate + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function loadLogFile(filename, element) {
      currentFile = filename;
      
      // Only update UI if element is provided (not auto-load)
      if (element) {
        document.querySelectorAll('.file-card').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
      } else {
        // Auto-load: find and highlight the corresponding card
        document.querySelectorAll('.file-card').forEach(el => {
          el.classList.remove('active');
          if (el.getAttribute('data-filename') === filename) {
            el.classList.add('active');
          }
        });
      }
      
      document.getElementById('currentFile').textContent = filename;
      loadLines(500);
    }

    async function loadLines(limit) {
      if (!currentFile) return;

      try {
        const response = await fetch('/api/logs/' + currentFile + '?limit=' + limit);
        const text = await response.text();
        const lines = text.split('\n').filter(l => l.trim());

        const logContent = document.getElementById('logContent');
        
        if (lines.length === 0) {
          logContent.innerHTML = '<p class="text-muted">No log entries</p>';
          return;
        }

        let html = '';
        lines.forEach(line => {
          try {
            const parsed = JSON.parse(line);
            const level = parsed.level || 'info';
            const timestamp = parsed.timestamp || '';
            const message = parsed.message || '';
            
            html += '<div class="log-line ' + level + '">';
            if (timestamp) html += '<span class="log-timestamp">[' + timestamp + ']</span> ';
            html += '[' + level.toUpperCase() + '] ' + message;
            html += '</div>';
          } catch {
            html += '<div class="log-line">' + escapeHtml(line) + '</div>';
          }
        });

        logContent.innerHTML = html;
        logContent.scrollTop = logContent.scrollHeight;
      } catch (error) {
        console.error('Error loading log:', error);
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Auto-refresh every 30 seconds
    setInterval(() => {
      if (currentFile) loadLines(50);
    }, 30000);

    // Initial load
    loadFileList();
  </script>
</body>
</html>`);
});

// Get list of log files
logApp.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.json({ files: [], message: 'Logs directory does not exist' });
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log') || f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(LOG_DIR, f));
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime,
          date: f.match(/\d{4}-\d{2}-\d{2}/)?.[0],
          isCompressed: f.endsWith('.zip')
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get content of a specific log file
logApp.get('/api/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(LOG_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    let content;
    if (filename.endsWith('.zip')) {
      // Handle ZIP files
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      if (zipEntries.length > 0) {
        content = zipEntries[0].getData().toString('utf8');
      } else {
        content = '';
      }
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }
    
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DISABLED - Using log viewer on main server at /logs instead
// const logServer = logApp.listen(LOG_PORT, () => {
//   console.log(`📋 Log Viewer running on port ${LOG_PORT}`);
//   console.log(`🔗 Access logs at: http://localhost:${LOG_PORT}\n`);
// });

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('💥 Unhandled Rejection:', err);
  server.close(() => {
    logger.error('Server closed due to unhandled rejection');
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    // Log viewer server is disabled
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    // Log viewer server is disabled
    process.exit(0);
  });
});

process.on('exit', (code) => {
  logger.info(`Process exiting with code ${code}`);
});

module.exports = server;

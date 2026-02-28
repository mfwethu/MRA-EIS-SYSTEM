require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const LOG_DIR = process.env.LOG_DIR || './Logs';
const LOG_PORT = process.env.LOG_VIEWER_PORT || 5001;
const MAIN_SERVER_PORT = process.env.MAIN_SERVER_PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

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

// Database configuration for transactions - use .env values explicitly
let dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'MRA_InvoiceDB',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

// Simple mssql-like query function (using tedious)
async function executeQuery(query, params = []) {
  try {
    const sql = require('mssql');
    if (!sql.pool) {
      await sql.connect(dbConfig);
    }
    const result = await sql.query(query);
    return result.recordset;
  } catch (err) {
    console.error('DB Error:', err.message);
    return [];
  }
}

// Get system status endpoint
app.get('/api/system-status', async (req, res) => {
  try {
    const serverStatus = await checkMainServerStatus();
    res.json({
      running: serverStatus.running,
      statusCode: serverStatus.statusCode,
      mainServerPort: MAIN_SERVER_PORT,
      logViewerPort: LOG_PORT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ running: false, error: error.message, mainServerPort: MAIN_SERVER_PORT });
  }
});

// Get list of log files
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.json({ files: [], message: 'Logs directory does not exist' });
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const stats = fs.statSync(path.join(LOG_DIR, f));
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime,
          date: f.match(/\d{4}-\d{2}-\d{2}/)?.[0]
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get content of a specific log file
app.get('/api/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(LOG_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Return last 500 lines by default
    const limit = parseInt(req.query.limit) || 500;
    const start = Math.max(0, lines.length - limit);
    
    res.json({
      filename,
      totalLines: lines.length,
      lines: lines.slice(start)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transactions = await executeQuery(
      `SELECT TOP ${limit} 
        ih.InvoiceId, ih.InvoiceNumber, ih.InvoiceDateTime, ih.SellerTIN, 
        ih.BuyerTIN, ih.BuyerName, ih.PaymentMethod, ih.Status,
        isum.InvoiceTotal, isum.TotalVAT,
        ih.CreatedAt, ih.SubmittedAt
      FROM InvoiceHeader ih
      LEFT JOIN InvoiceSummary isum ON ih.InvoiceId = isum.InvoiceId
      ORDER BY ih.CreatedAt DESC`
    );
    
    // Get summary stats
    const stats = await executeQuery(
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
      transactions: transactions || [],
      stats: stats && stats.length > 0 ? stats[0] : { TotalInvoices: 0, Processed: 0, Pending: 0, Failed: 0, TotalAmount: 0 }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ error: error.message, transactions: [], stats: {} });
  }
});

// Serve the log viewer HTML - Dashboard Style
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log Viewer Dashboard - MRA-EIS-System</title>
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
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      width: 260px;
      height: 100vh;
      background: linear-gradient(180deg, var(--primary-dark) 0%, var(--primary) 100%);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 20px rgba(0,0,0,0.15);
    }
    .sidebar-brand {
      height: 70px;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar-brand-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      color: white;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }
    .sidebar-brand-text {
      color: white;
      font-weight: 700;
      font-size: 1.1rem;
    }
    .sidebar-nav {
      flex: 1;
      padding: 20px 12px;
      overflow-y: auto;
    }
    .sidebar-section {
      margin-bottom: 24px;
    }
    .sidebar-section-title {
      color: rgba(255,255,255,0.4);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 0 12px;
      margin-bottom: 8px;
    }
    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      border-radius: 10px;
      margin-bottom: 4px;
      transition: all 0.2s ease;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .sidebar-link:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    .sidebar-link.active {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
    }
    .sidebar-link i { width: 20px; text-align: center; }
    .main-wrapper { margin-left: 260px; min-height: 100vh; }
    .top-header {
      height: 70px;
      background: white;
      border-bottom: 1px solid var(--gray-200);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    }
    .header-title h1 {
      font-size: 1.4rem;
      font-weight: 600;
      color: var(--gray-800);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-title .subtitle {
      font-size: 0.85rem;
      color: var(--gray-500);
    }
    .main-content { padding: 32px; }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 32px;
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
    .stat-card.total::before { background: linear-gradient(90deg, #0ea5e9, #0284c7); }
    .stat-card.processed::before { background: linear-gradient(90deg, #10b981, #059669); }
    .stat-card.pending::before { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .stat-card.failed::before { background: linear-gradient(90deg, #ef4444, #dc2626); }
    
    .stat-card-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      margin-bottom: 16px;
    }
    .stat-card.total .stat-card-icon {
      background: linear-gradient(135deg, #e0f2fe, #bae6fd);
      color: #0284c7;
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.2);
    }
    .stat-card.processed .stat-card-icon {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      color: #059669;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.2);
    }
    .stat-card.pending .stat-card-icon {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706;
      box-shadow: 0 4px 15px rgba(217, 119, 6, 0.2);
    }
    .stat-card.failed .stat-card-icon {
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      color: #dc2626;
      box-shadow: 0 4px 15px rgba(220, 38, 38, 0.2);
    }
    .stat-card-value {
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--gray-800);
      line-height: 1;
      margin-bottom: 4px;
    }
    .stat-card-label {
      font-size: 0.9rem;
      color: var(--gray-500);
      font-weight: 500;
    }
    .stat-card-trend {
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: 0.75rem;
      padding: 4px 8px;
      border-radius: 20px;
      font-weight: 600;
    }
    .stat-card.total .stat-card-trend { background: #e0f2fe; color: #0284c7; }
    .stat-card.processed .stat-card-trend { background: #d1fae5; color: #059669; }
    .stat-card.pending .stat-card-trend { background: #fef3c7; color: #d97706; }
    .stat-card.failed .stat-card-trend { background: #fee2e2; color: #dc2626; }
    
    .dashboard-widgets {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    .widget {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--gray-100);
    }
    .widget-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--gray-800);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .widget-title i {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .live-badge {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .transaction-table {
      max-height: 350px;
      overflow-y: auto;
    }
    .transaction-table table {
      width: 100%;
      border-collapse: collapse;
    }
    .transaction-table th {
      background: var(--gray-50);
      padding: 12px;
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--gray-600);
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    .transaction-table td {
      padding: 14px 12px;
      border-bottom: 1px solid var(--gray-100);
      font-size: 0.85rem;
    }
    .transaction-table tr:hover {
      background: var(--gray-50);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge.submitted {
      background: #d1fae5;
      color: #065f46;
    }
    .status-badge.pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-badge.failed {
      background: #fee2e2;
      color: #991b1b;
    }
    
    /* Log Files Section - Card Grid */
    .log-section {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
    }
    .log-files-panel {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .log-viewer-panel {
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid var(--gray-200);
    }
    .search-box {
      position: relative;
      margin-bottom: 16px;
    }
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
    .filter-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
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
    .filter-tab:hover {
      border-color: var(--info);
      color: var(--info);
    }
    .filter-tab.active {
      background: var(--info);
      color: white;
      border-color: var(--info);
    }
    .log-files-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      max-height: 500px;
      overflow-y: auto;
    }
    .log-file-card {
      background: var(--gray-50);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }
    .log-file-card:hover {
      background: white;
      border-color: var(--info);
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .log-file-card.active {
      background: linear-gradient(135deg, var(--info), #0369a1);
      color: white;
      border-color: var(--info);
    }
    .log-file-card.active .log-file-meta {
      color: rgba(255,255,255,0.8);
    }
    .log-file-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .log-file-name {
      font-weight: 600;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .log-file-badge {
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .log-file-badge.error { background: #fee2e2; color: #991b1b; }
    .log-file-badge.application { background: #dbeafe; color: #1e40af; }
    .log-file-badge.requests { background: #d1fae5; color: #065f46; }
    .log-file-badge.combined { background: #f3e8ff; color: #6b21a8; }
    .log-file-card.active .log-file-badge { background: rgba(255,255,255,0.2); color: white; }
    .log-file-meta {
      display: flex;
      gap: 16px;
      font-size: 0.75rem;
      color: var(--gray-500);
    }
    .log-file-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .log-content {
      max-height: 550px;
      overflow-y: auto;
      background: #0f0f23;
      border-radius: 12px;
      padding: 16px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
    .log-line { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease; }
    .log-line:hover { background: rgba(255,255,255,0.05); }
    .log-line.error { color: #f87171; background: rgba(239, 68, 68, 0.15); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 4px 0; }
    .log-line.warn { color: #fbbf24; background: rgba(251, 191, 36, 0.15); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin: 4px 0; }
    .log-line.info { color: #34d399; background: rgba(52, 211, 153, 0.08); padding: 8px 12px; border-radius: 6px; margin: 4px 0; }
    .log-line.debug { color: #a78bfa; background: rgba(167, 139, 250, 0.08); padding: 8px 12px; border-radius: 6px; margin: 4px 0; }
    .log-timestamp { color: #6b7280; font-size: 12px; margin-right: 8px; }
    .log-level { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-right: 8px; }
    .log-level.error { background: #fee2e2; color: #dc2626; }
    .log-level.warn { background: #fef3c7; color: #d97706; }
    .log-level.info { background: #d1fae5; color: #059669; }
    .log-level.debug { background: #ede9fe; color: #7c3aed; }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--info), #0369a1);
      border: none;
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
    }
    .badge-port {
      background: linear-gradient(135deg, #6b7280, #4b5563);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge-status {
      padding: 8px 16px;
      border-radius: 25px;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .badge-status.running {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    .badge-status.stopped {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    }
    .btn-sm {
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 500;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-800);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .stat-card, .widget, .log-files-panel, .log-viewer-panel { animation: fadeInUp 0.4s ease forwards; }
    @media (max-width: 1200px) {
      .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
      .dashboard-widgets { grid-template-columns: 1fr; }
      .log-section { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .main-wrapper { margin-left: 0; }
      .dashboard-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <nav class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="fas fa-receipt"></i></div>
      <span class="sidebar-brand-text">MRA-EIS</span>
    </div>
    <div class="sidebar-nav">
      <div class="sidebar-section">
        <div class="sidebar-section-title">Main</div>
        <a href="/dashboard.html" class="sidebar-link"><i class="fas fa-chart-pie"></i> Dashboard</a>
        <a href="/html/reports.html" class="sidebar-link"><i class="fas fa-file-alt"></i> Reports</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Operations</div>
        <a href="/html/terminal-activation.html" class="sidebar-link"><i class="fas fa-terminal"></i> Terminal</a>
        <a href="/html/demo-invoice.html" class="sidebar-link"><i class="fas fa-file-invoice"></i> Demo Invoice</a>
        <a href="/html/inventory-form.html" class="sidebar-link"><i class="fas fa-boxes"></i> Inventory</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">System</div>
        <a href="/html/activation-history.html" class="sidebar-link"><i class="fas fa-history"></i> Activation History</a>
        <a href="#" class="sidebar-link active"><i class="fas fa-list"></i> Log Viewer</a>
      </div>
    </div>
  </nav>

  <div class="main-wrapper">
    <header class="top-header">
      <div class="header-title">
        <h1><i class="fas fa-th-large"></i> Log Viewer Dashboard</h1>
        <span class="subtitle">| System Monitoring & Diagnostics</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div id="systemStatus" class="badge-status stopped">
          <i class="fas fa-circle"></i>
          <span>Checking...</span>
        </div>
        <span class="badge-port"><i class="fas fa-server"></i> Port ${LOG_PORT}</span>
      </div>
    </header>

    <div class="main-content">
      <!-- Dashboard Stats Grid -->
      <div class="dashboard-grid">
        <div class="stat-card total">
          <div class="stat-card-trend"><i class="fas fa-chart-line"></i> 24h</div>
          <div class="stat-card-icon"><i class="fas fa-file-invoice"></i></div>
          <div class="stat-card-value" id="statTotal">-</div>
          <div class="stat-card-label">Total Invoices</div>
        </div>
        <div class="stat-card processed">
          <div class="stat-card-trend"><i class="fas fa-check"></i> Success</div>
          <div class="stat-card-icon"><i class="fas fa-check-circle"></i></div>
          <div class="stat-card-value" id="statProcessed">-</div>
          <div class="stat-card-label">MRA Submitted</div>
        </div>
        <div class="stat-card pending">
          <div class="stat-card-trend"><i class="fas fa-clock"></i> Waiting</div>
          <div class="stat-card-icon"><i class="fas fa-hourglass-half"></i></div>
          <div class="stat-card-value" id="statPending">-</div>
          <div class="stat-card-label">Pending (Sage)</div>
        </div>
        <div class="stat-card failed">
          <div class="stat-card-trend"><i class="fas fa-exclamation-triangle"></i> Error</div>
          <div class="stat-card-icon"><i class="fas fa-times-circle"></i></div>
          <div class="stat-card-value" id="statFailed">-</div>
          <div class="stat-card-label">Failed</div>
        </div>
      </div>
      
      <!-- Dashboard Widgets -->
      <div class="dashboard-widgets">
        <!-- Live Transactions Widget -->
        <div class="widget">
          <div class="widget-header">
            <div class="widget-title"><i class="fas fa-bolt"></i> Live Transaction Feed</div>
            <span class="live-badge"><i class="fas fa-circle"></i> LIVE</span>
          </div>
          <div class="transaction-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="transactionBody">
                <tr><td colspan="6" class="text-center" style="padding: 40px; color: var(--gray-500);"><i class="fas fa-spinner fa-spin"></i> Loading transactions...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Quick Stats Widget -->
        <div class="widget">
          <div class="widget-header">
            <div class="widget-title"><i class="fas fa-chart-pie"></i> System Overview</div>
          </div>
          <div id="logStats" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div style="background: #fee2e2; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 2rem; font-weight: 700; color: #dc2626;" id="errorFileCount">-</div>
              <div style="font-size: 0.85rem; color: #991b1b; font-weight: 500;">Error Files</div>
            </div>
            <div style="background: #dbeafe; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 2rem; font-weight: 700; color: #1e40af;" id="appFileCount">-</div>
              <div style="font-size: 0.85rem; color: #1e40af; font-weight: 500;">App Files</div>
            </div>
            <div style="background: #d1fae5; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 2rem; font-weight: 700; color: #065f46;" id="requestFileCount">-</div>
              <div style="font-size: 0.85rem; color: #065f46; font-weight: 500;">Request Files</div>
            </div>
            <div style="background: #f3e8ff; padding: 20px; border-radius: 12px; text-align: center;">
              <div style="font-size: 2rem; font-weight: 700; color: #6b21a8;" id="totalLogSize">-</div>
              <div style="font-size: 0.85rem; color: #6b21a8; font-weight: 500;">Total Size</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Log Files Section -->
      <div class="log-section">
        <div class="log-files-panel">
          <div class="widget-header">
            <div class="widget-title"><i class="fas fa-folder-open"></i> Log Files</div>
            <button class="btn btn-sm btn-primary" onclick="loadFileList()"><i class="fas fa-sync-alt"></i> Refresh</button>
          </div>
          
          <!-- Search Box -->
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" id="fileSearch" placeholder="Search log files..." onkeyup="filterFiles()">
          </div>
          
          <!-- Filter Tabs -->
          <div class="filter-tabs">
            <div class="filter-tab active" onclick="setFilter('all', this)">All</div>
            <div class="filter-tab" onclick="setFilter('error', this)">Error</div>
            <div class="filter-tab" onclick="setFilter('application', this)">App</div>
            <div class="filter-tab" onclick="setFilter('requests', this)">Requests</div>
          </div>
          
          <div id="fileList" class="log-files-grid"></div>
        </div>
        
        <div class="log-viewer-panel">
          <div class="widget-header">
            <div class="widget-title"><i class="fas fa-file-code"></i> <span id="currentFile">Select a log file</span></div>
            <div>
              <button class="btn btn-sm btn-secondary me-2" onclick="loadLines(100)">100</button>
              <button class="btn btn-sm btn-secondary me-2" onclick="loadLines(500)">500</button>
              <button class="btn btn-sm btn-secondary" onclick="loadLines(1000)">1000</button>
            </div>
          </div>
          <div id="logContent" class="log-content" style="min-height: 500px;">
            <p style="color: var(--gray-500); text-align: center; padding: 40px;"><i class="fas fa-file-alt"></i> Select a log file to view its contents</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentFile = null;
    let transactionInterval = null;
    let statusInterval = null;

    // Load system status
    async function loadSystemStatus() {
      try {
        const response = await fetch('/api/system-status');
        const data = await response.json();
        
        const statusEl = document.getElementById('systemStatus');
        if (data.running) {
          statusEl.className = 'badge-status running';
          statusEl.innerHTML = '<i class="fas fa-circle"></i><span>System Running</span>';
        } else {
          statusEl.className = 'badge-status stopped';
          statusEl.innerHTML = '<i class="fas fa-circle"></i><span>System Stopped</span>';
        }
      } catch (error) {
        const statusEl = document.getElementById('systemStatus');
        statusEl.className = 'badge-status stopped';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>System Offline</span>';
      }
    }

    // Auto-refresh system status every 5 seconds
    function startStatusMonitoring() {
      loadSystemStatus();
      statusInterval = setInterval(loadSystemStatus, 5000);
    }

    // Load real-time transactions
    async function loadTransactions() {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        
        // Update stats
        document.getElementById('statTotal').textContent = data.stats.TotalInvoices || 0;
        document.getElementById('statProcessed').textContent = data.stats.Processed || 0;
        document.getElementById('statPending').textContent = data.stats.Pending || 0;
        document.getElementById('statFailed').textContent = data.stats.Failed || 0;
        
        // Update transaction table
        const tbody = document.getElementById('transactionBody');
        if (data.transactions && data.transactions.length > 0) {
          tbody.innerHTML = data.transactions.map(t => {
            const statusClass = t.Status === 'PROCESSED' ? 'submitted' : t.Status === 'PENDING' ? 'pending' : 'failed';
            const statusIcon = t.Status === 'PROCESSED' ? 'check' : t.Status === 'PENDING' ? 'clock' : 'times';
            const statusText = t.Status === 'PROCESSED' ? 'Submitted' : t.Status === 'PENDING' ? 'Pending' : 'Failed';
            const date = t.InvoiceDateTime ? new Date(t.InvoiceDateTime).toLocaleString() : 'N/A';
            const total = t.InvoiceTotal ? 'MWK ' + parseFloat(t.InvoiceTotal).toFixed(2).replace(/\\d(?=(\\d{3})+\\.)/g, '$&,') : 'MWK 0.00';
            return '<tr>' +
              '<td style="font-weight: 600; color: var(--primary); font-family: monospace;">' + (t.InvoiceNumber || 'N/A') + '</td>' +
              '<td style="color: var(--gray-600);">' + date + '</td>' +
              '<td style="font-family: monospace;">' + (t.SellerTIN || 'N/A') + '</td>' +
              '<td>' + (t.BuyerName || t.BuyerTIN || 'N/A') + '</td>' +
              '<td style="font-weight: 600; font-family: monospace;">' + total + '</td>' +
              '<td><span class="status-badge ' + statusClass + '"><i class="fas fa-' + statusIcon + '"></i> ' + statusText + '</span></td>' +
            '</tr>';
          }).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 40px; color: var(--gray-500);"><i class="fas fa-inbox"></i> No transactions yet</td></tr>';
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionBody').innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 40px; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Error loading transactions</td></tr>';
      }
    }

    // Auto-refresh transactions every 5 seconds
    function startTransactionMonitoring() {
      loadTransactions();
      transactionInterval = setInterval(loadTransactions, 5000);
    }

    let allFiles = [];
    let currentFilter = 'all';

    async function loadFileList() {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        
        allFiles = data.files || [];
        
        // Update overview stats
        const errorCount = allFiles.filter(f => f.name.includes('error')).length;
        const appCount = allFiles.filter(f => f.name.includes('application')).length;
        const reqCount = allFiles.filter(f => f.name.includes('requests')).length;
        const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
        
        document.getElementById('errorFileCount').textContent = errorCount;
        document.getElementById('appFileCount').textContent = appCount;
        document.getElementById('requestFileCount').textContent = reqCount;
        document.getElementById('totalLogSize').textContent = formatSize(totalSize);
        
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
        
        return '<div class="log-file-card" data-filename="' + file.name + '" data-category="' + category + '" onclick="loadLogFile(\'' + file.name + '\', this)" style="animation: fadeInUp 0.3s ease forwards; animation-delay: ' + (index * 0.05) + 's; opacity: 0;">' +
          '<div class="log-file-header">' +
            '<div class="log-file-name"><i class="fas ' + icon + '"></i> ' + file.name + '</div>' +
            '<span class="log-file-badge ' + category + '">' + category + '</span>' +
          '</div>' +
          '<div class="log-file-meta">' +
            '<div class="log-file-meta-item"><i class="fas fa-weight-hanging"></i> ' + size + '</div>' +
            '<div class="log-file-meta-item"><i class="fas fa-clock"></i> ' + modifiedDate + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function loadLogFile(filename, element) {
      currentFile = filename;
      
      // Handle both manual click and auto-load
      if (element) {
        document.querySelectorAll('.log-file-card').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
      } else {
        // Auto-load: find and highlight the corresponding card
        document.querySelectorAll('.log-file-card').forEach(el => {
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
        const data = await response.json();

        const logContent = document.getElementById('logContent');
        
        if (!data.lines || data.lines.length === 0) {
          logContent.innerHTML = '<p class="text-muted">No log entries</p>';
          return;
        }

        let html = '';
        data.lines.forEach(line => {
          try {
            const parsed = JSON.parse(line);
            const level = parsed.level || 'info';
            const timestamp = parsed.timestamp || '';
            const message = parsed.message || '';
            const meta = Object.keys(parsed).filter(k => !['level', 'message', 'timestamp', 'service']).map(k => k + '=' + JSON.stringify(parsed[k])).join(' ');
            
            html += '<div class="log-line ' + level + '">';
            if (timestamp) html += '<span class="log-timestamp">[' + timestamp + ']</span> ';
            html += '[' + level.toUpperCase() + '] ' + message;
            if (meta) html += ' ' + meta;
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
    startTransactionMonitoring();
    startStatusMonitoring();
  </script>
</body>
</html>`);
});

app.listen(LOG_PORT, () => {
  console.log('Log Viewer Dashboard running on http://localhost:' + LOG_PORT);
  console.log('Logs directory: ' + LOG_DIR);
});

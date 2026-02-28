# MRA-EIS-System - Complete Page List

This document provides a complete listing of all pages and endpoints available in the MRA-EIS-System.

## Main Application (Port 5000)

### Pages

| URL | Description | File |
|-----|-------------|------|
| http://localhost:5000/ | Main Dashboard | dashboard.html |
| http://localhost:5000/dashboard.html | Dashboard (alternate) | dashboard.html |
| http://localhost:5000/index.html | Landing Page | index.html |
| http://localhost:5000/inventory-form.html | Inventory Form | inventory-form.html |
| http://localhost:5000/inventory-form | Inventory Form (short) | inventory-form.html |
| http://localhost:5000/activate-terminal | Terminal Activation | terminal-activation.html |
| http://localhost:5000/terminal-activation.html | Terminal Activation (alternate) | terminal-activation.html |
| http://localhost:5000/reports | Reports | reports.html |
| http://localhost:5000/reports.html | Reports (alternate) | reports.html |
| http://localhost:5000/demo-invoices | Demo Invoices | demo-invoice.html |
| http://localhost:5000/demo-invoice.html | Demo Invoices (alternate) | demo-invoice.html |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check |
| /api/invoices | GET, POST | Invoice operations |
| /api/invoices/:id | GET, PUT, DELETE | Single invoice operations |
| /api/inventory | GET, POST | Inventory operations |
| /api/inventory/:id | GET, PUT, DELETE | Single inventory operations |
| /api/terminal/activate | POST | Terminal activation |
| /api/terminal/status | GET | Terminal status |
| /api/terminal/activation-history | GET | Activation history |
| /api/reports/* | GET | Report data |
| /api/demo-invoices | GET, POST | Demo invoice operations |
| /api/products/search | GET | Product search |
| /api/utils/* | GET | Utility endpoints |

---

## Log Viewer (Port 5001)

The log viewer is a separate application that must be started independently.

### Start Command
```bash
npm run logs
# or
node log-viewer.js
```

### Pages

| URL | Description |
|-----|-------------|
| http://localhost:5001/ | Log Viewer Main Page |
| http://localhost:5001/api/logs | List all log files |
| http://localhost:5001/api/logs/:filename | Get specific log file content |

---

## File Structure

```
public/
├── index.html                    # Landing page
├── favicon.ico                   # Website icon
├── css/
│   └── modern.css               # Modern styling
├── js/
│   └── app.js                   # Frontend JavaScript
└── html/
    ├── dashboard.html            # Main dashboard
    ├── inventory-form.html       # Inventory management
    ├── terminal-activation.html  # Terminal activation
    ├── reports.html              # Reports page
    ├── demo-invoice.html         # Demo invoices
    └── activation-history.html   # Activation history
```

---

## Quick Reference

### Production URLs
- **Main System**: http://localhost:5000
- **Log Viewer**: http://localhost:5001 (run separately)

### Development
```bash
# Start main server
npm start

# Start log viewer (separate terminal)
npm run logs
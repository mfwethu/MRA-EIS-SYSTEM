# MRA Invoice System

## Overview

The MRA Invoice System is an enterprise Node.js application for managing invoices and inventory submissions to the Malawi Revenue Authority (MRA). It provides POS terminal activation, invoice creation/submission, inventory management, and reporting — all integrated with MRA's external API. The system uses a background job processor that runs every 5 minutes to submit pending invoices and inventory to MRA.

Key capabilities:
- **Terminal Activation**: Register POS terminals with MRA and store credentials locally
- **Invoice Management**: Create, save, and submit invoices with MRA-compliant invoice number generation (Base64-encoded Julian date format)
- **Inventory Management**: Upload product inventory to MRA in batches with barcode tracking
- **VAT Calculation**: Malawi's 17.5% VAT rate applied across all calculations
- **Background Processing**: Automatic submission of pending invoices and inventory every 5 minutes
- **Reporting**: Dashboard with summary statistics, submission history, and failure tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend (Node.js + Express)

The application follows an MVC-like layered architecture:

- **Entry Point**: `server.js` — starts the Express server and the background invoice processor job
- **App Setup**: `src/app.js` — configures Express middleware (Helmet, CORS, body parsing, rate limiting, request logging) and mounts routes
- **Routes** (`src/routes/`): Define API endpoints for terminal, invoices, inventory, reports, and utility functions
- **Controllers** (`src/controllers/`): Handle HTTP request/response logic, delegate to services and models
- **Services** (`src/services/`): Business logic layer — handles MRA API communication, invoice submission workflows, inventory batch processing
- **Models** (`src/models/`): Data access layer using parameterized SQL queries against SQL Server (mssql package)
- **Middlewares** (`src/middlewares/`): Auth (JWT + terminal verification), rate limiting (custom in-memory), request logging (Morgan + Winston), input validation (express-validator), error handling
- **Utils** (`src/utils/`): Shared utilities — logger (Winston), Base64 converter, invoice number generator (Julian date-based), VAT calculator, terminal state management
- **Jobs** (`src/jobs/`): Background processor that periodically submits pending invoices and inventory to MRA

### Database (SQL Server / MSSQL)

- Uses the `mssql` npm package (v9) with connection pooling
- Database: `MRA_InvoiceDB` on SQL Server
- Key tables: `InvoiceHeader`, `InvoiceLineItems`, `ProcessedInvoices`, `InventoryUpload`, `SubmittedInventory`, `FailedInvoiceSubmissions`, `FailedInventorySubmissions`, `InvoiceProcessingHistory`
- Schema defined in `database/schema.sql`
- Configuration in `src/config/database.js` with environment variable overrides
- **Important**: This project was built for SQL Server (MSSQL). If adapting to a different database, all raw SQL queries in models and inline route handlers need to be updated. The queries use MSSQL-specific syntax (e.g., `OUTPUT INSERTED.*`, `@paramName` parameter syntax).

### Frontend

- Server-rendered HTML pages served from `public/html/`
- Static JavaScript in `public/js/app.js` — single-page-app-like behavior using fetch API calls
- Pages: Dashboard, Terminal Activation, Inventory Form, Index/Navigation
- Bootstrap 5 + Font Awesome for styling
- No frontend build step — plain HTML/CSS/JS

### Terminal Credential Storage

- Terminal credentials (JWT token, secret key, terminal ID, configuration versions) are stored as a JSON file on disk at `./data/terminal-creds.json`
- Managed by `src/utils/terminalState.js` — read/write/clear operations
- This is a deliberate design choice for simplicity; credentials persist across restarts without requiring database access

### Invoice Number Generation

- Follows MRA specification: `Base64(TaxpayerID)-Base64(TerminalPosition)-Base64(JulianDate)-Base64(Count)`
- Uses custom Base64 encoding (not standard base64) defined in `src/utils/base64Converter.js`
- Julian date calculation converts Gregorian dates to astronomical Julian day numbers

### Background Job Processing

- `src/jobs/invoiceProcessor.js` runs on a 5-minute interval
- Processes both pending invoices and pending inventory
- Requires terminal activation before processing can occur
- Failed submissions are recorded in dedicated failure tables for retry/audit

### Security

- Helmet for HTTP security headers
- CORS configuration via environment variables
- Custom in-memory rate limiting (100 req/min API, 5 req/min auth, 10 req/min uploads)
- JWT verification middleware for protected routes
- Terminal activation verification middleware
- Input validation with express-validator
- Parameterized SQL queries to prevent injection

### API Structure

All API routes are prefixed with `/api`:
- `POST /api/terminal/activate` — Activate terminal with MRA
- `GET /api/terminal/status` — Check terminal activation status
- `POST /api/invoices/submit` — Submit invoice to MRA
- `POST /api/invoices/save` — Save invoice locally (pending)
- `GET /api/invoices/pending` — List pending invoices
- `GET /api/invoices/processed` — List processed invoices
- `POST /api/inventory/upload` — Upload inventory to MRA
- `POST /api/inventory/save` — Save inventory locally
- `GET /api/inventory/pending` — List pending inventory
- `GET /api/reports/summary` — Dashboard summary statistics
- `POST /api/utils/calculate-vat` — VAT calculation utility
- `GET /health` — Health check endpoint

HTML pages served at:
- `/` — Main dashboard
- `/inventory-form` — Inventory management form
- `/activate-terminal` — Terminal activation page

## External Dependencies

### MRA API Integration
- Base URL configured via `MRA_API_BASE_URL` environment variable
- Axios HTTP client with request/response interceptors (`src/config/mraApi.js`)
- Endpoints used: `/onboarding/activate-terminal`, `/utilities/taxpayer-initial-inventory-upload`, invoice submission endpoints
- Authentication via Bearer JWT token obtained during terminal activation
- Timeout configurable via `MRA_API_TIMEOUT` (default 30 seconds)

### Database
- **SQL Server** (MSSQL) via the `mssql` npm package
- Connection configured through environment variables: `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Connection pooling: min 2, max 20 connections (configurable via `DB_POOL_MIN`, `DB_POOL_MAX`)

### Key NPM Packages
- `express` (v4) — Web framework
- `mssql` (v9) — SQL Server driver
- `axios` (v1.4) — HTTP client for MRA API
- `winston` (v3) — Logging
- `morgan` — HTTP request logging
- `helmet` (v7) — Security headers
- `jsonwebtoken` (v9) — JWT handling
- `bcryptjs` — Password hashing
- `express-validator` (v7) — Input validation
- `uuid` (v9) — UUID generation
- `dotenv` — Environment variable loading
- `compression` — Response compression
- `cors` — Cross-origin resource sharing

### Environment Variables Required
- `PORT` — Server port (default: 5000)
- `NODE_ENV` — Environment (development/production)
- `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — Database connection
- `MRA_API_BASE_URL` — MRA API endpoint
- `MRA_API_TIMEOUT` — API timeout in ms
- `JWT_SECRET` — Secret for JWT verification
- `CORS_ORIGIN` — Allowed CORS origins
- `LOG_LEVEL`, `LOG_DIR` — Logging configuration
- `TERMINAL_STORAGE_PATH` — Path for terminal credentials file
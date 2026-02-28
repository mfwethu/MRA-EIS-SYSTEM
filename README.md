# MRA Invoice System

A comprehensive Node.js enterprise application for managing invoices and inventory submissions to the Malawi Revenue Authority (MRA) system.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Error Handling](#error-handling)
- [Security](#security)

## Features

✅ **Terminal Activation**
- Activate POS terminals with MRA
- Store and manage terminal credentials
- Support for multiple terminal configurations

✅ **Invoice Management**
- Create and submit invoices to MRA
- Invoice number generation following MRA specifications
- Tax calculation and breakdown
- Pending/Processed invoice tracking
- Full audit trail

✅ **Inventory Management**
- Upload initial inventory to MRA
- Barcode tracking
- Stock level management
- Batch processing support

✅ **Reporting**
- Comprehensive reporting dashboards
- Invoice submission reports
- Inventory upload reports
- Summary statistics

✅ **Security**
- JWT token-based authentication
- Rate limiting
- Input validation
- SQL injection prevention
- Helmet security headers

✅ **Audit & Compliance**
- Complete audit logging
- Transaction status tracking
- MRA response storage
- Compliance reporting

## Prerequisites

- **Node.js** v16.0.0 or higher
- **SQL Server** 2019 or later
- **npm** v8.0.0 or higher
- Git (for version control)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mfwethu/mra-invoice-system.git
cd mra-invoice-system
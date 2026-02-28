const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'server.js',
  'package.json',
  '.env.example',
  'src/app.js',
  'src/config/database.js',
  'src/config/mraApi.js',
  'src/middlewares/auth.js',
  'src/middlewares/errorHandler.js',
  'src/middlewares/requestLogger.js',
  'src/middlewares/rateLimiter.js',
  'src/middlewares/validation.js',
  'src/utils/logger.js',
  'src/utils/base64Converter.js',
  'src/utils/invoiceNumberGenerator.js',
  'src/utils/terminalState.js',
  'src/routes/terminal.js',
  'src/routes/invoices.js',
  'src/routes/inventory.js',
  'src/routes/reports.js',
  'src/routes/inventoryForm.js',
  'src/controllers/terminalController.js',
  'src/controllers/invoiceController.js',
  'src/controllers/inventoryController.js',
  'src/controllers/reportController.js',
  'src/models/invoiceModel.js',
  'src/models/inventoryModel.js',
  'src/services/mraTerminalService.js',
  'src/services/mraInvoiceService.js',
  'src/services/mraInventoryService.js',
  'public/html/index.html',
  'public/html/inventory-form.html',
  'public/js/app.js',
  'database/schema.sql'
];

console.log('=== MRA Invoice System - File Check ===\n');

let missing = [];
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`✗ ${file} - MISSING`);
    missing.push(file);
  }
});

console.log(`\n${requiredFiles.length - missing.length}/${requiredFiles.length} files present`);

if (missing.length > 0) {
  console.log('\nMissing files:');
  missing.forEach(file => console.log(`  - ${file}`));
  process.exit(1);
} else {
  console.log('\n✅ All files present!');
  process.exit(0);
}
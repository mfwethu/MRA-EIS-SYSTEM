/**
 * Diagnostic script to check log viewer issues
 */
require('dotenv').config();
const http = require('http');

const LOG_VIEWER_PORT = process.env.LOG_VIEWER_PORT || 5001;
const MAIN_SERVER_PORT = process.env.SERVER_PORT || 5000;

console.log('=== Log Viewer Diagnostics ===\n');

function testEndpoint(port, path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: true, statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ success: true, statusCode: res.statusCode, data: data.substring(0, 200) });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, error: 'TIMEOUT' });
    });
  });
}

async function runDiagnostics() {
  // Test system status
  console.log('1. Testing /api/system-status...');
  const systemStatus = await testEndpoint(LOG_VIEWER_PORT, '/api/system-status');
  console.log(JSON.stringify(systemStatus, null, 2));

  // Test logs endpoint
  console.log('\n2. Testing /api/logs...');
  const logs = await testEndpoint(LOG_VIEWER_PORT, '/api/logs');
  console.log('Success:', logs.success);
  if (logs.success && logs.data.files) {
    console.log('Log files count:', logs.data.files.length);
  }
  if (!logs.success) {
    console.log('Error:', logs.error);
  }

  // Test transactions endpoint
  console.log('\n3. Testing /api/transactions...');
  const transactions = await testEndpoint(LOG_VIEWER_PORT, '/api/transactions');
  console.log('Success:', transactions.success);
  if (transactions.success) {
    console.log('Data:', JSON.stringify(transactions.data).substring(0, 500));
  } else {
    console.log('Error:', transactions.error);
  }
  
  console.log('\n=== Done ===');
}

runDiagnostics();

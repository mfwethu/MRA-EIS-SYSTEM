require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourPassword123!',
  database: process.env.DB_NAME || 'MRA_InvoiceDB',
  authentication: {
    type: 'default'
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectTimeout: 30000
  }
};

console.log('\n=== Database Connection Test ===\n');
console.log('Configuration:');
console.log(`  Server: ${config.server}:${config.port}`);
console.log(`  User: ${config.user}`);
console.log(`  Database: ${config.database}`);
console.log(`  Encrypt: ${config.options.encrypt}`);
console.log('');

async function testConnection() {
  try {
    console.log('Attempting to connect...\n');
    const pool = new sql.ConnectionPool(config);
    
    await pool.connect();
    console.log('✅ SUCCESS: Connected to database!\n');
    
    // Test query
    const result = await pool.request().query('SELECT @@VERSION as Version');
    console.log('SQL Server Version:');
    console.log(result.recordset[0].Version);
    console.log('');
    
    // List databases
    const dbResult = await pool.request().query('SELECT name FROM sys.databases');
    console.log('Available Databases:');
    dbResult.recordset.forEach(db => console.log(`  - ${db.name}`));
    console.log('');
    
    await pool.close();
    console.log('Connection test completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR: Failed to connect to database');
    console.error('\nError Details:');
    console.error(`  Message: ${err.message}`);
    console.error(`  Code: ${err.code}`);
    console.error('\nTroubleshooting Steps:');
    console.error('  1. Verify SQL Server is running');
    console.error('  2. Check username and password in .env file');
    console.error('  3. Verify database exists');
    console.error('  4. Check .env file is in root directory');
    console.error('');
    process.exit(1);
  }
}

testConnection();
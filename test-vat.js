const { calculateLineVAT, calculateInvoiceTotals, calculateVATFromTotal, VAT_RATE } = require('./src/utils/vatCalculator');

console.log('=== MRA VAT CALCULATION TEST (17.5%) ===\n');

// Test 1: Single line item
console.log('Test 1: Single Line Item');
const lineCalc = calculateLineVAT(1000, 1, 0);
console.log('Input: unitPrice=1000, quantity=1, discount=0');
console.log(`Output:`, lineCalc);
console.log(`Verification: ${lineCalc.baseAmount} + ${lineCalc.vatAmount} = ${lineCalc.baseAmount + lineCalc.vatAmount}`);
console.log('');

// Test 2: Multiple line items
console.log('Test 2: Multiple Line Items');
const items = [
  { total: 1000 },
  { total: 2000 },
  { total: 500 }
];
const invoiceCalc = calculateInvoiceTotals(items);
console.log('Items: [1000, 2000, 500]');
console.log(`Output:`, invoiceCalc);
console.log('');

// Test 3: Reverse calculation
console.log('Test 3: Reverse Calculation (from total)');
const reverseCalc = calculateVATFromTotal(1175);
console.log('Input: totalAmount=1175');
console.log(`Output:`, reverseCalc);
console.log('');

// Test 4: Real-world example
console.log('Test 4: Real-world Invoice');
const realItems = [
  { total: 250000 }, // CONSULTANCY SERVICES
  { total: 150000 }  // Another service
];
const realInvoice = calculateInvoiceTotals(realItems);
console.log('Items: [250000, 150000]');
console.log(`Output:`, realInvoice);
console.log('');

console.log('=== FORMULA ===');
console.log(`VAT Rate: ${VAT_RATE * 100}%`);
console.log('Taxable Amount = Total ÷ 1.175');
console.log('VAT Amount = Total - Taxable Amount');
console.log('Verification: Taxable + VAT = Total');
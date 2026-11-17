const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getFinancialYear, generateGSTR1PDF } = require('../../src/services/gstPdfService');

describe('GSTR-1 Financial Year Calculation Unit Tests', () => {
  it('correctly calculates financial year for dates from April to December', () => {
    // April 1, 2026 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2026-04-01'), '2026 - 2027');
    // August 15, 2026 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2026-08-15'), '2026 - 2027');
    // December 31, 2026 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2026-12-31'), '2026 - 2027');
  });

  it('correctly calculates financial year for dates from January to March', () => {
    // January 15, 2027 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2027-01-15'), '2026 - 2027');
    // February 28, 2027 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2027-02-28'), '2026 - 2027');
    // March 31, 2027 -> 2026 - 2027
    assert.strictEqual(getFinancialYear('2027-03-31'), '2026 - 2027');
    // March 10, 2024 -> 2023 - 2024
    assert.strictEqual(getFinancialYear('2024-03-10'), '2023 - 2024');
  });

  it('generates a valid GSTR-1 PDF buffer using calculated dynamic financial year', async () => {
    const mockBill = {
      billNo: 501,
      date: new Date('2026-10-15'),
      companyName: 'Test Seafood Exporter',
      companyGstin: '37ABCDE1234F1Z5',
      taxableValue: 10000,
      total: 10000,
      grandTotal: 10500,
      cgstAmount: 250,
      sgstAmount: 250,
      igstAmount: 0,
      isVoided: false,
    };

    const pdfBuffer = await generateGSTR1PDF({
      bills: [mockBill],
      dateRange: { start: '2026-10-01', end: '2026-10-31', label: 'Oct 2026' },
      settings: { businessName: 'VIJAYA DURGA SEA FOODS' },
    });

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Must return a Node.js Buffer');
    assert.ok(pdfBuffer.length > 1000, 'PDF buffer should be non-empty and well-formed');
    // PDF Magic Header check
    assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
  });
});

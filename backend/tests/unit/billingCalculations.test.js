const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  round2,
  calculateVerifiedBillTotals,
  calculateGstFromRates,
} = require('../../src/utils/billingCalculations');

describe('Financial Calculation Unit Tests', () => {
  describe('round2() precision tests', () => {
    it('correctly rounds standard decimal numbers to 2 decimal places', () => {
      assert.strictEqual(round2(100.456), 100.46);
      assert.strictEqual(round2(100.454), 100.45);
      assert.strictEqual(round2(100.455), 100.46);
      assert.strictEqual(round2(0), 0);
    });

    it('resolves floating-point precision quirks (e.g. 0.1 + 0.2)', () => {
      const sum = 0.1 + 0.2; // 0.30000000000000004 in raw IEEE 754
      assert.strictEqual(round2(sum), 0.3);
      assert.strictEqual(round2(1.005), 1.01);
    });

    it('handles string numeric inputs gracefully', () => {
      assert.strictEqual(round2('1250.75'), 1250.75);
      assert.strictEqual(round2('invalid'), 0);
    });
  });

  describe('calculateVerifiedBillTotals() logic tests', () => {
    it('calculates single line item total correctly', () => {
      const items = [
        {
          particulars: 'Tiger Prawns (Black Tiger)',
          hsn: '0306',
          quantity: 50,
          rate: 420,
        },
      ];

      const result = calculateVerifiedBillTotals(items);
      assert.strictEqual(result.subtotal, 21000);
      assert.strictEqual(result.cgstAmount, 0);
      assert.strictEqual(result.sgstAmount, 0);
      assert.strictEqual(result.igstAmount, 0);
      assert.strictEqual(result.grandTotal, 21000);
      assert.strictEqual(result.processedItems.length, 1);
      assert.strictEqual(result.processedItems[0].amount, 21000);
    });

    it('calculates multi-item invoice with fractional weights and rates correctly', () => {
      const items = [
        { particulars: 'Vannamei Prawns 30 Count', hsn: '0306', quantity: 184.65, rate: 385.50 },
        { particulars: 'Vannamei Prawns 40 Count', hsn: '0306', quantity: 92.40, rate: 340.25 },
        { particulars: 'Sea White Prawns', hsn: '0306', quantity: 14.80, rate: 610.75 },
      ];

      // Item 1: 184.65 * 385.50 = 71182.575 -> 71182.58
      // Item 2: 92.40 * 340.25 = 31439.10
      // Item 3: 14.80 * 610.75 = 9039.10
      // Subtotal = 71182.58 + 31439.10 + 9039.10 = 111660.78
      const result = calculateVerifiedBillTotals(items);
      assert.strictEqual(result.processedItems[0].amount, 71182.58);
      assert.strictEqual(result.processedItems[1].amount, 31439.10);
      assert.strictEqual(result.processedItems[2].amount, 9039.10);
      assert.strictEqual(result.subtotal, 111660.78);
      assert.strictEqual(result.grandTotal, 111660.78);
    });

    it('calculates intra-state GST (CGST + SGST) accurately', () => {
      const items = [
        { particulars: 'Frozen Prawns Grade A', hsn: '0306', quantity: 100, rate: 500 },
      ];
      // Subtotal: 50,000
      // CGST (2.5%): 1,250
      // SGST (2.5%): 1,250
      // Grand Total: 52,500
      const result = calculateVerifiedBillTotals(items, 1250, 1250, 0);
      assert.strictEqual(result.subtotal, 50000);
      assert.strictEqual(result.cgstAmount, 1250);
      assert.strictEqual(result.sgstAmount, 1250);
      assert.strictEqual(result.igstAmount, 0);
      assert.strictEqual(result.grandTotal, 52500);
    });

    it('calculates inter-state GST (IGST) accurately', () => {
      const items = [
        { particulars: 'Export Quality Prawns', hsn: '0306', quantity: 200, rate: 450 },
      ];
      // Subtotal: 90,000
      // IGST (5%): 4,500
      // Grand Total: 94,500
      const result = calculateVerifiedBillTotals(items, 0, 0, 4500);
      assert.strictEqual(result.subtotal, 90000);
      assert.strictEqual(result.cgstAmount, 0);
      assert.strictEqual(result.sgstAmount, 0);
      assert.strictEqual(result.igstAmount, 4500);
      assert.strictEqual(result.grandTotal, 94500);
    });

    it('rejects empty line items array', () => {
      assert.throws(() => {
        calculateVerifiedBillTotals([]);
      }, /At least one line item is required/);
    });

    it('rejects items with zero or negative quantity', () => {
      assert.throws(() => {
        calculateVerifiedBillTotals([{ particulars: 'Item A', quantity: 0, rate: 100 }]);
      }, /must have quantity > 0/);

      assert.throws(() => {
        calculateVerifiedBillTotals([{ particulars: 'Item B', quantity: -5, rate: 100 }]);
      }, /must have quantity > 0/);
    });

    it('rejects items with zero or negative rate', () => {
      assert.throws(() => {
        calculateVerifiedBillTotals([{ particulars: 'Item A', quantity: 10, rate: 0 }]);
      }, /must have quantity > 0 and rate > 0/);

      assert.throws(() => {
        calculateVerifiedBillTotals([{ particulars: 'Item B', quantity: 10, rate: -250 }]);
      }, /must have quantity > 0 and rate > 0/);
    });

    it('fills default particulars and HSN when omitted', () => {
      const items = [{ quantity: 10, rate: 100 }];
      const result = calculateVerifiedBillTotals(items);
      assert.strictEqual(result.processedItems[0].particulars, 'Fresh Seafood / Prawns Supply');
      assert.strictEqual(result.processedItems[0].hsn, '0306');
    });
  });

  describe('calculateGstFromRates() tax computation', () => {
    it('computes 5% GST (2.5% CGST + 2.5% SGST) correctly', () => {
      const { cgstAmount, sgstAmount, igstAmount, totalTax } = calculateGstFromRates(10000, 2.5, 2.5, 0);
      assert.strictEqual(cgstAmount, 250);
      assert.strictEqual(sgstAmount, 250);
      assert.strictEqual(igstAmount, 0);
      assert.strictEqual(totalTax, 500);
    });

    it('computes 5% IGST correctly for inter-state transactions', () => {
      const { cgstAmount, sgstAmount, igstAmount, totalTax } = calculateGstFromRates(10000, 0, 0, 5);
      assert.strictEqual(cgstAmount, 0);
      assert.strictEqual(sgstAmount, 0);
      assert.strictEqual(igstAmount, 500);
      assert.strictEqual(totalTax, 500);
    });

    it('handles rounding on odd taxable amounts', () => {
      // 33333.33 * 0.025 = 833.33325 -> 833.33
      const { cgstAmount, sgstAmount, totalTax } = calculateGstFromRates(33333.33, 2.5, 2.5, 0);
      assert.strictEqual(cgstAmount, 833.33);
      assert.strictEqual(sgstAmount, 833.33);
      assert.strictEqual(totalTax, 1666.66);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  round2,
  calculateItemAmount,
  calculateCrateTare,
  calculateTaxSplit,
  calculateBillTotals,
  restoreDraft,
  serializeDraft,
} from './billingCalculations';

describe('Frontend Billing Calculations Unit Tests (Vitest)', () => {
  describe('round2 & calculateItemAmount', () => {
    it('rounds floating point numbers accurately with 2 decimal places', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(round2(10.555)).toBe(10.56);
      expect(round2(10.554)).toBe(10.55);
      expect(round2('125.456')).toBe(125.46);
      expect(round2(null)).toBe(0);
      expect(round2(undefined)).toBe(0);
    });

    it('calculates item amount correctly from quantity and rate', () => {
      expect(calculateItemAmount(120.5, 450)).toBe(54225);
      expect(calculateItemAmount('85.25', '380.50')).toBe(32437.63);
      expect(calculateItemAmount(0, 500)).toBe(0);
      expect(calculateItemAmount(100, 0)).toBe(0);
    });
  });

  describe('calculateCrateTare', () => {
    it('accurately deducts standard crate tare (2.5 kg/crate) from gross weight', () => {
      // 10 plastic crates @ 2.5 kg = 25 kg tare
      const result = calculateCrateTare(250.0, 10, 2.5);
      expect(result.grossWeight).toBe(250.0);
      expect(result.tareWeight).toBe(25.0);
      expect(result.netWeight).toBe(225.0);
    });

    it('supports custom crate tare weight values', () => {
      // 15 crates @ 1.8 kg = 27 kg tare
      const result = calculateCrateTare(500.0, 15, 1.8);
      expect(result.grossWeight).toBe(500.0);
      expect(result.tareWeight).toBe(27.0);
      expect(result.netWeight).toBe(473.0);
    });

    it('clamps net weight to 0 if tare weight exceeds gross weight', () => {
      const result = calculateCrateTare(20.0, 10, 2.5); // tare = 25 kg > 20 kg
      expect(result.grossWeight).toBe(20.0);
      expect(result.tareWeight).toBe(25.0);
      expect(result.netWeight).toBe(0);
    });

    it('handles string inputs and zero crates safely', () => {
      const result = calculateCrateTare('150.75', '0');
      expect(result.grossWeight).toBe(150.75);
      expect(result.tareWeight).toBe(0);
      expect(result.netWeight).toBe(150.75);
    });
  });

  describe('calculateTaxSplit', () => {
    it('calculates intra-state 5% GST (2.5% CGST + 2.5% SGST) for Andhra Pradesh', () => {
      const result = calculateTaxSplit(100000, {
        isInterstate: false,
        cgstRate: 2.5,
        sgstRate: 2.5,
      });

      expect(result.taxableAmount).toBe(100000);
      expect(result.cgstAmount).toBe(2500);
      expect(result.sgstAmount).toBe(2500);
      expect(result.igstAmount).toBe(0);
      expect(result.totalTax).toBe(5000);
    });

    it('calculates inter-state 5% IGST for non-AP buyers', () => {
      const result = calculateTaxSplit(100000, {
        isInterstate: true,
        igstRate: 5,
      });

      expect(result.taxableAmount).toBe(100000);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.igstAmount).toBe(5000);
      expect(result.totalTax).toBe(5000);
    });

    it('handles odd taxable amounts with correct 2-decimal rounding', () => {
      const result = calculateTaxSplit(379476.55, {
        isInterstate: false,
        cgstRate: 2.5,
        sgstRate: 2.5,
      });

      expect(result.cgstAmount).toBe(9486.91);
      expect(result.sgstAmount).toBe(9486.91);
      expect(result.totalTax).toBe(18973.82);
    });
  });

  describe('calculateBillTotals', () => {
    it('aggregates multiple line items, optional ice, and tax into grand total', () => {
      const items = [
        { quantity: 150.5, rate: 420, amount: 63210 },
        { quantity: 80.25, rate: 380, amount: 30495 },
      ];
      const ice = { quantity: 10, rate: 120 }; // 10 blocks * 120 = 1200
      const cgstAmount = 2367.63;
      const sgstAmount = 2367.63;

      const totals = calculateBillTotals({
        items,
        ice,
        cgstAmount,
        sgstAmount,
      });

      expect(totals.itemsSubtotal).toBe(93705);
      expect(totals.iceAmount).toBe(1200);
      expect(totals.iceQuantityNum).toBe(10);
      expect(totals.iceRateNum).toBe(120);
      expect(totals.hasIce).toBe(true);
      expect(totals.subtotal).toBe(94905); // 93705 + 1200
      expect(totals.totalTax).toBe(4735.26); // 2367.63 * 2
      expect(totals.grandTotal).toBe(99640.26); // 94905 + 4735.26
      expect(totals.totalWeight).toBe(230.75); // 150.5 + 80.25
    });

    it('handles empty items and zero ice gracefully', () => {
      const totals = calculateBillTotals({ items: [], ice: null });
      expect(totals.itemsSubtotal).toBe(0);
      expect(totals.iceAmount).toBe(0);
      expect(totals.iceQuantityNum).toBe(0);
      expect(totals.iceRateNum).toBe(0);
      expect(totals.hasIce).toBe(false);
      expect(totals.subtotal).toBe(0);
      expect(totals.totalTax).toBe(0);
      expect(totals.grandTotal).toBe(0);
      expect(totals.totalWeight).toBe(0);
    });
  });

  describe('restoreDraft & serializeDraft', () => {
    it('returns null on invalid, empty, or corrupt draft json', () => {
      expect(restoreDraft(null)).toBe(null);
      expect(restoreDraft('')).toBe(null);
      expect(restoreDraft('{ invalid-json }')).toBe(null);
      expect(restoreDraft(JSON.stringify({}))).toBe(null);
      expect(restoreDraft(JSON.stringify({ companyName: '', items: [] }))).toBe(null);
    });

    it('correctly restores valid draft with company name and items', () => {
      const mockDraft = {
        companyName: 'Sri Venkateswara Sea Foods',
        customerPhone: '9848012345',
        vehicleNo: 'AP39TE1234',
        paymentStatus: 'Pending',
        items: [
          { count: '30', particulars: 'HEAD-ON', quantity: '120.5', rate: '450' }
        ],
        ice: { quantity: '5', rate: '100' },
        cgstRate: '2.5',
        sgstRate: '2.5',
      };

      const restored = restoreDraft(JSON.stringify(mockDraft));
      expect(restored).not.toBe(null);
      expect(restored.companyName).toBe('Sri Venkateswara Sea Foods');
      expect(restored.customerPhone).toBe('9848012345');
      expect(restored.vehicleNo).toBe('AP39TE1234');
      expect(restored.items.length).toBe(1);
      expect(restored.items[0].amount).toBe(54225); // 120.5 * 450
      expect(restored.ice.quantity).toBe('5');
    });

    it('serializes and roundtrips draft form state cleanly', () => {
      const formState = {
        companyName: 'Ocean Catch Exports',
        customerPhone: '9123456789',
        vehicleNo: 'AP16XY9999',
        items: [{ sno: 1, count: '40', quantity: '200', rate: '350', amount: 70000 }],
        ice: { quantity: '2', rate: '150' },
      };

      const serialized = serializeDraft(formState);
      const parsed = restoreDraft(serialized);

      expect(parsed.companyName).toBe(formState.companyName);
      expect(parsed.customerPhone).toBe(formState.customerPhone);
      expect(parsed.items[0].amount).toBe(70000);
    });
  });
});

/**
 * Financial calculation logic for SRSF Billing System
 * Handles item totals, subtotals, GST tax breakdown, and grand totals with exact 2-decimal rounding.
 */

/**
 * Rounds a number to exactly 2 decimal places, avoiding floating point inaccuracies.
 * @param {number} val
 * @returns {number}
 */
function round2(val) {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item amounts, subtotal, taxes, and grand total.
 * Validates that all items have positive quantity and rate.
 *
 * @param {Array} items Array of item objects { quantity, rate, particulars, hsn, taxRate }
 * @param {number|string} [cgstAmount=0] Optional CGST amount override
 * @param {number|string} [sgstAmount=0] Optional SGST amount override
 * @param {number|string} [igstAmount=0] Optional IGST amount override
 * @returns {Object} { processedItems, subtotal, cgstAmount, sgstAmount, igstAmount, grandTotal }
 */
function calculateVerifiedBillTotals(items, cgstAmount = 0, sgstAmount = 0, igstAmount = 0) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one line item is required');
  }

  const processedItems = items.map((it, idx) => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.rate) || 0;
    if (q <= 0 || r <= 0) {
      throw new Error(`Item #${idx + 1} (${it.particulars || 'Item'}) must have quantity > 0 and rate > 0`);
    }
    const itemAmt = round2(q * r);
    return {
      sno: idx + 1,
      count: it.count ? String(it.count).trim() : '',
      particulars: it.particulars?.trim() || 'HEAD-ON',
      hsn: it.hsn?.trim() || '0306',
      quantity: q,
      rate: r,
      taxRate: it.taxRate || '',
      amount: itemAmt,
    };
  });

  const subtotal = round2(processedItems.reduce((sum, item) => sum + item.amount, 0));
  const numCgst = round2(cgstAmount);
  const numSgst = round2(sgstAmount);
  const numIgst = round2(igstAmount);

  const grandTotal = round2(subtotal + numCgst + numSgst + numIgst);

  return {
    processedItems,
    subtotal,
    cgstAmount: numCgst,
    sgstAmount: numSgst,
    igstAmount: numIgst,
    grandTotal,
  };
}

/**
 * Computes GST tax amounts based on percentage rates.
 * Intra-state: CGST + SGST (split equally, e.g. 2.5% + 2.5% = 5%)
 * Inter-state: IGST (e.g. 5%)
 *
 * @param {number} taxableValue
 * @param {number} cgstRate Percentage (e.g. 2.5)
 * @param {number} sgstRate Percentage (e.g. 2.5)
 * @param {number} igstRate Percentage (e.g. 5)
 * @returns {Object} { cgstAmount, sgstAmount, igstAmount, totalTax }
 */
function calculateGstFromRates(taxableValue, cgstRate = 0, sgstRate = 0, igstRate = 0) {
  const taxable = round2(taxableValue);
  const cgstAmount = cgstRate > 0 ? round2(taxable * (cgstRate / 100)) : 0;
  const sgstAmount = sgstRate > 0 ? round2(taxable * (sgstRate / 100)) : 0;
  const igstAmount = igstRate > 0 ? round2(taxable * (igstRate / 100)) : 0;
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount);

  return {
    taxableValue: taxable,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
  };
}

module.exports = {
  round2,
  calculateVerifiedBillTotals,
  calculateGstFromRates,
};

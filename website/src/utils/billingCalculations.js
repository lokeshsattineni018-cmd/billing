/**
 * Frontend Billing Calculation Utilities for SRSF Billing System
 * Encapsulates exact financial rounding, crate/bag tare deduction, GST tax split,
 * bill summary totals, and draft restore/serialization logic.
 */

/**
 * Rounds a number to exactly 2 decimal places with epsilon correction.
 * @param {number|string} val
 * @returns {number}
 */
export function round2(val) {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates line item total amount from quantity (weight in kg) and rate per kg.
 * @param {number|string} quantity
 * @param {number|string} rate
 * @returns {number}
 */
export function calculateItemAmount(quantity, rate) {
  const q = typeof quantity === 'number' ? quantity : parseFloat(quantity) || 0;
  const r = typeof rate === 'number' ? rate : parseFloat(rate) || 0;
  return round2(q * r);
}

/**
 * Calculates crate/bag tare deduction from gross weight.
 * Default tare per plastic crate in Indian seafood markets is 2.5 kg.
 * @param {number|string} grossWeight - Total gross weight with crates
 * @param {number|string} crateCount - Number of crates
 * @param {number|string} [tarePerCrate=2.5] - Tare weight per crate in kg
 * @returns {{ grossWeight: number, tareWeight: number, netWeight: number }}
 */
export function calculateCrateTare(grossWeight, crateCount, tarePerCrate = 2.5) {
  const gross = typeof grossWeight === 'number' ? grossWeight : parseFloat(grossWeight) || 0;
  const count = typeof crateCount === 'number' ? crateCount : parseFloat(crateCount) || 0;
  const tarePer = typeof tarePerCrate === 'number' ? tarePerCrate : parseFloat(tarePerCrate) || 0;

  const tareWeight = round2(count * tarePer);
  const netWeight = Math.max(0, round2(gross - tareWeight));

  return {
    grossWeight: round2(gross),
    tareWeight,
    netWeight,
  };
}

/**
 * Calculates exact GST tax split for intra-state (CGST + SGST) or inter-state (IGST).
 * @param {number|string} taxableAmount
 * @param {object} [options]
 * @param {boolean} [options.isInterstate=false]
 * @param {number|string} [options.cgstRate=2.5]
 * @param {number|string} [options.sgstRate=2.5]
 * @param {number|string} [options.igstRate=5]
 * @returns {{ taxableAmount: number, cgstAmount: number, sgstAmount: number, igstAmount: number, totalTax: number }}
 */
export function calculateTaxSplit(taxableAmount, {
  isInterstate = false,
  cgstRate = 2.5,
  sgstRate = 2.5,
  igstRate = 5,
} = {}) {
  const taxable = round2(taxableAmount);

  if (isInterstate) {
    const rate = typeof igstRate === 'number' ? igstRate : parseFloat(igstRate) || 0;
    const igstAmount = round2(taxable * (rate / 100));
    return {
      taxableAmount: taxable,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalTax: igstAmount,
    };
  }

  const cRate = typeof cgstRate === 'number' ? cgstRate : parseFloat(cgstRate) || 0;
  const sRate = typeof sgstRate === 'number' ? sgstRate : parseFloat(sgstRate) || 0;

  const cgstAmount = round2(taxable * (cRate / 100));
  const sgstAmount = round2(taxable * (sRate / 100));
  const totalTax = round2(cgstAmount + sgstAmount);

  return {
    taxableAmount: taxable,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalTax,
  };
}

/**
 * Aggregates complete bill totals: item subtotal, ice charges, tax breakdown, and grand total.
 * @param {object} params
 * @param {Array} [params.items=[]] - Prawn items with quantity and amount
 * @param {object} [params.ice=null] - Optional ice { quantity, rate }
 * @param {number|string} [params.cgstAmount=0]
 * @param {number|string} [params.sgstAmount=0]
 * @param {number|string} [params.igstAmount=0]
 * @returns {{ itemsSubtotal: number, iceAmount: number, subtotal: number, totalTax: number, grandTotal: number, totalWeight: number }}
 */
export function calculateBillTotals({
  items = [],
  ice = null,
  cgstAmount = 0,
  sgstAmount = 0,
  igstAmount = 0,
} = {}) {
  const itemsSubtotal = round2(
    items.reduce((sum, it) => sum + (parseFloat(it?.amount) || 0), 0)
  );

  const iceQty = parseFloat(ice?.quantity) || 0;
  const iceRate = parseFloat(ice?.rate) || 0;
  const hasIce = iceQty > 0 && iceRate > 0;
  const iceAmount = hasIce ? round2(iceQty * iceRate) : 0;

  const subtotal = round2(itemsSubtotal + iceAmount);

  const numCgst = parseFloat(cgstAmount) || 0;
  const numSgst = parseFloat(sgstAmount) || 0;
  const numIgst = parseFloat(igstAmount) || 0;
  const totalTax = round2(numCgst + numSgst + numIgst);

  const grandTotal = round2(subtotal + totalTax);

  const totalWeight = round2(
    items.reduce((sum, it) => sum + (parseFloat(it?.quantity) || 0), 0)
  );

  return {
    itemsSubtotal,
    iceAmount,
    iceQuantityNum: iceQty,
    iceRateNum: iceRate,
    hasIce,
    subtotal,
    totalTax,
    grandTotal,
    totalWeight,
  };
}

/**
 * Validates and restores an offline draft JSON string from localStorage into sanitized form state.
 * Returns null if the draft is empty, corrupt, or has no substantive user entries.
 * @param {string|null} savedDraftJson
 * @returns {object|null}
 */
export function restoreDraft(savedDraftJson) {
  if (!savedDraftJson || typeof savedDraftJson !== 'string') return null;

  try {
    const draft = JSON.parse(savedDraftJson);
    if (!draft || typeof draft !== 'object') return null;

    const hasCompanyName = Boolean(draft.companyName && String(draft.companyName).trim());
    const hasItems = Array.isArray(draft.items) && draft.items.some(
      (it) => it && (parseFloat(it.quantity) > 0 || parseFloat(it.rate) > 0)
    );
    const hasIce = Boolean(draft.ice && (parseFloat(draft.ice.quantity) > 0 || parseFloat(draft.ice.rate) > 0));

    // If draft contains zero actionable user input, disregard it
    if (!hasCompanyName && !hasItems && !hasIce) {
      return null;
    }

    return {
      companyName: String(draft.companyName || '').trim(),
      customerPhone: String(draft.customerPhone || '').replace(/\D/g, '').slice(0, 10),
      vehicleNo: String(draft.vehicleNo || '').trim(),
      date: draft.date || new Date().toISOString().split('T')[0],
      paymentStatus: ['Pending', 'Partial', 'Paid'].includes(draft.paymentStatus) ? draft.paymentStatus : 'Pending',
      cgstRate: String(draft.cgstRate || '0'),
      cgstAmount: String(draft.cgstAmount || '0'),
      sgstRate: String(draft.sgstRate || '0'),
      sgstAmount: String(draft.sgstAmount || '0'),
      igstAmount: String(draft.igstAmount || '0'),
      items: Array.isArray(draft.items) && draft.items.length > 0 ? draft.items.map((it, idx) => ({
        sno: idx + 1,
        count: String(it?.count || '').trim(),
        particulars: String(it?.particulars || 'HEAD-ON').trim() || 'HEAD-ON',
        quantity: it?.quantity !== undefined && it?.quantity !== null ? String(it.quantity) : '',
        rate: it?.rate !== undefined && it?.rate !== null ? String(it.rate) : '',
        taxRate: String(it?.taxRate || '0'),
        amount: calculateItemAmount(it?.quantity, it?.rate),
      })) : [
        { sno: 1, count: '', particulars: 'HEAD-ON', quantity: '', rate: '', taxRate: '0', amount: 0 }
      ],
      ice: {
        quantity: draft.ice?.quantity ? String(draft.ice.quantity) : '',
        rate: draft.ice?.rate ? String(draft.ice.rate) : '',
        taxRate: String(draft.ice?.taxRate || '0'),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Serializes current form state for debounced localStorage draft auto-save.
 * @param {object} formState
 * @returns {string}
 */
export function serializeDraft(formState) {
  if (!formState || typeof formState !== 'object') return '';
  return JSON.stringify({
    companyName: formState.companyName || '',
    customerPhone: formState.customerPhone || '',
    vehicleNo: formState.vehicleNo || '',
    date: formState.date || '',
    paymentStatus: formState.paymentStatus || 'Pending',
    cgstRate: formState.cgstRate || '0',
    cgstAmount: formState.cgstAmount || '0',
    sgstRate: formState.sgstRate || '0',
    sgstAmount: formState.sgstAmount || '0',
    igstAmount: formState.igstAmount || '0',
    items: formState.items || [],
    ice: formState.ice || { quantity: '', rate: '', taxRate: '0' },
    savedAt: new Date().toISOString(),
  });
}
